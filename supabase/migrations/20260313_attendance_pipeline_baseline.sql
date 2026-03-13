-- =============================================================================
-- Attendance Import Pipeline — Baseline Migration
-- Generated : 2026-03-13
-- Target    : Supabase / PostgreSQL 15+
--
-- Object inventory
--   extensions : pgcrypto
--   tables     : attendance_source_files
--                attendance_daily_rows
--                attendance_reports
--   indexes    : see sections 1-3
--   functions  : claim_attendance_file_for_processing(uuid)
--                promote_attendance_report(text, date, uuid)
--   views      : attendance_active_rows
--   realtime   : attendance_source_files, attendance_reports
--
-- Idempotent — safe to run repeatedly on a fresh environment.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1. attendance_source_files
--
-- Immutable file registry.
-- One row per unique (storage_path, content_hash) pair.
-- Same storage_path may appear many times when content changes.
-- ---------------------------------------------------------------------------
create table if not exists public.attendance_source_files (
  id              uuid        primary key default gen_random_uuid(),
  project_code    text        not null,
  report_date     date        not null,
  storage_path    text        not null,
  file_name       text        not null,
  revision_no     integer,
  file_size       bigint,
  content_hash    text,

  status          text        not null default 'pending'
                              check (status in ('pending', 'processing', 'done', 'failed')),
  row_count       integer     check (row_count is null or row_count >= 0),
  error_message   text,
  processed_at    timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  check (revision_no is null or revision_no >= 0),
  check (file_size is null or file_size >= 0),

  unique (storage_path, content_hash)
);

comment on table public.attendance_source_files is
  'Immutable registry of imported attendance files. Same storage_path may appear multiple times when content changes; exact byte-duplicates are rejected by unique(storage_path, content_hash).';

comment on column public.attendance_source_files.status is
  'Pipeline lifecycle: pending -> processing -> done | failed';

comment on column public.attendance_source_files.content_hash is
  'SHA-256 hex digest of the raw file bytes.';

create index if not exists idx_asf_project_date
  on public.attendance_source_files (project_code, report_date);

create index if not exists idx_asf_storage_path
  on public.attendance_source_files (storage_path);

create index if not exists idx_asf_status_retry
  on public.attendance_source_files (status)
  where status in ('pending', 'failed');

create index if not exists idx_asf_processing_updated_at
  on public.attendance_source_files (updated_at)
  where status = 'processing';

create index if not exists idx_asf_created_at
  on public.attendance_source_files (created_at desc);

-- ---------------------------------------------------------------------------
-- 2. attendance_daily_rows
--
-- Immutable parsed row snapshots for one source file.
-- Promotion makes a snapshot live; row data itself is never updated.
-- ---------------------------------------------------------------------------
create table if not exists public.attendance_daily_rows (
  id                  uuid    primary key default gen_random_uuid(),
  source_file_id      uuid    not null
                              references public.attendance_source_files (id)
                              on delete cascade,

  source_sheet        text    not null default 'ЕЖЕДНЕВНЫЙ ОТЧЕТ',
  source_row_no       integer not null check (source_row_no > 0),
  display_no          integer check (display_no is null or display_no > 0),

  section_title       text,
  section_order       integer check (section_order is null or section_order > 0),

  employee_id         text,
  full_name           text    not null,
  discipline_group    text,
  discipline_code     text,
  profession_group    text,
  position_structural text,
  position_hr         text,
  company             text,

  absence_reason      text,
  status              text generated always as (
                        case
                          when absence_reason is null
                            or trim(absence_reason) = ''
                          then 'Present'
                          else 'Absent'
                        end
                      ) stored,

  notes               text,
  is_mobilization     boolean not null default false,

  unique (source_file_id, source_row_no)
);

comment on table public.attendance_daily_rows is
  'Immutable parsed attendance rows for one source file snapshot. Rows are never updated after insert; see attendance_reports for promotion.';

comment on column public.attendance_daily_rows.status is
  'Generated column: Present when absence_reason is blank, Absent otherwise.';

comment on column public.attendance_daily_rows.is_mobilization is
  'True when the row represents a mobilisation/demobilisation event rather than a regular work day.';

create index if not exists idx_adr_source_file
  on public.attendance_daily_rows (source_file_id);

create index if not exists idx_adr_employee_id
  on public.attendance_daily_rows (employee_id);

create index if not exists idx_adr_full_name
  on public.attendance_daily_rows (full_name);

