import { CveTableRowItem } from '@/components/explorer/CveTable';
import { VendorSyncLog, WebhookConfig } from '@/types';

// Real empty initial states - live data is fetched dynamically from Supabase
export const INITIAL_CVES: CveTableRowItem[] = [];
export const INITIAL_SYNC_LOGS: VendorSyncLog[] = [];
export const INITIAL_WEBHOOKS: WebhookConfig[] = [];
