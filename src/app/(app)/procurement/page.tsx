import { DataCard, DataTable, PageHeading, StatCard } from "@/components/apex/blocks";
import { StackedBars } from "@/components/apex/charts";
import { procurementOrders, vendorPerformance } from "@/lib/apex-data";

export default function ProcurementPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Procurement"
        description="Purchase order lifecycle controls, delivery reliability, and vendor performance management."
        badge="24 open POs"
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Procurement Value"
          value="$68.3M"
          delta="+$4.2M this month"
          note="Total value of active commitments."
          trend="up"
        />
        <StatCard
          title="Outstanding POs"
          value="24"
          delta="7 high priority"
          note="Open orders awaiting delivery or closeout."
          trend="flat"
        />
        <StatCard
          title="Overdue Deliveries"
          value="5"
          delta="-2 week over week"
          note="Delayed deliveries requiring expediting."
          trend="up"
        />
        <StatCard
          title="Invoice Match Rate"
          value="93.2%"
          delta="+1.1 points"
          note="PO-GRN-invoice three-way match health."
          trend="up"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <DataCard title="PO Register" description="Delivery and payment tracking for current procurement cycle">
          <DataTable
            columns={["PO", "Vendor", "Amount", "Required", "Actual", "Status", "Overdue"]}
            rows={procurementOrders.map((row) => [
              row.po,
              row.vendor,
              row.amount,
              row.requiredDate,
              row.actualDate,
              row.status,
              row.overdueDays ? `${row.overdueDays} days` : "-",
            ])}
          />
        </DataCard>

        <DataCard title="Vendor Scorecard" description="On-time delivery, quality, and commercial metrics">
          <StackedBars
            data={vendorPerformance}
            xKey="vendor"
            bars={[
              { key: "onTime", color: "#0284c7", name: "On-Time" },
              { key: "quality", color: "#10b981", name: "Quality" },
              { key: "commercial", color: "#f59e0b", name: "Commercial" },
            ]}
          />
        </DataCard>
      </section>
    </div>
  );
}
