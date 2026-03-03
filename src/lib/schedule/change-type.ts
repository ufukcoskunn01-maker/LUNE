export type ScheduleCompareChangeType =
  | "UNCHANGED"
  | "DATE_SHIFT"
  | "DURATION_CHANGE"
  | "PROGRESS_CHANGE"
  | "LOGIC_CHANGE"
  | "CONSTRAINT_CHANGE"
  | "CALENDAR_CHANGE"
  | "WBS_MOVED"
  | "RENAMED"
  | "ADDED"
  | "REMOVED";

export type ScheduleChangeSignals = {
  isAdded: boolean;
  isRemoved: boolean;
  renamed: boolean;
  wbsMoved: boolean;
  dateShifted: boolean;
  durationChanged: boolean;
  progressChanged: boolean;
  logicChanged: boolean;
  constraintChanged: boolean;
  calendarChanged: boolean;
};

export function classifyScheduleChangeType(signals: ScheduleChangeSignals): ScheduleCompareChangeType {
  if (signals.isAdded) return "ADDED";
  if (signals.isRemoved) return "REMOVED";

  const hasDelta =
    signals.renamed ||
    signals.wbsMoved ||
    signals.dateShifted ||
    signals.durationChanged ||
    signals.progressChanged ||
    signals.logicChanged ||
    signals.constraintChanged ||
    signals.calendarChanged;

  if (!hasDelta) return "UNCHANGED";
  if (signals.wbsMoved) return "WBS_MOVED";
  if (signals.renamed) return "RENAMED";
  if (signals.logicChanged) return "LOGIC_CHANGE";
  if (signals.constraintChanged) return "CONSTRAINT_CHANGE";
  if (signals.calendarChanged) return "CALENDAR_CHANGE";
  if (signals.dateShifted) return "DATE_SHIFT";
  if (signals.durationChanged) return "DURATION_CHANGE";
  if (signals.progressChanged) return "PROGRESS_CHANGE";
  return "UNCHANGED";
}
