create unique index if not exists field_reports_installation_storage_path_uidx
  on public.field_reports (storage_path)
  where report_type = 'INSTALLATION';
