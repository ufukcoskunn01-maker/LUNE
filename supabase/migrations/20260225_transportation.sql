-- Transportation reporting: plates, shift runs, reporter ACL, and storage access
create extension if not exists pgcrypto;

create table if not exists public.transport_plates (
  plate text primary key,
  project_code text not null default 'A27',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.transport_runs (
  id uuid primary key default gen_random_uuid(),
  project_code text not null,
  work_date date not null,
  shift text not null check (shift in ('morning', 'evening')),
  plate text not null references public.transport_plates(plate),
  trips int not null default 1 check (trips >= 0 and trips <= 10),
  photo_path text not null,
  comment text,
  reported_by uuid not null references auth.users(id),
  reported_at timestamptz not null default now(),
  unique (project_code, work_date, shift, plate),
  constraint transport_runs_photo_path_format_chk
    check (
      photo_path ~ '^transport/[^/]+/[0-9]{4}-[0-9]{2}/[0-9]{4}-[0-9]{2}-[0-9]{2}/(morning|evening)/[^/]+/[0-9a-fA-F-]{36}\\.jpg$'
    )
);

create table if not exists public.transport_reporters (
  user_id uuid primary key references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists transport_runs_project_date_idx
  on public.transport_runs (project_code, work_date);

create index if not exists transport_runs_plate_idx
  on public.transport_runs (plate);

create index if not exists transport_runs_reported_by_idx
  on public.transport_runs (reported_by);

alter table public.transport_plates enable row level security;
alter table public.transport_runs enable row level security;
alter table public.transport_reporters enable row level security;

drop policy if exists transport_reporters_select_self on public.transport_reporters;
create policy transport_reporters_select_self
on public.transport_reporters
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists transport_plates_select_authenticated on public.transport_plates;
create policy transport_plates_select_authenticated
on public.transport_plates
for select
to authenticated
using (true);

drop policy if exists transport_plates_insert_reporters on public.transport_plates;
create policy transport_plates_insert_reporters
on public.transport_plates
for insert
to authenticated
with check (
  exists (
    select 1
    from public.transport_reporters tr
    where tr.user_id = auth.uid()
  )
);

drop policy if exists transport_plates_update_reporters on public.transport_plates;
create policy transport_plates_update_reporters
on public.transport_plates
for update
to authenticated
using (
  exists (
    select 1
    from public.transport_reporters tr
    where tr.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.transport_reporters tr
    where tr.user_id = auth.uid()
  )
);

drop policy if exists transport_runs_select_authenticated on public.transport_runs;
create policy transport_runs_select_authenticated
on public.transport_runs
for select
to authenticated
using (true);

drop policy if exists transport_runs_insert_reporters on public.transport_runs;
create policy transport_runs_insert_reporters
on public.transport_runs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.transport_reporters tr
    where tr.user_id = auth.uid()
  )
);

drop policy if exists transport_runs_update_reporters on public.transport_runs;
create policy transport_runs_update_reporters
on public.transport_runs
for update
to authenticated
using (
  exists (
    select 1
    from public.transport_reporters tr
    where tr.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.transport_reporters tr
    where tr.user_id = auth.uid()
  )
);

-- Storage bucket + policies
insert into storage.buckets (id, name, public)
values ('transport-approvals', 'transport-approvals', false)
on conflict (id) do update set public = excluded.public;

alter table storage.objects enable row level security;

drop policy if exists transport_approvals_read_authenticated on storage.objects;
create policy transport_approvals_read_authenticated
on storage.objects
for select
to authenticated
using (bucket_id = 'transport-approvals');

drop policy if exists transport_approvals_insert_reporters on storage.objects;
create policy transport_approvals_insert_reporters
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'transport-approvals'
  and name ~ '^transport/[^/]+/[0-9]{4}-[0-9]{2}/[0-9]{4}-[0-9]{2}-[0-9]{2}/(morning|evening)/[^/]+/[0-9a-fA-F-]{36}\\.jpg$'
  and exists (
    select 1
    from public.transport_reporters tr
    where tr.user_id = auth.uid()
  )
);
