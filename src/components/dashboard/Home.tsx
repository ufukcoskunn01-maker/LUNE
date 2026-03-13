"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";

import { AppShellSidebar } from "./AppShellSidebar";
import styles from "./home.module.css";

type RangeKey = "1W" | "1M" | "3M" | "YTD" | "ALL";
type HomeTab = "overview" | "networth";

const rangeMeta: Record<RangeKey, { value: string; change: string; points: number[] }> = {
  "1W": {
    value: "$208,420",
    change: "+2.1%",
    points: [44, 46, 45, 57, 55, 59, 62, 66, 70],
  },
  "1M": {
    value: "$210,150",
    change: "+5.5%",
    points: [24, 28, 30, 34, 40, 73, 67, 56, 52, 60, 57, 60, 61, 58, 67, 71, 69, 72, 54, 45, 58, 76, 72, 70, 70, 77, 73, 80, 74, 72, 60, 54, 88, 84, 80, 92, 90, 98],
  },
  "3M": {
    value: "$203,960",
    change: "+9.8%",
    points: [24, 27, 30, 35, 33, 36, 34, 40, 43, 47, 44, 49, 52, 57, 54, 58, 61, 64, 68, 72],
  },
  YTD: {
    value: "$198,640",
    change: "+14.2%",
    points: [20, 18, 22, 24, 28, 26, 31, 35, 39, 37, 42, 45, 48, 53, 57, 56, 60, 66, 72, 78],
  },
  ALL: {
    value: "$210,150",
    change: "+38.6%",
    points: [8, 9, 10, 12, 13, 15, 18, 17, 20, 24, 26, 29, 34, 38, 40, 45, 48, 53, 59, 66],
  },
};

const rangeValues: Record<RangeKey, string> = {
  "1W": "$2.1k",
  "1M": "$10.8k",
  "3M": "$18.6k",
  YTD: "$29.7k",
  ALL: "$57.4k",
};

const monthAmounts: Record<number, number[]> = {
  0: [18, 80, 8, 1300, 64, 102, 32, 11, 14, 26, 0, 42, 21, 9, 0, 38, 12, 55, 24, 71, 15, 0, 33, 12, 0, 47, 22, 17, 0, 0, 0],
  1: [26, 42, 0, 77, 54, 0, 31, 15, 21, 44, 19, 0, 28, 13, 6, 36, 0, 82, 18, 39, 27, 14, 0, 24, 0, 51, 29, 16, 7, 0],
  2: [14, 65, 27, 0, 59, 22, 9, 0, 31, 48, 18, 0, 26, 12, 0, 40, 17, 0, 33, 74, 11, 0, 29, 16, 0, 52, 24, 13, 8, 0, 0],
};

const transactions = [
  { name: "Starbucks", date: "March 22", amount: "$12.00", icon: <CupIcon /> },
  { name: "Netflix", date: "March 22", amount: "$29.90", icon: <TvIcon /> },
  { name: "Walmart", date: "March 21", amount: "$17.50", icon: <BasketIcon /> },
  { name: "Bi-Rite", date: "March 21", amount: "+$1,877.90", icon: <DollarIcon />, positive: true },
];

const marketRows = [
  {
    label: "NASDAQ",
    symbol: "DJI",
    value: "$19.20k",
    change: "2.47%",
    tone: "blue" as const,
    points: [18, 21, 23, 34, 32, 27, 30, 29, 31, 30, 31, 31, 28, 27, 36, 34, 35, 37, 36, 35, 35, 31, 29, 40, 38, 44, 42, 45, 44, 44, 44, 50],
  },
  {
    label: "S&P 500",
    symbol: "SPX",
    value: "$5.92k",
    change: "2.47%",
    tone: "blue" as const,
    points: [19, 22, 24, 35, 33, 29, 31, 30, 32, 31, 32, 32, 29, 28, 37, 35, 36, 38, 37, 36, 36, 32, 30, 41, 39, 45, 43, 46, 45, 45, 45, 51],
  },
  {
    label: "VIX",
    symbol: "VIX",
    value: "$18.96",
    change: "7.83%",
    tone: "red" as const,
    points: [56, 54, 51, 48, 47, 47, 47, 48, 48, 46, 46, 47, 47, 42, 43, 40, 32, 31, 33, 34, 37, 38, 35, 36, 35, 34, 36, 37, 36, 29, 27, 31, 30, 28, 29, 27, 29, 31, 26, 18, 16, 14],
  },
];

