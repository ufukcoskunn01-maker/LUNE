import { DataCard, DataTable, PageHeading, StatCard } from "@/components/apex/blocks";
import { notifications } from "@/lib/apex-data";

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Notifications"
        description="Unified alert center for delays, cost variance thresholds, approvals, and document updates."
        badge="Unread: 9"
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Critical Alerts"
          value="3"
          delta="+1 today"
          note="Items requiring immediate action."
          trend="down"
        />
        <StatCard
          title="Approval Requests"
          value="12"
          delta="-4 from yesterday"
          note="Pending workflow approvals."
          trend="up"
        />
        <StatCard
          title="Mentions"
          value="27"
          delta="+5 today"
          note="Direct mentions in modules and reports."
          trend="flat"
        />
        <StatCard
          title="Digests Sent"
          value="44"
          delta="Last batch 19:00"
          note="Scheduled summary notifications delivered."
          trend="up"
        />
      </section>

      <DataCard title="Alert Feed" description="Chronological notification stream with source module context">
        <DataTable
          columns={["Type", "Severity", "Message", "Module", "Time"]}
          rows={notifications.map((item) => [item.type, item.severity, item.message, item.module, item.time])}
        />
      </DataCard>
    </div>
  );
}
