import Image from "next/image";
import { DataCard, DataTable, PageHeading, StatCard } from "@/components/apex/blocks";
import { StackedBars } from "@/components/apex/charts";
import { MomentumCard, TransactionFeedCard } from "@/components/apex/live-graphics";
import { reportJobs } from "@/lib/apex-data";
import { momentumSeries, recentTransactions, reportOutputTrend } from "@/lib/apex-live-data";

export default function ReportsPage() {
  return (
    <div className="relative overflow-hidden rounded-[30px] border border-white/15">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/project-backgrounds/meadow.jpg')" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(9,13,8,0.85)_0%,rgba(10,10,10,0.93)_100%)]" />

      <div className="relative space-y-6 p-4 md:p-6">
        <PageHeading
          title="Reports Hub"
          description="Automated reporting center with delivery analytics, refresh velocity, and board-ready export previews."
          badge="8 schedules active"
        />

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Reports Generated"
            value="146"
            delta="+18 this week"
            note="System-generated outputs across all modules."
            trend="up"
          />
          <StatCard
            title="Delivery Success"
            value="98.1%"
            delta="+0.5 points"
            note="Scheduled jobs completed and delivered."
            trend="up"
          />
          <StatCard
            title="Avg Generation Time"
            value="42s"
            delta="-6s"
            note="From trigger to completed export package."
            trend="up"
          />
          <StatCard
            title="Pending Failures"
            value="1"
            delta="Needs review"
            note="Exception queue requiring user action."
            trend="down"
          />
        </section>

        <DataCard title="Scheduled Jobs" description="Recurring report workflows with status tracking">
          <DataTable
            columns={["Name", "Schedule", "Output", "Recipients", "Last Run", "Status"]}
            rows={reportJobs.map((job) => [job.name, job.schedule, job.output, job.recipients, job.lastRun, job.status])}
          />
        </DataCard>

        <section className="grid gap-6 xl:grid-cols-2">
          <MomentumCard data={momentumSeries} title="Reports Last 30D" value={210150} deltaPct={5.5} />
          <TransactionFeedCard items={recentTransactions.slice(0, 4)} />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <DataCard title="Report Throughput Trend" description="Generated, delivered, and failed outputs by month">
            <StackedBars
              data={reportOutputTrend}
              xKey="month"
              bars={[
                { key: "generated", color: "#0284c7", name: "Generated" },
                { key: "delivered", color: "#10b981", name: "Delivered" },
                { key: "failed", color: "#ef4444", name: "Failed" },
              ]}
            />
          </DataCard>

          <DataCard title="Live Report Preview" description="Visual board pack style inspired by your reference assets">
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-2xl border">
                <Image
                  src="/origin/images/68b7555efe58911d1050d3e4_1b7239eb1b5f8e3b968aebdff411859a_6_Card_.svg"
                  alt="Report preview card"
                  width={1074}
                  height={568}
                  className="h-auto w-full"
                />
              </div>
              <div className="relative overflow-hidden rounded-2xl border">
                <Image
                  src="/origin/images/68bf62637b5f6813a3d48c56_portfolio-performance.png"
                  alt="Portfolio analytics preview"
                  width={716}
                  height={452}
                  className="h-auto w-full"
                />
              </div>
            </div>
          </DataCard>
        </section>

        <DataCard title="Report Catalog" description="Core reports available for one-click or scheduled generation">
          <DataTable
            columns={["Report Type", "Purpose", "Format", "Frequency"]}
            rows={[
              ["Executive Dashboard", "Portfolio KPIs and strategic risk", "PDF/XLSX", "Weekly"],
              ["EVM Performance", "PV/EV/AC variance and forecast", "XLSX/PDF", "Weekly"],
              ["Schedule Status", "Critical path and milestone health", "PDF/XLSX", "Daily"],
              ["Progress Summary", "Physical vs earned completion", "XLSX", "Daily"],
              ["Attendance Summary", "Trade/company manpower", "XLSX/CSV", "Daily"],
            ]}
          />
        </DataCard>
      </div>
    </div>
  );
}
