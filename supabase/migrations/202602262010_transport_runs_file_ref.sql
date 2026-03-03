alter table if exists public.transport_runs
  add column if not exists photo_file_id uuid references public.files(id) on delete set null;

alter table if exists public.transport_runs
  alter column photo_path drop not null;

alter table if exists public.transport_runs
  drop constraint if exists transport_runs_photo_path_format_chk;

create index if not exists transport_runs_photo_file_id_idx on public.transport_runs (photo_file_id);
