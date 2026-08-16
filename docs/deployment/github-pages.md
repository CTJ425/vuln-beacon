# GitHub Pages Deployment

## Trigger

`.github/workflows/deploy-pages.yml` runs on every push to `main`, and can
also be run manually from the Actions tab (`workflow_dispatch`). A successful
run publishes to https://ctj425.github.io/vuln-beacon/.

## Pipeline

Two jobs:

1. **build** — `npm ci`, then `test:unit` → `test:smoke` → `test:e2e`, then
   `npm run build`, all with `working-directory: src` (this repo has no root
   `package.json`; everything lives under `src/`, per `CLAUDE.md`). The build
   output (`src/dist`) is uploaded as the Pages artifact.
2. **deploy** — publishes the artifact via `actions/deploy-pages`, gated on
   `build` succeeding.

Any of the three test suites failing blocks the build step, so a red suite
never reaches production.

## Why `vite.config.ts` has a conditional `base`

A GitHub Pages *project* site (as opposed to a user/org site) is served from
`https://<user>.github.io/<repo>/`, not from the domain root. Vite's default
`base: '/'` would emit asset URLs like `/assets/...`, which 404 under that
subpath. `src/vite.config.ts` sets:

```ts
base: process.env.GH_PAGES ? '/vuln-beacon/' : '/',
```

Only the CI build sets `GH_PAGES=true`. Local `npm run dev` and a plain local
`npm run build` are unaffected and keep using `/`.

## One-time prerequisite

Repo **Settings → Pages → Build and deployment → Source** must be set to
**"GitHub Actions"** (already done for this repo). Without that, the
`deploy` job's `actions/deploy-pages` step has nothing to publish to. A fork
or a differently-named repo also needs the `/vuln-beacon/` base path in
`vite.config.ts` updated to match its own repo name.
