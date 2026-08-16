# Progress Log

## 2026-08-16 23:01:20 Asia/Taipei - audit findings remediated and verified
- Completed **remediation of all 14 audit findings** (BUG-003 through BUG-016, plus 1 investigation entry, all moved to `docs/agent/FIXED_BUG.md`). All entries include detailed resolution summaries.
- Remediation pass: A reviewer identified and fixed 4 further defects in the remediation itself (BLOCKER on syncVendors cve_id select, inflated skipped counts, missing order on backfill select, secret leakage in maskWebhookUrl).
- Regression tests added: `auditRemediation.test.ts` (webhook timeout/concurrency/secret-logging/ignoreActiveState, alert de-duplication), `advisoryStorageKey.test.ts` (backward compatibility + drift guard for Deno/Node copies), `webhookPanelSecurity.test.tsx` (secret absent from DOM, delete confirmation), `syncServicePersist.test.ts` (narrowed protected-table assertion to "no mutating calls").
- Verification: **132 → 159 tests** (36 files); `npm --prefix src run build` success; `npx tsc --noEmit` clean.
- All open bugs now FIXED. BUG-001 (webhook server-side dispatch, deferred) and BUG-002 (accepted risk) remain OPEN per scope.

## 2026-08-16 22:25:59 Asia/Taipei - read-only code audit completed
- Completed **read-only code audit** (baseline green: 132 tests pass, `tsc --noEmit` clean).
- Findings: 14 OPEN bugs recorded in `docs/agent/BUG_FIX.md` (ranked HIGH/MEDIUM/LOW, independent verification by main session, no code changed). (3 HIGH: duplicate webhook alerts, sync stalling on unresponsive webhook, silent sync failure. 8 MEDIUM: optimistic delete, silent truncation, key escaping, partial commit, non-deterministic advisory, webhook test ambiguity, drawer persistence, form validation. 3 LOW: secret in DOM, dead adapter, repo hygiene).
- Investigation: Rules-of-Hooks violation at src/components/explorer/CveDetailDrawer.tsx:52 was investigated and REJECTED as false positive. No throw on re-hook after 0-hook render (React treats it as fresh mount).
- No code changed. All files read-only.
