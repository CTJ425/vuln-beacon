import { Advisory, AdvisoryCveMap, CveRecord } from '@/types';

// Writes one ingestion run with a service-role client. Shared by sync-cve
// (manual sync and browser-supplied chunks) and scheduled-sync through
// ingest.bundle.js, so all three write paths merge CVEs the same way.

export const ADVISORY_BUCKET = 'advisory-documents';

const DB_BATCH_SIZE = 1000;
const MAX_RAW_PAYLOAD_BYTES = 5 * 1024 * 1024;
const CVE_ID_REGEX = /^CVE-\d{4}-\d{4,}$/i;

// BUG-008: keeps the storage key byte-identical to what already-stored
// objects use (`advisory_id.replace(/:/g, '_')`) for every id made only of
// [A-Za-z0-9._:-]; only path separators and '..' are neutralised. A copy
// lives in src/scripts/backfillAdvisoryStorage.mjs (separate Node runtime) —
// keep both in sync.
export function sanitiseAdvisoryKey(advisoryId: unknown): string {
  return String(advisoryId)
    .replace(/:/g, '_')
    .replace(/\.\./g, '_')
    .replace(/[\\/]/g, '_');
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface PersistIngestionInput {
  vendorId: string;
  vendorCode: string;
  advisories: Advisory[];
  cves: CveRecord[];
  mappings: AdvisoryCveMap[];
}

export async function persistIngestion(client: any, input: PersistIngestionInput): Promise<void> {
  const { vendorId, vendorCode } = input;

  // CVEs go through upsert_cves, which merges instead of overwriting: a vendor
  // that has no score or description for a CVE must not erase the one another
  // vendor already stored.
  const uniqueCves = Array.from(
    new Map(
      (input.cves || [])
        .filter((c) => c?.cve_id && CVE_ID_REGEX.test(c.cve_id))
        .map((c) => [c.cve_id, c] as const)
    ).values()
  );
  const localCveIdByCveId = new Map(uniqueCves.map((c) => [c.cve_id, c.id]));
  const cveIdMap = new Map<string, string>();
  for (const batch of chunk(uniqueCves, DB_BATCH_SIZE)) {
    const { data, error } = await client.rpc('upsert_cves', {
      p_rows: batch.map((c) => ({
        cve_id: c.cve_id,
        description: c.description ?? null,
        description_fallback: c.description_fallback ?? null,
        cvss_v3_score: c.cvss_v3_score ?? null,
        cvss_v3_vector: c.cvss_v3_vector ?? null,
        severity: c.severity ?? null,
        is_known_exploited: !!c.is_known_exploited,
        published_date: c.published_date ?? null,
      })),
    });
    if (error) throw error;
    for (const row of data || []) {
      const localId = localCveIdByCveId.get(row.cve_id);
      if (localId) cveIdMap.set(localId, row.id);
    }
  }

  // Uploads happen per batch, immediately before that batch's upsert, so a
  // failed upsert only orphans objects of the batch it removes again. A
  // storage failure for one advisory leaves its path null instead of
  // aborting the run.
  const uniqueAdvisories = Array.from(
    new Map((input.advisories || []).map((a) => [a.advisory_id, a] as const)).values()
  );
  const advisoryIdMap = new Map<string, string>();
  for (const batch of chunk(uniqueAdvisories, DB_BATCH_SIZE)) {
    const rawPayloadPaths = new Map<string, string>();
    for (const adv of batch) {
      if (!adv.raw_payload || Object.keys(adv.raw_payload).length === 0) continue;
      const payload = JSON.stringify(adv.raw_payload);
      if (new TextEncoder().encode(payload).length > MAX_RAW_PAYLOAD_BYTES) {
        console.error(`Raw payload for advisory ${adv.advisory_id} (vendor ${vendorCode}) exceeds 5MB; not stored`);
        continue;
      }
      const path = `${vendorCode}/${sanitiseAdvisoryKey(adv.advisory_id)}.json`;
      try {
        const { error: uploadError } = await client.storage
          .from(ADVISORY_BUCKET)
          .upload(path, payload, { contentType: 'application/json', upsert: true });
        if (uploadError) throw uploadError;
        rawPayloadPaths.set(adv.advisory_id, path);
      } catch (uploadErr) {
        console.error(`Failed to upload raw payload for advisory ${adv.advisory_id} (vendor ${vendorCode}):`, uploadErr);
      }
    }

    const { data, error } = await client
      .from('advisories')
      .upsert(
        batch.map((adv) => ({
          vendor_id: vendorId,
          advisory_id: adv.advisory_id,
          title: adv.title,
          severity: adv.severity,
          published_at: adv.published_at,
          url: adv.url,
          summary: adv.summary,
          raw_payload: {},
          raw_payload_path: rawPayloadPaths.get(adv.advisory_id) ?? null,
        })),
        { onConflict: 'vendor_id, advisory_id' }
      )
      .select('id, advisory_id');

    if (error) {
      // BUG-009: the upsert failed after this batch's payloads were uploaded.
      // Best-effort cleanup; never let it mask the original error.
      const paths = Array.from(rawPayloadPaths.values());
      if (paths.length > 0) {
        try {
          await client.storage.from(ADVISORY_BUCKET).remove(paths);
        } catch {
          // best-effort only
        }
      }
      throw error;
    }
    for (const row of data || []) {
      const original = batch.find((a) => a.advisory_id === row.advisory_id);
      if (original) advisoryIdMap.set(original.id, row.id);
    }
  }

  const merged = new Map<string, { advisory_id: string; cve_id: string; affected_products: unknown[]; fixed_versions: string[] }>();
  for (const m of input.mappings || []) {
    const advisoryId = advisoryIdMap.get(m.advisory_id);
    const cveId = cveIdMap.get(m.cve_id);
    if (!advisoryId || !cveId) continue;
    const products: unknown[] = m.product_impacts && m.product_impacts.length > 0 ? m.product_impacts : m.affected_products || [];
    const key = `${advisoryId}:${cveId}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { advisory_id: advisoryId, cve_id: cveId, affected_products: products, fixed_versions: m.fixed_versions || [] });
    } else {
      existing.affected_products = Array.from(new Set([...existing.affected_products, ...products]));
      existing.fixed_versions = Array.from(new Set([...existing.fixed_versions, ...(m.fixed_versions || [])]));
    }
  }
  for (const batch of chunk(Array.from(merged.values()), DB_BATCH_SIZE)) {
    const { error } = await client.from('advisory_cve_map').upsert(batch, { onConflict: 'advisory_id, cve_id' });
    if (error) throw error;
  }
}
