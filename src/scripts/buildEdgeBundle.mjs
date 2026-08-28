// Bundles the pure ingestion sources (src/engine, src/adapters,
// src/services/scheduleWindow.ts, ...) for the Deno Edge Function runtime.
// The Edge Functions import the generated ingest.bundle.js instead of
// carrying a second, hand-copied implementation (TASK-13 D1).
//
// Usage:
//   node scripts/buildEdgeBundle.mjs

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(__dirname, '..');

await build({
  entryPoints: [path.join(srcRoot, 'supabase/functions/_shared/ingest.entry.ts')],
  outfile: path.join(srcRoot, 'supabase/functions/_shared/ingest.bundle.js'),
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  bundle: true,
  alias: {
    '@': srcRoot,
  },
});

console.log('Wrote src/supabase/functions/_shared/ingest.bundle.js');
