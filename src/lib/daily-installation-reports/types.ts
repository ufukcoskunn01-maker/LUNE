export const DAILY_INSTALLATION_STATUS = {
  UPLOADED: "uploaded",
  PROCESSING: "processing",
  READY: "ready",
  FAILED: "failed",
} as const;

export type DailyInstallationStatus = (typeof DAILY_INSTALLATION_STATUS)[keyof typeof DAILY_INSTALLATION_STATUS];

export type DailyInstallationFileRow = {
  id: string;
  project_id: string;
  report_date: string | null;
  storage_bucket: string;
  storage_path: string;
  original_filename: string;
  mime_type: string | null;
  file_size: number | null;
  file_hash: string | null;
  uploaded_by: string | null;
  status: DailyInstallationStatus;
  parse_error: string | null;
  parser_version: string | null;
  created_at: string;
  updated_at: string;
};

export type DailyInstallationReportRow = {
  id: string;
  file_id: string;
  project_id: string;
  report_date: string | null;
  report_title: string | null;
  contractor_name: string | null;
  zone: string | null;
  floor: string | null;
  summary_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type DailyInstallationReportItemRow = {
  id: string;
  report_id: string;
  sort_order: number;
  category: string | null;
  item_code: string | null;
  item_name: string;
  unit: string | null;
  planned_qty: number | null;
  actual_qty: number | null;
  cumulative_qty: number | null;
  remarks: string | null;
  raw_json: Record<string, unknown> | null;
  created_at: string;
};

export type NormalizedDailyInstallationItem = {
  sort_order: number;
  category: string | null;
  item_code: string | null;
  item_name: string;
  unit: string | null;
  planned_qty: number | null;
  actual_qty: number | null;
  cumulative_qty: number | null;
  remarks: string | null;
  raw_json: Record<string, unknown> | null;
};

export type NormalizedDailyInstallationReport = {
  report_date: string | null;
  report_title: string | null;
  contractor_name: string | null;
  zone: string | null;
  floor: string | null;
  summary_json: Record<string, unknown>;
  items: NormalizedDailyInstallationItem[];
};
