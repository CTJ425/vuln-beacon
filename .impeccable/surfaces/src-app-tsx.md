---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# App shell (whole VulnBeacon web app)

Scope: every route of the app (overview, vulnerabilities list, advisory/CVE detail, vendors, our products, admin). Visitor mode: Operate.

Audience and job: small ops team; routine desk checks, arriving from an alert link on a phone, projecting in patch-planning meetings. Task order: what affects our products, how severe, is a fix out and in which version.

Constraints: one `explorer_dataset` load + IndexedDB cache; React 18 + MUI; EN + zh-TW; every advisory and CVE deep-linkable; never more clicks than today.

## Direction contract

THESIS: The category standard at Snyk / GitHub Security Advisories craft: severity and fix status readable in the list row, no dashboard theatre. Refuses KPI-card heroes, neon-on-black SOC styling and drawer-only detail.

OWN-WORLD: Dark-first cool graphite neutrals (light theme as equal twin), one indigo accent for selection and links only, a fixed four-step severity scale (critical red, high orange, medium amber, low neutral) used for nothing else. Inter with CJK system fallback, tabular numerals, mono only for IDs and versions. 6px radius, 1px borders, no gradients, no glass.

STORY: The visitor sees what affects their products first, scans severity and fix state in rows, opens one item in place and shares its URL.

FIRST VIEWPORT: Left rail nav (overview, vulnerabilities, vendors, our products, admin); top bar with search, language and theme. Main: severity × fix-status matrix strip, then grouped rows; detail opens in a right split on wide screens, full page when narrow.

FORM: Category standard (canon), chosen by the user over the rolled direction; seed key cd62f213.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
