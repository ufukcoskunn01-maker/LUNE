create extension if not exists pgcrypto;

create or replace function public.set_daily_installation_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table if not exists public.daily_installation_report_files (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  report_date date null,
  storage_bucket text not null,
  storage_path text not null unique,
  original_filename text not null,
  mime_type text null,
  file_size bigint null,
  file_hash text null,
  uploaded_by uuid null references auth.users(id) on delete set null,
  status text not null default 'uploaded',
  parse_error text null,
  parser_version text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_installation_report_files_status_check
    check (status in ('uploaded', 'processing', 'ready', 'failed'))
);

create index if not exists daily_installation_report_files_project_idx
  on public.daily_installation_report_files (project_id);

create index if not exists daily_installation_report_files_project_date_idx
  on public.daily_installation_report_files (project_id, report_date desc);

create index if not exists daily_installation_report_files_status_idx
  on public.daily_installation_report_files (status);

drop trigger if exists trg_daily_installation_report_files_updated_at on public.daily_installation_report_files;
create trigger trg_daily_installation_report_files_updated_at
before update on public.daily_installation_report_files
for each row
execute procedure public.set_daily_installation_updated_at();

create table if not exists public.daily_installation_reports (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.daily_installation_report_files(id) on delete cascade,
  project_id text not null,
  report_date date null,
  report_title text null,
  contractor_name text null,
  zone text null,
  floor text null,
  summary_json jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_installation_reports_file_unique unique (file_id)
);

create index if not exists daily_installation_reports_project_date_idx
  on public.daily_installation_reports (project_id, report_date desc);

create index if not exists daily_installation_reports_file_idx
  on public.daily_installation_reports (file_id);

drop trigger if exists trg_daily_installation_reports_updated_at on public.daily_installation_reports;
create trigger trg_daily_installation_reports_updated_at
before update on public.daily_installation_reports
for each row
execute procedure public.set_daily_installation_updated_at();

create table if not exists public.daily_installation_report_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_installation_reports(id) on delete cascade,
  sort_order integer not null default 0,
  category text null,
  item_code text null,
  item_name text not null,
  unit text null,
  planned_qty numeric null,
  actual_qty numeric null,
  cumulative_qty numeric null,
  remarks text null,
  raw_json jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists daily_installation_report_items_report_idx
  on public.daily_installation_report_items (report_id, sort_order);

create index if not exists daily_installation_report_items_item_code_idx
  on public.daily_installation_report_items (item_code);

create unique index if not exists daily_installation_report_items_unique_row_idx
  on public.daily_installation_report_items (report_id, sort_order, item_name, coalesce(item_code, ''));

alter table public.daily_installation_report_files enable row level security;
alter table public.daily_installation_reports enable row level security;
alter table public.daily_installation_report_items enable row level security;

drop policy if exists daily_installation_report_files_select_authenticated on public.daily_installation_report_files;
create policy daily_installation_report_files_select_authenticated
on public.daily_installation_report_files
for select
to authenticated
using (true);

drop policy if exists daily_installation_reports_select_authenticated on public.daily_installation_reports;
create policy daily_installation_reports_select_authenticated
on public.daily_installation_reports
for select
to authenticated
using (true);

drop policy if exists daily_installation_report_items_select_authenticated on public.daily_installation_report_items;
create policy daily_installation_report_items_select_authenticated
on public.daily_installation_report_items
for select
to authenticated
using (true);

grant select on table
  public.daily_installation_report_files,
  public.daily_installation_reports,
  public.daily_installation_report_items
to authenticated;

grant all privileges on table
  public.daily_installation_report_files,
  public.daily_installation_reports,
  public.daily_installation_report_items
to service_role;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    begin
      execute 'alter publication supabase_realtime add table public.daily_installation_report_files';
    exception
      when duplicate_object then null;
    end;
    begin
      execute 'alter publication supabase_realtime add table public.daily_installation_reports';
    exception
      when duplicate_object then null;
    end;
    begin
      execute 'alter publication supabase_realtime add table public.daily_installation_report_items';
    exception
      when duplicate_object then null;
    end;
  end if;
end;
$$;

notify pgrst, 'reload schema';
