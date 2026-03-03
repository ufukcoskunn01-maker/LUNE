import { DataCard, DataTable, PageHeading, StatCard } from "@/components/apex/blocks";

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Profile"
        description="Personal preferences, security controls, and communication settings."
        badge="User: Olivia Jordan"
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Access Role"
          value="Project Manager"
          delta="Elevated project scope"
          note="Module-level edit permissions enabled."
          trend="flat"
        />
        <StatCard
          title="MFA Status"
          value="Enabled"
          delta="Last verified today"
          note="Multi-factor authentication is active."
          trend="up"
        />
        <StatCard
          title="Notification Rules"
          value="12"
          delta="3 critical alerts"
          note="Custom watchlists by project and module."
          trend="flat"
        />
        <StatCard
          title="Recent Sessions"
          value="4"
          delta="No anomalies"
          note="Session history with device tracking."
          trend="up"
        />
      </section>

      <DataCard title="Profile Settings" description="User-level preference and account controls">
        <DataTable
          columns={["Setting", "Value", "Status"]}
          rows={[
            ["Full Name", "Olivia Jordan", "Configured"],
            ["Email", "olivia.jordan@lune-pmo.com", "Verified"],
            ["Phone", "+1 832 555 0190", "Verified"],
            ["Timezone", "UTC+03:00", "Configured"],
            ["Language", "English", "Configured"],
            ["Digest Delivery", "Daily at 19:00", "Enabled"],
          ]}
        />
      </DataCard>
    </div>
  );
}
