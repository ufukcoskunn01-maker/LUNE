import Link from "next/link";
import { DataCard, DataTable, PageHeading, StatCard } from "@/components/apex/blocks";
import { portfolioProjects } from "@/lib/apex-data";

const totalBudget = portfolioProjects.reduce((sum, item) => sum + item.budgetM, 0);
const totalSpent = portfolioProjects.reduce((sum, item) => sum + item.spentM, 0);
const totalTeam = portfolioProjects.reduce((sum, item) => sum + item.teamSize, 0);
const avgProgress = Math.round(portfolioProjects.reduce((sum, item) => sum + item.progress, 0) / portfolioProjects.length);

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Projects Portfolio"
        description="Comprehensive project portfolio management with status control, financial exposure, and execution progress."
        badge="26 active projects"
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Budget"
          value={`$${totalBudget.toFixed(1)}M`}
          delta="+4.1% vs baseline"
          note="Portfolio-wide approved budget."
          trend="up"
        />
        <StatCard
          title="Total Spent"
          value={`$${totalSpent.toFixed(1)}M`}
          delta="52.6% burn"
          note="Cost to date across active projects."
          trend="flat"
        />
        <StatCard
          title="Total Team Members"
          value={`${totalTeam}`}
          delta="+18 this week"
          note="Combined direct and indirect staffing."
          trend="up"
        />
        <StatCard
          title="Average Progress"
          value={`${avgProgress}%`}
          delta="+3 points"
          note="Weighted average physical progress."
          trend="up"
        />
      </section>

      <DataCard
        title="Portfolio Register"
        description="Filter-ready project register with scope, cost, schedule, and responsible manager."
        right={<div className="rounded-xl border bg-background px-3 py-2 text-xs">Filters: status, phase, category, location</div>}
      >
        <DataTable
          columns={[
            "Project",
            "Status",
            "Progress",
            "Budget",
            "Spent",
            "Deadline",
            "Location",
            "Phase",
            "Category",
            "Manager",
            "Team",
            "Detail",
          ]}
          rows={portfolioProjects.map((project) => [
            project.name,
            project.status,
            `${project.progress}%`,
            `$${project.budgetM.toFixed(1)}M`,
            `$${project.spentM.toFixed(1)}M`,
            project.deadline,
            project.location,
            project.phase,
            project.category,
            project.manager,
            project.teamSize,
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="rounded-lg border bg-background px-2 py-1 text-xs hover:bg-accent/30"
            >
              Open
            </Link>,
          ])}
        />
      </DataCard>
    </div>
  );
}
