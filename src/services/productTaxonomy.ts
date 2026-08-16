import { AdvisoryRowItem } from '@/services/advisoryService';
import { VENDOR_NAMES } from '@/components/common/VendorIcon';

const DEFAULT_TOP_N = 10;

const VERSION_PARENS_RE = /\s*\(\s*v\.?\s*[\d.]+\s*\)\s*$/i;
// Single leading digit (optionally followed by .N decimal segments) so a
// genuine release version ("... 9", "... 9.2") strips, while an opaque
// multi-digit label ("Family 01") does not get mistaken for one.
const VERSION_NUMBER_RE = /\s+\d+(\.\d+)*$/;
const CHANNEL_TOKENS = [
  'AppStream',
  'BaseOS',
  'CRB',
  'CodeReady Linux Builder',
  'Supplementary',
  'Extras',
  'Optional',
  'Server',
  'Workstation',
  'Client',
  'Desktop',
];
// Longest token first so multi-word tokens (e.g. "CodeReady Linux Builder")
// are stripped before a shorter overlapping token could match. The token may
// be the entire string (matched from the start) or a trailing word preceded
// by whitespace — either way, stripping it can leave an empty result.
const CHANNEL_TOKEN_RE = new RegExp(
  `(?:^|\\s)(?:${CHANNEL_TOKENS.slice()
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})$`,
  'i',
);

export function normalizeProductFamily(productName: string): string {
  const original = productName.trim();
  let current = original;

  while (true) {
    let next = current.replace(VERSION_PARENS_RE, '');
    next = next.replace(CHANNEL_TOKEN_RE, '');
    next = next.replace(VERSION_NUMBER_RE, '');
    next = next.replace(/\s+/g, ' ').trim();

    if (next === current) break;
    current = next;
  }

  return current === '' ? original : current;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface ProductFamilyNode {
  id: string;
  name: string;
  advisoryCount: number;
  isOverflow?: boolean;
  memberFamilyIds?: string[];
}

export interface VendorNode {
  vendorId: string;
  vendorName: string;
  advisoryCount: number;
  criticalCount: number;
  products: ProductFamilyNode[];
}

export function deriveTaxonomy(
  advisories: AdvisoryRowItem[],
  topN: number = DEFAULT_TOP_N
): VendorNode[] {
  interface VendorAccumulator {
    vendorId: string;
    advisoryCount: number;
    criticalCount: number;
    families: Map<string, { name: string; advisoryCount: number }>;
  }

  const vendors = new Map<string, VendorAccumulator>();

  for (const advisory of advisories) {
    const vendorId = advisory.vendor_id;
    let vendor = vendors.get(vendorId);
    if (!vendor) {
      vendor = { vendorId, advisoryCount: 0, criticalCount: 0, families: new Map() };
      vendors.set(vendorId, vendor);
    }

    vendor.advisoryCount += 1;
    if (advisory.severity === 'CRITICAL') {
      vendor.criticalCount += 1;
    }

    const familyNames = new Set(
      (advisory.affected_products || []).map((name) => normalizeProductFamily(name))
    );
    for (const familyName of familyNames) {
      const familyId = slugify(familyName);
      const existing = vendor.families.get(familyId);
      if (existing) {
        existing.advisoryCount += 1;
      } else {
        vendor.families.set(familyId, { name: familyName, advisoryCount: 1 });
      }
    }
  }

  const vendorNodes: VendorNode[] = Array.from(vendors.values()).map((vendor) => {
    const sortedFamilies = Array.from(vendor.families.entries())
      .map(([id, value]) => ({ id, name: value.name, advisoryCount: value.advisoryCount }))
      .sort((a, b) => b.advisoryCount - a.advisoryCount || a.name.localeCompare(b.name));

    const kept = sortedFamilies.slice(0, topN);
    const overflow = sortedFamilies.slice(topN);

    const products: ProductFamilyNode[] = kept.map((f) => ({
      id: f.id,
      name: f.name,
      advisoryCount: f.advisoryCount,
    }));

    if (overflow.length > 0) {
      products.push({
        id: 'other',
        name: 'Other products',
        advisoryCount: overflow.reduce((sum, f) => sum + f.advisoryCount, 0),
        isOverflow: true,
        memberFamilyIds: overflow.map((f) => f.id),
      });
    }

    return {
      vendorId: vendor.vendorId,
      vendorName: VENDOR_NAMES[vendor.vendorId] ?? vendor.vendorId,
      advisoryCount: vendor.advisoryCount,
      criticalCount: vendor.criticalCount,
      products,
    };
  });

  vendorNodes.sort((a, b) => b.advisoryCount - a.advisoryCount);

  return vendorNodes;
}

export function matchesProductFamily(
  advisory: AdvisoryRowItem,
  familyId: string,
  taxonomy: VendorNode[]
): boolean {
  const familyIds = new Set(
    (advisory.affected_products || []).map((name) => slugify(normalizeProductFamily(name)))
  );

  if (familyId === 'other') {
    const vendor = taxonomy.find((v) => v.vendorId === advisory.vendor_id);
    const otherNode = vendor?.products.find((p) => p.id === 'other');
    if (!otherNode?.memberFamilyIds) return false;
    return otherNode.memberFamilyIds.some((id) => familyIds.has(id));
  }

  return familyIds.has(familyId);
}
