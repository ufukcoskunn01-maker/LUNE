"use client";

import React, { useMemo, useState } from "react";

type Segment = "Indirect" | "Direct" | "Mobilization";
type Discipline = "Electrical" | "Mechanical" | "Shared" | "Total";
type Status = "Present" | "Absent" | "All";

type CellCounts = { present: number; absent: number; total: number };
type Selection = { segment: Segment; discipline: Discipline; status: Status } | null;

type Person = {
  id: string;
  name: string;
  company: string;
  profession: string;
  segment: Segment;
  discipline: Exclude<Discipline, "Total">;
  status: Exclude<Status, "All">;
  absenceReason?: string;
};

const SEGMENTS: Segment[] = ["Indirect", "Direct", "Mobilization"];
const DISCIPLINES: Discipline[] = ["Electrical", "Mechanical", "Shared", "Total"];

function demoCounts(segment: Segment, discipline: Discipline): CellCounts {
  const base =
    (segment === "Indirect" ? 40 : segment === "Direct" ? 120 : 60) +
    (discipline === "Electrical" ? 10 : discipline === "Mechanical" ? 5 : discipline === "Shared" ? 2 : 0);

  const absent = Math.max(0, Math.round(base * 0.08));
  const present = Math.max(0, base - absent);
  return { present, absent, total: present + absent };
}

function demoPeople(): Person[] {
  return [
    { id: "1", name: "Ivan Petrov", company: "Subcon A", profession: "Engineer", segment: "Indirect", discipline: "Electrical", status: "Present" },
    { id: "2", name: "Ahmet Kaya", company: "Subcon A", profession: "Foreman", segment: "Indirect", discipline: "Electrical", status: "Absent", absenceReason: "Sick" },
    { id: "3", name: "Sergey Ivanov", company: "Subcon B", profession: "Electrician", segment: "Direct", discipline: "Electrical", status: "Present" },
    { id: "4", name: "Mehmet Demir", company: "Subcon B", profession: "Fitter", segment: "Direct", discipline: "Mechanical", status: "Present" },
    { id: "5", name: "Ali Yilmaz", company: "Subcon C", profession: "Welder", segment: "Mobilization", discipline: "Mechanical", status: "Absent", absenceReason: "No show" },
    { id: "6", name: "John Smith", company: "Subcon C", profession: "Electrician", segment: "Mobilization", discipline: "Electrical", status: "Present" },
  ];
}

