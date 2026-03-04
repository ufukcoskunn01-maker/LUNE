alter table if exists public.field_installation_files
  add column if not exists ingest_status text not null default 'uploaded';

alter table if exists public.field_installation_files
  add column if not exists uploaded_at timestamptz not null default now();

alter table if exists public.field_installation_files
  add column if not exists processing_started_at timestamptz null;

alter table if exists public.field_installation_files
  add column if not exists processing_finished_at timestamptz null;

alter table if exists public.field_installation_files
  add column if not exists last_retry_at timestamptz null;

alter table if exists public.field_installation_files
  add column if not exists last_error text null;

alter table if exists public.field_installation_files
  add column if not exists parser_version text null;

alter table if exists public.field_installation_files
  add column if not exists distinct_row_dates jsonb not null default '[]'::jsonb;

alter table if exists public.field_installation_files
  add column if not exists parsed_material_rows int not null default 0;

alter table if exists public.field_installation_files
  add column if not exists parsed_labor_rows int not null default 0;

alter table if exists public.field_installation_files
  add column if not exists inserted_material_rows int not null default 0;

alter table if exists public.field_installation_files
  add column if not exists inserted_labor_rows int not null default 0;

alter table if exists public.field_installation_files
  add column if not exists warning_count int not null default 0;

do $$
begin
  if to_regclass('public.field_installation_files') is null then
    return;
  end if;

  update public.field_installation_files
  set ingest_status = case
    when coalesce(rows_count, 0) > 0 then 'ready'
    when parse_error is not null and btrim(parse_error) <> '' then 'failed'
    when processed_at is not null and coalesce(rows_count, 0) = 0 then 'ready'
    else coalesce(nullif(ingest_status, ''), 'queued')
  end
  where ingest_status is null or btrim(ingest_status) = '' or ingest_status = 'uploaded';

  update public.field_installation_files
  set uploaded_at = coalesce(uploaded_at, source_created_at, created_at, now())
  where uploaded_at is null;

  update public.field_installation_files
  set warning_count = greatest(0, coalesce(warning_count, 0))
  where warning_count is null or warning_count < 0;
end
$$;

do $$
begin
  if to_regclass('public.field_installation_files') is null then
    return;
  end if;

  alter table public.field_installation_files
    drop constraint if exists field_installation_files_ingest_status_check;

  alter table public.field_installation_files
    add constraint field_installation_files_ingest_status_check
      check (ingest_status in ('uploaded', 'queued', 'processing', 'ready', 'failed', 'failed_timeout'));
end
$$;

create index if not exists field_installation_files_ingest_status_idx
  on public.field_installation_files (ingest_status);

create index if not exists field_installation_files_processing_started_idx
  on public.field_installation_files (processing_started_at);

notify pgrst, 'reload schema';
