---
name: versioning
description: The version number determination rule of VulnBeacon. Use it when you want to determine the next version number, increment dev.N on the dev branch, merge dev into main for final version, or write a docs/agent/CHANGELOG.md version record.
---

# Version number specification details

Prerequisite (stated in `CLAUDE.md` and `GEMINI.md` § Versioning): the version number does not have the `v` prefix.
Keep these synchronized:

- `src/config/version.ts` → `APP_VERSION` (UI display & fallback)
- `src/package.json` → `version` (with `src/package-lock.json`)
- `README.md` → version badge / notes if present
- `docs/agent/CHANGELOG.md` → version history

**`dev` and `main` must never disagree on the version string after a sync.** After every release merge, fast-forward so both tips carry the **same** finalized `x.x.x`.

---

## Official version (`main` branch / release commit)

Format: **`x.x.x`** (semver, no suffix).

- Bump patch for bug fixes and small maintenance (`1.0.0` → `1.0.1`).
- Bump minor for new adapters, new features, or architectural enhancements (`1.0.0` → `1.1.0`).
- The release commit (or the commit that finalizes the merge into `main`) is the **only** place that may drop `-dev.N`.
- `docs/agent/CHANGELOG.md` title for that version is the official number with release date (e.g. `## 1.1.0 - 2026-09-11`).

---

## Development versions (`dev` and feature work)

Format: **`x.x.x-dev.N`** (dot between `dev` and `N`, not a second hyphen).

| Piece | Meaning |
| ---- | ---- |
| `x.x.x` | The **next** official version this line of work will become when released |
| `N` | Sequential change count on that target, starting at **1** |

Examples: target `1.1.0` → first change `1.1.0-dev.1`, second `1.1.0-dev.2`.

### When to put `-dev`

- **Any non-release work on `dev`** (features, fixes, docs that ship with a version bump): use `x.x.x-dev.N`.
- After an official `x.x.x` is on both branches, the **next** edit that needs a version bump starts at **`(x.x.x + patch)-dev.1`**, not a bare `x.x.x` on `dev`.
- Do **not** leave `dev` showing a bare official number while unfinished work is in progress.

### When to remove `-dev`

- **Only on the official release commit** that merges to `main` (or the finalization commit on that path): strip `-dev.N` → `x.x.x`, finalize CHANGELOG, then fast-forward `dev` so both branches match.

---

## Release Checklist

1. Confirm the target official number (e.g. new multi-vendor threat feeds & UX hardening → release **`1.1.0`**).
2. Set `src/package.json`, `src/package-lock.json`, and fallback in `src/config/version.ts` to **`1.1.0`** (no `-dev`).
3. Finalize `docs/agent/CHANGELOG.md` with sections: `Added`, `Changed`, `Fixed`.
4. Update `docs/agent/PROGRESS.md` and `docs/agent/TASK.md`.
5. Run verification suite (`npm --prefix src run verify`).
6. Commit changes on `main` branch.
7. Tag release (`git tag 1.1.0`).
8. Sync branches (`git branch -f dev main` or fast-forward) so `dev` and `main` match.
