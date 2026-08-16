# Historical Bug Fixes

---

### Bug ID: BUG-001 — Hardcoded fake CVE-2026-73086 injected into every Red Hat ingestion sync
- **Date**: 2026-08-15, fixed in 1.0.0-dev.1
- **Root Cause**: Code had unconditional hardcoded injection block in `src/adapters/redhat.ts` `fetchAdvisories()` (lines ~61-69) that force-added fabricated CVE record (CVE-2026-73086, RHSA-2026:48758/54412/50287) into every production sync run, indistinguishable from genuine Red Hat data, polluting the live Supabase database.
- **Fix**: Removed the hardcoded injection block from `src/adapters/redhat.ts`. Cleaned polluted live Supabase database (project xgrtyjazyqajqinwzlbl): deleted fake CVE-2026-73086 row (id 65f7576c-c0bd-4f0d-b44b-93c9609e0f17) and RHSA-2026:48758 advisory row (id cf395a71-a923-47b6-b7f1-b84e2748c398) with cascaded `advisory_cve_map` entry. Verified the advisory was not shared with any real CVE before deletion.
- **Status**: ✅ FIXED (1.0.0-dev.1)

### Bug ID: BUG-003 — Duplicate Webhook Alerts on Every Sync
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: HIGH
- **Location**: `src/engine/ingestion.ts:122`
- **Root Cause**: The CRITICAL/HIGH dispatch does not consult `isNew` (computed line 94). Worse, `IngestionEngine` is constructed per sync run, so the in-memory `this.cves` map always starts empty and `isNew` is always true. Every sync re-alerts every CRITICAL/HIGH CVE in the fetched window.
- **Fix**: webhook alerts now gated on "new to this run AND absent from knownCveIds"; IngestionEngine takes knownCveIds, syncVendors supplies already-persisted cve_ids via the paginated fetchAllRows helper; dispatch moved out of the per-CVE loop into a batched Promise.allSettled.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-004 — Single Unresponsive Webhook Stalls Entire Sync
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: HIGH
- **Location**: `src/services/webhook.ts:35`, `src/services/webhook.ts:46`, `src/engine/ingestion.ts:123`
- **Root Cause**: `fetch` has no timeout/AbortController. `notifyAll` awaits each hook sequentially in a for-loop. Ingestion awaits `notifyAll` inside the per-CVE loop. One black-holed webhook URL blocks all later hooks and the whole ingestion, unbounded. Compounded by `catch {}` which swallows every delivery error with no logging.
- **Fix**: dispatch() now uses an AbortController with a 10s timeout cleared in finally; notifyAll dispatches concurrently via Promise.allSettled; the swallowing `catch {}` now logs config.id and platform only, never webhook_url.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-005 — Silent Sync Failure Gives User No Feedback
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: HIGH
- **Location**: `src/App.tsx:72-74`, `src/App.tsx:92-97`
- **Root Cause**: `if (result.success)` has no `else`, so when `syncVendors()` resolves with success=false the UI shows no banner at all and the user believes the sync worked. Same class: `handleAddWebhook` silently does nothing when `createWebhook` returns null.
- **Fix**: syncVendors() now tracks allSucceeded and returns the real result instead of a hardcoded true; App.tsx surfaces a failure message for both a false sync result and a null createWebhook result.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-006 — Optimistic Webhook Delete with No Rollback or Error Handling
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: MEDIUM
- **Location**: `src/App.tsx:99-102`
- **Root Cause**: The row is removed from state before `deleteWebhook(id)` is awaited; there is no try/catch and no rollback, so a failed delete leaves the UI misrepresenting server state until reload.
- **Fix**: handleDeleteWebhook captures the previous list, awaits inside try, restores it and shows an error on failure.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-007 — Backfill Script Can Silently Truncate
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: MEDIUM
- **Location**: `src/scripts/backfillAdvisoryStorage.mjs:29-32`
- **Root Cause**: The select has no `.range()`/pagination and relies on the PostgREST default row cap (1000). If the unmigrated backlog exceeds the cap the script prints a clean summary while leaving rows un-migrated.
- **Fix**: backfill select is paginated with .range() plus a deterministic .order('id'), a zero-progress guard, and per-run distinct-id accounting so the printed totals are true.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-008 — Storage Object Key Escapes Only ':'
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: MEDIUM
- **Location**: `src/supabase/functions/sync-cve/index.ts:87`, `src/scripts/backfillAdvisoryStorage.mjs:54`
- **Root Cause**: Key is built from advisory_id replacing only `:`. Any id containing `/` or `..` would write outside the intended vendor prefix. Both sites are consistent with each other (no split-brain).
- **Fix**: shared sanitiseAdvisoryKey helper in both runtimes; verified byte-identical to the legacy `:`->`_` key for realistic advisory ids so already-stored objects stay reachable, while neutralising `/`, `\` and `..`.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-009 — Edge Function Partial-Commit Leaves Orphaned Storage Objects
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: MEDIUM
- **Location**: `src/supabase/functions/sync-cve/index.ts:86-97`
- **Root Cause**: If the DB upsert fails after a successful upload, the uploaded object is orphaned and earlier advisories in the same request stay committed.
- **Fix**: a failed DB upsert after a successful upload now removes the orphaned object best-effort, without masking or replacing the original error.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-010 — Non-Deterministic Canonical Advisory for Multi-Advisory CVEs
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: MEDIUM
- **Location**: `src/services/cveService.ts:52`
- **Root Cause**: `mappings[0]` picks the displayed advisory_id/url/solution, but the embedded `advisory_cve_map` is selected with no nested `.order()`, so PostgREST gives no ordering guarantee and the displayed advisory can flip between fetches.
- **Fix**: mappings are sorted deterministically by advisory_id before picking the canonical advisory.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-011 — testWebhook Cannot Distinguish "Disabled" from "Broken"
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: MEDIUM
- **Location**: `src/services/webhook.ts:28`
- **Root Cause**: `dispatch` returns false when `is_active` is false without issuing any request, so a "Test" on an inactive webhook reports failure identically to an unreachable URL.
- **Fix**: dispatch() accepts { ignoreActiveState } and testWebhook passes it, so a Test actually probes the URL; the severity floor still applies to normal alert traffic.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-012 — Detail Drawers Persist Across Navigation
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: MEDIUM
- **Location**: `src/App.tsx:213-223`
- **Root Cause**: Both drawers are rendered outside the section switch and `selectedCve`/`selectedAdvisory` are not cleared when `currentNav` changes, so an open drawer stays on top of an unrelated page after using the sidebar.
- **Fix**: selectedCve and selectedAdvisory are cleared when currentNav changes.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-013 — Webhook Form Lacks URL Validation and Delete Confirmation
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: MEDIUM
- **Location**: `src/components/settings/WebhookConfigPanel.tsx:136-145`, `src/components/settings/WebhookConfigPanel.tsx:217-223`
- **Root Cause**: Only HTML `required`, no URL-format check, so any non-empty string is persisted. Trash icon deletes immediately with no confirmation dialog.
- **Fix**: destination URL must parse and be https:, with an inline error; deletion now requires a confirming second click.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-014 — Webhook URL Secret Rendered in Plain DOM Text
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: LOW
- **Location**: `src/components/settings/WebhookConfigPanel.tsx:193-195`
- **Root Cause**: Discord/Slack webhook URLs embed a secret token; the full value is in the DOM, only visually truncated with CSS.
- **Fix**: the webhook URL is masked to origin only — path, query and fragment are replaced, so the secret never reaches the DOM whatever the URL shape.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-015 — Dead Adapter with Ambiguous vendorCode
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: LOW
- **Location**: `src/adapters/redhat.ts:52`, `src/adapters/redhat-csaf.ts:144`
- **Root Cause**: Both declare `vendorCode = 'redhat'`, but only RedHatCsafAdapter is in ALL_ADAPTERS. RedHatAdapter (300 lines) is unreachable; if ever registered, `getAdapterByCode` would silently resolve whichever comes first.
- **Fix**: adapters/index.ts now throws on duplicate vendorCode registration; RedHatAdapter stays exported but unregistered, documented, with 'redhat' still resolving to RedHatCsafAdapter.
- **Status**: ✅ FIXED (2026-08-16)

### Bug ID: BUG-016 — Repo Hygiene: Untracked but Unignored Infra Identifiers
- **Date**: 2026-08-16, fixed 2026-08-16
- **Severity**: LOW
- **Location**: `.gitignore`, `src/.env.example`
- **Root Cause**: `supabase/.temp/` is untracked but NOT gitignored and holds real infra identifiers. Also `src/.env.example` is missing while README documents the required variables.
- **Fix**: supabase/.temp/ added to .gitignore; src/.env.example created with variable names only.
- **Status**: ✅ FIXED (2026-08-16)

### Investigation: Rules-of-Hooks Violation Rejected as False Positive
- **Date**: 2026-08-16, investigated and closed
- **Location**: `src/components/explorer/CveDetailDrawer.tsx:52`
- **Finding**: A reported Rules-of-Hooks violation (early `return null` before useState/useMemo) was investigated. Executed reproduction test showed no throw, because React's renderWithHooks selects the mount dispatcher when `current.memoizedState === null`, so a 0-hook render followed by an N-hook render is treated as a fresh mount. The pattern is still lint-fragile and worth tidying, but it does not crash.
- **Status**: ✅ CLOSED (2026-08-16) — rejected as false positive

## Reviewer Pass Remediations (2026-08-16)
A reviewer pass on the remediation of BUG-003 through BUG-016 found and fixed 4 further defects:
- **(a) BLOCKER**: syncVendors read cve_id with a bare select subject to PostgREST's silent 1000-row cap, now using fetchAllRows.
- **(b) Inflated skipped counts**: re-selecting empty-payload rows in the backfill loop, now de-duplicated per-run.
- **(c) Missing .order()**: the paginated backfill select now includes deterministic `.order('id')`.
- **(d) Secret leakage in maskWebhookUrl**: previously revealed the first path segment, unsafe when the secret IS that segment, now masked to origin only.

New regression tests added:
- `src/tests/unit/services/auditRemediation.test.ts` — webhook timeout/concurrency/secret-logging/ignoreActiveState, and ingestion alert de-duplication.
- `src/tests/unit/services/advisoryStorageKey.test.ts` — storage-key backward compatibility plus a drift guard asserting the Deno and Node copies stay identical.
- `src/tests/unit/components/webhookPanelSecurity.test.tsx` — secret absent from DOM across URL shapes, delete confirmation.
- `src/tests/unit/services/syncServicePersist.test.ts` — protected-table assertion narrowed from "no .from() calls" to "no mutating calls", so the client may read cve_id while still being forbidden to write.

