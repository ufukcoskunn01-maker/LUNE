import InstallationsWorkspace from "@/components/installations/InstallationsWorkspace";
import { DataCard, DataTable, PageHeading, StatCard } from "@/components/apex/blocks";
import { StackedBars, TrendLines } from "@/components/apex/charts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { progressByTrade, progressCurve } from "@/lib/apex-data";

export default function ProgressPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Progress Tracking"
        description="Physical and earned progress measurement across trades, areas, and reporting periods."
        badge="Daily updates enabled"
      />

      <Tabs defaultValue="summary" className="space-y-5">
        <TabsList className="w-full justify-start gap-2 rounded-xl border border-white/15 bg-black/35 p-1 text-zinc-300 md:w-auto">
          <TabsTrigger
            value="summary"
            className="data-[state=active]:bg-zinc-100/95 data-[state=active]:text-zinc-900"
          >
            Progress Summary
          </TabsTrigger>
          <TabsTrigger
            value="daily-installation"
            className="data-[state=active]:bg-zinc-100/95 data-[state=active]:text-zinc-900"
          >
            Installation Follow-up
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6">
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Overall Completion"
              value="57.0%"
              delta="+4.3 points MoM"
              note="Weighted physical completion across packages."
              trend="up"
            />
            <StatCard
              title="Progress Velocity"
              value="2.9% / month"
              delta="+0.4 vs last cycle"
              note="Rate of physical progress growth."
              trend="up"
            />
            <StatCard
              title="Productivity Index"
              value="0.96"
              delta="+0.03"
              note="Actual output vs planned output."
              trend="flat"
            />
            <StatCard
              title="Critical Workfronts"
              value="7"
              delta="2 behind target"
              note="High-impact packages requiring intervention."
              trend="down"
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <DataCard title="S-Curve Progress" description="Planned, actual, and earned completion trend">
              <TrendLines
                data={progressCurve}
                xKey="month"
                series={[
                  { key: "planned", color: "#0284c7", name: "Planned" },
                  { key: "actual", color: "#f59e0b", name: "Actual" },
                  { key: "earned", color: "#10b981", name: "Earned" },
                ]}
              />
            </DataCard>

            <DataCard title="Completion by Trade" description="Completed vs remaining scope by discipline">
              <StackedBars
                data={progressByTrade}
                xKey="trade"
                bars={[
                  { key: "complete", color: "#10b981", name: "Complete" },
                  { key: "remaining", color: "#ef4444", name: "Remaining" },
                ]}
              />
            </DataCard>
          </section>

          <DataCard title="Work Package Progress Register" description="Measurement methods and latest completion values">
            <DataTable
              columns={["Work Package", "Method", "Planned Qty", "Completed Qty", "Physical %", "Earned %", "Owner"]}
              rows={[
                ["WP-CIV-032", "Units Complete", "8,400 m3", "5,880 m3", "70%", "68%", "Civil JV"],
                ["WP-MEP-101", "50/50 Rule", "420 points", "216 points", "51%", "49%", "MEP Alliance"],
                ["WP-ARC-207", "Percent Complete", "12 floors", "5 floors", "42%", "40%", "Architectural Team"],
                ["WP-COM-330", "Weighted Milestones", "15 milestones", "7 milestones", "47%", "45%", "Commissioning Team"],
              ]}
            />
          </DataCard>
        </TabsContent>

        <TabsContent value="daily-installation" className="space-y-4">
          <InstallationsWorkspace embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
