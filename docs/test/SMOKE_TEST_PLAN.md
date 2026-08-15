# Smoke Test Plan

## 1. Objectives

Smoke testing provides rapid, high-level sanity verification to ensure that critical application paths, compilation targets, database schemas, and external contracts are healthy before deployment or merging.

Smoke tests run automatically on every build and CI pipeline step.

---

## 2. Smoke Test Matrix

| Test Case ID | Target | Verification Check | Expected Result |
| :--- | :--- | :--- | :--- |
| `SMK-01` | **Frontend Production Build** | Run Vite build bundle | Bundle compiles with 0 errors and generates valid assets in `dist/` |
| `SMK-02` | **Supabase Database Schema Integrity** | Verify SQL syntax and migration table/column constraints | Migration scripts parse valid PostgreSQL DDL with RLS policies intact |
| `SMK-03` | **Vendor Adapters Registration** | Verify all 8 adapters are instantiated and export standardized interfaces | All 8 vendor adapters implement `VendorAdapter` interface with `vendorCode` and `fetchAdvisories` method |
| `SMK-04` | **Webhook Dispatcher Entrypoint** | Verify dispatcher routing for Discord, Telegram, and Slack | Webhook dispatcher accepts normalized alert payload and maps to correct channel client |
| `SMK-05` | **Environment & Config Integrity** | Check default config constants and environment fallbacks | Supabase URL, Anon Key, and scheduling constants parse properly |

---

## 3. Implementation Details

Smoke tests are located in `tests/smoke/`:

- `tests/smoke/build.smoke.test.ts`: Validates module imports, tree-shaking, and export declarations.
- `tests/smoke/schema.smoke.test.ts`: Validates SQL migration file syntax, table definitions (`vendors`, `advisories`, `cves`, `advisory_cve_map`, `cve_triage`, `vendor_sync_logs`, `webhook_configs`), and RLS policies.
- `tests/smoke/adapters.smoke.test.ts`: Instantiates all 8 adapters and ensures they adhere to the interface contracts.
- `tests/smoke/webhook.smoke.test.ts`: Validates payload schema against platform webhook specifications.

---

## 4. Execution Command

```bash
npm run test:smoke
```
Smoke tests should execute in under 10 seconds.
