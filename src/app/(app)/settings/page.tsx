import { DataCard, DataTable, PageHeading, StatCard } from "@/components/apex/blocks";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Settings"
        description="System, project, and user configuration controls for enterprise deployments."
        badge="Environment: Production"
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Company Profiles"
          value="4"
          delta="All validated"
          note="Configured business entities and branding."
          trend="flat"
        />
        <StatCard
          title="Integration Endpoints"
          value="9"
          delta="+1 this month"
          note="ERP, API, and document connectors."
          trend="up"
        />
        <StatCard
          title="Workflow Templates"
          value="18"
          delta="+3"
          note="Approval and escalation templates available."
          trend="up"
        />
        <StatCard
          title="Backup Health"
          value="100%"
          delta="Last run 02:00 UTC"
          note="Automated backup and restore checks passed."
          trend="up"
        />
      </section>

      <DataCard title="Settings Matrix" description="Main configuration domains and current values">
        <DataTable
          columns={["Domain", "Current Value", "Owner", "Last Updated"]}
          rows={[
            ["Theme", "Dark (default)", "Platform Admin", "2026-02-14"],
            ["Language", "English", "Platform Admin", "2026-02-01"],
            ["Timezone", "UTC+03:00", "Platform Admin", "2026-01-28"],
            ["Date Format", "YYYY-MM-DD", "Controls Team", "2026-02-03"],
            ["Approval Chain", "PM -> Controls Lead -> Director", "PMO", "2026-02-10"],
            ["Notification Policy", "Critical + Daily Digest", "PMO", "2026-02-12"],
          ]}
        />
      </DataCard>
    </div>
  );
}
