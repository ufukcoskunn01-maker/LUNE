import { Suspense } from "react";
import ScheduleControlWorkspace from "@/components/schedule/ScheduleControlWorkspace";

export default function ScheduleComparisonPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-400">Loading schedule comparison...</div>}>
      <ScheduleControlWorkspace />
    </Suspense>
  );
}
