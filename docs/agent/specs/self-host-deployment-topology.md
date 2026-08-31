# Spec: Self-Hosted Supabase + Non-Public Network Deployment Topology

Status: SPEC (decision recorded, not implemented)
Created: 2026-08-30 Asia/Taipei
Lane: 2 (deployment topology, external ingress, Edge Function runtime, secrets)

## User decisions (fixed, do not revisit)

1. Supabase moves to **self-hosted**.
2. Supabase **MUST NOT** be published on the public internet as its own hostname.
3. The frontend **MUST** be reachable from outside, through **Cloudflare Tunnel** or
   **Tailscale**.

## Decision

**Keep the current SPA + BaaS architecture. Do NOT introduce a BFF.**

This is a network-layer problem, not an architecture problem. One Cloudflare Tunnel,
one reverse proxy, and a same-origin path prefix satisfy all three user decisions.
The only application change is the value of `VITE_SUPABASE_URL`.

### Governing constraint

The browser MUST reach the Supabase API. `src/lib/supabase.ts` creates a browser
supabase-js client; `src/lib/fetchAllRows.ts` reads through PostgREST; and
`src/services/syncService.ts` calls `supabase.functions.invoke('sync-cve', ...)`.
Therefore Supabase cannot be fully unreachable. It can only be **not independently
published** — reachable exclusively through the same controlled ingress as the frontend.

## Target topology

```
Internet -> Cloudflare (Access SSO) -> Tunnel (outbound only, no inbound port)
                                          |
  +---------------------------------------v--------------------------+
  | private host / docker network                                     |
  |  caddy   <- the only tunnel target                                |
  |    /            -> vuln-beacon static build (vite build output)   |
  |    /supabase/*  -> strip prefix -> kong:8000                      |
  |                                                                   |
  |  kong:8000  - postgrest / edge-runtime / storage / auth           |
  |  db:5432    - pg_cron -> http://kong:8000/functions/v1/           |
  |                          scheduled-sync   (internal, no tunnel)   |
  +-------------------------------------------------------------------+
```

## Design

### D1 - single hostname with a path prefix, NOT two subdomains

Do not use `app.example.com` + `api.example.com`.

Cloudflare Access binds its `CF_Authorization` cookie to a hostname. supabase-js does
not send `credentials: 'include'`. A cross-subdomain XHR is therefore redirected (302)
to the Access login page and then blocked by CORS. The browser reports a misleading
CORS error, which makes the real cause hard to find.

Same-origin removes all of it: no CORS, no cookie scope problem, one Access policy for
everything.

### D2 - cloudflared matches paths but does NOT rewrite them

`path: ^/supabase/ -> kong:8000` is wrong. Kong receives `/supabase/rest/v1/...` and
returns 404. A reverse proxy MUST be the single tunnel target and MUST strip the prefix.

```caddyfile
:80 {
  handle_path /supabase/* {     # handle_path strips the prefix; handle does not
    reverse_proxy kong:8000
  }
  handle {
    root * /srv/vuln-beacon
    try_files {path} /index.html
    file_server
  }
}
```

```yaml
# cloudflared config.yml
ingress:
  - hostname: vb.example.com
    service: http://caddy:80
  - service: http_status:404
```

### D3 - frontend change is one environment variable

```dotenv
VITE_SUPABASE_URL=https://vb.example.com/supabase
```

**Verified against the installed supabase-js 2.112.3** (not assumed):
`validateSupabaseUrl` applies `ensureTrailingSlash` (`dist/index.mjs:350,387`), so
`new URL("rest/v1", baseUrl)` (`dist/index.mjs:664`) resolves to
`https://vb.example.com/supabase/rest/v1`. The `realtime/v1`, `auth/v1`, `storage/v1`
and `functions/v1` URLs (`dist/index.mjs:630-634`) keep the prefix the same way.
Without the trailing-slash normalisation the prefix would be dropped; do not remove it
by passing a pre-normalised URL that defeats the check.

### D4 - the scheduler never leaves the private network

