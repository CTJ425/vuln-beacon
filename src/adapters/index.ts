import { VendorAdapter } from '@/types';
import { RedHatAdapter } from './redhat';
import { RedHatCsafAdapter } from './redhat-csaf';

export { RedHatAdapter, RedHatCsafAdapter };

// RedHatAdapter (legacy cve.json based adapter) also declares vendorCode
// 'redhat', but it is intentionally NOT registered here: RedHatCsafAdapter is
// the adapter that must resolve for 'redhat' (SyncService.fetchAndIngestQuery
// feeds it CSAF documents). RedHatAdapter stays exported, unregistered, for
// any caller that wants to construct it explicitly.
export const ALL_ADAPTERS: VendorAdapter[] = [
  new RedHatCsafAdapter(),
];

// Guard against silently-ambiguous vendorCode resolution: if a future change
// registers two adapters with the same vendorCode, fail loudly instead of
// resolving to "whichever one appears first by luck" (BUG-015).
const seenVendorCodes = new Set<string>();
for (const adapter of ALL_ADAPTERS) {
  if (seenVendorCodes.has(adapter.vendorCode)) {
    throw new Error(`Duplicate vendorCode registration in ALL_ADAPTERS: '${adapter.vendorCode}'`);
  }
  seenVendorCodes.add(adapter.vendorCode);
}

export function getAdapterByCode(code: string): VendorAdapter | undefined {
  return ALL_ADAPTERS.find((a) => a.vendorCode === code.toLowerCase());
}
