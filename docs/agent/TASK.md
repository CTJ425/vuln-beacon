# Active Tasks

Open entries only; completed tasks live in `TASK_ARCHIVE.md`.

## Open

- **UI/UX redesign (whole app)** — planning, opened 2026-10-08. Product record in `PRODUCT.md`. Decided: category-standard look (bar: Snyk/Wiz, GitHub Security Advisories), dark primary + light switch, EN + zh-TW i18n, URL routing with deep links, split list/detail on wide screens and full page on narrow, team-shared "our products" list in Supabase matched by product + exact version.
  - Phases: (1) router, design tokens, i18n scaffold; (2) our-products table, admin editor, normalized version model + matching; (3) overview, merged advisory/CVE list, detail pages; (4) admin console; (5) finish review + `DESIGN.md`.
  - Phase 1 released as 1.6.0 (2026-10-09).
  - BUG-036 hotfix on `dev` as 1.6.1-dev.1, migration applied to dev and prod; verify prod, then release 1.6.1.
  - Phase 2 input: `docs/agent/VERSION_MODEL_RESEARCH.md`. Recommendation: product-level matching first, then version matching per vendor (Debian/Ubuntu → SUSE → Red Hat → Cisco → Nutanix → VMware); spike OSV.dev first. Distro "our products" entries need package + installed version. User approved (2026-10-09).
  - Phase 3 notes: on phones the 240px sidebar squeezes content (pre-existing); state badge labels still carry emoji and fixed bilingual text; Header "Daily Shifts" line is hard-coded and may not match per-vendor schedules; alert `dashboardUrl` can now point at `/advisories/:id`.
