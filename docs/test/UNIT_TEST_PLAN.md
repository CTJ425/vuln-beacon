# Unit Test Plan

## 1. Scope & Objectives

Unit testing in `cve-collector` focuses on validating the isolation, deterministic behavior, and edge-case handling of all low-level building blocks:
1. Modular Vendor Adapters (8 vendors).
2. Data Normalization & CVSS / EPSS / Exploit Enrichment helpers.
3. Webhook Alert Payload Formatters (Discord, Telegram, Slack).
4. Triage State Transitions & Validation Logic.
5. React UI Components, Custom Hooks, and Utility Functions.

---

## 2. Test Suite Matrix

### 2.1 Vendor Adapters (`tests/unit/adapters/`)

| Adapter | Test Target | Test Cases |
| :--- | :--- | :--- |
| `redhat.test.ts` | Red Hat Security Data API parser | Valid JSON parsing, missing CVSS fallback, multi-CVE mapping, empty response handling |
| `vmware.test.ts` | Broadcom / VMware security advisory feed | VMSA advisory code extraction, affected product version matrix parsing, duplicate prevention |
| `nutanix.test.ts` | Nutanix Support Advisories RSS/JSON | NTNX-SA ID matching, severity normalization, link resolution |
| `dell.test.ts` | Dell Security Advisories (DSA) | DSA code extraction, CVE extraction from HTML/text summary, date normalization |
| `hpe.test.ts` | HPE Security Bulletin RSS | HPESB ID parsing, CVSS string parsing, legacy bulletin format handling |
| `netapp.test.ts` | NetApp Advisories JSON API | NTAP ID extraction, affected ONTAP/StorageGRID version matching, CVSS v3 score parsing |
| `veeam.test.ts` | Veeam Security KB articles | KB ID extraction, CVE regex parsing, severity tier mapping |
| `cohesity.test.ts` | Cohesity / Veritas NetBackup Bulletins | Bulletin ID parsing, CVSS extraction, multi-product affected table normalization |

### 2.2 Enrichment & Normalization Helpers (`tests/unit/enrichment/`)

| Module | Test Target | Test Cases |
| :--- | :--- | :--- |
| `cvss.test.ts` | CVSS Score & Severity Classifier | CVSS v3.1/v3.0 vector parsing, score to severity mapping (None, Low, Medium, High, Critical) |
| `cve-normalizer.test.ts` | Standard CVE ID Extractor | Regex matching (`CVE-\d{4}-\d{4,7}`), deduplication, whitespace trimming |
| `date-parser.test.ts` | Date/Time standardizer | UTC conversion, ISO-8601 formatting, timezone offset correction for Asia/Taipei |

### 2.3 Webhook Formatters (`tests/unit/formatters/`)

| Formatter | Test Target | Test Cases |
| :--- | :--- | :--- |
| `discord.test.ts` | Discord Embed Webhook | Color coding by severity, field truncation (25 fields limit, 1024 char limit), direct link formatting |
| `telegram.test.ts` | Telegram HTML/MarkdownV2 | HTML tag escaping, bold/code tags, emoji severity indicators, message length splitting (> 4096 chars) |
| `slack.test.ts` | Slack Block Kit | Header blocks, section blocks with markdown, action buttons (link to triage dashboard) |

### 2.4 Frontend UI Components & Hooks (`tests/unit/components/`)

| Component / Hook | Test Target | Test Cases |
| :--- | :--- | :--- |
| `SeverityBadge.test.tsx` | Severity chip component | Render correct color & label for CRITICAL, HIGH, MEDIUM, LOW |
| `CveTable.test.tsx` | Multi-vendor CVE Table | Sort by CVSS, filter by vendor, paginate, click row to open triage drawer |
| `TriageDrawer.test.tsx` | Triage action panel | Form submission, status select (`PENDING` -> `PATCH_REQUIRED`), notes validation |
| `useCveData.test.ts` | Custom data fetching hook | Loading states, error states, cache invalidation on mutate |

---

## 3. Running Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run specific adapter test
npm run test:unit tests/unit/adapters/redhat.test.ts

# Run with coverage
npm run test:coverage
```
