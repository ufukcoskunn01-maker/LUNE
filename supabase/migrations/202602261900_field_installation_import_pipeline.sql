create extension if not exists pgcrypto;

alter table if exists public.field_installation_rows
  add column if not exists report_date date;

create table if not exists public.field_installation_labor_rows (
  id uuid primary key default gen_random_uuid(),
  project_code text not null,
  work_date date not null,
  source_file_id uuid not null references public.field_installation_files(id) on delete cascade,
  team_no text null,
  employee_id text null,
  full_name text null,
  title text null,
  hours_indirect numeric null,
  hours_direct numeric null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint field_installation_labor_rows_source_identity_unique
    unique (source_file_id, employee_id, full_name, title, team_no)
);

create index if not exists field_installation_labor_rows_project_date_idx
  on public.field_installation_labor_rows (project_code, work_date);

create index if not exists field_installation_labor_rows_source_idx
  on public.field_installation_labor_rows (source_file_id);

create table if not exists public.field_installation_day_summary (
  id uuid primary key default gen_random_uuid(),
  project_code text not null,
  work_date date not null,
  source_file_id uuid not null references public.field_installation_files(id) on delete cascade,
  mh_material numeric not null default 0,
  mh_direct numeric not null default 0,
  mh_indirect numeric not null default 0,
  mh_total numeric not null default 0,
  date_ok boolean not null default true,
  mh_match_ok boolean not null default true,
  attendance_match_ok boolean not null default true,
  efficiency_pct numeric not null default 0,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint field_installation_day_summary_project_date_unique unique (project_code, work_date)
);

create index if not exists field_installation_day_summary_project_date_idx
  on public.field_installation_day_summary (project_code, work_date);

create index if not exists field_installation_day_summary_source_idx
  on public.field_installation_day_summary (source_file_id);

create or replace function public.set_field_installation_day_summary_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_field_installation_day_summary_updated_at on public.field_installation_day_summary;
create trigger trg_field_installation_day_summary_updated_at
before update on public.field_installation_day_summary
for each row
execute procedure public.set_field_installation_day_summary_updated_at();

alter table public.field_installation_labor_rows enable row level security;
alter table public.field_installation_day_summary enable row level security;

drop policy if exists field_installation_labor_rows_select_authenticated on public.field_installation_labor_rows;
create policy field_installation_labor_rows_select_authenticated
on public.field_installation_labor_rows
for select
to authenticated
using (true);

drop policy if exists field_installation_day_summary_select_authenticated on public.field_installation_day_summary;
create policy field_installation_day_summary_select_authenticated
on public.field_installation_day_summary
for select
to authenticated
using (true);

grant select on table public.field_installation_labor_rows, public.field_installation_day_summary to authenticated;
grant all privileges on table public.field_installation_labor_rows, public.field_installation_day_summary to service_role;

notify pgrst, 'reload schema';
