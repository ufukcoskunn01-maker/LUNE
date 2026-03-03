create extension if not exists pgcrypto;

create or replace function public.set_row_updated_at_if_exists()
returns trigger
language plpgsql
as $$
begin
  if to_jsonb(new) ? 'updated_at' then
    new := jsonb_populate_record(new, jsonb_build_object('updated_at', now()));
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.field_installation_files') is null then
    create table public.field_installation_files (
      id uuid primary key default gen_random_uuid(),
      project_code text not null,
      work_date date not null,
      bucket_id text not null default 'imports',
      storage_path text not null,
      file_name text not null,
      file_kind text null,
      revision text not null default 'rev00',
      source_created_at timestamptz null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint field_installation_files_bucket_storage_unique unique (bucket_id, storage_path),
      constraint field_installation_files_project_date_revision_unique unique (project_code, work_date, revision)
    );
  else
    alter table public.field_installation_files add column if not exists file_kind text;
    alter table public.field_installation_files add column if not exists source_created_at timestamptz;
    alter table public.field_installation_files add column if not exists revision text;
    alter table public.field_installation_files alter column bucket_id set default 'imports';

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'field_installation_files'
        and column_name = 'rev'
    ) then
      execute $sql$
        update public.field_installation_files
        set revision = coalesce(nullif(revision, ''), 'rev' || lpad(rev::text, 2, '0'))
      $sql$;
    end if;

    execute $sql$
      update public.field_installation_files
      set revision = 'rev00'
      where coalesce(nullif(revision, ''), '') = ''
    $sql$;

    alter table public.field_installation_files alter column revision set not null;
    alter table public.field_installation_files alter column revision set default 'rev00';
  end if;
end;
$$;

create index if not exists field_installation_files_project_date_idx
  on public.field_installation_files (project_code, work_date);

create unique index if not exists field_installation_files_project_date_revision_uidx
  on public.field_installation_files (project_code, work_date, revision);


do $$
begin
  if to_regclass('public.field_installation_rows') is null then
    create table public.field_installation_rows (
      id uuid primary key default gen_random_uuid(),
      source_file_id uuid not null references public.field_installation_files(id) on delete cascade,
      project_code text not null,
      work_date date not null,
      row_no int,
      zone text,
      floor text,
      budget_code text,
      activity_code text,
      description text,
      unit text,
      qty numeric,
      manhours numeric,
      team_no int,
      elevation text,
      install_action text,
      location text,
      project_name text,
      orientation text,
      comment text,
      raw jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
  else
    alter table public.field_installation_rows add column if not exists row_no int;
    alter table public.field_installation_rows add column if not exists manhours numeric;
    alter table public.field_installation_rows add column if not exists team_no int;
    alter table public.field_installation_rows add column if not exists elevation text;
    alter table public.field_installation_rows add column if not exists install_action text;
    alter table public.field_installation_rows add column if not exists location text;
    alter table public.field_installation_rows add column if not exists project_name text;
    alter table public.field_installation_rows add column if not exists orientation text;
    alter table public.field_installation_rows add column if not exists comment text;
    alter table public.field_installation_rows add column if not exists raw jsonb not null default '{}'::jsonb;
  end if;
end;
$$;

create index if not exists field_installation_rows_project_date_idx
  on public.field_installation_rows (project_code, work_date);

create index if not exists field_installation_rows_file_idx
  on public.field_installation_rows (source_file_id);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'field_installation_rows'
      and column_name = 'row_index'
  ) then
    execute 'update public.field_installation_rows set row_no = coalesce(row_no, row_index) where row_no is null';
  end if;
end;
$$;

with dedup as (
  select ctid
  from (
    select
      ctid,
      row_number() over (partition by source_file_id, row_no order by ctid) as rn
    from public.field_installation_rows
    where row_no is not null
  ) ranked
  where rn > 1
)
delete from public.field_installation_rows t
using dedup d
where t.ctid = d.ctid;

create unique index if not exists field_installation_rows_source_file_row_no_uidx
  on public.field_installation_rows (source_file_id, row_no)
  where row_no is not null;


do $$
begin
  if to_regclass('public.field_installation_day_summary') is null then
    create table public.field_installation_day_summary (
      id uuid primary key default gen_random_uuid(),
      project_code text not null,
      work_date date not null,
      source_file_id uuid not null references public.field_installation_files(id) on delete cascade,
      material_total_mh numeric,
      people_total_mh numeric,
      indirect_total_mh numeric,
      direct_total_mh numeric,
      delta_mh numeric,
      efficiency_score numeric,
      is_mismatch boolean not null default false,
      warnings jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint field_installation_day_summary_uniq unique (project_code, work_date, source_file_id)
    );
  end if;
end;
$$;

create index if not exists field_installation_day_summary_project_date_idx
  on public.field_installation_day_summary (project_code, work_date);

create index if not exists field_installation_day_summary_source_file_idx
  on public.field_installation_day_summary (source_file_id);

drop trigger if exists trg_field_installation_files_updated_at on public.field_installation_files;
create trigger trg_field_installation_files_updated_at
before update on public.field_installation_files
for each row
execute function public.set_row_updated_at_if_exists();

drop trigger if exists trg_field_installation_day_summary_updated_at on public.field_installation_day_summary;
create trigger trg_field_installation_day_summary_updated_at
before update on public.field_installation_day_summary
for each row
execute function public.set_row_updated_at_if_exists();

drop trigger if exists trg_field_installation_rows_updated_at on public.field_installation_rows;

alter table public.field_installation_files enable row level security;
alter table public.field_installation_rows enable row level security;
alter table public.field_installation_day_summary enable row level security;

drop policy if exists field_installation_files_select_authenticated on public.field_installation_files;
create policy field_installation_files_select_authenticated
on public.field_installation_files
for select
to authenticated
using (true);

drop policy if exists field_installation_rows_select_authenticated on public.field_installation_rows;
create policy field_installation_rows_select_authenticated
on public.field_installation_rows
for select
to authenticated
using (true);

drop policy if exists field_installation_day_summary_select_authenticated on public.field_installation_day_summary;
create policy field_installation_day_summary_select_authenticated
on public.field_installation_day_summary
for select
to authenticated
using (true);

grant usage on schema public to anon, authenticated, service_role;
grant select on table public.field_installation_files to authenticated;
grant select on table public.field_installation_rows to authenticated;
grant select on table public.field_installation_day_summary to authenticated;
grant all privileges on table public.field_installation_files to service_role;
grant all privileges on table public.field_installation_rows to service_role;
grant all privileges on table public.field_installation_day_summary to service_role;

notify pgrst, 'reload schema';
