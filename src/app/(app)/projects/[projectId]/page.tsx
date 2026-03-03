import Link from "next/link";
import { notFound } from "next/navigation";
import { DataCard, DataTable, PageHeading, StatCard } from "@/components/apex/blocks";
import { TrendLines } from "@/components/apex/charts";
import { evmTrend, milestoneTrend, portfolioProjects, scheduleDelta } from "@/lib/apex-data";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = portfolioProjects.find((item) => item.id === projectId);
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <PageHeading
        title={`${project.name} (${project.id})`}
        description={`${project.category} project in ${project.location}. Control status, EVM trends, schedule deltas, and delivery risk in one view.`}
        badge={`Manager: ${project.manager}`}
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Execution Status"
          value={project.status}
          delta={`${project.progress}% complete`}
          note={`Current phase: ${project.phase}`}
          trend={project.status === "Delayed" ? "down" : "up"}
        />
        <StatCard
          title="Budget"
          value={`$${project.budgetM.toFixed(1)}M`}
          delta={`Spent: $${project.spentM.toFixed(1)}M`}
          note={`Remaining: $${(project.budgetM - project.spentM).toFixed(1)}M`}
          trend="flat"
        />
        <StatCard
          title="Deadline"
          value={project.deadline}
          delta="Schedule watchlist active"
          note="Critical-path milestones are auto-monitored."
          trend="flat"
        />
        <StatCard
          title="Team Size"
          value={`${project.teamSize}`}
          delta="+6 this period"
          note="Direct + indirect personnel assigned."
          trend="up"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <DataCard title="EVM Performance" description="PV/EV/AC trend for project controls reviews">
          <TrendLines
            data={evmTrend}
            xKey="period"
            series={[
              { key: "pv", color: "#0284c7", name: "PV" },
              { key: "ev", color: "#10b981", name: "EV" },
              { key: "ac", color: "#ef4444", name: "AC" },
            ]}
          />
        </DataCard>

        <DataCard title="Milestone Completion" description="Planned vs actual milestone delivery">
          <TrendLines
            data={milestoneTrend}
            xKey="period"
            series={[
              { key: "planned", color: "#0284c7", name: "Planned" },
              { key: "actual", color: "#f59e0b", name: "Actual" },
            ]}
          />
        </DataCard>
      </section>

      <DataCard
        title="Schedule Delta Log"
        description="Key baseline-to-update changes used in claims and recovery analysis."
        right={
          <Link href="/schedule-comparison" className="rounded-xl border bg-background px-3 py-2 text-xs hover:bg-accent/30">
            Open Full Comparison
          </Link>
        }
      >
        <DataTable
          columns={["Activity", "Baseline Finish", "Current Finish", "Delta Days", "Critical"]}
          rows={scheduleDelta.map((row) => [
            row.activity,
            row.baselineFinish,
            row.currentFinish,
            row.deltaDays > 0 ? `+${row.deltaDays}` : row.deltaDays,
            row.critical ? "Yes" : "No",
          ])}
        />
      </DataCard>
    </div>
  );
}
