import DailyInstallationReportsWorkspace from "@/components/daily-installation-reports/DailyInstallationReportsWorkspace";

export default function DailyInstallationReportsPage() {
  return (
    <div className="relative overflow-hidden rounded-[30px] border border-white/15">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/project-backgrounds/sand.jpg')" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(17,13,11,0.84)_0%,rgba(6,6,7,0.94)_100%)]" />

      <div className="relative p-4 md:p-6">
        <DailyInstallationReportsWorkspace />
      </div>
    </div>
  );
}
