import { exportPersonalReportsMonthlyWorkbook } from "@/lib/personal-reports-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const projectCode = (url.searchParams.get("projectCode") || "").trim();
    const month = (url.searchParams.get("month") || "").trim();

    if (!projectCode) {
      return Response.json({ ok: false, error: "projectCode is required." }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return Response.json({ ok: false, error: "month must be in YYYY-MM format." }, { status: 400 });
    }

    const result = await exportPersonalReportsMonthlyWorkbook(projectCode, month);

    return new Response(new Uint8Array(result.content), {
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename=\"${result.fileName}\"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Monthly export failed.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
