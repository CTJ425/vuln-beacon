# Progress Log

## 2026-09-05 00:36:00 Asia/Taipei - Fixed Audit Remediation Bugs & Hardened Webhook/Sync Systems
- **Fixed critical issues identified during adversarial review of prior remediation attempt**:
  - **Database Migration Fixes**:
    - Corrected column names in `tick_scheduled_syncs()` diagnostic logging (`sync_status` -> `status`, `sync_duration_ms` -> `duration_ms`, plus `vendor_code`), eliminating fatal PostgreSQL execution errors.
    - Fixed RLS policy dropping in `20260905000000_security_and_reliability_fixes.sql` to explicitly drop the actual `Allow write access to webhook_configs` policy (which was previously active, leaving write access open to anonymous users).
  - **Scheduled Sync Retry & Failure Tracking**:
    - Added error throw on `result.status === 'FAILED'` in `scheduled-sync/index.ts` so failed runs route into the catch block, populate the `failed` array, and do not update `last_scheduled_run_at`, allowing retry within the schedule window.
  - **Webhook Formatter & Proxy Fixes**:
    - Added pre-formatted payload transmission in `WebhookConfigService.testWebhook` to prevent Slack/Discord/Telegram from rejecting unformatted raw alert objects with HTTP 400.
    - Implemented platform-appropriate fallback payload generation in `sync-cve` `test_webhook` action.
    - Added top-level `text` field to `formatSlackAlert` for notifications compatibility.
    - Added HTML quote escaping and safe URL href formatting in `formatTelegramAlert`.
  - **SSRF Hardening**:
    - Expanded `isSafeDestinationUrl` across client and Edge Function to block RFC 4193 IPv6 ULA (`fc00::/7`), RFC 4291 link-local (`fe80::/10`), IPv4-mapped IPv6 (`::ffff:`), and CGNAT/broadcast IPv4 ranges.
  - **Client Concurrency & Data Integrity**:
    - Bounded `fetchAndIngestQuery` advisory fetches to batches of 5 concurrent requests (`BATCH_SIZE = 5`).
    - Fixed PostgREST joined array fallback in `advisoryService.ts` to use normalized `vendor?.name`.
- **Verification**: All 52 test files (283 tests) passed 100%; `build:edge` + `tsc` + `vite build` completed cleanly.

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
