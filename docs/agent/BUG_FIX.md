# Open Bugs

## BUG-001: Webhook Alerting Never Dispatches in Production
- **Status**: OPEN (2026-08-16)
- **Severity**: HIGH (feature completely non-functional in production)
- **Location**: `src/services/webhook.ts` (WebhookService constructor, registerWebhook method, IngestionEngine integration in src/services/syncService.ts)
- **Root Cause**: WebhookService only dispatches to configs added via registerWebhook(). That method is called nowhere in production code — only in `src/tests/e2e/webhook-alert-flow.e2e.test.ts:12`. In production, SyncService constructs an empty WebhookService, hands it to IngestionEngine, and notifyAll() loops over an empty array. Webhooks saved in Settings are never read at dispatch time.
- **Impact**: Webhook alerting is completely non-functional in production. E2E test passes only because it registers a config by hand first.
- **Expected Fix**: Spec written (docs/agent/specs/webhook-admin-and-server-dispatch.md) covering: (1) webhook-admin Edge Function for CRUD operations using service-role key, (2) webhook URLs moved server-side (so anon key can no longer read them), (3) IngestionEngine queries webhook_configs table and dispatches to all configured webhooks at sync completion.
- **Deferral Note**: DEFERRED per user direction to prioritise RHSA-centric core first. Phase B2 (webhook-admin Edge Function) blocked pending this fix.

## BUG-002: affected_products Fallback Hardcodes Product Name (Low-Priority Risk)
- **Status**: OPEN / ACCEPTED RISK (2026-08-16, found during Phase C1+C2 review)
- **Severity**: LOW (no present-day impact; future multi-vendor concern)
- **Location**: `src/services/advisoryService.ts` (AdvisoryService.fetchAdvisories, plain-string affected_products fallback)
- **Description**: In src/services/advisoryService.ts the plain-string affected_products fallback hardcodes product_name as 'Enterprise System', whereas src/services/cveService.ts uses the joined vendor name in the same position. The advisory-first query deliberately omits the vendors join. This creates an inconsistency in product naming between advisory-first and CVE-first views.
- **Impact**: Limited to future multi-vendor datasets where affected_products holds plain strings (objects) rather than already-parsed objects. In current Red Hat-only dataset, object path is used, so no present-day visible difference between the two queries.
- **Recommendation**: Revisit if/when second vendor is ingested and affected_products data model changes. Accept for now as low-priority risk.