const movers = [
  {
    ticker: "NVDA",
    name: "NVIDIA",
    price: "$142.80",
    profit: "+$26.14",
    change: "-0.05%",
    tone: "negative" as const,
    icon: <NvidiaBadge />,
    spark: [54, 53, 54, 52, 52, 53, 52, 53, 48, 51, 52, 50, 50],
  },
  {
    ticker: "TSLA",
    name: "Tesla",
    price: "$142.80",
    profit: "+$26.14",
    change: "+3.27%",
    tone: "positive" as const,
    icon: <TeslaBadge />,
    spark: [34, 33, 29, 31, 30, 36, 34, 37, 36, 38, 37, 38, 38],
  },
  {
    ticker: "MSFT",
    name: "Microsoft",
    price: "$142.80",
    profit: "+$26.14",
    change: "+3.27%",
    tone: "positive" as const,
    icon: <MicrosoftBadge />,
    spark: [35, 34, 30, 32, 31, 37, 35, 38, 37, 39, 38, 39, 39],
  },
];

export function Home() {
  const [tab, setTab] = useState<HomeTab>("overview");
  const [range, setRange] = useState<RangeKey>("1M");
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setHeroVisible(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const monthDays = useMemo(() => {
    const amounts = monthAmounts[0];
    return Array.from({ length: 31 }, (_, index) => {
      const amount = amounts[index] ?? 0;
      return { day: index + 1, amount };
    });
  }, []);

  const activeRange = rangeMeta[range];

  return (
    <div className={styles.appShell}>
      <AppShellSidebar />

      <div className={styles.mainArea}>
        <header className={styles.topChrome}>
          <div className={styles.titleBar}>
            <span className={styles.pageTitle}>Home</span>

            <div className={styles.iconRow}>
              <IconCircle label="Profile" className={styles.iconCircleProfile}><UserIcon /></IconCircle>
              <IconCircle label="Add" className={styles.iconCirclePrimary}><PlusIcon /></IconCircle>
              <IconCircle label="Help" className={styles.iconCircleSecondary}><HelpIcon /></IconCircle>
              <IconCircle label="Settings" className={`${styles.iconCircleSecondary} ${styles.iconCircleSettings}`}><GearIcon /></IconCircle>
            </div>
          </div>

          <nav className={styles.tabRow} aria-label="Home views">
            <button
              type="button"
              className={`${styles.tab} ${tab === "overview" ? styles.tabActive : ""}`}
              onClick={() => setTab("overview")}
            >
              Overview
            </button>
            <button
              type="button"
              className={`${styles.tab} ${tab === "networth" ? styles.tabActive : ""}`}
              onClick={() => setTab("networth")}
            >
              Net worth
            </button>
          </nav>
        </header>

        <main className={styles.scrollArea}>
          <div className={styles.boardGrid}>
            <div className={styles.leftColumn}>
              <section className={`${styles.card} ${styles.netWorthCard} ${heroVisible ? styles.cardVisible : ""}`}>
                  <CardHeader eyebrow="Net worth" action={<GhostPill>Forecast</GhostPill>} />
                  <div className={styles.valueRow}>
                    <span className={styles.primaryValue}>{activeRange.value}</span>
                    <span className={styles.positiveText}>{activeRange.change}</span>
                  </div>
                  <LineChart points={activeRange.points} className={styles.netWorthChart} atmospheric compact />
                  <div className={styles.rangeRail}>
                    {(Object.keys(rangeMeta) as RangeKey[]).map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={`${styles.rangeButton} ${range === item ? styles.rangeButtonActive : ""}`}
                        onClick={() => setRange(item)}
                      >
                        <span>{item}</span>
                        <small>{rangeValues[item]}</small>
                      </button>
                    ))}
                  </div>
                  <button type="button" className={styles.fullButton}>View accounts</button>
                </section>

              <section className={`${styles.card} ${styles.spendCard} ${heroVisible ? styles.cardVisible : ""}`}>
                  <CardHeader
                    eyebrow="Spend last 7D"
                    showChevron
                    action={<MiniPlus />}
                  />
                  <div className={styles.primaryValue}>$1,590</div>
                  <div className={styles.spendGrid}>
                    <div className={styles.calendarGrid}>
                      {monthDays.map((item) => (
                        <button
                          key={item.day}
                          type="button"
                          className={styles.dayCell}
                          data-day={item.day}
                          data-level={item.amount === 0 ? "0" : item.amount < 25 ? "1" : item.amount < 90 ? "2" : "3"}
                        >
                          <span>{item.day}</span>
                          <strong>{item.amount > 0 ? `$${item.amount}` : ""}</strong>
                        </button>
                      ))}
                    </div>
                    <div className={styles.transactions}>
                      <div className={styles.sideHeading}>Recent transactions</div>
                      {transactions.map((item) => (
                        <div key={item.name} className={styles.transactionRow}>
                          <span className={styles.transactionIcon}>{item.icon}</span>
                          <div className={styles.transactionMeta}>
                            <span>{item.name}</span>
                            <small>{item.date}</small>
                          </div>
                          <span className={item.positive ? styles.positiveAmount : styles.transactionAmount}>{item.amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

              <section className={`${styles.card} ${styles.investmentsCard} ${heroVisible ? styles.cardVisible : ""}`}>
                  <CardHeader eyebrow="Investments last 30D" showChevron action={<MiniPlus />} />
                  <div className={styles.investmentsTop}>
                    <div>
                      <div className={styles.primaryValue}>$210,150</div>
                      <div className={styles.positiveText}>+5.5%</div>
                    </div>
                  </div>
                  <LineChart
                    points={[24, 28, 30, 34, 40, 73, 67, 56, 52, 60, 57, 60, 61, 58, 67, 71, 69, 72, 54, 45, 58, 76, 72, 70, 70, 77, 73, 80, 74, 72, 60, 54, 88, 84, 80, 92, 90, 98]}
                    className={styles.investmentsChart}
                    atmospheric
                    compact
                  />
                  <div className={styles.moversHeading}>Top movers</div>
                  <div className={styles.moversList}>
                    {movers.map((mover) => (
                      <div key={mover.ticker} className={styles.moverRow}>
                        <div className={styles.moverIdentity}>
                          <span className={styles.moverBadge}>{mover.icon}</span>
                          <div className={styles.moverNameBlock}>
                            <strong>{mover.ticker}</strong>
                            <small>{mover.name}</small>
                          </div>
                        </div>
                        <div className={styles.moverPrice}>{mover.price}</div>
                        <div className={styles.moverSparkWrap}>
                          <LineChart points={mover.spark} className={styles.miniSpark} tone={mover.tone === "negative" ? "red" : "green"} noArea />
                        </div>
                        <div className={styles.moverProfit}>{mover.profit}</div>
                        <span className={`${styles.changePill} ${mover.tone === "negative" ? styles.changePillNegative : styles.changePillPositive}`}>
                          {mover.change}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
            </div>

            <aside className={styles.rightRail}>
              <section className={`${styles.card} ${styles.recapCard} ${heroVisible ? styles.cardVisible : ""}`}>
                  <CardHeader eyebrow="Personal recap" action={<CloseButton />} />
                  <div className={styles.recapTitle}>Your weekly digest</div>
                  <p className={styles.recapBody}>
                    Spending held steady, your portfolio moved up, and net worth closed the week higher than last Friday.
                  </p>
                </section>

              <section className={`${styles.card} ${styles.budgetCard} ${heroVisible ? styles.cardVisible : ""}`}>
                  <CardHeader eyebrow="Budget in June" showChevron action={<MiniPlus className={styles.budgetMiniButton} />} />
                  <div className={styles.budgetValue}>
                    <span>$5,600</span>
                    <small>of $10,000</small>
                  </div>
                  <div className={styles.budgetProgressRow}>
                    <div className={styles.progressTrack}>
                      <span className={styles.progressLead} />
                      <span className={styles.progressMid} />
                      <span className={styles.progressFill} style={{ width: "56%" }} />
                    </div>
                    <div className={styles.progressMeta}>56.0%</div>
                  </div>
                </section>

              <section className={`${styles.card} ${styles.creditCard} ${heroVisible ? styles.cardVisible : ""}`}>
                  <CardHeader eyebrow="Credit score" showChevron action={<MiniPlus />} />
                  <div className={styles.creditTop}>
                    <div>
                      <div className={styles.primaryValue}>425</div>
                    </div>
                    <span className={styles.caption}>Poor</span>
                  </div>
                  <div className={styles.scoreScale}>
                    <span data-tone="1" />
                    <span data-tone="2" />
                    <span data-tone="3" />
                    <span data-tone="4" />
                    <span data-tone="5" />
                  </div>
                  <div className={styles.scoreFooter}>
                    <small className={styles.scoreMarker}>You</small>
                    <small className={styles.caption}>+10 this month</small>
                  </div>
                </section>

              <section className={`${styles.card} ${styles.marketCard} ${heroVisible ? styles.cardVisible : ""}`}>
                  <CardHeader eyebrow="Market watch" showChevron action={<MiniPlus />} />
                  <div className={styles.marketStack}>
                    {marketRows.map((row) => (
                      <div key={row.label} className={styles.marketPanel}>
                        <LineChart points={row.points} className={styles.marketChart} tone={row.tone} atmospheric />
                        <div className={styles.marketMeta}>
                          <div>
                            <div>{row.label}</div>
                            <small>{row.symbol}</small>
                          </div>
                          <div className={styles.marketValueBlock}>
                            <div>{row.value}</div>
                            <small className={row.tone === "red" ? styles.negativeText : styles.positiveText}>{row.change}</small>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

function IconCircle({ children, label, className = "" }: { children: ReactNode; label: string; className?: string }) {
  return <button type="button" className={`${styles.iconCircle} ${className}`.trim()} aria-label={label}>{children}</button>;
}

function CardHeader({ eyebrow, action, showChevron = false }: { eyebrow: string; action: ReactNode; showChevron?: boolean }) {
  return (
    <div className={styles.cardHeader}>
      <span className={styles.eyebrow}>
        {eyebrow}
        {showChevron ? <span className={styles.eyebrowChevron}>›</span> : null}
      </span>
      {action}
    </div>
  );
}

function GhostPill({ children }: { children: ReactNode }) {
  return <button type="button" className={styles.ghostPill}>{children}<span className={styles.pillChevron}>›</span></button>;
}

function MiniPlus({ className = "" }: { className?: string }) {
  return <button type="button" className={`${styles.miniButton} ${className}`.trim()} aria-label="Add"><SparkIcon /></button>;
}

function CloseButton() {
  return <button type="button" className={styles.miniButton} aria-label="Close"><CloseIcon /></button>;
}

function LineChart({
  points,
  className,
  tone = "blue",
  noArea = false,
  atmospheric = false,
  compact = false,
}: {
  points: number[];
  className?: string;
  tone?: "blue" | "red" | "green";
  noArea?: boolean;
  atmospheric?: boolean;
  compact?: boolean;
}) {
  const gradientId = useId();
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const width = 100;
  const height = 100;
  const chartAmplitude = compact ? 62 : 78;
  const chartTopInset = compact ? 18 : 10;
  const normalized = points.map((value, index) => ({
    x: (index / (points.length - 1)) * width,
    y: height - ((value - min) / range) * chartAmplitude - chartTopInset,
  }));

  const d = normalized
    .map((point, index, list) => {
      if (index === 0) {
        return `M ${point.x} ${point.y}`;
      }

      const previous = list[index - 1];
      const midpointX = (previous.x + point.x) / 2;
      return `Q ${midpointX} ${previous.y} ${point.x} ${point.y}`;
    })
    .join(" ");

  const area = `${d} L 100 100 L 0 100 Z`;
  const palette =
    tone === "red"
      ? {
          stroke: "#ff4d4f",
          top: "#ff6a63",
          topOpacity: atmospheric ? 0.34 : 0.24,
          bottom: "#ff3b3b",
          bottomOpacity: 0,
        }
      : tone === "green"
        ? {
            stroke: "#00d084",
            top: "#00d084",
            topOpacity: atmospheric ? 0.24 : 0.18,
            bottom: "#00d084",
            bottomOpacity: 0,
          }
        : {
            stroke: "#149cff",
            top: "#2c9dff",
            topOpacity: atmospheric ? 0.38 : 0.32,
            bottom: "#149cff",
            bottomOpacity: 0,
          };

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={`${styles.chart} ${className ?? ""}`} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.top} stopOpacity={palette.topOpacity} />
          <stop offset="100%" stopColor={palette.bottom} stopOpacity={palette.bottomOpacity} />
        </linearGradient>
      </defs>
      {noArea ? null : <path d={area} fill={`url(#${gradientId})`} />}
      <path d={d} fill="none" stroke={palette.stroke} strokeWidth={atmospheric ? (tone === "blue" ? "0.38" : "0.38") : tone === "blue" ? "1.2" : "1.05"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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
      <path
        d="M12 8.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.2 13.1v-2.2l-1.7-.45a5.86 5.86 0 0 0-.5-1.2l.92-1.48-1.55-1.55-1.48.92c-.38-.2-.78-.37-1.2-.5L13.1 4.8h-2.2l-.45 1.7c-.42.13-.82.3-1.2.5l-1.48-.92-1.55 1.55.92 1.48c-.2.38-.37.78-.5 1.2l-1.7.45v2.2l1.7.45c.13.42.3.82.5 1.2l-.92 1.48 1.55 1.55 1.48-.92c.38.2.78.37 1.2.5l.45 1.7h2.2l.45-1.7c.42-.13.82-.3 1.2-.5l1.48.92 1.55-1.55-.92-1.48c.2-.38.37-.78.5-1.2l1.7-.45Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.8 14.15 9.85 20.2 12l-6.05 2.15L12 20.2l-2.15-6.05L3.8 12l6.05-2.15Z"
        fill="currentColor"
      />
    </svg>
  );
}
function CloseIcon() { return <IconBase><path d="M205.66 194.34a8 8 0 0 1-11.32 11.32L128 139.31l-66.34 66.35a8 8 0 0 1-11.32-11.32L116.69 128 50.34 61.66a8 8 0 0 1 11.32-11.32L128 116.69l66.34-66.35a8 8 0 0 1 11.32 11.32L139.31 128Z" /></IconBase>; }
function CupIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 8.5h8.5v1.2a4 4 0 0 1-4 4H8.6v1.8h3.1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.5 9h1.1a1.9 1.9 0 0 1 0 3.8h-1.1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function TvIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4.5" y="6.5" width="15" height="10" rx="1.7" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 18.5h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function BasketIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5.2 10.2h13.6l-1.1 7.3H6.3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 10.2 12 6.5l3 3.7M8.4 13.2h7.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function DollarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8.1v7.8M13.9 9.9c-.4-.5-1-.8-1.9-.8-1.2 0-2 .6-2 1.5 0 .8.5 1.2 1.9 1.5 1.5.3 2.2.8 2.2 1.8 0 1.1-.9 1.9-2.3 1.9-.9 0-1.7-.3-2.3-.9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function NvidiaBadge() { return <span className={styles.stockLogoNvidia}>◔</span>; }
function TeslaBadge() { return <span className={styles.stockLogoTesla}>T</span>; }
function MicrosoftBadge() { return <span className={styles.stockLogoMicrosoft}><i /><i /><i /><i /></span>; }
