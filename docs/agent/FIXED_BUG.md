# Historical Bug Fixes

---

### Bug ID: BUG-001 — Hardcoded fake CVE-2026-73086 injected into every Red Hat ingestion sync
- **Date**: 2026-08-15, fixed in 1.0.0-dev.1
- **Root Cause**: Code had unconditional hardcoded injection block in `src/adapters/redhat.ts` `fetchAdvisories()` (lines ~61-69) that force-added fabricated CVE record (CVE-2026-73086, RHSA-2026:48758/54412/50287) into every production sync run, indistinguishable from genuine Red Hat data, polluting the live Supabase database.
- **Fix**: Removed the hardcoded injection block from `src/adapters/redhat.ts`. Cleaned polluted live Supabase database (project xgrtyjazyqajqinwzlbl): deleted fake CVE-2026-73086 row (id 65f7576c-c0bd-4f0d-b44b-93c9609e0f17) and RHSA-2026:48758 advisory row (id cf395a71-a923-47b6-b7f1-b84e2748c398) with cascaded `advisory_cve_map` entry. Verified the advisory was not shared with any real CVE before deletion.
- **Status**: ✅ FIXED (1.0.0-dev.1)
