-- Field Installation ingestion schema
-- Run this in Supabase SQL Editor before using /api/field-installation/sync

create extension if not exists pgcrypto;

create table if not exists public.field_files (
  id uuid primary key default gen_random_uuid(),
  project_code text not null,
  work_date date not null,
  storage_bucket text not null,
  storage_path text not null unique,
  file_name text not null,
  revision int not null default 0,
  sha256 text null,
  file_size bigint null,
  last_modified timestamptz null,
  parse_status text not null default 'PENDING',
  parse_error text null,
  rows_count int not null default 0,
  parsed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint field_files_parse_status_check check (parse_status in ('PENDING', 'OK', 'FAILED'))
);

create index if not exists field_files_project_date_idx
  on public.field_files (project_code, work_date);

create index if not exists field_files_project_rev_idx
  on public.field_files (project_code, work_date, revision desc);

create table if not exists public.field_installation_rows (
  id uuid primary key default gen_random_uuid(),
  source_file_id uuid not null references public.field_files(id) on delete cascade,
  project_code text not null,
  work_date date not null,
  row_index int not null,
  budget_code text null,
  activity_code text null,
  description text null,
  unit text null,
  qty numeric null,
  zone text null,
  floor text null,
  crew text null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists field_installation_rows_project_date_idx
  on public.field_installation_rows (project_code, work_date);

create index if not exists field_installation_rows_budget_idx
  on public.field_installation_rows (budget_code);

create index if not exists field_installation_rows_activity_idx
  on public.field_installation_rows (activity_code);

create index if not exists field_installation_rows_zone_idx
  on public.field_installation_rows (zone);

create index if not exists field_installation_rows_file_idx
  on public.field_installation_rows (source_file_id);

alter table public.field_files enable row level security;
alter table public.field_installation_rows enable row level security;

drop policy if exists field_files_select_authenticated on public.field_files;
create policy field_files_select_authenticated
on public.field_files
for select
to authenticated
using (true);

drop policy if exists field_installation_rows_select_authenticated on public.field_installation_rows;
create policy field_installation_rows_select_authenticated
on public.field_installation_rows
for select
to authenticated
using (true);

-- Writes are intended via service-role server routes.
grant usage on schema public to authenticated, service_role;
grant select on table public.field_files, public.field_installation_rows to authenticated;
grant all privileges on table public.field_files, public.field_installation_rows to service_role;

notify pgrst, 'reload schema';
