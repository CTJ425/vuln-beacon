import { VendorAdapter } from '@/types';
import { RedHatAdapter } from './redhat';

export { RedHatAdapter };

export const ALL_ADAPTERS: VendorAdapter[] = [
  new RedHatAdapter(),
];

export function getAdapterByCode(code: string): VendorAdapter | undefined {
  return ALL_ADAPTERS.find((a) => a.vendorCode === code.toLowerCase());
}
