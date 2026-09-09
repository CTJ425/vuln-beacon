# Spec: Server-Side Manual Threat Feed Sync Trigger

Status: SPEC (ready for implementation)
Created: 2026-09-09 Asia/Taipei
Lane: 2 (Edge Function, ingestion runtime, network topology, admin security)
Reference: `docs/agent/specs/self-host-deployment-topology.md` (Consequence C1, BUG-003)

## 1. Problem Statement

### 1.1 Ingress & Egress Network Asymmetry (C1)
In the current implementation (`src/services/syncService.ts:245-270`), manual sync execution originates from the client browser:
1. The browser directly fetches vendor security APIs (`access.redhat.com`, `portal.nutanix.com`).
2. The browser parses and normalizes the raw payloads via `IngestionEngine`.
3. The browser chunks the normalized datasets into <=3MB payloads (`buildPersistChunks`).
4. The browser posts chunks to the `sync-cve` Edge Function via `action: 'persist_ingestion'`.

Under self-hosted private topology (Cloudflare Access / Tailscale VPN), administrative users frequently operate behind strictly egress-filtered networks where workstation access to external security advisory portals is blocked, but the server hosting the Supabase Edge Runtime has unrestricted outbound internet access. In this topology:
- Scheduled background syncs (`scheduled-sync`) succeed because they run server-side.
- Manual sync clicks in the Admin Console fail with client network/CORS timeouts.

### 1.2 Browser Payload Overhead & Chunk Floor (BUG-003 / BUG-006)
Serializing thousands of advisory and CVE entities into multi-megabyte JSON strings in the browser thread causes tab freezes and risks hitting HTTP payload ceilings on intermediate proxies.

## 2. Architectural Design

```
[ Admin Browser ]
       |
       | POST /functions/v1/sync-cve
       | Body: { action: 'trigger_manual_sync', vendorCodes?: ['redhat', 'nutanix'] }
       | Headers: Authorization: Bearer <Admin User JWT>
       v
[ sync-cve Edge Function ]
       |
       | 1. Validate JWT session (authenticated role required)
       | 2. Acquire advisory lock (pg_try_advisory_xact_lock)
       | 3. Execute IngestionEngine server-side via ingest.bundle.js
       | 4. Batch upsert CVEs, Advisories, Mappings into Postgres
       | 5. Store raw document in advisory-documents storage bucket
       | 6. Dispatch registered Webhooks
       | 7. Commit vendor_sync_logs row
       v
[ Return Execution Summary to Admin Console ]
```

### D1 — Server-Side Ingestion Re-use via `ingest.bundle.js`
`src/supabase/functions/_shared/ingest.bundle.js` already bundles `IngestionEngine`, `RedHatCsafAdapter`, `NutanixAdapter`, `WebhookService`, and normalizers. The server-side execution path in `sync-cve` will directly utilize this bundle, mirroring `scheduled-sync` while offering on-demand execution.

### D2 — Role-Gated Admin Authorization
The manual sync endpoint MUST be restricted to authenticated administrative users.
- Verify JWT using `supabase.auth.getUser(token)`.
- Deny unauthenticated requests with HTTP 401 Unauthorized.

### D3 — Mutual Exclusion & Concurrency Protection
To prevent race conditions between a pg_cron scheduled sync and an administrator clicking manual sync:
- Use PostgreSQL transactional advisory lock (`pg_try_advisory_xact_lock(7425001)`).
- If lock acquisition fails, return HTTP 409 Conflict: `"A threat feed synchronization is already in progress"`.

### D4 — Frontend Invocation Simplification
Update `SyncService.syncVendors(vendorCodes)`:
- If running in online mode, invoke `supabase.functions.invoke('sync-cve', { body: { action: 'trigger_manual_sync', vendorCodes } })`.
- Parse the returned `VendorSyncLog` and update UI state immediately.
- Fallback gracefully to client-side execution if running in offline development/testing environments without Edge Function runtime.

## 3. Implementation Plan

| Phase | Component | Changes |
| ----- | --------- | ------- |
| Phase 1 | `sync-cve/index.ts` | Add `trigger_manual_sync` action handler with JWT auth check and server-side engine execution. |
| Phase 2 | `syncService.ts` | Refactor `syncVendors` to invoke the server-side endpoint when authenticated. |
| Phase 3 | Tests | Unit tests for server-side manual sync action and E2E test verifying end-to-end admin triggering. |

## 4. Verification Record Matrix

1. **Unit Test**: Mock server-side invocation in `syncService.test.ts`.
2. **E2E Test**: Admin clicks "Sync All Feeds Now" -> Edge Function executes server-side -> returns success and updates logs table.
3. **Restricted Egress Simulation**: Ingestion succeeds when client browser has no direct network route to Red Hat or Nutanix.
