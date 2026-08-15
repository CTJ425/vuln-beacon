# System Specifications

## 1. Functional Specifications

### 1.1 Multi-Vendor Advisory Ingestion
* Ingest security advisories from 8 target enterprise vendors:
  * RedHat (`redhat`)
  * VMware / Broadcom (`vmware`)
  * Nutanix (`nutanix`)
  * Dell (`dell`)
  * HPE (`hpe`)
  * NetApp (`netapp`)
  * Veeam (`veeam`)
  * Cohesity / Veritas NetBackup (`cohesity`, `netbackup`)
* Extract unified attributes: Advisory ID, Title, Severity, Published Date, Updated Date, Official URL, Impacted Products/Versions, and Associated CVEs.
* Idempotent ingestion: Only create new entries or update modified records. Avoid duplicate notifications.

### 1.2 Automated Shift-based Scheduling
* Execution Schedule: Daily 3-shift runs at `08:00`, `12:30`, and `18:30` (Asia/Taipei time).
* Cron Configuration: UTC `0 0 * * *`, `30 4 * * *`, `30 10 * * *`.
* Support manual ad-hoc synchronization per vendor or for all vendors via Web Dashboard.

### 1.3 Webhook Notification Dispatcher
* Supported Channels: Discord, Telegram, Slack.
* Trigger Rules:
  * Default: Send alert when new `CRITICAL` or `HIGH` severity CVEs are discovered.
  * Configurable minimum severity threshold per webhook endpoint.
* Alert Card Content: Vendor Name, Advisory ID, CVE ID(s), CVSS Score, Severity Badge, Impacted Products, Official URL, and direct Dashboard link.

### 1.4 Web Dashboard & Triage Interface
* **Frontend Tech Stack**: React (v18+) + Vite + Material UI (MUI v5/v6) + TypeScript.
* **Overview Dashboard**: Metrics (Today's new CVEs, Critical count, Pending triage count, Vendor breakdown chart).
* **CVE Explorer**: Filter by Vendor, Severity, CVSS range, Date range, Triage status; Full-text search on CVE ID, Advisory ID, and Product names.
* **Triage Operations**: Authenticated users can update status (`PENDING`, `IN_PROGRESS`, `NOT_AFFECTED`, `PATCH_REQUIRED`, `PATCHED`), assign handlers, and add internal investigation notes.
* **Sync Health Monitor**: View execution status, error logs, and last sync timestamp for all 8 vendors.

## 2. Technical Specifications

### 2.1 Database Schema (Supabase PostgreSQL)
* `vendors`: `(id UUID PK, code TEXT UNIQUE, name TEXT, icon_url TEXT, homepage TEXT, is_active BOOL, created_at TIMESTAMPTZ)`
* `advisories`: `(id UUID PK, vendor_id UUID FK, advisory_id TEXT, title TEXT, severity TEXT, published_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, url TEXT, summary TEXT, raw_payload JSONB, created_at TIMESTAMPTZ, UNIQUE(vendor_id, advisory_id))`
* `cves`: `(id UUID PK, cve_id TEXT UNIQUE, description TEXT, cvss_v3_score NUMERIC, cvss_v3_vector TEXT, severity TEXT, is_known_exploited BOOL, published_date TIMESTAMPTZ, last_modified_date TIMESTAMPTZ, created_at TIMESTAMPTZ)`
* `advisory_cve_map`: `(id UUID PK, advisory_id UUID FK, cve_id UUID FK, affected_products JSONB, fixed_versions JSONB, created_at TIMESTAMPTZ, UNIQUE(advisory_id, cve_id))`
* `cve_triage`: `(id UUID PK, cve_id UUID FK, status TEXT, notes TEXT, assigned_to UUID FK auth.users, updated_by UUID FK auth.users, updated_at TIMESTAMPTZ)`
* `vendor_sync_logs`: `(id UUID PK, vendor_id UUID FK, status TEXT, items_fetched INT, new_items_count INT, error_message TEXT, duration_ms INT, started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ)`
* `webhook_configs`: `(id UUID PK, name TEXT, platform TEXT, webhook_url TEXT, min_severity TEXT, is_active BOOL, created_at TIMESTAMPTZ)`

### 2.2 Security & Access Control
* Supabase Row Level Security (RLS) enabled on all tables.
* Public/Anonymous read access allowed for CVE/Advisory viewing (if configured), or authenticated-only for enterprise internal use.
* Triage status write access strictly restricted to authenticated users (`auth.uid() IS NOT NULL`).
* Service Role Key strictly isolated inside Edge Functions for ingestion and notification writes.
