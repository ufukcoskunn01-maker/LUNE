-- Daily Field Reports (Installation) module
create extension if not exists pgcrypto;

create table if not exists public.field_reports (
  id uuid primary key default gen_random_uuid(),
  project_code text not null,
  report_type text not null default 'INSTALLATION',
  work_date date not null,
  storage_bucket text not null,
  storage_path text not null,
  file_name text not null,
  revision text null,
  file_hash text null,
  file_size bigint null,
  last_modified timestamptz null,
  imported_at timestamptz not null default now(),
  parse_status text not null default 'PENDING',
  parse_error text null,
  summary jsonb not null default '{}'::jsonb,
  constraint field_reports_parse_status_check check (parse_status in ('PENDING', 'OK', 'FAILED')),
  constraint field_reports_report_type_check check (report_type in ('INSTALLATION', 'PERSONAL', 'TRANSPORT'))
);

create unique index if not exists field_reports_project_type_work_date_uidx
  on public.field_reports (project_code, report_type, work_date);

create unique index if not exists field_reports_storage_bucket_path_uidx
  on public.field_reports (storage_bucket, storage_path);

create index if not exists field_reports_project_type_date_idx
  on public.field_reports (project_code, report_type, work_date);

create table if not exists public.field_report_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.field_reports(id) on delete cascade,
  row_no int not null,
  zone text null,
  floor text null,
  system text null,
  activity_code text null,
  material_code text null,
  item_name text null,
  unit text null,
  qty numeric null,
  notes text null
);

create index if not exists field_report_items_report_id_idx
  on public.field_report_items (report_id);

create index if not exists field_report_items_zone_idx
  on public.field_report_items (zone);

create index if not exists field_report_items_floor_idx
  on public.field_report_items (floor);

create index if not exists field_report_items_material_code_idx
  on public.field_report_items (material_code);

alter table public.field_reports enable row level security;
alter table public.field_report_items enable row level security;

drop policy if exists field_reports_read_authenticated on public.field_reports;
create policy field_reports_read_authenticated
on public.field_reports
for select
to authenticated
using (true);

drop policy if exists field_reports_write_app_admin on public.field_reports;
create policy field_reports_write_app_admin
on public.field_reports
for all
to authenticated
using (coalesce(auth.jwt() ->> 'role', '') = 'app_admin')
with check (coalesce(auth.jwt() ->> 'role', '') = 'app_admin');

drop policy if exists field_report_items_read_authenticated on public.field_report_items;
create policy field_report_items_read_authenticated
on public.field_report_items
for select
to authenticated
using (true);

drop policy if exists field_report_items_write_app_admin on public.field_report_items;
create policy field_report_items_write_app_admin
on public.field_report_items
for all
to authenticated
using (coalesce(auth.jwt() ->> 'role', '') = 'app_admin')
with check (coalesce(auth.jwt() ->> 'role', '') = 'app_admin');

create or replace function public.replace_field_report_items(
  p_report_id uuid,
  p_items jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  if p_report_id is null then
    raise exception 'p_report_id is required';
  end if;

  delete from public.field_report_items where report_id = p_report_id;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return 0;
  end if;

  insert into public.field_report_items (
    report_id,
    row_no,
    zone,
    floor,
    system,
    activity_code,
    material_code,
    item_name,
    unit,
    qty,
    notes
  )
  select
    p_report_id,
    coalesce((item->>'row_no')::int, 0),
    nullif(item->>'zone', ''),
    nullif(item->>'floor', ''),
    nullif(item->>'system', ''),
    nullif(item->>'activity_code', ''),
    nullif(item->>'material_code', ''),
    nullif(item->>'item_name', ''),
    nullif(item->>'unit', ''),
    case when coalesce(item->>'qty', '') = '' then null else (item->>'qty')::numeric end,
    nullif(item->>'notes', '')
  from jsonb_array_elements(p_items) as item;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

grant usage on schema public to authenticated, service_role;
grant select on table public.field_reports, public.field_report_items to authenticated;
grant all privileges on table public.field_reports, public.field_report_items to service_role;
grant execute on function public.replace_field_report_items(uuid, jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