-- ---------------------------------------------------------------------------
-- 3. attendance_reports
--
-- Active pointer per (project_code, report_date).
-- Promotion/rollback updates this table only.
-- ---------------------------------------------------------------------------
create table if not exists public.attendance_reports (
  project_code    text        not null,
  report_date     date        not null,
  active_file_id  uuid        not null
                              references public.attendance_source_files (id),
  version         integer     not null default 1 check (version > 0),
  updated_at      timestamptz not null default now(),

  primary key (project_code, report_date)
);

comment on table public.attendance_reports is
  'Active promoted snapshot per (project_code, report_date). Promotion and rollback are O(1) upserts on this table; row data is never copied.';

comment on column public.attendance_reports.version is
  'Monotonically increasing counter incremented on every promotion or rollback.';

create index if not exists idx_ar_active_file
  on public.attendance_reports (active_file_id);

-- ---------------------------------------------------------------------------
-- 4. RPC: claim_attendance_file_for_processing(uuid)
--
-- Atomic compare-and-swap from pending|failed -> processing.
-- Returns the claimed row, or 0 rows if another worker already won.
-- ---------------------------------------------------------------------------
create or replace function public.claim_attendance_file_for_processing(
  p_source_file_id uuid
)
returns setof public.attendance_source_files
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    update public.attendance_source_files
    set
      status        = 'processing',
      error_message = null,
      updated_at    = now()
    where
      id = p_source_file_id
      and status in ('pending', 'failed')
    returning *;
end;
$$;

comment on function public.claim_attendance_file_for_processing(uuid) is
  'Atomically transitions a file from pending|failed to processing. Returns the updated row on success, empty on a lost race.';

-- ---------------------------------------------------------------------------
-- 5. RPC: promote_attendance_report(text, date, uuid)
--
-- Upserts the active pointer and bumps version on every promotion.
-- Calling with an older source_file_id performs rollback instantly.
-- ---------------------------------------------------------------------------
create or replace function public.promote_attendance_report(
  p_project_code   text,
  p_report_date    date,
  p_active_file_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.attendance_reports (
    project_code,
    report_date,
    active_file_id,
    version,
    updated_at
  )
  values (
    p_project_code,
    p_report_date,
    p_active_file_id,
    1,
    now()
  )
  on conflict (project_code, report_date)
  do update set
    active_file_id = excluded.active_file_id,
    version        = public.attendance_reports.version + 1,
    updated_at     = now();
end;
$$;

comment on function public.promote_attendance_report(text, date, uuid) is
  'Upserts the active pointer for a project/date pair and increments the version. Calling with an older source_file_id performs an instant rollback.';

-- ---------------------------------------------------------------------------
-- 6. View: attendance_active_rows
--
-- Resolves the currently promoted snapshot and surfaces row data
-- alongside pointer metadata.
-- ---------------------------------------------------------------------------
create or replace view public.attendance_active_rows as
select
  ar.project_code,
  ar.report_date,
  ar.version,
  ar.updated_at as promoted_at,

  r.id,
  r.source_file_id,
  r.source_sheet,
  r.source_row_no,
  r.display_no,
  r.section_title,
  r.section_order,
  r.employee_id,
  r.full_name,
  r.discipline_group,
  r.discipline_code,
  r.profession_group,
  r.position_structural,
  r.position_hr,
  r.company,
  r.absence_reason,
  r.status,
  r.notes,
  r.is_mobilization
from public.attendance_reports ar
join public.attendance_daily_rows r
  on r.source_file_id = ar.active_file_id;

comment on view public.attendance_active_rows is
  'Live attendance rows resolved through attendance_reports.active_file_id. Reflects promotions and rollbacks instantly without touching row data.';

-- ---------------------------------------------------------------------------
-- 7. Realtime subscriptions
--
-- Source-file registry + active pointer only.
-- attendance_daily_rows is intentionally excluded because it is large
-- and immutable after insert.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then

    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where p.pubname = 'supabase_realtime'
        and n.nspname = 'public'
        and c.relname = 'attendance_source_files'
    ) then
      alter publication supabase_realtime
        add table public.attendance_source_files;
    end if;

    if not exists (
      select 1
      from pg_publication_rel pr
      join pg_publication p on p.oid = pr.prpubid
      join pg_class c on c.oid = pr.prrelid
      join pg_namespace n on n.oid = c.relnamespace
      where p.pubname = 'supabase_realtime'
        and n.nspname = 'public'
        and c.relname = 'attendance_reports'
    ) then
      alter publication supabase_realtime
        add table public.attendance_reports;
    end if;

  end if;
end
$$;

commit;