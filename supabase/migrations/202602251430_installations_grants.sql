-- Ensure PostgREST can expose installations tables to authenticated role
-- and keep service-role access explicit for server-side routes.

grant usage on schema public to anon, authenticated, service_role;

do $$
begin
  if to_regclass('public.user_roles') is not null then
    execute 'grant select, insert, update, delete on table public.user_roles to authenticated';
    execute 'grant all privileges on table public.user_roles to service_role';
  end if;

  if to_regclass('public.installation_files') is not null then
    execute 'grant select, insert, update, delete on table public.installation_files to authenticated';
    execute 'grant all privileges on table public.installation_files to service_role';
  end if;

  if to_regclass('public.installation_rows') is not null then
    execute 'grant select, insert, update, delete on table public.installation_rows to authenticated';
    execute 'grant all privileges on table public.installation_rows to service_role';
  end if;

  if to_regclass('public.installation_day_summary') is not null then
    execute 'grant select, insert, update, delete on table public.installation_day_summary to authenticated';
    execute 'grant all privileges on table public.installation_day_summary to service_role';
  end if;

  if to_regclass('public.installation_rows_id_seq') is not null then
    execute 'grant usage, select on sequence public.installation_rows_id_seq to authenticated, service_role';
  end if;
end
$$;

-- Ask PostgREST to reload schema cache after grants/tables change.
notify pgrst, 'reload schema';
