-- Align field_installation_rows.source_file_id with field_installation_files ids.
-- This fixes inserts coming from /api/field-installation/day and sync pipelines.

do $$
begin
  if to_regclass('public.field_installation_rows') is null then
    raise notice 'public.field_installation_rows does not exist, skipping FK update';
    return;
  end if;

  if to_regclass('public.field_installation_files') is null then
    raise notice 'public.field_installation_files does not exist, skipping FK update';
    return;
  end if;

  alter table public.field_installation_rows
    drop constraint if exists field_installation_rows_source_file_id_fkey;

  alter table public.field_installation_rows
    add constraint field_installation_rows_source_file_id_fkey
    foreign key (source_file_id)
    references public.field_installation_files(id)
    on delete cascade;
end;
$$;

notify pgrst, 'reload schema';
