import AttendanceWorkspace from "@/components/attendance/AttendanceWorkspace";
import TransportationWorkspace from "@/components/personal/TransportationWorkspace";
import { Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function DailyPersonalReportsPage() {
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="relative overflow-hidden rounded-[30px] border border-white/15">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/project-backgrounds/sand.jpg')" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(18,12,8,0.84)_0%,rgba(6,6,7,0.94)_100%)]" />

      <div className="relative p-4 md:p-6">
        <Tabs defaultValue="attendance" className="space-y-4">
          <TabsList className="w-full justify-start gap-2 rounded-xl border border-white/15 bg-black/35 p-1 text-zinc-300 md:w-auto">
            <TabsTrigger
              value="attendance"
              className="data-[state=active]:bg-zinc-100/95 data-[state=active]:text-zinc-900"
            >
              Attendance
            </TabsTrigger>
            <TabsTrigger
              value="transportation"
              className="data-[state=active]:bg-zinc-100/95 data-[state=active]:text-zinc-900"
            >
              Transportation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="attendance">
            <Suspense fallback={<div className="text-sm text-zinc-400">Loading attendance...</div>}>
              <AttendanceWorkspace />
            </Suspense>
          </TabsContent>

          <TabsContent value="transportation">
            <TransportationWorkspace initialDate={todayIso} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
