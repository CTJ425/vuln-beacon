# Version Model Research (redesign phase 2 input)

2026-10-08 Asia/Taipei. Read-only investigation of whether "our products" can be matched by product + exact version. No code changed.

## Conclusion

Feasible for 5 of 7 vendors. Debian, Ubuntu, SUSE and Red Hat feeds carry exact fixed package versions; Cisco lists affected versions explicitly; Nutanix has loose free text; VMware has nothing structured. Most version data is discarded today or stored as free text in the wrong fields (`justification`, `fixed_versions`), so it must be re-extracted.

Recommendation: ship phase 2 with product-level matching (vendor + product + release stream), then add version matching per vendor: Debian/Ubuntu → SUSE → Red Hat → Cisco → Nutanix → VMware (likely manual entry).

Scoping fact: for Linux distros "our version" is an installed package version, not an OS point release. "RHEL 9.4" alone cannot say fixed/not fixed; feeds publish fixed package versions per release stream. Distro entries need optional `package` + `installed_version`.

## Storage today

- `advisory_cve_map.affected_products` JSONB (`supabase/migrations/20260815000000_init_cve_collector.sql:50`) holds `ProductImpactItem` or plain strings (`engine/persistIngestion.ts:145`). `fixed_versions` (`:51`) is a free-string JSONB array merged across the advisory (`persistIngestion.ts:149-152`). No typed version, scheme or range.
- `UpdatedPackageItem.version` (`types/index.ts:74-81`) is filled only by the legacy Red Hat adapter (`adapters/redhat.ts:191`) and never persisted.
- Raw payloads in bucket `advisory-documents` (`persistIngestion.ts:91-97`): Red Hat stores only `{csaf_document_id, cve_ids}` (`adapters/redhat-csaf.ts:339-342`) so backfill means refetching; Debian stores a re-parsed object (`adapters/debian.ts:202-213`); Nutanix, Ubuntu, SUSE, Cisco store the full document; VMware only the list row.
- `ALL_ADAPTERS` registers `RedHatCsafAdapter`, not legacy `RedHatAdapter` (`adapters/index.ts:22-35`).

## Per vendor

| Vendor | Raw feed version data | Kept / discarded | Comparison | Effort |
| ---- | ---- | ---- | ---- | ---- |
| Red Hat CSAF | product IDs `<stream>:<NEVRA>`, `product_status`, `remediations`; CPE/purl in live docs (unverified, fixture strips them) | keeps stream display name, package, state; drops EVR (`redhat-csaf.ts:136-149`), minor/EUS stream, CPE, purl, arch; `fixed_versions` is "Released in RHSA-…" (`:317`) | rpm EVR per stream; "affected, no fix" only in per-CVE VEX (not fetched) | 3–4 d + refetch backfill |
| SUSE CSAF | `<product>:<NVRA>`, `product_status.recommended`, remediations | full package string in `justification` / `fixed_versions` (`suse.ts:238,244`); state hard-coded Fixed; drops split, CPEs, status | rpm vercmp per product/SP; module names need mapping to OS release | ~2 d |
| Ubuntu USN | `release_packages[codename][] = {name, version, is_source}`, `releases[]` codename→version | fixed version in `justification` (`ubuntu.ts:161`); flat `fixed_versions` loses per-release mapping (`:153`) | dpkg; `~esm` needs Ubuntu Pro; needed/not-affected only in CVE JSON (not fetched) | ~1.5 d (+1 d CVE statuses) |
| Debian | DSA lines `[trixie] - pkg ver`; tracker `releases[rel].{status, fixed_version, urgency}` | per-release fixed version in `justification` (`debian.ts:178,289,372`); drops codename→number, "0 = never vulnerable" | dpkg | 1.5–2 d |
| Cisco CSAF | family > `product_version` > `service_pack` leaves; `known_affected` explicit list; no first-fixed release | leaf names only as `affected_products`; no `productImpacts` (`cisco.ts:252-261`) | exact-set membership; IOS trains not orderable; "fixed" needs Software Checker / openVuln API | 2–3 d |
| Nutanix | free text `affected_version` ("All versions prior to 7.5.1.12"), `fixedRelease`, wildcard `cpe` | range text in `justification`, fixed in `errata` / `fixed_versions` (`nutanix.ts:141-152`); state always Affected | dotted numeric per product train; LTS/STS ambiguity; one fixture only | 2–3 d |
| VMware / Broadcom | list API: truncated `supportProducts`, no versions; NVD `affected[]` inconsistent; real data in HTML VMSA response matrix | nothing kept beyond CVSS + description (`vmware.ts:223-230`) | build number is the only reliable order | 5–8 d scrape (fragile) — prefer manual entry |

## Proposed model (OSV-style)

`tracked_products` (shared list; admin writes, all read): `id, vendor_code, product_key (rhel|ubuntu|sles|vcenter|aos|roomos…), stream (9.4-eus|22.04|15-sp7|8.0), package?, installed_version?, arch?, display_name, notes, created_by, updated_at`.

`advisory_affected_versions` (per advisory × CVE × product/stream × package, written at ingestion): `advisory_id, cve_id, vendor_code, product_key, stream, package, status (fixed|affected|not_affected|under_investigation), version_scheme (dpkg|rpm|enum|dotted|vmware_build), introduced, fixed, last_affected, affected_exact text[], source_product_id, cpe, purl, confidence (parsed|inferred|manual)`; index on `(vendor_code, product_key, stream, package)`.

Comparators in TypeScript (Postgres has no dpkg/rpm compare), shared by ingestion and UI, TDD against vendor tooling vectors: dpkg, rpm EVR, exact set, dotted numeric, build/manual.

Effort: shared groundwork ~5 d; per vendor ~17–24 d total; each vendor ships independently and falls back to product-level matching until then.

## Risks / unverified

- Main risk: per-vendor name mapping to `product_key` + `stream` (codename↔number, CSAF stream IDs↔"RHEL 9.4 EUS", SUSE module↔SLES SP); drifts as vendors add products; needs an "unmapped" report.
- Unverified: CPE/purl in live Red Hat/SUSE CSAF; `<not-affected>` lines in live Debian DSA list; Nutanix field variability; whether VMSA page is server-rendered.
- Possible shortcut (unverified): OSV.dev publishes Debian, Ubuntu, SUSE and Red Hat records with ecosystem ranges; spike before writing four parsers.

## Existing bugs found (not fixed; log separately)

- Cisco `fixed_versions` holds affected versions (`cisco.ts:242-248`).
- Debian annotation lines (`<not-affected>`, `<no-dsa>`) would be captured as versions and marked Fixed (`debian.ts:177,248-254`).
- Debian tracker falls back to `repositories[rel]` (current version) as fixed version (`debian.ts:365`); any non-`resolved` status becomes Affected (`:360`).
- Ubuntu `fixed_versions` loses which release each version belongs to (`ubuntu.ts:153`).
- Red Hat drops EVR (`redhat-csaf.ts:146-148`) and does not store the raw document (`:339-342`).
- SUSE `componentFromPackageName` mis-splits names like `java-11-openjdk-…` into `java` (`suse.ts:30-35`).
