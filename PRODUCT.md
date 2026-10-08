# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: the owner and a small operations team (sysadmins / SREs) who run Red Hat, Ubuntu, Debian, SUSE, Nutanix, Cisco and VMware estates. They open VulnBeacon routinely (daily or weekly) to find out which new vendor advisories affect the products they actually run, and how urgently.

Secondary: an admin (same team) who manages feed syncs, schedules, webhooks and logs in the Admin Console.

## Product Purpose

Ingest security advisories from seven vendors (Red Hat CSAF, Nutanix, Ubuntu USN, Debian DSA + Security Tracker, SUSE CSAF 2.0, Cisco CSAF, VMware/Broadcom VMSA), normalize them into one model, and let the team answer "what affects us, and what do we do about it" faster than reading each vendor's site. Success = a team member can go from opening the app to knowing the relevant new advisories and their fix status in seconds, not minutes.

## Positioning

One normalized view across seven heterogeneous vendor feeds, with a unified vulnerability state classification that maps each vendor's terminology onto a common set, plus a per-advisory product impact matrix.

## Operating Context

- Users answer, in order: (1) which advisories affect our products, (2) how severe, (3) is a fix available and in which version.
- Three usage scenes, all confirmed: routine checks at a desk on a large screen; arriving from a Discord/Slack/Telegram alert link, often on a phone, straight to one advisory or CVE; projecting or screen-sharing in meetings and patch planning, where others must read the state at a glance.
- Alerts also arrive out-of-band via Discord / Slack / Telegram webhooks with severity thresholds; the app is where they go to look closer.
- Deployed as a Cloudflare-hosted frontend over Supabase Cloud (Postgres, Auth, Storage, Edge Functions); pg_cron drives scheduled syncs.

## Capabilities and Constraints

- Existing: dashboard, CVE/advisory explorer with filters and paged CVE table, CVE and advisory detail drawers, vendor/product taxonomy pages with vendor logos, admin console (sync monitor, feed sources, schedules, webhooks, logs, system health). Admin requires `app_metadata.role = admin`.
- Data loads through one compact `explorer_dataset` RPC and is cached in IndexedDB for instant repeat visits; the redesign must keep that load path.
- Stack: React 18, TypeScript, Vite, MUI + Emotion, lucide-react icons; tests in Vitest + Testing Library under strict TDD (`docs/test/TDD_GUIDELINES.md`).
- **New capability requested (redesign scope)**: a team-shared list of the products/versions the team runs ("our products"), stored in Supabase (new table + migration), edited by admins, the same for every viewer. The home view leads with advisories affecting these products. Matching granularity confirmed as product + exact version (e.g. vCenter 8.0 U2), so the app can say whether our installed version is fixed. Data gap: `ProductImpactItem` (`src/types`) carries `product_name`, `component`, `state`, `cpe` but no normalized affected/fixed version range; adapters see version data in vendor-specific formats. Version matching needs a normalized version model per vendor first.
- **New capability requested**: UI in both English and Traditional Chinese (i18n, switchable). Vendor advisory content, CVE IDs and product names stay in their original language.
- Redesign scope: the whole app (dashboard, explorer, vendor pages, detail drawers, admin console).

## Brand Commitments

Name: VulnBeacon (package name cve-collector). Vendor brand logos are used for vendor identification. The current sky-blue MUI look is not a commitment.

Standing visual preference (chosen 2026-10-08 in the redesign direction round): the category standard, executed at full craft, with no novelty world. Quality bar: Snyk / Wiz (vulnerability lists, severity, blast radius) and GitHub Security Advisories (advisory detail, affected vs. patched versions). Dark theme is the primary design target; a light theme stays available as a switch.

## Evidence on Hand

Real production data: thousands of advisories and CVE mappings across seven vendors (about 5,000 advisory–CVE mappings as of 2026-09). No testimonials, customers or external users; do not invent any.

## Product Principles

1. Relevance first: what affects our products outranks what is merely new.
2. Fast path to the answer: severity and fix status visible without opening a detail view.
3. Density with hierarchy: an ops tool shows a lot, but the important item must stand out. Splitting information across many clicks is a confirmed failure mode.
4. Vendor truth preserved: normalized states never hide the vendor's original wording or link.
5. Deep-linkable: every advisory and CVE has a stable URL an alert can point to.
