import type { SupabaseClient } from "@supabase/supabase-js";
import { parseFieldInstallationWorkbook } from "@/lib/field-installation/ingest";

type FileRecord = {
  id: string;
  project_code: string;
  work_date: string;
  bucket_id: string | null;
  storage_path: string;
  file_name: string;
  revision: string | null;
};

export async function ingestFieldInstallationFileById(args: {
  admin: SupabaseClient;
  fileId: string;
}): Promise<{
  insertedRows: number;
  summary: ReturnType<typeof parseFieldInstallationWorkbook>["summary"];
}> {
  const fileRes = await args.admin
    .from("field_installation_files")
    .select("id,project_code,work_date,bucket_id,storage_path,file_name,revision")
    .eq("id", args.fileId)
    .returns<FileRecord[]>()
    .maybeSingle();

  if (fileRes.error) throw new Error(fileRes.error.message);
  if (!fileRes.data) throw new Error("File metadata not found.");

  const file = fileRes.data;
  const bucket = (file.bucket_id || "imports").trim() || "imports";

  const download = await args.admin.storage.from(bucket).download(file.storage_path);
  if (download.error || !download.data) {
    throw new Error(download.error?.message || "Storage download failed.");
  }

  const buffer = Buffer.from(await download.data.arrayBuffer());
  const parsedWorkbook = parseFieldInstallationWorkbook(buffer, file.work_date);

  const delRes = await args.admin.from("field_installation_rows").delete().eq("source_file_id", file.id);
  if (delRes.error) throw new Error(delRes.error.message);

  let insertedRows = 0;
  if (parsedWorkbook.rows.length) {
    for (let i = 0; i < parsedWorkbook.rows.length; i += 500) {
      const chunk = parsedWorkbook.rows.slice(i, i + 500).map((row) => ({
        source_file_id: file.id,
        project_code: file.project_code,
        work_date: file.work_date,
        row_no: row.row_no,
        zone: row.zone,
        floor: row.floor,
        budget_code: row.budget_code,
        activity_code: row.activity_code,
        description: row.description,
        unit: row.unit,
        qty: row.qty,
        manhours: row.manhours,
        team_no: row.team_no,
        elevation: row.elevation,
        install_action: row.install_action,
        location: row.location,
        project_name: row.project_name,
        orientation: row.orientation,
        comment: row.comment,
        raw: {
          ...row.raw,
          report_date: row.report_date,
        },
      }));

      const insRes = await args.admin.from("field_installation_rows").insert(chunk);
      if (insRes.error) throw new Error(insRes.error.message);
      insertedRows += chunk.length;
    }
  }

  const summary = parsedWorkbook.summary;
  const summaryRes = await args.admin.from("field_installation_day_summary").upsert(
    {
      project_code: file.project_code,
      work_date: file.work_date,
      source_file_id: file.id,
      material_total_mh: summary.material_total_mh,
      people_total_mh: summary.people_total_mh,
      indirect_total_mh: summary.indirect_total_mh,
      direct_total_mh: summary.direct_total_mh,
      delta_mh: summary.delta_mh,
      efficiency_score: summary.efficiency_score,
      is_mismatch: summary.is_mismatch,
      warnings: summary.warnings,
    },
    { onConflict: "project_code,work_date,source_file_id" }
  );

  if (summaryRes.error) throw new Error(summaryRes.error.message);

  return {
    insertedRows,
    summary,
  };
}
