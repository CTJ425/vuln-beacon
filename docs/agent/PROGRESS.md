# Progress Log

## 2026-09-05 00:23:00 Asia/Taipei - Resolved 16 Codebase Risks Across Security, Webhooks, Pipeline & Ingestion
- **Resolved all 16 audit findings and open defects**:
  - **P0 Security Hardening**:
    - Guarded `sync-cve` Edge Function with `Authorization: Bearer` authentication, CVE ID format validation, and 5MB storage payload protection.
    - Restricted `public.webhook_configs` RLS: anonymous clients may only SELECT; INSERT/UPDATE/DELETE restricted to authenticated and service_role. Added `create_webhook` and `delete_webhook` service-role handlers to `sync-cve`.
    - Implemented SSRF validator `isSafeDestinationUrl` blocking localhost, IPv4/IPv6 private ranges, and cloud metadata (169.254.169.254) across `WebhookService`, `sync-cve`, and `WebhookConfigPanel`.
    - Revoked public/anon execution on `tick_scheduled_syncs()`, granted to service_role only. Added transaction-level advisory lock (`pg_try_advisory_xact_lock`) to prevent concurrent tick executions.
  - **P1 Webhook & Integration**:
    - Added Telegram `chat_id` parsing and payload delivery; implemented HTML escaping (`&`, `<`, `>`) and 4000-char length truncation in `formatTelegramAlert`.
    - Added server-side webhook testing/dispatching in `sync-cve` to bypass browser-native Slack CORS blocking.
    - Added character truncation guards to Slack and Discord formatters (Slack 2500 chars, Discord 3500/1000 chars).
    - Added `loadWebhooks()` and passed `webhookService` in `fetchAndIngestQuery` so on-demand queries raise alerts.
  - **P1/P2 DevOps & Pipeline**:
    - Connected `build:edge` into `package.json` `"build"` script (`npm run build:edge && tsc && vite build`) to eliminate Edge Function bundle drift.
    - Added diagnostic error logging in `tick_scheduled_syncs()` when vault secrets are missing.
  - **P2 Ingestion & Operational Reliability**:
    - Updated `fetchAndIngestQuery` to persist records via bounded chunks using `buildPersistChunks`.
    - Added batching concurrency control (limit of 5) to `RedHatCsafAdapter.fetchAdvisories` to prevent memory exhaustion and timeouts.
    - Updated `scheduled-sync` to only update vendor `last_scheduled_run_at` on successful ingestion, allowing transient failures to retry within the tolerance window. Added `failed` vendor tracking.
  - **Client Performance & Data Integrity**:
    - Fixed BUG-002: updated `advisoryService.ts` string fallback to use `row.vendors?.name`.
    - Fixed BUG-007: added `.range()` to select mock in `syncServicePersist.test.ts`.
    - Disabled schedule controls in `ScheduleSettings.tsx` for unimplemented vendor adapters (`isAdapterImplemented`).
- **Verification**: All 52 test files (279 tests) passed 100%; `npm --prefix src run build` passed cleanly.

## 2026-08-31 10:40:00 Asia/Taipei - Supabase Cloud deployment & BUG-018 resolved
- **Supabase Cloud migration and function deployment complete**: Project linked to Supabase Cloud instance (`vuln-beacon-dev` / `kxtzxtxpsywhvfisarye`).
- **BUG-018 fixed**: Resolved PostgreSQL 15+ syntax error in `20260828000000_vendor_schedule.sql` where `CHECK` constraint attempted to use a subquery (`SELECT 1 FROM unnest(schedule_times)...`). Replaced with `IMMUTABLE` function `public.validate_schedule_times(TEXT[])`.
- **Database & Storage deployed**: All 4 migrations (`20260815000000_init_cve_collector.sql`, `20260816000000_restrict_write_rls.sql`, `20260816010000_advisory_storage.sql`, `20260828000000_vendor_schedule.sql`) successfully pushed via `supabase db push`. Verified `vendors` (all 8 seed rows), tables, indexes, RLS, and `advisory-documents` public storage bucket.
- **Edge Functions deployed**: Deployed `sync-cve` and `scheduled-sync` to Supabase Cloud runtime via `supabase functions deploy`. Verified `sync-cve` CORS OPTIONS returns HTTP 200 `ok`.
- **Verification**: `npm run build` clean; `supabase migration list` confirms all migrations in sync with remote; `curl` verification on PostgREST `vendors` endpoint and Storage bucket endpoint confirmed healthy.
