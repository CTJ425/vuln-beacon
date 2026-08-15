# Changelog

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