Set the vault secret `scheduled_sync_url` to the internal address:

```
http://kong:8000/functions/v1/scheduled-sync
```

`scheduled_sync_key` is the self-hosted service_role JWT. Scheduled traffic then never
crosses the tunnel and needs no Access credential.
`pg_cron`, `pg_net` and `vault` all ship in the `supabase/postgres` image, so
`src/supabase/migrations/20260828000000_vendor_schedule.sql` applies unchanged.

### D5 - Edge Function deployment differs on self-host

There is no `supabase functions deploy`. Deployment is a file copy into the
`supabase/edge-runtime` container volume followed by a restart. The copy MUST include
the generated `src/supabase/functions/_shared/ingest.bundle.js`; regenerate it with
`npm --prefix src run build:edge` whenever bundled app sources change.

### D6 - Edge Function environment variables are no longer injected

`src/.env.example` currently states that Edge Functions receive `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` automatically from the Supabase platform. **That comment is
wrong under self-host.** Both MUST be set manually in the `edge-runtime` container
environment. Update the comment.

### D7 - anon key rotation

The anon/publishable key is a static JWT signed with the self-hosted `JWT_SECRET`.
There is no rotation UI. A leak requires changing `JWT_SECRET` and re-signing every key.

## Cloudflare Tunnel vs Tailscale

**Recommend Cloudflare Tunnel + Access.** Users need only a browser and SSO; no client
install; lowest administration cost.

Tailscale is stricter (no trust in Cloudflare TLS termination) but every user must
install the client and join the tailnet. The topology is **identical** — same Caddy,
same path prefix. The only difference is using `tailscale cert` for `*.ts.net` HTTPS.
HTTPS is required; without it the page is not a secure context.

Both can coexist: the tunnel for ordinary users, the tailnet for administration.

## Consequences for existing defects

### C1 - browser-side manual sync breaks on restricted networks

`src/services/syncService.ts:319-332` fetches `access.redhat.com` from **the user's
browser**, not from the server. After self-hosting, a user on a restricted network
(tailnet only, no internet egress) will see manual sync fail while scheduled sync
succeeds, because the scheduler runs server-side.

This is a second reason to move manual sync to the server, in addition to the 3 MB
chunk limit (BUG-003).

### C2 - webhook_configs exposure severity drops but does not disappear

`public.webhook_configs` still has open anon SELECT and write policies
(`20260816000000_restrict_write_rls.sql` deliberately excluded it). Behind Access or a
tailnet an attacker must first pass SSO, so severity falls from urgent to
should-fix. Any authenticated user can still read every webhook token.
Existing spec: `docs/agent/specs/webhook-admin-and-server-dispatch.md` (DEFERRED).

## Recommended order of work

1. **Network layer only** — Caddy + Tunnel + `VITE_SUPABASE_URL` path prefix.
   No code change. Get self-host running first.
2. **Docs** — fix `src/.env.example` (D6) and record the self-host Edge Function
   deployment procedure (D5).
3. **Move manual sync server-side** — resolves C1 and BUG-003. Needs its own spec.
4. **`webhook-admin` Edge Function** — resolves C2; spec already exists.

## Verification

| Step | Check |
| ---- | ---- |
| D3 | Browser devtools Network shows `GET https://vb.example.com/supabase/rest/v1/cves?...` returning 200, not 404 |
| D2 | `curl -I https://vb.example.com/supabase/rest/v1/` reaches PostgREST, not the SPA fallback |
| D4 | `select * from cron.job_run_details order by start_time desc limit 5;` shows successful ticks with no tunnel involvement |
| D5 | `supabase.functions.invoke('sync-cve', { body: { action: 'update_vendor_schedule', ... } })` returns 200 from the browser |
| D1 | Manual sync completes end to end while logged in through Access, with no CORS error in the console |

## Non-goals

- Introducing a dedicated backend service or BFF layer.
- Publishing Supabase under its own public hostname.
- Changing RLS policies (tracked separately by the webhook-admin spec).
