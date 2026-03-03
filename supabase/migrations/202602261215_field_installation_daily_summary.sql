create extension if not exists pgcrypto;

create table if not exists public.field_installation_daily_summary (
  id uuid primary key default gen_random_uuid(),
  project_id text not null,
  report_date date not null,
  file_path text not null,
  uploaded_at timestamptz not null default now(),
  efficiency_pct numeric null,
  efficiency_status text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint field_installation_daily_summary_project_date_unique unique (project_id, report_date),
  constraint field_installation_daily_summary_efficiency_status_check
    check (efficiency_status in ('good', 'risk', 'bad', 'unknown'))
);

create index if not exists field_installation_daily_summary_project_month_idx
  on public.field_installation_daily_summary (project_id, report_date);

create or replace function public.set_field_installation_daily_summary_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_field_installation_daily_summary_updated_at on public.field_installation_daily_summary;
create trigger trg_field_installation_daily_summary_updated_at
before update on public.field_installation_daily_summary
for each row
execute procedure public.set_field_installation_daily_summary_updated_at();

alter table public.field_installation_daily_summary enable row level security;

drop policy if exists field_installation_daily_summary_select_authenticated on public.field_installation_daily_summary;
create policy field_installation_daily_summary_select_authenticated
on public.field_installation_daily_summary
for select
to authenticated
using (true);

grant select on table public.field_installation_daily_summary to authenticated;
grant all privileges on table public.field_installation_daily_summary to service_role;

notify pgrst, 'reload schema';
