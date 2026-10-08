// Equivalence and timing check for two explorer_dataset() migrations, run on
// synthetic data shaped like production (2026-10-09: 659 advisories, 4,342
// CVEs, 9,479 mappings, ~8% of advisories with per-CVE impact lists, plus NULL,
// non-array and string-array rows). Uses PGlite (Postgres in WASM), so absolute
// times differ from Supabase; equality of output is exact.
//
//   npx -y -p @electric-sql/pglite@0.5.8 node supabase/checks/explorer-dataset-equivalence.mjs \
//     supabase/migrations/<old>.sql supabase/migrations/<new>.sql
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
const [oldMigration, newMigration] = process.argv.slice(2);
const db = new PGlite();

await db.exec(`
  create table vendors (id uuid primary key default gen_random_uuid(), code text, name text);
  create table advisories (id uuid primary key default gen_random_uuid(), vendor_id uuid, advisory_id text, title text,
    severity text, published_at timestamptz, url text, summary text);
  create table cves (id uuid primary key default gen_random_uuid(), cve_id text, description text, cvss_v3_score numeric,
    cvss_v3_vector text, severity text, is_known_exploited boolean, published_date timestamptz, last_modified_date timestamptz,
    created_at timestamptz default now());
  create table advisory_cve_map (id uuid primary key default gen_random_uuid(), advisory_id uuid, cve_id uuid,
    affected_products jsonb default '[]'::jsonb, fixed_versions jsonb default '[]'::jsonb, created_at timestamptz default now());
  create role anon; create role authenticated;
`);

// Both definitions verbatim from the migrations; the old one is renamed aside.
await db.exec(fs.readFileSync(oldMigration, 'utf8'));
await db.exec('alter function public.explorer_dataset(boolean) rename to explorer_dataset_old');
await db.exec(fs.readFileSync(newMigration, 'utf8'));

// Deterministic PRNG.
let seed = 42;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (n) => Math.floor(rnd() * n);

await db.exec(`insert into vendors (code, name) select 'v' || g, 'Vendor ' || g from generate_series(1, 7) g;`);
await db.exec(`insert into cves (cve_id, description, severity, published_date)
  select 'CVE-2026-' || g, repeat('desc ', 20), (array['CRITICAL','HIGH','MEDIUM','LOW'])[1 + g % 4], now() - (g || ' hours')::interval
  from generate_series(1, 4342) g;`);
await db.exec(`insert into advisories (vendor_id, advisory_id, title, severity, published_at, url)
  select (select id from vendors order by code offset (g % 7) limit 1), 'ADV-' || g, 'Advisory ' || g,
         (array['CRITICAL','HIGH','MEDIUM','LOW'])[1 + g % 4], now() - ((g % 300) || ' days')::interval, 'https://x/' || g
  from generate_series(1, 659) g;`);
const advIds = (await db.query('select id from advisories order by advisory_id')).rows.map((r) => r.id);
const cveIds = (await db.query('select id from cves')).rows.map((r) => r.id);

const rows = [];
let mappings = 0;
for (const [ai, adv] of advIds.entries()) {
  const nCves = Math.max(1, Math.round(14.4 * (0.2 + rnd() * 1.6)));
  const nImpacts = 4 + pick(28);
  const base = Array.from({ length: nImpacts }, (_, k) => ({
    product_name: `Product ${ai % 40}`, component: `pkg-${ai}-${k}`, state: ['Fixed', 'Affected', 'Not affected'][k % 3],
  }));
  const perCveDiffers = rnd() < 0.08; // some vendors (Red Hat) differ per CVE
  for (let c = 0; c < nCves && mappings < 9479; c++, mappings++) {
    let arr = base;
    if (perCveDiffers && rnd() < 0.5) arr = base.filter(() => rnd() < 0.7).reverse();
    let ap = JSON.stringify(arr);
    const roll = rnd();
    if (roll < 0.004) ap = null;                               // NULL column
    else if (roll < 0.008) ap = JSON.stringify({ odd: true });  // non-array JSON
    else if (roll < 0.012) ap = JSON.stringify(['Plain string product', 'Plain string product']); // strings + duplicate
    rows.push([adv, cveIds[pick(cveIds.length)], ap]);
  }
}
for (let i = 0; i < rows.length; i += 500) {
  const chunk = rows.slice(i, i + 500);
  const values = chunk.map((_, k) => `($${k * 3 + 1}::uuid, $${k * 3 + 2}::uuid, $${k * 3 + 3}::jsonb)`).join(',');
  await db.query(`insert into advisory_cve_map (advisory_id, cve_id, affected_products) values ${values}`, chunk.flat());
}
await db.exec('analyze');

const stats = (await db.query(`select (select count(*) from advisory_cve_map) maps,
  (select count(*) from advisory_cve_map m, jsonb_array_elements(case when jsonb_typeof(m.affected_products)='array' then m.affected_products else '[]' end) e) elems`)).rows[0];
console.log('data', stats);

for (const compact of [false, true]) {
  const t0 = performance.now();
  const a = (await db.query(`select md5(explorer_dataset_old($1)::text) h`, [compact])).rows[0].h;
  const t1 = performance.now();
  const b = (await db.query(`select md5(explorer_dataset($1)::text) h`, [compact])).rows[0].h;
  const t2 = performance.now();
  console.log(`compact=${compact} identical=${a === b} old=${(t1 - t0).toFixed(0)}ms new=${(t2 - t1).toFixed(0)}ms`);
  if (a !== b) process.exitCode = 1;
}
await db.close();
