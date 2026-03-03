import { DataCard, DataTable, PageHeading, StatCard } from "@/components/apex/blocks";
import { DonutChart, StackedBars, TrendLines } from "@/components/apex/charts";
import {
  AllocationRiskCard,
  BudgetTrackerCard,
  ForecastCurveCard,
  MomentumCard,
  TransactionFeedCard,
} from "@/components/apex/live-graphics";
import { dashboardKpis, financeTrend, projectStatusMix, reportJobs, weeklyTeamHours } from "@/lib/apex-data";
import {
  allocationMix,
  budgetLines,
  forecastCurve,
  momentumSeries,
  recentTransactions,
  spendByDay,
  totalBudget,
} from "@/lib/apex-live-data";

export default function DashboardPage() {
  const spendTotal = spendByDay.reduce((sum, day) => sum + day.amount, 0);

  return (
    <div className="relative overflow-hidden rounded-[30px] border border-white/15">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/project-backgrounds/water.jpg')" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(3,10,20,0.84)_0%,rgba(2,8,18,0.92)_100%)]" />

      <div className="relative space-y-6 p-4 md:p-6">
        <PageHeading
          title="Command Dashboard"
          description="Real-time portfolio intelligence with live trend cards, workforce activity, cost trajectory, and automation health."
          badge="Last synchronized: February 17, 2026 at 09:10"
        />

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {dashboardKpis.map((kpi) => (
            <StatCard key={kpi.title} {...kpi} />
          ))}
        </section>

        <ForecastCurveCard
          data={forecastCurve}
          currentValue={325472}
          futureValue={1240056}
          futureDelta={914584}
        />

        <section className="grid gap-6 xl:grid-cols-2">
          <MomentumCard data={momentumSeries} value={spendTotal} deltaPct={5.5} title="Spend This Month" />
          <TransactionFeedCard items={recentTransactions.slice(0, 5)} />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <BudgetTrackerCard
            lines={budgetLines}
            totalSpent={totalBudget.spent}
            totalLimit={totalBudget.limit}
          />
          <AllocationRiskCard items={allocationMix} />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <DataCard title="Financial Performance" description="Revenue, expense, and profit trend (USD millions)">
            <TrendLines
              data={financeTrend}
              xKey="period"
              series={[
                { key: "revenue", color: "#0284c7", name: "Revenue" },
                { key: "expense", color: "#ef4444", name: "Expense" },
                { key: "profit", color: "#10b981", name: "Profit" },
              ]}
            />
          </DataCard>

          <DataCard title="Project Status Distribution" description="Portfolio breakdown by execution status">
            <DonutChart data={projectStatusMix} nameKey="name" dataKey="value" />
          </DataCard>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <DataCard title="Weekly Team Activity" description="Worked hours by discipline">
            <StackedBars
              data={weeklyTeamHours}
              xKey="day"
              bars={[
                { key: "engineering", color: "#0284c7", name: "Engineering" },
                { key: "field", color: "#f59e0b", name: "Field" },
                { key: "qc", color: "#10b981", name: "QA/QC" },
              ]}
            />
          </DataCard>

          <DataCard title="Automation Job Monitor" description="Scheduled report workflows and delivery status">
            <DataTable
              columns={["Job", "Schedule", "Output", "Recipients", "Last Run", "Status"]}
              rows={reportJobs.map((job) => [job.name, job.schedule, job.output, job.recipients, job.lastRun, job.status])}
            />
          </DataCard>
        </section>
      </div>
    </div>
  );
}
