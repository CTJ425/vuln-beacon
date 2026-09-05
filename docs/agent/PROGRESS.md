# Progress Log

## 2026-09-05 09:17:00 Asia/Taipei - Adversarial Review Fixes: Chunking Timeout Optimization & Auth Robustness
- **Fixed critical defect and robustness gaps identified during adversarial review**:
  - **O(N) Incremental Chunk Byte Calculation in `syncService.ts`**:
    - Replaced O(N^2) repeated `JSON.stringify` / `TextEncoder().encode()` of candidate chunks with incremental byte counting and WeakMap item size caching in `buildPersistChunks`.
    - Eliminated Vitest 5000ms test timeouts where `tests/unit/services/syncServiceChunking.test.ts` previously timed out and failed 5 tests.
  - **Auth Header Robustness in `functionAuth.ts` and `sync-cve`**:
    - Avoided emitting malformed `Authorization: Bearer ` header when token/key is absent in `getFunctionHeaders()`.
    - Added support for case-insensitive `bearer ` prefix in `sync-cve` edge function authentication handler.
  - **Nested Error Object Extraction in `extractErrorMessage()`**:
    - Supported nested `errorBody.error.message` structures in `extractErrorMessage()`.
  - **Test Suite Completeness**:
    - Added test coverage for empty token handling, nested error objects, and lowercase bearer authorization.
    - Added `.order()` and `.range()` mock chaining to avoid noisy console warnings in unit tests.
- **Verification**: Full test suite (`npm --prefix src test`) passes 100% (53 files, 300 tests); `npm --prefix src run build` passes cleanly.

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