export default function Page(): React.ReactElement {
  // ✅ 1) STATE (all hooks together, once)
  const [selection, setSelection] = useState<Selection>(null);
  const [tab, setTab] = useState<"people" | "pivot">("people");
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState<string>("All");
  const [professionChip, setProfessionChip] = useState<string | null>(null);

  // ✅ 2) DATA
  const people = useMemo(() => demoPeople(), []);

  const companies = useMemo(() => {
  const set = new Set(people.map((p) => p.company));
  return ["All", ...Array.from(set).sort()];
  }, [people]);

  // ✅ 3) DERIVED
  const matrix = useMemo(() => {
    const m: Record<string, CellCounts> = {};
    for (const s of SEGMENTS) for (const d of DISCIPLINES) m[`${s}|${d}`] = demoCounts(s, d);
    return m;
  }, []);

  const filteredPeople = useMemo(() => {
  if (!selection) return [];
  return people
    .filter((p) => p.segment === selection.segment)
    .filter((p) => (selection.discipline === "Total" ? true : p.discipline === selection.discipline))
    .filter((p) => (selection.status === "All" ? true : p.status === selection.status))
    .filter((p) => (company === "All" ? true : p.company === company))
    .filter((p) => (professionChip ? p.profession === professionChip : true))
    .filter((p) => (search.trim() ? p.name.toLowerCase().includes(search.toLowerCase()) : true));
    }, [people, selection, search, company, professionChip]);


  const pivot = useMemo(() => {
    const map = new Map<string, { present: number; absent: number; total: number }>();
    for (const p of filteredPeople) {
      const cur = map.get(p.profession) ?? { present: 0, absent: 0, total: 0 };
      if (p.status === "Present") cur.present += 1;
      if (p.status === "Absent") cur.absent += 1;
      cur.total += 1;
      map.set(p.profession, cur);
    }
    return Array.from(map.entries())
      .map(([profession, c]) => ({ profession, ...c }))
      .sort((a, b) => b.total - a.total);
  }, [filteredPeople]);

  // ✅ 4) UI ONLY below
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Daily Personnel</h1>
        <p className="text-sm text-muted-foreground">Summary matrix → drill-down (demo data).</p>
      </div>

      <div className="rounded-2xl border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-medium">Summary Matrix</div>
          <div className="text-xs text-muted-foreground">Click P / A / T</div>
        </div>

        <div className="grid grid-cols-5 gap-2 text-sm">
          <HeaderCell>Segment</HeaderCell>
          {DISCIPLINES.map((d) => (
            <HeaderCell key={d}>{d}</HeaderCell>
          ))}

          {SEGMENTS.map((seg) => (
            <React.Fragment key={seg}>
              <Cell className="font-medium">{seg}</Cell>
              {DISCIPLINES.map((d) => {
                const c = matrix[`${seg}|${d}`];
                return (
                  <MetricCell
                    key={`${seg}-${d}`}
                    counts={c}
                    onClick={(status) => {
                    setSelection({ segment: seg, discipline: d, status });
                    setTab("people");
                    setSearch("");
                    setCompany("All");
                   setProfessionChip(null);
                   }}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {selection && (
        <RightDrawer title="Attendance" onClose={() => setSelection(null)}>
          <div className="space-y-4">
            <div className="rounded-xl border bg-card p-3 text-sm">
              <div className="font-medium">
                {selection.segment} • {selection.discipline} • {selection.status}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Rows: {filteredPeople.length}</div>
            </div>

            <div className="flex gap-2">
              <button
                className={`rounded-xl border px-3 py-2 text-sm ${tab === "people" ? "bg-accent" : "bg-background hover:bg-accent/40"}`}
                onClick={() => setTab("people")}
              >
                People
              </button>
              <button
                className={`rounded-xl border px-3 py-2 text-sm ${tab === "pivot" ? "bg-accent" : "bg-background hover:bg-accent/40"}`}
                onClick={() => setTab("pivot")}
              >
                Profession Pivot
              </button>
            </div>

            <input
              className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              placeholder="Search name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
              <select
               className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
              value={company}
               onChange={(e) => setCompany(e.target.value)}
               >
               {companies.map((c) => (
                <option key={c} value={c}>
               {c}
               </option>
                 ))}
                </select>
               {professionChip && (
               <div className="flex items-center justify-between rounded-xl border bg-card px-3 py-2 text-sm">
                 <div>
                Profession: <span className="font-medium">{professionChip}</span>
                </div>
                <button
                className="rounded-lg border bg-background px-2 py-1 text-xs hover:bg-accent/40"
                onClick={() => setProfessionChip(null)}
                >
                Clear
                </button>
                </div>
                )}


            {tab === "people" ? (
              <div className="rounded-2xl border bg-card">
                <div className="grid grid-cols-12 gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                  <div className="col-span-4">Name</div>
                  <div className="col-span-3">Profession</div>
                  <div className="col-span-3">Company</div>
                  <div className="col-span-2 text-right">Status</div>
                </div>

                {filteredPeople.map((p) => (
                  <div key={p.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm hover:bg-accent/20">
                    <div className="col-span-4">{p.name}</div>
                    <div className="col-span-3 text-muted-foreground">{p.profession}</div>
                    <div className="col-span-3 text-muted-foreground">{p.company}</div>
                    <div className="col-span-2 text-right">
                      <div className="text-xs">{p.status}</div>
                      {p.status === "Absent" && p.absenceReason ? (
                        <div className="text-xs text-muted-foreground">{p.absenceReason}</div>
                      ) : null}
                    </div>
                  </div>
                ))}

                {filteredPeople.length === 0 && (
                  <div className="px-3 py-4 text-sm text-muted-foreground">No results.</div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border bg-card">
                <div className="grid grid-cols-12 gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                  <div className="col-span-6">Profession</div>
                  <div className="col-span-2 text-right">P</div>
                  <div className="col-span-2 text-right">A</div>
                  <div className="col-span-2 text-right">T</div>
                </div>

                {pivot.map((r) => (
  <button
    key={r.profession}
    className="grid w-full grid-cols-12 gap-2 px-3 py-2 text-sm text-left hover:bg-accent/20"
    onClick={() => {
      setProfessionChip(r.profession);
      setTab("people");
    }}
  >
    <div className="col-span-6 font-medium">{r.profession}</div>
    <div className="col-span-2 text-right tabular-nums">{r.present}</div>
    <div className="col-span-2 text-right tabular-nums">{r.absent}</div>
    <div className="col-span-2 text-right tabular-nums">{r.total}</div>
  </button>
))}

                {pivot.length === 0 && <div className="px-3 py-4 text-sm text-muted-foreground">No data.</div>}
              </div>
            )}
          </div>
        </RightDrawer>
      )}
    </div>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="rounded-xl border bg-muted px-3 py-2 font-medium">{children}</div>;
}

function Cell({ children, className = "" }: { children: React.ReactNode; className?: string }): React.ReactElement {
  return <div className={`rounded-xl border bg-background px-3 py-2 ${className}`}>{children}</div>;
}

function MetricCell({
  counts,
  onClick,
}: {
  counts: CellCounts;
  onClick: (status: Status) => void;
}): React.ReactElement {
  return (
    <div className="rounded-xl border bg-background px-3 py-2">
      <div className="flex items-center gap-3">
        <button className="text-left hover:underline" onClick={() => onClick("Present")}>
          <div className="text-xs text-muted-foreground">P</div>
          <div className="font-medium tabular-nums">{counts.present}</div>
        </button>

        <button className="text-left hover:underline" onClick={() => onClick("Absent")}>
          <div className="text-xs text-muted-foreground">A</div>
          <div className="font-medium tabular-nums">{counts.absent}</div>
        </button>

        <button className="ml-auto text-left hover:underline" onClick={() => onClick("All")}>
          <div className="text-xs text-muted-foreground">T</div>
          <div className="font-medium tabular-nums">{counts.total}</div>
        </button>
      </div>
    </div>
  );
}

function RightDrawer({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}): React.ReactElement {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-[520px] bg-background shadow-xl">
        <div className="flex h-14 items-center justify-between border-b px-5">
          <div className="text-sm font-semibold">{title}</div>
          <button className="rounded-xl border bg-card px-3 py-1.5 text-sm hover:bg-accent/40" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
