-- Installation daily field reports module
create extension if not exists pgcrypto;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'planner', 'viewer')),
  created_at timestamptz not null default now()
);

create or replace function public.is_admin_or_planner(user_uuid uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  result boolean;
begin
  if user_uuid is null then
    return false;
  end if;

  if to_regclass('public.user_roles') is not null then
    select exists(
      select 1
      from public.user_roles ur
      where ur.user_id = user_uuid
        and ur.role in ('admin', 'planner')
    )
    into result;

    if coalesce(result, false) then
      return true;
    end if;
  end if;

  if to_regclass('public.profiles') is not null then
    begin
      execute 'select exists(
        select 1 from public.profiles p
        where p.id = $1
          and (coalesce(p.is_admin, false) = true or coalesce(p.role, '''') in (''admin'', ''planner''))
      )'
      into result
      using user_uuid;
      return coalesce(result, false);
    exception
      when undefined_column then
        return false;
    end;
  end if;

  return false;
end;
$$;

create table if not exists public.installation_files (
  id uuid primary key default gen_random_uuid(),
  project_code text not null,
  work_date date not null,
  rev int not null default 0,
  filename text not null,
  storage_path text not null unique,
  file_size bigint,
  last_modified timestamptz,
  parsed_rows int not null default 0,
  checksum text,
  created_at timestamptz not null default now()
);

create unique index if not exists installation_files_project_date_rev_filename_idx
  on public.installation_files (project_code, work_date, rev, filename);

create index if not exists installation_files_project_date_idx
  on public.installation_files (project_code, work_date);

create table if not exists public.installation_rows (
  id bigserial primary key,
  file_id uuid not null references public.installation_files(id) on delete cascade,
  project_code text not null,
  work_date date not null,
  budget_code text,
  activity_code text,
  description text,
  manhours numeric,
  qty numeric,
  uom text,
  turk_count int,
  local_count int,
  turk_adsa numeric,
  local_adsa numeric,
  created_at timestamptz not null default now()
);

create index if not exists installation_rows_project_date_idx
  on public.installation_rows (project_code, work_date);

create index if not exists installation_rows_activity_code_idx
  on public.installation_rows (activity_code);

create index if not exists installation_rows_budget_code_idx
  on public.installation_rows (budget_code);

create table if not exists public.installation_day_summary (
  project_code text not null,
  work_date date not null,
  latest_file_id uuid references public.installation_files(id) on delete set null,
  rows_count int not null default 0,
  total_manhours numeric,
  total_qty numeric,
  updated_at timestamptz not null default now(),
  primary key (project_code, work_date)
);

alter table public.user_roles enable row level security;
alter table public.installation_files enable row level security;
alter table public.installation_rows enable row level security;
alter table public.installation_day_summary enable row level security;

drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own
on public.user_roles
for select
to authenticated
using (user_id = auth.uid() or public.is_admin_or_planner(auth.uid()));

drop policy if exists installation_files_select_authenticated on public.installation_files;
create policy installation_files_select_authenticated
on public.installation_files
for select
to authenticated
using (true);

drop policy if exists installation_files_write_admin_planner on public.installation_files;
create policy installation_files_write_admin_planner
on public.installation_files
for all
to authenticated
using (public.is_admin_or_planner(auth.uid()))
with check (public.is_admin_or_planner(auth.uid()));

drop policy if exists installation_rows_select_authenticated on public.installation_rows;
create policy installation_rows_select_authenticated
on public.installation_rows
for select
to authenticated
using (true);

drop policy if exists installation_rows_write_admin_planner on public.installation_rows;
create policy installation_rows_write_admin_planner
on public.installation_rows
for all
to authenticated
using (public.is_admin_or_planner(auth.uid()))
with check (public.is_admin_or_planner(auth.uid()));

drop policy if exists installation_summary_select_authenticated on public.installation_day_summary;
create policy installation_summary_select_authenticated
on public.installation_day_summary
for select
to authenticated
using (true);

drop policy if exists installation_summary_write_admin_planner on public.installation_day_summary;
create policy installation_summary_write_admin_planner
on public.installation_day_summary
for all
to authenticated
using (public.is_admin_or_planner(auth.uid()))
with check (public.is_admin_or_planner(auth.uid()));

grant execute on function public.is_admin_or_planner(uuid) to authenticated;
