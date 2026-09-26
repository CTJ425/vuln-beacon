# System Specifications

Describes the system as built (1.3.0). Feature-level designs live in `docs/agent/specs/`.

## 1. Functional Specifications

### 1.1 Multi-Vendor Advisory Ingestion
* Implemented adapters (`src/adapters/`), listed in `SYNCED_VENDOR_CODES` (`src/config/sync.ts`):

  | Code | Source | Advisory ids |
  | ---- | ---- | ---- |
  | `redhat` | Red Hat Security Data API, CSAF documents | `RHSA-*`, `RHBA-*`, `RHEA-*` |
  | `nutanix` | Nutanix security advisories | `NXSA-*` |
  | `ubuntu` | Ubuntu Security Notices | `USN-*`, `LSN-*` |
  | `debian` | Debian security advisories and Security Tracker | `DSA-*`, `DLA-*` |
  | `suse` | SUSE CSAF 2.0 | `SUSE-SU-*`, `openSUSE-*` |
  | `cisco` | Cisco CSAF | `cisco-sa-*` |
  | `vmware` | Broadcom security advisory API (VMSA); CVSS enriched from NVD | `VMSA-*` |

* `vendors` also holds rows for `dell`, `hpe`, `netapp`, `veeam` and `cohesity` from the initial seed. They have no adapter and are never synced.
* Each run normalises advisories, CVEs and advisory-to-CVE mappings with product impacts and fixed versions (`src/engine/ingestion.ts`), then writes them through `src/engine/persistIngestion.ts`.
* Full advisory documents go to the `advisory-documents` storage bucket (`raw_payload_path`); `advisories.raw_payload` stays empty.
* A CVE row is shared by every vendor. `upsert_cves()` merges instead of overwriting: the higher CVSS score and its vector win, severity is the highest any vendor reported, the earliest published date is kept, and a value is never replaced with NULL. A description from a vendor wins; the advisory title is used only when a new row has none.
* A CVE counts as new only if it is neither earlier in the run nor already in `cves`.

### 1.2 Scheduling and Manual Sync
* Each vendor has its own schedule: `schedule_enabled`, `schedule_times` (default `08:00`, `12:30`, `18:30`) and `schedule_timezone` (default `Asia/Taipei`).
* pg_cron runs `tick_scheduled_syncs()` every 5 minutes. It posts to the `scheduled-sync` Edge Function with `SCHEDULED_SYNC_SECRET`. That value is stored both in Vault (`scheduled_sync_key`) and in the function secrets. The function syncs the vendors whose window is due (`src/services/scheduleWindow.ts`) and stamps `last_scheduled_run_at` on success.
* A tick that finds the Vault secrets missing, or whose previous request came back with HTTP ≥ 400, writes a throttled `FAILED` row to `vendor_sync_logs`.
* Admins trigger a manual sync from the Admin Console (`sync-cve`, `trigger_manual_sync`), for all vendors or a subset.
* Only one sync runs at a time across manual and scheduled runs (`sync_leases`, 15-minute lease).
* Admins can also fetch a single advisory or CVE id from the Explorer search and persist it.

### 1.3 Webhook Notifications
* Channels: Discord, Slack, Telegram.
* Every new CVE in a run queues an alert. Alerts are sent only after the run and its log row are persisted. Each webhook's `min_severity` (`CRITICAL`, `HIGH` default, `MEDIUM`, `LOW`) decides delivery.
* Alert content: vendor, advisory id and title, CVE id, CVSS score, severity, affected products, fixed versions and advisory URL. Destinations must be public HTTPS URLs (SSRF guard).

### 1.4 Web Dashboard
* Stack: React 18, Vite 6, MUI 6, TypeScript. Routes other than the Dashboard are code-split. Hosted on Cloudflare, deployed from `main`.
* **Dashboard**: tracked, critical and impacted-component counts, per-vendor advisory cards, recent critical and high advisories.
* **Data load**: one `explorer_dataset()` RPC feeds the Dashboard, Explorer and Vendor pages. It returns each distinct product impact once per advisory, with per-mapping indexes.
* **Explorer**: advisory and CVE views, 50 rows per page; filter by product family, severity and impact state; keyword search over CVE, advisory, component, product, errata and description. A CVE lists every vendor that published an advisory for it.
* **Vendor pages**: product taxonomy navigation per vendor.
* **Admin Console** (admin only): sync monitor and logs, per-vendor schedules, webhook management and test delivery, system health.
* Not implemented: triage workflow. The `cve_triage` table exists but nothing reads or writes it.

## 2. Technical Specifications

### 2.1 Database Schema (Supabase PostgreSQL)
* `vendors`: `id, code UNIQUE, name, icon_url, homepage, is_active, schedule_enabled, schedule_times TEXT[], schedule_timezone, last_scheduled_run_at, created_at`
* `advisories`: `id, vendor_id → vendors, advisory_id, title, severity, published_at, updated_at, url, summary, raw_payload JSONB (empty), raw_payload_path, created_at, UNIQUE(vendor_id, advisory_id)`
* `cves`: `id, cve_id UNIQUE, description, cvss_v3_score, cvss_v3_vector, severity, is_known_exploited, published_date, last_modified_date, created_at`
* `advisory_cve_map`: `id, advisory_id → advisories, cve_id → cves, affected_products JSONB (product impacts), fixed_versions JSONB, created_at, UNIQUE(advisory_id, cve_id)`
* `vendor_sync_logs`: `id, vendor_id, vendor_code, status (RUNNING | SUCCESS | PARTIAL_SUCCESS | FAILED), items_fetched, new_items_count, error_message, duration_ms, started_at, finished_at, details JSONB`
* `webhook_configs`: `id, name, platform, webhook_url, min_severity, is_active, created_at`
* `sync_leases`: `name PK, holder, expires_at`
* `scheduled_sync_ticks`: `id, request_id (pg_net), created_at`, pruned after one day
* `cve_triage`: present, unused

### 2.2 Security & Access Control
* RLS is enabled on every table. `vendors`, `advisories`, `cves`, `advisory_cve_map` and `vendor_sync_logs` are publicly readable; none of them accepts writes from the browser.
* Admin is `auth.users.raw_app_meta_data.role = 'admin'`, which only the service role can set. `public.is_admin()` reads it from the JWT. Email signup is disabled; accounts are created by an operator.
* `webhook_configs` is readable and writable by admins only, because webhook URLs and bot tokens are credentials.
* All writes go through Edge Functions using the service-role key:
  * `sync-cve` requires an admin JWT or the service-role key for every action except `health_check`.
  * `scheduled-sync` requires `SCHEDULED_SYNC_SECRET` or the service-role key.
* `upsert_cves`, `acquire_sync_lease`, `release_sync_lease`, `tick_scheduled_syncs` and `set_scheduled_sync_vault_secrets` are executable by `service_role` only.
