create extension if not exists pgcrypto;

create table if not exists public.field_installation_files (
  id uuid primary key default gen_random_uuid(),
  project_code text not null,
  work_date date not null,
  bucket_id text not null default 'imports',
  storage_path text not null,
  file_name text not null,
  rev int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint field_installation_files_bucket_storage_unique unique (bucket_id, storage_path),
  constraint field_installation_files_project_date_rev_unique unique (project_code, work_date, rev)
);

create index if not exists field_installation_files_project_date_idx
  on public.field_installation_files (project_code, work_date);

create or replace function public.set_field_installation_files_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_field_installation_files_updated_at on public.field_installation_files;
create trigger trg_field_installation_files_updated_at
before update on public.field_installation_files
for each row
execute procedure public.set_field_installation_files_updated_at();

alter table public.field_installation_files enable row level security;

drop policy if exists field_installation_files_select_authenticated on public.field_installation_files;
create policy field_installation_files_select_authenticated
on public.field_installation_files
for select
to authenticated
using (true);

grant select on table public.field_installation_files to authenticated;
grant all privileges on table public.field_installation_files to service_role;

notify pgrst, 'reload schema';
