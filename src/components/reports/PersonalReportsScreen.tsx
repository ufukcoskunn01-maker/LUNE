"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AppShellSidebar } from "@/components/dashboard/AppShellSidebar";
import shellStyles from "@/components/dashboard/home.module.css";
import {
  DEFAULT_PROJECT_CODE,
  formatReportDate,
  formatReportMonth,
  type MonthlyPersonnelPoint,
  type PatCode,
  type PersonalReportsData,
  type ReportDisciplineOrTotal,
  type ReportSegment,
} from "@/lib/personal-reports";

import styles from "./personal-reports.module.css";

type PersonalReportsScreenProps = {
  data: PersonalReportsData | null;
  date: string;
  error?: string | null;
  projectCode?: string;
};

type MatrixFilter = {
  segment: ReportSegment | null;
  discipline: ReportDisciplineOrTotal | null;
  status: PatCode | null;
};

type CalendarCell = {
  key: string;
  isoDate: string | null;
  dayNumber: number | null;
  selected: boolean;
  muted: boolean;
};

const SEGMENTS: ReportSegment[] = ["Indirect", "Direct", "Mobilization"];
const DISCIPLINES: ReportDisciplineOrTotal[] = ["Electrical", "Mechanical", "Shared", "Total"];

export function PersonalReportsScreen({
  data,
  date,
  error,
  projectCode = DEFAULT_PROJECT_CODE,
}: PersonalReportsScreenProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [matrixFilter, setMatrixFilter] = useState<MatrixFilter | null>(null);
  const [draftDate, setDraftDate] = useState(date);

  useEffect(() => {
    setDraftDate(date);
  }, [date]);

  const month = date.slice(0, 7);
  const calendar = useMemo(() => buildCalendar(date), [date]);
  const monthlyPoints = useMemo(() => data?.monthlyPoints ?? [], [data?.monthlyPoints]);
  const monthlyPointMap = useMemo(
    () => new Map(monthlyPoints.map((point) => [point.date, point])),
    [monthlyPoints]
  );
  const selectedPoint = useMemo(
    () => monthlyPoints.find((point) => point.date === date) ?? null,
    [monthlyPoints, date]
  );
  const latestAvailablePoint = useMemo(
    () =>
      [...monthlyPoints]
        .filter((point) => point.total > 0)
        .sort((left, right) => right.date.localeCompare(left.date))[0] ?? null,
    [monthlyPoints]
  );
  const monthlyAveragePresent = useMemo(
    () => (monthlyPoints.length ? Math.round(monthlyPoints.reduce((sum, point) => sum + point.present, 0) / monthlyPoints.length) : 0),
    [monthlyPoints]
  );
  const monthlyMaxTotal = useMemo(
    () => Math.max(0, ...monthlyPoints.map((point) => point.total)),
    [monthlyPoints]
  );
  const monthlyAbsenceRatio = useMemo(() => {
    const absent = monthlyPoints.reduce((sum, point) => sum + point.absent, 0);
    const total = monthlyPoints.reduce((sum, point) => sum + point.total, 0);
    return total > 0 ? `${Math.round((absent / total) * 100)}%` : "0%";
  }, [monthlyPoints]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    if (!matrixFilter) return data.rows;

    return data.rows.filter((row) => {
      if (matrixFilter.segment && row.segment !== matrixFilter.segment) return false;
      if (matrixFilter.discipline && matrixFilter.discipline !== "Total" && row.discipline !== matrixFilter.discipline) return false;
      if (matrixFilter.status && row.pat !== matrixFilter.status) return false;
      return true;
    });
  }, [data, matrixFilter]);

  const rosterSubtitle = useMemo(() => {
    if (!matrixFilter) {
      return `Main personnel report table for ${formatReportDate(date)} using the live report status values.`;
    }

    const parts = [];
    if (matrixFilter.status === "P") parts.push("present personnel");
    if (matrixFilter.status === "A") parts.push("absent personnel");
    if (!matrixFilter.status) parts.push("all personnel");
    if (matrixFilter.segment) parts.push(matrixFilter.segment);
    if (matrixFilter.discipline && matrixFilter.discipline !== "Total") parts.push(matrixFilter.discipline);
    return `Showing ${parts.join(" · ")} for ${formatReportDate(date)}.`;
  }, [date, matrixFilter]);

  const activeFilterChips = useMemo(
    () =>
      matrixFilter
        ? [
            matrixFilter.status ? { key: "status", label: `Status: ${matrixFilter.status}` } : null,
            matrixFilter.segment ? { key: "segment", label: `Segment: ${matrixFilter.segment}` } : null,
            matrixFilter.discipline && matrixFilter.discipline !== "Total"
              ? { key: "discipline", label: `Discipline: ${matrixFilter.discipline}` }
              : null,
          ].filter((chip): chip is { key: string; label: string } => chip !== null)
        : [],
    [matrixFilter]
  );
  const rosterTitle = useMemo(() => {
    if (!matrixFilter) return "Operational roster — Total personnel";

    const parts = ["Operational roster"];
    if (matrixFilter.status === "P") parts.push("Present personnel");
    else if (matrixFilter.status === "A") parts.push("Absent personnel");
    else parts.push("All personnel");
    if (matrixFilter.segment) parts.push(matrixFilter.segment);
    if (matrixFilter.discipline && matrixFilter.discipline !== "Total") parts.push(matrixFilter.discipline);
    return parts.join(" — ");
  }, [matrixFilter]);

  const handleDateChange = (nextDate: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("date", nextDate);
    router.push(`${pathname}?${params.toString()}`);
  };

  const statTotal = data?.patTotals.total ?? 0;
  const statPresent = data?.patTotals.present ?? 0;
  const statAbsent = data?.patTotals.absent ?? 0;
  const noRowsForDate = !!data && data.rows.length === 0;
  const filteredOut = !!data && data.rows.length > 0 && filteredRows.length === 0;

  return (
    <div className={shellStyles.appShell}>
      <AppShellSidebar />

      <div className={shellStyles.mainArea}>
        <header className={`${shellStyles.topChrome} ${shellStyles.topChromeCompact}`}>
          <div className={shellStyles.titleBar}>
            <span className={shellStyles.pageTitle}>Personal Reports</span>
            <div className={shellStyles.iconRow}>
              <IconCircle className={shellStyles.iconCircleProfile} label="Profile">
                <UserIcon />
              </IconCircle>
              <IconCircle className={shellStyles.iconCirclePrimary} label="Add">
                <PlusIcon />
              </IconCircle>
              <IconCircle className={shellStyles.iconCircleSecondary} label="Help">
                <HelpIcon />
              </IconCircle>
              <IconCircle className={`${shellStyles.iconCircleSecondary} ${shellStyles.iconCircleSettings}`} label="Settings">
                <GearIcon />
              </IconCircle>
            </div>
          </div>
        </header>

        <main className={shellStyles.scrollArea}>
          <div className={styles.page}>
            <section className={styles.hero}>
              <div className={styles.heroGrid}>
                <div className={styles.heroMain}>
                  <div className={styles.eyebrow}>Reports</div>
                  <h1 className={styles.title}>Personal Reports</h1>
                  <p className={styles.description}>
                    Daily personnel reporting for the selected work date, including the operational roster,
                    P/A/T summary matrix, and profession-level aggregation.
                  </p>
                  <div className={styles.headerContextStrip}>
                    <HeaderMetric label="Selected date" value={formatReportDate(date)} />
                    <HeaderMetric
                      label="Latest available"
                      value={latestAvailablePoint ? formatReportDate(latestAvailablePoint.date) : "No data in month"}
                    />
                    <HeaderMetric label="Selected-day total" value={String(selectedPoint?.total ?? 0)} />
                    <HeaderMetric label="Month avg present" value={String(monthlyAveragePresent)} />
                    <HeaderMetric label="Month max total" value={String(monthlyMaxTotal)} />
                    <HeaderMetric label="Absence ratio" value={monthlyAbsenceRatio} />
                  </div>
                </div>

                <div className={styles.heroActions}>
                  <div className={styles.headerActions}>
                    <form
                      method="get"
                      className={styles.inlineForm}
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleDateChange(draftDate);
                      }}
                    >
                      <label htmlFor="report-date" className={styles.fieldLabel}>
                        Report date
                      </label>
                      <div className={styles.actionRow}>
                        <input
                          id="report-date"
                          name="date"
                          type="date"
                          value={draftDate}
                          onChange={(event) => setDraftDate(event.target.value)}
                          className={styles.dateInput}
                        />
                        <button type="submit" className={styles.actionButton}>Apply date</button>
                        <a
                          className={styles.secondaryLink}
                          href={`/api/personal-reports/export-monthly?projectCode=${encodeURIComponent(projectCode)}&month=${encodeURIComponent(month)}`}
                          aria-label={`Export ${formatReportMonth(month)}`}
                          title={`Export ${formatReportMonth(month)}`}
                        >
                          <ExportIcon />
                        </a>
                      </div>
                    </form>
                  </div>

                  <section className={styles.calendarCard} aria-label={`Calendar for ${calendar.monthLabel}`}>
                    <div className={styles.calendarHeader}>
                      <div>
                        <div className={styles.calendarEyebrow}>Report month</div>
                        <div className={styles.calendarMonth}>{calendar.monthLabel}</div>
                      </div>
                      <div className={styles.calendarNav}>
                        <button type="button" className={styles.calendarNavButton} aria-label="Previous month" onClick={() => handleDateChange(calendar.previousMonthDate)}>
                          {"‹"}
                        </button>
                        <button type="button" className={styles.calendarNavButton} aria-label="Next month" onClick={() => handleDateChange(calendar.nextMonthDate)}>
                          {"›"}
                        </button>
                      </div>
                    </div>

                    <div className={styles.calendarWeekdays}>
                      {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((label) => (
                        <span key={label}>{label}</span>
                      ))}
                    </div>

                    <div className={styles.calendarGrid}>
                      {calendar.cells.map((cell) => {
                        const isoDate = cell.isoDate;
                        const point = isoDate ? monthlyPointMap.get(isoDate) : null;
                        const level = point
                          ? point.total === 0
                            ? "0"
                            : point.total < 10
                              ? "1"
                              : point.total < 25
                                ? "2"
                                : "3"
                          : "0";

                        return isoDate ? (
                          <button
                            key={cell.key}
                            type="button"
                            className={styles.calendarDay}
                            data-muted={cell.muted ? "true" : "false"}
                            data-selected={cell.selected ? "true" : "false"}
                            data-level={level}
                            onClick={() => handleDateChange(isoDate)}
                          >
                            <span>{cell.dayNumber}</span>
                            <strong>{point && point.total > 0 ? point.total : ""}</strong>
                          </button>
                        ) : (
                          <span key={cell.key} className={styles.calendarSpacer} aria-hidden="true" />
                        );
                      })}
                    </div>
                  </section>
                </div>
              </div>
            </section>

            {error ? (
              <section className={styles.tableCard}>
                <div className={styles.errorState}>{error}</div>
              </section>
            ) : null}

            {!error && data ? (
              <>
                <section className={styles.chartCard}>
                  <MonthlyPersonnelChart points={monthlyPoints} selectedDate={date} onSelectDate={handleDateChange} />
                </section>

                <section className={styles.statsRow}>
                  <StatCard
                    label="P"
                    value={statPresent}
                    caption="Present personnel"
                    active={matrixFilter?.status === "P" && !matrixFilter.segment && !matrixFilter.discipline}
                    onClick={() => setMatrixFilter({ segment: null, discipline: null, status: "P" })}
                  />
                  <StatCard
                    label="A"
                    value={statAbsent}
                    caption="Absent personnel"
                    active={matrixFilter?.status === "A" && !matrixFilter.segment && !matrixFilter.discipline}
                    onClick={() => setMatrixFilter({ segment: null, discipline: null, status: "A" })}
                  />
                  <StatCard
                    label="T"
                    value={statTotal}
                    caption={`Total personnel for ${formatReportDate(date)}`}
                    active={!matrixFilter}
                    onClick={() => setMatrixFilter(null)}
                  />
                </section>

                <div className={styles.drilldownBar}>
                  <div className={styles.drilldownLabel}>Active drill-down</div>
                  <div className={styles.drilldownContent}>
                    {activeFilterChips.length > 0 ? (
                      activeFilterChips.map((chip) => (
                        <span key={chip.key} className={styles.filterChip}>{chip.label}</span>
                      ))
                    ) : (
                      <span className={styles.filterChipMuted}>All personnel · all segments · all disciplines</span>
                    )}
                  </div>
                  {matrixFilter ? (
                    <button type="button" className={styles.clearButton} onClick={() => setMatrixFilter(null)}>
                      Reset filters
                    </button>
                  ) : null}
                </div>

                <section className={styles.tableCard}>
                  <div className={styles.tableHeader}>
                    <div>
                      <div className={styles.tableTitle}>P / A / T summary</div>
                      <div className={styles.tableSubtitle}>
                        Select any P, A, or T count to drill the roster by segment and discipline.
                      </div>
                    </div>
                  </div>
                  <div className={styles.matrixWrap}>
                    <table className={styles.matrixDataTable}>
                      <thead>
                        <tr>
                          <th>Segment</th>
                          {DISCIPLINES.map((discipline) => (
                            <th key={discipline}>{discipline}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {SEGMENTS.map((segment) => (
                          <MatrixRow
                            key={segment}
                            segment={segment}
                            data={data}
                            onSelect={setMatrixFilter}
                            activeFilter={matrixFilter}
                          />
                        ))}
                        <tr>
                          <th>Total</th>
                          {DISCIPLINES.map((discipline) => {
                            const counts = data.disciplineTotals[discipline];
                            return (
                              <td key={`total-${discipline}`}>
                                <MatrixTriplet
                                  counts={counts}
                                  onSelect={(status) =>
                                    setMatrixFilter({
                                      segment: null,
                                      discipline,
                                      status,
                                    })
                                  }
                                  activeStatus={matrixFilter?.discipline === discipline && !matrixFilter.segment ? matrixFilter.status : null}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className={styles.tableCard}>
                  <div className={styles.tableHeader}>
                    <div>
                      <div className={styles.tableTitle}>{rosterTitle}</div>
                      <div className={styles.tableSubtitle}>{rosterSubtitle}</div>
                    </div>
                    {matrixFilter ? (
                      <button type="button" className={styles.clearButton} onClick={() => setMatrixFilter(null)}>
                        Reset filters
                      </button>
                    ) : null}
                  </div>
                  {activeFilterChips.length > 0 ? (
                    <div className={styles.filterBar}>
                      {activeFilterChips.map((chip) => (
                        <span key={chip.key} className={styles.filterChip}>{chip.label}</span>
                      ))}
                    </div>
                  ) : null}
                  <div className={styles.tableWrap}>
                    {filteredRows.length > 0 ? (
                      <table className={`${styles.table} ${styles.rosterTable}`}>
                        <thead>
                          <tr>
                            <th>Employee ID</th>
                            <th>Full name</th>
                            <th>Company</th>
                            <th>Segment</th>
                            <th>Discipline</th>
                            <th>Status</th>
                            <th>Profession</th>
                            <th>Absence reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredRows.map((row) => (
                            <tr key={`${row.employeeId}-${row.segment}-${row.discipline}-${row.pat}`}>
                              <td>{row.employeeId}</td>
                              <td><strong>{row.fullName}</strong></td>
                              <td>{row.company ?? <span className={styles.muted}>Unassigned</span>}</td>
                              <td>{row.segment}</td>
                              <td>{row.discipline}</td>
                              <td>
                                <span className={styles.patCode} data-status={row.pat}>{row.pat}</span>
                              </td>
                              <td>{row.professionOfficial || row.professionActual || <span className={styles.muted}>Unassigned</span>}</td>
                              <td>{row.absenceReason || <span className={styles.muted}>-</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : filteredOut ? (
                      <div className={styles.emptyState}>
                        No personnel matched the current drill-down for {formatReportDate(date)}.
                        <span className={styles.emptyStateHint}> Reset filters to return to total personnel for the selected date.</span>
                      </div>
                    ) : noRowsForDate ? (
                      <div className={styles.emptyState}>
                        No personnel report data exists for {formatReportDate(date)}.
                        <span className={styles.emptyStateHint}>
                          {latestAvailablePoint
                            ? ` Select another date or jump to the latest available report date: ${formatReportDate(latestAvailablePoint.date)}.`
                            : " Select another report date."}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className={styles.tableCard}>
                  <div className={styles.tableHeader}>
                    <div>
                      <div className={styles.tableTitle}>Profession pivot</div>
                      <div className={styles.tableSubtitle}>
                        Aggregated reporting by profession with company spread and P/A/T counts for {formatReportDate(date)}.
                      </div>
                    </div>
                  </div>
                  <div className={styles.tableWrap}>
                    {data.pivotRows.length > 0 ? (
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Profession</th>
                            <th>Companies</th>
                            <th>P</th>
                            <th>A</th>
                            <th>T</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.pivotRows.map((row) => (
                            <tr key={row.profession}>
                              <td><strong>{row.profession}</strong></td>
                              <td>{row.companyCount}</td>
                              <td>{row.present}</td>
                              <td>{row.absent}</td>
                              <td>{row.total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className={styles.emptyState}>
                        No profession summary rows are available for {formatReportDate(date)}.
                        <span className={styles.emptyStateHint}> Select another work date to review a different reporting day.</span>
                      </div>
                    )}
                  </div>
                </section>
              </>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}

function MatrixRow({
  segment,
  data,
  onSelect,
  activeFilter,
}: {
  segment: ReportSegment;
  data: PersonalReportsData;
  onSelect: (next: MatrixFilter) => void;
  activeFilter: MatrixFilter | null;
}) {
  return (
    <tr>
      <th>{segment}</th>
      {DISCIPLINES.map((discipline) => {
        const counts = data.summaryMatrix[segment][discipline];
        const activeStatus = activeFilter?.segment === segment && activeFilter?.discipline === discipline ? activeFilter.status : null;
        return (
          <td key={`${segment}-${discipline}`}>
            <MatrixTriplet counts={counts} activeStatus={activeStatus} onSelect={(status) => onSelect({ segment, discipline, status })} />
          </td>
        );
      })}
    </tr>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.headerMetric}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatCard({
  label,
  value,
  caption,
  active,
  onClick,
}: {
  label: string;
  value: number;
  caption: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.statCard} data-active={active ? "true" : "false"} onClick={onClick}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statCaption}>{caption}</div>
    </button>
  );
}

function MatrixTriplet({
  counts,
  activeStatus,
  onSelect,
}: {
  counts: { present: number; absent: number; total: number };
  activeStatus: PatCode | null;
  onSelect: (status: PatCode | null) => void;
}) {
  return (
    <div className={styles.matrixTriplet}>
      <button type="button" className={styles.matrixMetric} data-active={activeStatus === "P" ? "true" : "false"} onClick={() => onSelect("P")}>
        <span>P</span>
        <strong>{counts.present}</strong>
      </button>
      <button type="button" className={styles.matrixMetric} data-active={activeStatus === "A" ? "true" : "false"} onClick={() => onSelect("A")}>
        <span>A</span>
        <strong>{counts.absent}</strong>
      </button>
      <button type="button" className={styles.matrixMetric} data-active={activeStatus === null ? "true" : "false"} onClick={() => onSelect(null)}>
        <span>T</span>
        <strong>{counts.total}</strong>
      </button>
    </div>
  );
}

function MonthlyPersonnelChart({
  points,
  selectedDate,
  onSelectDate,
}: {
  points: MonthlyPersonnelPoint[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const max = Math.max(1, ...points.map((point) => Math.max(point.total, point.present, point.absent)));
  const selectedDay = Number(selectedDate.slice(8, 10));
  const selectedPoint = points.find((point) => point.day === selectedDay) ?? null;
  const selectedMonth = formatReportMonth(selectedDate.slice(0, 7));
  const averagePresent = points.length ? Math.round(points.reduce((sum, point) => sum + point.present, 0) / points.length) : 0;
  const maxTotal = Math.max(0, ...points.map((point) => point.total));
  const monthAbsent = points.reduce((sum, point) => sum + point.absent, 0);
  const monthTotal = points.reduce((sum, point) => sum + point.total, 0);
  const absenceRatio = monthTotal > 0 ? `${Math.round((monthAbsent / monthTotal) * 100)}%` : "0%";

  const presentPath = buildSmoothLine(points, max, "present");
  const totalPath = buildStepLine(points, max, "total");
  const absentPath = buildStepLine(points, max, "absent");
  const presentAreaPath = buildArea(points, max, "present");
  const selectedMarker = selectedPoint ? getChartPoint(points, selectedPoint.day, max, "present") : null;
  const selectedTotalMarker = selectedPoint ? getChartPoint(points, selectedPoint.day, max, "total") : null;
  const axisDays = new Set([1, 7, 14, 21, 28]);

  return (
    <div className={styles.chartWrap}>
      <div className={styles.chartHeaderBar}>
        <div className={styles.chartEyebrow}>Personnel this month</div>
        <div className={styles.chartActionRow}>
          <button type="button" className={styles.chartIconButton} aria-label="Trend view">
            <TrendMiniIcon />
          </button>
          <button type="button" className={styles.chartIconButton} aria-label="Calendar view">
            <CalendarMiniIcon />
          </button>
          <button type="button" className={styles.chartIconButton} aria-label="Highlight">
            <SparkMiniIcon />
          </button>
        </div>
      </div>

      <div className={styles.chartDivider} />

      <div className={styles.chartMeta}>
        <div className={styles.chartValueBlock}>
          <div className={styles.chartValue}>{selectedPoint ? selectedPoint.total : 0}</div>
          <div className={styles.chartLegend}>
            <Legend tone="present" label="P" />
            <Legend tone="total" label="T" />
            <Legend tone="absent" label="A" />
          </div>
        </div>

        <button type="button" className={styles.chartCompareButton} aria-label={`Selected month ${selectedMonth}`}>
          <span>{selectedMonth}</span>
          <ChevronDownIcon />
        </button>
      </div>

      <div className={styles.chartKpis}>
        <KpiPill label="Selected day total" value={String(selectedPoint?.total ?? 0)} />
        <KpiPill label="Avg present" value={String(averagePresent)} />
        <KpiPill label="Max total" value={String(maxTotal)} />
        <KpiPill label="Absence ratio" value={absenceRatio} />
      </div>

      <div className={styles.chartSvgWrap}>
        <svg viewBox="0 0 100 48" preserveAspectRatio="none" className={styles.chartSvg} aria-hidden="true">
          <defs>
            <linearGradient id="personnel-present-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#22a2ff" stopOpacity="0.34" />
              <stop offset="72%" stopColor="#1d75c7" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#1d75c7" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={presentAreaPath} className={styles.presentArea} />
          {selectedPoint ? (
            <rect
              x={Math.max(0, ((selectedPoint.day - 1) / Math.max(1, points.length - 1)) * 100 - 1.55)}
              y="0"
              width={points.length > 1 ? (100 / Math.max(1, points.length - 1)) * 0.95 : 2}
              height="48"
              className={styles.selectedBand}
            />
          ) : null}
          <path d={totalPath} className={styles.totalLine} />
          <path d={absentPath} className={styles.absentLine} />
          <path d={presentPath} className={styles.presentLine} />
          {selectedTotalMarker ? <line x1={selectedTotalMarker.x} x2={selectedTotalMarker.x} y1="0" y2="48" className={styles.selectedLine} /> : null}
          {selectedMarker ? (
            <g className={styles.selectedMarker}>
              <circle cx={selectedMarker.x} cy={selectedMarker.y} r="1.9" className={styles.selectedMarkerOuter} />
              <circle cx={selectedMarker.x} cy={selectedMarker.y} r="0.94" className={styles.selectedMarkerInner} />
            </g>
          ) : null}
        </svg>

        <div className={styles.chartHitGrid}>
          {points.map((point) => (
            <button
              key={point.date}
              type="button"
              className={styles.chartHit}
              data-selected={point.day === selectedDay ? "true" : "false"}
              onClick={() => onSelectDate(point.date)}
              aria-label={`Select ${point.date}`}
            />
          ))}
        </div>
      </div>

      <div className={styles.chartAxis}>
        {points.map((point) => (
          <button
            key={point.date}
            type="button"
            className={styles.chartTick}
            data-selected={point.day === selectedDay ? "true" : "false"}
            onClick={() => onSelectDate(point.date)}
          >
            {axisDays.has(point.day) ? String(point.day).padStart(2, "0") : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

function KpiPill({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.chartKpi}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Legend({ tone, label }: { tone: "total" | "present" | "absent"; label: string }) {
  return (
    <div className={styles.legendItem}>
      <span className={styles.legendSwatch} data-tone={tone} />
      <span>{label}</span>
    </div>
  );
}

function buildSmoothLine(points: MonthlyPersonnelPoint[], max: number, key: "total" | "present" | "absent") {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const point = getChartPoint(points, points[0].day, max, key);
    return `M ${point.x} ${point.y}`;
  }

  const coords = points.map((point) => getChartPoint(points, point.day, max, key));
  let path = `M ${coords[0].x} ${coords[0].y}`;

  for (let index = 0; index < coords.length - 1; index += 1) {
    const current = coords[index];
    const next = coords[index + 1];
    const controlX = current.x + (next.x - current.x) / 2;
    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }

  return path;
}

function buildStepLine(points: MonthlyPersonnelPoint[], max: number, key: "total" | "present" | "absent") {
  if (points.length === 0) return "";
  const coords = points.map((point) => getChartPoint(points, point.day, max, key));
  let path = `M ${coords[0].x} ${coords[0].y}`;

  for (let index = 1; index < coords.length; index += 1) {
    const prev = coords[index - 1];
    const current = coords[index];
    path += ` L ${current.x} ${prev.y} L ${current.x} ${current.y}`;
  }

  return path;
}

function buildArea(points: MonthlyPersonnelPoint[], max: number, key: "present") {
  if (points.length === 0) return "";

  const line = buildSmoothLine(points, max, key);
  const first = getChartPoint(points, points[0].day, max, key);
  const last = getChartPoint(points, points[points.length - 1].day, max, key);
  return `${line} L ${last.x} 48 L ${first.x} 48 Z`;
}

function getChartPoint(
  points: MonthlyPersonnelPoint[],
  day: number,
  max: number,
  key: "total" | "present" | "absent"
) {
  const index = Math.max(
    0,
    points.findIndex((point) => point.day === day)
  );
  const point = points[index];
  const x = points.length === 1 ? 0 : (index / (points.length - 1)) * 100;
  const y = 41 - (point[key] / max) * 18;
  return { x, y };
}

function buildCalendar(selectedDate: string) {
  const [yearPart, monthPart, dayPart] = selectedDate.split("-");
  const year = Number(yearPart);
  const monthIndex = Number(monthPart) - 1;
  const day = Number(dayPart);

  const firstDay = new Date(year, monthIndex, 1);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: CalendarCell[] = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({
      key: `lead-${index}`,
      isoDate: null,
      dayNumber: null,
      selected: false,
      muted: true,
    });
  }

  for (let index = 1; index <= daysInMonth; index += 1) {
    const isoDate = formatIsoDate(year, monthIndex, index);
    cells.push({
      key: isoDate,
      isoDate,
      dayNumber: index,
      selected: index === day,
      muted: false,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({
      key: `tail-${cells.length}`,
      isoDate: null,
      dayNumber: null,
      selected: false,
      muted: true,
    });
  }

  return {
    monthLabel: new Date(year, monthIndex, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    previousMonthDate: formatIsoDate(year, monthIndex - 1, 1),
    nextMonthDate: formatIsoDate(year, monthIndex + 1, 1),
    cells,
  };
}

function formatIsoDate(year: number, monthIndex: number, day: number) {
  const date = new Date(year, monthIndex, day);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function IconCircle({ children, label, className = "" }: { children: ReactNode; label: string; className?: string }) {
  return <button type="button" className={`${shellStyles.iconCircle} ${className}`.trim()} aria-label={label}>{children}</button>;
}

function IconBase({ children }: { children: ReactNode }) {
  return <svg viewBox="0 0 256 256" aria-hidden="true">{children}</svg>;
}

function UserIcon() { return <IconBase><path d="M128 128a40 40 0 1 0-40-40 40 40 0 0 0 40 40Zm0 16c-35.35 0-64 18.61-64 41.6a8 8 0 0 0 16 0C80 172.57 101.53 160 128 160s48 12.57 48 25.6a8 8 0 0 0 16 0C192 162.61 163.35 144 128 144Z" /></IconBase>; }
function PlusIcon() { return <IconBase><path d="M128 56a8 8 0 0 1 8 8v56h56a8 8 0 0 1 0 16h-56v56a8 8 0 0 1-16 0v-56H64a8 8 0 0 1 0-16h56V64a8 8 0 0 1 8-8Z" /></IconBase>; }
function HelpIcon() { return <IconBase><path d="M140 180a12 12 0 1 1-12-12 12 12 0 0 1 12 12Zm-12-164A112 112 0 1 0 240 128 112.12 112.12 0 0 0 128 16Zm0 208a96 96 0 1 1 96-96 96.11 96.11 0 0 1-96 96Zm-8-72a8 8 0 0 1 8-8 20 20 0 1 0-20-20 8 8 0 0 1-16 0 36 36 0 1 1 44 35.12V160a8 8 0 0 1-16 0Z" /></IconBase>; }
function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5Z" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.2 13.1v-2.2l-1.7-.45a5.86 5.86 0 0 0-.5-1.2l.92-1.48-1.55-1.55-1.48.92c-.38-.2-.78-.37-1.2-.5L13.1 4.8h-2.2l-.45 1.7c-.42.13-.82.3-1.2.5l-1.48-.92-1.55 1.55.92 1.48c-.2.38-.37.78-.5 1.2l-1.7.45v2.2l1.7.45c.13.42.3.82.5 1.2l-.92 1.48 1.55 1.55 1.48-.92c.38.2.78.37 1.2.5l.45 1.7h2.2l.45-1.7c.42-.13.82-.3 1.2-.5l1.48.92 1.55-1.55-.92-1.48c.2-.38.37-.78.5-1.2l1.7-.45Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4.5v9m0 0 3.5-3.5M12 13.5 8.5 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 15.5v1.25A2.25 2.25 0 0 0 7.25 19h9.5A2.25 2.25 0 0 0 19 16.75V15.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrendMiniIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2.25 10.5 5.25 7.5l2 1.9 3.3-4.15 3.2 2.1" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarMiniIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.25 2.5v2M11.75 2.5v2M2.5 5.5h11" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <rect x="2.5" y="3.75" width="11" height="9.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function SparkMiniIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="m8 2 1.1 3.1L12 6.2 8.9 7.3 8 10.4 7.1 7.3 4 6.2l2.9-1.1Z" fill="currentColor" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="m4.25 6.25 3.75 3.75 3.75-3.75" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
