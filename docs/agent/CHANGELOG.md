# Changelog

## 1.0.0-dev.2 - 2026-08-16
### Changed
- **Ingestion engine rewrite (Phase D)**: Converted from CVE-driven to advisory-first model. New `RedHatCsafAdapter` parses CSAF 2.0 documents with one advisory per errata carrying every CVE it fixes (previously averaged 1.00 CVE/advisory, now 4.76).
- Product impact matrix: Build artifacts (-debuginfo/-debugsource) now filtered out; per-locale package families collapsed (e.g. glibc-langpack variants).
- Adapter registration: `getAdapterByCode('redhat')` now returns RedHatCsafAdapter (advisory-first); RedHatAdapter still exported.
- Sync service: fetchAndIngestQuery rewritten to CSAF endpoints. Errata id hits detail endpoint directly; CVE goes through csaf.json?cve= reverse index then parallel detail fetches. Old /securitydata/cve.json and /cve/<id>.json calls removed.
### Fixed
- Non-array product_status in CSAF documents (guarded with Array.isArray, skipped if not array).
- E2E test fixtures updated to CSAF shape (csaf-e2e-sample.json).
### Added
- New unit test files: redhatCsaf.test.ts (8 tests), redhatCsafCollapse.test.ts (5 tests), csafQuery.test.ts (5 tests).
- New CSAF fixtures: csaf-advisory-sample.json, csaf-e2e-sample.json.
- Live database re-ingestion: 50 advisories, 142 CVEs, 238 mappings (upgraded from 50 advisories, 50 CVEs, 50 mappings in CVE-first model).

## 1.0.0-dev.1 - 2026-08-15
### Added
- Complete testing architecture in `docs/test/` (README, TDD Guidelines, Unit Test Plan, Smoke Test Plan, E2E Test Plan).
- Synchronized TDD guidelines and test memory paths in `AGENT.md`, `CLAUDE.md`, and `GEMINI.md`.
- Initial PostgreSQL migration `20260815000000_init_cve_collector.sql` with 7 tables, RLS policies, indexes, and 8 vendor seeds.
- Modular adapters for 8 vendors (RedHat, VMware, Nutanix, Dell, HPE, NetApp, Veeam, Cohesity).
- CVSS score normalizer, vector parser, and standard CVE extractor.
- Multi-channel Webhook formatters (Discord embed, Telegram HTML, Slack Block Kit).
- IngestionEngine coordinator and TriageService state manager.
- 49 unit, smoke, and E2E tests passing with 100% test success rate.

## 0.1.0-dev.1 - 2026-08-15
### Added
- Project initialized.
- System architecture and roadmap documentation (`docs/agent/PLAN.md`).
- System specifications document (`docs/agent/SPEC.md`).
- Phased task tracking breakdown (`docs/agent/TASK.md`).
