import Image from "next/image";
import { DataCard, PageHeading, StatCard } from "@/components/apex/blocks";
import {
  AllocationRiskCard,
  BudgetTrackerCard,
  ForecastCurveCard,
  MomentumCard,
  SpendCalendarCard,
  TransactionFeedCard,
} from "@/components/apex/live-graphics";
import {
  allocationMix,
  budgetLines,
  forecastCurve,
  momentumSeries,
  recentTransactions,
  spendByDay,
  totalBudget,
} from "@/lib/apex-live-data";

export default function ControlTowerPage() {
  const spendTotal = spendByDay.reduce((sum, day) => sum + day.amount, 0);

  return (
    <div className="relative overflow-hidden rounded-[30px] border border-white/15">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/project-backgrounds/dune.jpg')" }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(20,12,7,0.82)_0%,rgba(7,7,7,0.93)_100%)]" />

      <div className="relative space-y-6 p-4 md:p-6">
        <PageHeading
          title="Control Tower"
          description="Live command view for executive reporting, cashflow pulse, operational alerts, and scenario-level controls."
          badge="Live mode enabled"
        />

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Live Data Feeds"
            value="41"
            delta="+4 this week"
            note="Connected systems streaming to the command layer."
            trend="up"
          />
          <StatCard
            title="Active Scenarios"
            value="12"
            delta="+2 pending review"
            note="What-if simulations for cost and schedule."
            trend="up"
          />
          <StatCard
            title="Critical Alerts"
            value="3"
            delta="-2 vs yesterday"
            note="Cross-module exceptions requiring action."
            trend="up"
          />
          <StatCard
            title="Auto Reports"
            value="98.1%"
            delta="Delivery reliability"
            note="Generated and distributed without manual touch."
            trend="up"
          />
        </section>

        <ForecastCurveCard data={forecastCurve} currentValue={325472} futureValue={1240056} futureDelta={914584} />

        <section className="grid gap-6 xl:grid-cols-2">
          <MomentumCard data={momentumSeries} value={spendTotal} deltaPct={5.5} title="Program Spend Pulse" />
          <SpendCalendarCard days={spendByDay} total={spendTotal} monthLabel="May 2026" />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <TransactionFeedCard items={recentTransactions} />
          <BudgetTrackerCard lines={budgetLines} totalSpent={totalBudget.spent} totalLimit={totalBudget.limit} />
        </section>

        <AllocationRiskCard items={allocationMix} />

        <DataCard title="Live Media Feeds" description="Visual references and media panels available in command workflows">
          <div className="grid gap-4 xl:grid-cols-3">
            <div className="relative overflow-hidden rounded-2xl border">
              <Image
                src="/origin/images/68bf6605b4df5f9a02f2489b_spend-this-month.png"
                alt="Spend this month media card"
                width={716}
                height={510}
                className="h-auto w-full"
              />
            </div>
            <div className="relative overflow-hidden rounded-2xl border">
              <Image
                src="/origin/images/68bf64b1237dc852e9cbcdc0_upcoming-card-3.png"
                alt="Upcoming transactions media card"
                width={716}
                height={510}
                className="h-auto w-full"
              />
            </div>
            <div className="relative overflow-hidden rounded-2xl border">
              <Image
                src="/origin/images/68c02b1aa2d9315689379726_budgetcard.png"
                alt="Budget media card"
                width={716}
                height={510}
                className="h-auto w-full"
              />
            </div>
          </div>
        </DataCard>
      </div>
    </div>
  );
}
