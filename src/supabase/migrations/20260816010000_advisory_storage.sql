-- Storage bucket for full CSAF advisory documents, kept out of Postgres
-- to stay under the free-tier database size limit. Public read matches
-- the existing public-read RLS posture on public.advisories; CSAF
-- documents are Red Hat public data already.
insert into storage.buckets (id, name, public)
values ('advisory-documents', 'advisory-documents', true)
on conflict (id) do nothing;

drop policy if exists "Allow public read of buckets" on storage.buckets;
create policy "Allow public read of buckets"
on storage.buckets for select
using (public = true);

drop policy if exists "Allow public read of advisory documents" on storage.objects;
create policy "Allow public read of advisory documents"
on storage.objects for select
using (bucket_id = 'advisory-documents');

alter table public.advisories
  add column if not exists raw_payload_path text;

