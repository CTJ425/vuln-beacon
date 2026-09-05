# Progress Log

## 2026-09-05 09:07:00 Asia/Taipei - Resolved Supabase Edge Function 401 Auth, Context Error Surfacing & Cloud Sync
- **Resolved Supabase Edge Function 401 Authentication & Error Surfacing Defect**:
  - **`sync-cve` Edge Function Auth**:
    - Updated authentication in `src/supabase/functions/sync-cve/index.ts` to accept either `Authorization: Bearer <token>` OR `apikey: <key>` header, validating non-empty tokens.
    - Resolves 401 Unauthorized errors caused by Supabase JS SDK stripping bearer tokens when using `sb_publishable_...` keys (`omitApiKeyAsBearer: true`).
  - **Client Function Invocation Headers**:
    - Implemented `getFunctionHeaders()` in `src/lib/functionAuth.ts` to explicitly provide `Authorization: Bearer <token>` and `apikey` headers.
    - Updated all client services (`syncService.ts`, `webhookConfigService.ts`, `vendorService.ts`) to pass headers when calling `supabase.functions.invoke('sync-cve')`.
  - **Underlying Error Extraction**:
    - Added `extractErrorMessage()` in `syncService.ts` to parse JSON body from `err.context.json()` (or `.clone().json()`) on `FunctionsHttpError`, surfacing actual root cause error messages to users rather than generic fallback strings.
  - **Scheduled Sync Edge Function Syntax Fix**:
    - Restored missing `try {` in `src/supabase/functions/scheduled-sync/index.ts` vendor loop that caused Deno bundle parse errors.
  - **Supabase Cloud Sync & Deployment**:
    - Linked `vuln-beacon-dev` (`egofadbvftmbwodjneoy`) using user-provided access token.
    - Pushed database migrations (`20260815000000` through `20260905000000`) via `supabase db push`.
    - Deployed `sync-cve` and `scheduled-sync` edge functions to remote cloud runtime; verified live CORS and auth responses.
- **Verification**: All 53 test files (297 tests) passed 100%; `npm --prefix src run build` passed cleanly with zero type errors.

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

