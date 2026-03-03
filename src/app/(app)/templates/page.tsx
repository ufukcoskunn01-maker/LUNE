import { DataCard, DataTable, PageHeading, StatCard } from "@/components/apex/blocks";
import { templates } from "@/lib/apex-data";

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Template Gallery"
        description="Demonstration and production templates for imports, exports, reporting, and analytics packs."
        badge="Curated template library"
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Templates"
          value={`${templates.length}`}
          delta="+2 this month"
          note="Templates available in active library."
          trend="up"
        />
        <StatCard
          title="Most Used Category"
          value="Attendance"
          delta="38% usage share"
          note="Highest demand import/export package."
          trend="flat"
        />
        <StatCard
          title="Validation Pass Rate"
          value="97.4%"
          delta="+1.2 points"
          note="Imports matching schema on first pass."
          trend="up"
        />
        <StatCard
          title="Auto Update Coverage"
          value="100%"
          delta="Weekly refresh enabled"
          note="All templates versioned with changelog."
          trend="up"
        />
      </section>

      <DataCard title="Template Catalog" description="Reusable files for global project controls workflows">
        <DataTable
          columns={["Template", "Category", "Format", "Updated", "Description"]}
          rows={templates.map((item) => [item.title, item.category, item.format, item.updatedAt, item.description])}
        />
      </DataCard>
    </div>
  );
}
