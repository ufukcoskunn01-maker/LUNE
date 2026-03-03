create extension if not exists pgcrypto;

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  bucket text not null,
  path text not null unique,
  mime_type text,
  size bigint,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists files_entity_idx on public.files (entity_type, entity_id, created_at desc);
create index if not exists files_owner_idx on public.files (owner_id, created_at desc);

alter table public.files enable row level security;

drop policy if exists files_select_own on public.files;
create policy files_select_own
on public.files
for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists files_insert_own on public.files;
create policy files_insert_own
on public.files
for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists files_update_own on public.files;
create policy files_update_own
on public.files
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists files_delete_own on public.files;
create policy files_delete_own
on public.files
for delete
to authenticated
using (owner_id = auth.uid());
