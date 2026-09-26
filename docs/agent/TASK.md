# Active Tasks

Open entries only; completed tasks live in `TASK_ARCHIVE.md`.

## Open

- [ ] **Explorer loads every CVE and advisory with full product impacts on page load** (`src/services/cveService.ts`, `src/services/advisoryService.ts`). Current volume is small (dev 2026-09-26: 188 CVEs, 51 advisories, 335 mappings, 318 kB of mapping JSON), so this is deferred. The fix is server-side pagination and search for Explorer, Dashboard and Vendor pages together with BUG-006 (advisory-level product impacts); revisit when the list query becomes measurable.
