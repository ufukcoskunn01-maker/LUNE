import type { Metadata } from "next";

import { PersonalReportsScreen } from "@/components/reports/PersonalReportsScreen";
import { DEFAULT_PROJECT_CODE, getPersonalReportsData, resolveReportDate } from "@/lib/personal-reports";

export const metadata: Metadata = {
  title: "Lune | Personal Reports",
  description: "Operational workspace for daily personal reporting.",
};

type PageProps = {
  searchParams?: Promise<{ date?: string }>;
};

export default async function DailyPersonalReportsPage({ searchParams }: PageProps) {
  const params = (await searchParams) || {};
  const date = resolveReportDate(params.date);
  let data = null;
  const loadError: string | null = await getLoadError();

  return <PersonalReportsScreen data={data} date={date} projectCode={DEFAULT_PROJECT_CODE} error={loadError} />;

  async function getLoadError() {
    try {
      data = await getPersonalReportsData(DEFAULT_PROJECT_CODE, date);
      return null;
    } catch (loadFailure) {
      return loadFailure instanceof Error ? loadFailure.message : "Failed to load personal reports.";
    }
  }
}
