export default function Page() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Daily Personnel</h1>
        <p className="text-sm text-muted-foreground">
          Excel-based attendance: Present = Control blank, Absent = Control has reason.
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <div className="text-sm font-medium">Summary Matrix</div>
        <div className="mt-3 grid grid-cols-4 gap-2 text-sm">
          {["Segment", "Electrical", "Mechanical", "Total"].map((h) => (
            <div key={h} className="rounded-xl border bg-background px-3 py-2 font-medium">
              {h}
            </div>
          ))}
          {["Indirect", "Direct", "Mobilization"].flatMap((seg) => [
            <div key={seg} className="rounded-xl border bg-background px-3 py-2">{seg}</div>,
            <div key={seg + "E"} className="rounded-xl border bg-background px-3 py-2">P/A/T</div>,
            <div key={seg + "M"} className="rounded-xl border bg-background px-3 py-2">P/A/T</div>,
            <div key={seg + "T"} className="rounded-xl border bg-background px-3 py-2">P/A/T</div>,
          ])}
        </div>
      </div>
    </div>
  )
}
