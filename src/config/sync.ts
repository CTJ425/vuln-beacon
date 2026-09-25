// Shared by the browser and, via ingest.bundle.js, the Edge Functions.

// The vendors a sync contacts today. Single source of truth so the UI can
// state sync coverage truthfully and the server default matches it.
export const SYNCED_VENDOR_CODES = ['redhat', 'nutanix', 'ubuntu', 'debian', 'suse', 'cisco', 'vmware'] as const;

// One sync runs at a time across manual and scheduled runs. The lease outlives
// the longest Edge Function wall-clock limit, so a killed run frees it on its own.
export const SYNC_LEASE_NAME = 'vendor-sync';
export const SYNC_LEASE_TTL_SECONDS = 900;
