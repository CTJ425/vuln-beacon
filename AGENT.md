# AGENT.md

Agent rules for **cve-collector** (VulnBeacon). Keep this file short; details live in `docs/`.

## Memory (`docs/agent/` & `docs/test/`)

Persist important state here so the next agent does not need chat history.

| Directory / File | Use |
| ---- | ---- |
| `docs/agent/PROGRESS.md` | Latest status (**read top only**); older → `PROGRESS_ARCHIVE.md` |
| `docs/agent/TASK.md` | Active tasks; done → `TASK_ARCHIVE.md` |
| `docs/agent/BUG_FIX.md` / `FIXED_BUG.md` | Open / fixed bugs |
| `docs/agent/PLAN.md` / `SPEC.md` | Architecture / specifications |
| `docs/agent/CHANGELOG.md` | Version history |
| `docs/test/README.md` | Testing framework, test pyramid, and execution commands |
| `docs/test/TDD_GUIDELINES.md` | Test-Driven Development (TDD) rules & Red-Green-Refactor cycle |
| `docs/test/UNIT_TEST_PLAN.md` | Unit test plan & coverage requirements |
| `docs/test/SMOKE_TEST_PLAN.md` | Smoke test plan & sanity check criteria |
| `docs/test/E2E_TEST_PLAN.md` | End-to-End integration test plan & scenarios |

### Size discipline

| Hot file | Cap | Overflow goes to |
| ---- | ---- | ---- |
| `PROGRESS.md` | header + **newest 2 log entries** | `PROGRESS_ARCHIVE.md` (prepend, newest-first) |
| `TASK.md` | open entries only; done items collapsed | `TASK_ARCHIVE.md` |
| `BUG_FIX.md` | open bugs only | `FIXED_BUG.md` |

## Project Structure & TDD Quality Standards

- **Project Location**: All source code, configs (`package.json`, `tsconfig.json`, `vite.config.ts`), and tests are encapsulated entirely inside `src/`. Root directory is strictly kept clean (`AGENT.md`, `CLAUDE.md`, `GEMINI.md`, `docs/`, `src/`).
- **Mandatory TDD**: All code development MUST follow Test-Driven Development (Red -> Green -> Refactor).
- **Test Commands** (run in `src/` or with `--prefix src`):
  - Unit: `npm --prefix src run test:unit` (or `cd src && npm run test:unit`)
  - Smoke: `npm --prefix src run test:smoke`
  - E2E: `npm --prefix src run test:e2e`
  - All: `npm --prefix src test`
  - Build: `npm --prefix src run build`
  - Coverage: `npm --prefix src run test:coverage`

## Start of session

Read (on demand, keep context small):
1. `docs/agent/PROGRESS.md` — top only
2. `docs/agent/TASK.md`
3. `docs/agent/BUG_FIX.md`

Then inspect code you will touch in `src/`.

## Work style

- After work: update `TASK.md` / `PROGRESS.md` (and bugs if needed). Significant records: `YYYY-MM-DD HH:mm:ss Asia/Taipei`.

## Versioning

- No `v` prefix (e.g. `1.0.0`).
- `main` = `x.x.x`
- `dev` (unfinished) = `x.x.x-dev.N`
