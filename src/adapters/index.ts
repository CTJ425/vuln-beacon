import { VendorAdapter } from '@/types';
import { RedHatAdapter } from './redhat';
import { RedHatCsafAdapter } from './redhat-csaf';

export { RedHatAdapter, RedHatCsafAdapter };

export const ALL_ADAPTERS: VendorAdapter[] = [
  new RedHatCsafAdapter(),
];

export function getAdapterByCode(code: string): VendorAdapter | undefined {
  return ALL_ADAPTERS.find((a) => a.vendorCode === code.toLowerCase());
}
