import { DataCard, DataTable, PageHeading, StatCard } from "@/components/apex/blocks";
import { teamMembers } from "@/lib/apex-data";

export default function TeamPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Team Management"
        description="Role-based access and organization-wide workforce visibility for project controls execution."
        badge="1,284 active users"
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Super Admins"
          value="6"
          delta="No change"
          note="Users with full system privileges."
          trend="flat"
        />
        <StatCard
          title="Project Managers"
          value="44"
          delta="+2 this month"
          note="Active PM profiles across portfolio."
          trend="up"
        />
        <StatCard
          title="Read-Only Users"
          value="189"
          delta="+14 this quarter"
          note="Client and executive observers."
          trend="up"
        />
        <StatCard
          title="Inactive Accounts"
          value="12"
          delta="-5 month over month"
          note="Accounts pending deactivation workflow."
          trend="up"
        />
      </section>

      <DataCard title="User Directory" description="Role, organization, access level, and latest activity">
        <DataTable
          columns={["Name", "Role", "Department", "Company", "Access", "Status", "Last Login"]}
          rows={teamMembers.map((row) => [row.name, row.role, row.department, row.company, row.access, row.status, row.lastLogin])}
        />
      </DataCard>
    </div>
  );
}
