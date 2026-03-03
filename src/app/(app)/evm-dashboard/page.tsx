import { DataCard, DataTable, PageHeading, StatCard } from "@/components/apex/blocks";
import { TrendLines } from "@/components/apex/charts";
import { evmIndexTrend, evmSummary, evmTrend } from "@/lib/apex-data";

export default function EVMDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="EVM Dashboard"
        description="ANSI-748 aligned earned value controls with variance signals, performance indices, and forecast readiness."
        badge="Period: 2026-W06"
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="BCWS (PV)"
          value={`$${evmSummary.bcws.toFixed(1)}M`}
          delta="Planned value"
          note="Budgeted cost of work scheduled."
          trend="flat"
        />
        <StatCard
          title="BCWP (EV)"
          value={`$${evmSummary.bcwp.toFixed(1)}M`}
          delta="Earned value"
          note="Budgeted cost of work performed."
          trend="up"
        />
        <StatCard
          title="ACWP (AC)"
          value={`$${evmSummary.acwp.toFixed(1)}M`}
          delta="Actual cost"
          note="Actual cost of work performed."
          trend="down"
        />
        <StatCard
          title="EAC / VAC"
          value={`$${evmSummary.eac.toFixed(1)}M`}
          delta={`VAC ${evmSummary.vac.toFixed(1)}M`}
          note="Estimate at completion and variance at completion."
          trend="down"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <DataCard title="S-Curve (PV vs EV vs AC)" description="Cumulative trend for cost and schedule performance">
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

        <DataCard title="Performance Indices" description="CPI and SPI movement by reporting period">
          <TrendLines
            data={evmIndexTrend}
            xKey="period"
            series={[
              { key: "cpi", color: "#f59e0b", name: "CPI" },
              { key: "spi", color: "#8b5cf6", name: "SPI" },
            ]}
          />
        </DataCard>
      </section>

      <DataCard title="EVM Metrics Register" description="Control-account level summary metrics">
        <DataTable
          columns={["Metric", "Value", "Meaning"]}
          rows={[
            ["CPI", evmSummary.cpi.toFixed(2), "Cost performance index (EV/AC)"],
            ["SPI", evmSummary.spi.toFixed(2), "Schedule performance index (EV/PV)"],
            ["CV", evmSummary.cv.toFixed(1), "Cost variance (EV-AC)"],
            ["SV", evmSummary.sv.toFixed(1), "Schedule variance (EV-PV)"],
            ["BAC", evmSummary.bac.toFixed(1), "Budget at completion"],
            ["ETC", evmSummary.etc.toFixed(1), "Estimate to complete"],
          ]}
        />
      </DataCard>
    </div>
  );
}
