// Single entry point bundled (see src/scripts/buildEdgeBundle.mjs) into
// ingest.bundle.js for the Deno Edge Functions. Re-exports only what the
// scheduled-sync function needs — the Edge Function MUST NOT contain a second
// copy of adapter or ingestion logic (TASK-13 D1).

export { IngestionEngine } from '@/engine/ingestion';
export { getAdapterByCode } from '@/adapters';
export { isVendorDue, SCHEDULE_TICK_TOLERANCE_MINUTES } from '@/services/scheduleWindow';
