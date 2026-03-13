"use client";

import { useId, type CSSProperties, type ReactNode } from "react";

import { AppShellSidebar } from "@/components/dashboard/AppShellSidebar";

import styles from "./spending-page.module.css";

type CategoryItem = {
  name: string;
  subtitle: string;
  amount: string;
  color: string;
  icon: ReactNode;
};

type TransactionItem = {
  name: string;
  date: string;
  amount: string;
  tone?: "positive" | "muted";
  status?: string;
  trailing?: ReactNode;
  icon: ReactNode;
};

type CalendarBadge = "gray" | "white" | "red" | "count" | "google";

type UpcomingCell = {
  day: string;
  amount?: string;
  muted?: boolean;
  ring?: boolean;
  striped?: boolean;
  stack?: readonly CalendarBadge[];
};

const navTabs = ["Overview", "Breakdown", "Recurring", "Transactions", "Reports"];

const spendSeries = [18, 24, 28, 42, 40, 33, 37, 36, 38, 37, 39, 39, 39, 38, 42, 41, 42, 34, 30, 40, 45, 43, 42, 42, 42, 45, 44, 47, 45, 43, 43, 39, 34, 50, 49, 46, 51, 50, 54, 53, 55, 53, 53, 53, 53, 56, 56, 53, 53, 53, 54, 54, 62, 69];
const comparisonSeries = [12, 18, 20, 23, 28, 28, 28, 35, 35, 35, 35, 42, 42, 42, 42, 42, 50, 50, 50, 50, 50, 50, 50, 50, 50, 41, 40, 43, 39, 44, 42, 39, 39, 39, 42, 46, 50, 53, 48, 47, 48, 49, 51, 48, 54, 51, 51, 51, 51, 51, 54, 54, 51, 52, 53, 65, 70];

const categories: CategoryItem[] = [
  { name: "Household", subtitle: "Info", amount: "$99.99", color: "#70b9ff", icon: <HomeIcon /> },
  { name: "Groceries", subtitle: "Info", amount: "$99.99", color: "#d7edf0", icon: <BasketIcon /> },
  { name: "Drinks & dining", subtitle: "Info", amount: "$99.99", color: "#f2b660", icon: <ForkIcon /> },
  { name: "Health care", subtitle: "Info", amount: "$99.99", color: "#d98ae2", icon: <HealthIcon /> },
  { name: "Entertainment", subtitle: "Info", amount: "$99.99", color: "#7d73ff", icon: <TicketIcon /> },
  { name: "Auto & transport", subtitle: "Info", amount: "$99.99", color: "#c4663e", icon: <CarIcon /> },
];

const transactions: TransactionItem[] = [
  { name: "Starbucks", date: "May 23", amount: "$99.99", icon: <ForkIcon /> },
  {
    name: "Netflix",
    date: "May 20",
    amount: "$99.99",
    tone: "muted",
    status: "Pending",
    trailing: (
      <>
        <EyeSlashIcon />
        <RepeatIcon />
      </>
    ),
    icon: <TicketIcon />,
  },
  { name: "Paycheck", date: "May 15", amount: "$99.99", tone: "positive", icon: <DollarIcon /> },
  { name: "HBO", date: "May 28", amount: "$99.99", trailing: <RepeatIcon />, icon: <TicketIcon /> },
  { name: "HBO", date: "May 28", amount: "$99.99", trailing: <RepeatIcon />, icon: <TicketIcon /> },
];

const upcomingCells: readonly UpcomingCell[] = [
  { day: "27", muted: true },
  { day: "28", muted: true },
  { day: "7", amount: "$13.99", ring: true },
  { day: "30", muted: true },
  { day: "1", amount: "$13.99", stack: ["gray", "white", "red"] as const, striped: true },
  { day: "2" },
  { day: "3", amount: "$13.99", ring: true },
  { day: "4", amount: "$13.99", stack: ["white", "red", "count"] as const },
  { day: "5" },
  { day: "6", amount: "$13.99", stack: ["white", "red", "google"] as const },
  { day: "7" },
  { day: "8" },
  { day: "9", amount: "$13.99", stack: ["white", "red"] as const },
  { day: "10", amount: "$13.99", ring: true },
] as const;

export function SpendingPage() {
  return (
    <div className={styles.shell}>
      <AppShellSidebar />

      <div className={styles.main}>
        <header className={styles.topBar}>
          <div className={styles.headerRow}>
            <h1 className={styles.pageTitle}>Spending</h1>

            <div className={styles.topActions}>
              <CircleButton label="Profile" bordered>
                <UserIcon />
              </CircleButton>
              <CircleButton label="Add" filled>
                <PlusIcon />
              </CircleButton>
              <CircleButton label="Help">
                <HelpIcon />
              </CircleButton>
              <CircleButton label="Settings">
                <GearIcon />
              </CircleButton>
            </div>
          </div>

          <nav className={styles.tabs} aria-label="Spending sections">
            {navTabs.map((tab, index) => (
              <button key={tab} type="button" className={`${styles.tab} ${index === 0 ? styles.tabActive : ""}`.trim()}>
                {tab}
              </button>
            ))}
          </nav>
        </header>

        <main className={styles.scrollArea}>
          <div className={styles.board}>
            <div className={styles.primaryColumn}>
              <section className={`${styles.card} ${styles.heroCard}`}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardEyebrow}>Spend this month</div>
                  <div className={styles.headerButtons}>
                    <SquareButton label="Trend">
                      <TrendMiniIcon />
                    </SquareButton>
                    <SquareButton label="Calendar">
                      <CalendarIcon />
                    </SquareButton>
                    <SquareButton label="Favorites" accent>
                      <SparkIcon />
                    </SquareButton>
                  </div>
                </div>

                <div className={styles.heroContent}>
                  <div className={styles.heroTotals}>
                    <div className={styles.heroAmount}>$2,132</div>
                    <div className={styles.heroLegend}>
                      <span className={styles.heroDot} />
                      <span>May</span>
                    </div>
                  </div>

                  <button type="button" className={styles.comparePill}>
                    ----
                    <span className={styles.compareLabel}>vs April</span>
                    <ChevronDownIcon />
                  </button>
                </div>

                <SpendChart />

                <div className={styles.axisRow}>
                  <span>01</span>
                  <span>07</span>
                  <span>14</span>
                  <span>21</span>
                  <span>28</span>
                </div>
              </section>

              <div className={styles.middleGrid}>
                <section className={`${styles.card} ${styles.transactionsCard}`}>
                  <CardTitle title="Latest transactions" />
                  <div className={styles.transactionList}>
                    {transactions.map((item) => (
                      <div key={`${item.name}-${item.date}-${item.amount}`} className={styles.transactionRow}>
                        <span className={`${styles.transactionIcon} ${item.tone === "positive" ? styles.transactionIconPositive : ""}`.trim()}>
                          {item.icon}
                        </span>
                        <div className={styles.transactionMeta}>
                          <span className={item.tone === "muted" ? styles.transactionNameMuted : ""}>{item.name}</span>
                          <small>
                            {item.date}
                            {item.status ? ` / ${item.status}` : ""}
                          </small>
                        </div>
                        <div className={styles.transactionTrail}>
                          {item.trailing ? <span className={styles.transactionState}>{item.trailing}</span> : null}
                          <span
                            className={`${styles.transactionAmount} ${
                              item.tone === "positive" ? styles.transactionAmountPositive : item.tone === "muted" ? styles.transactionAmountMuted : ""
                            }`.trim()}
                          >
                            {item.amount}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className={`${styles.card} ${styles.upcomingCard}`}>
                  <div className={styles.cardHeader}>
                    <CardTitle title="Upcoming transactions" inline />
                    <SquareButton label="Add" accent>
                      <SparkIcon />
                    </SquareButton>
                  </div>

                  <div className={styles.calendarHeader}>
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>

                  <div className={styles.calendarGrid}>
                    {upcomingCells.map((cell, index) => (
                      <div
                        key={`${cell.day}-${index}`}
                        className={`${styles.calendarCell} ${cell.muted ? styles.calendarCellMuted : ""} ${cell.striped ? styles.calendarCellStriped : ""}`.trim()}
                      >
                        <span className={styles.calendarDay}>{cell.day}</span>
                        <div className={styles.calendarBadges}>
                          {cell.stack?.map((token, tokenIndex) => (
                            <span key={`${token}-${tokenIndex}`} className={`${styles.badge} ${badgeClass(token)}`.trim()}>
                              {token === "count" ? "+2" : token === "google" ? <GoogleGlyph /> : null}
                            </span>
                          ))}
                          {cell.ring ? <span className={styles.ringBadge} /> : null}
                        </div>
                        <span className={styles.calendarAmount}>{cell.amount ?? ""}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <section className={`${styles.card} ${styles.reportsCard}`}>
                <div className={styles.cardHeader}>
                  <CardTitle title="Reports" inline />
                  <div className={styles.headerButtons}>
                    <SquareButton label="Add" accent>
                      <SparkIcon />
                    </SquareButton>
                  </div>
                </div>

                <div className={styles.reportMeta}>
                  <span>Last 6 months</span>
                  <small>May (Current)</small>
                </div>

                <div className={styles.reportToolbar}>
                  <SquareButton label="Swap">
                    <SplitIcon />
                  </SquareButton>
                  <SquareButton label="Bars">
                    <BarsIcon />
                  </SquareButton>
                  <SquareButton label="Share">
                    <NodesIcon />
                  </SquareButton>
                </div>

                <SankeyMock />

                <div className={styles.statGrid}>
                  <StatBlock label="Total income" value="$12,701.12" />
                  <StatBlock label="Total expenses" value="$9,004.10" />
                  <StatBlock label="Net cash flow" value="$3,697.02" />
                  <StatBlock label="Avg cash flow / mo" value="$2,501.10" />
                </div>
              </section>
            </div>

            <aside className={styles.sideColumn}>
              <section className={`${styles.card} ${styles.categoryCard}`}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardEyebrow}>Category breakdown</div>
                  <SquareButton label="Add" accent>
                    <SparkIcon />
                  </SquareButton>
                </div>

                <div className={styles.segmentTabs}>
                  <button type="button" className={`${styles.segmentTab} ${styles.segmentTabActive}`.trim()}>
                    Expenses
                  </button>
                  <button type="button" className={styles.segmentTab}>
                    Budget
                  </button>
                </div>

                <CategoryRing />

                <div className={styles.categoryList}>
                  {categories.map((category) => (
                    <div key={category.name} className={styles.categoryRow}>
                      <span className={styles.categoryIcon} style={{ "--swatch": category.color } as CSSProperties}>
                        {category.icon}
                      </span>
                      <div className={styles.categoryMeta}>
                        <span>{category.name}</span>
                        <small>{category.subtitle}</small>
                      </div>
                      <span className={styles.categoryAmount}>{category.amount}</span>
                    </div>
                  ))}
                </div>

                <button type="button" className={styles.fullWidthButton}>
                  See more
                </button>
              </section>

              <section className={`${styles.card} ${styles.incomeCard}`}>
                <div className={styles.cardHeader}>
                  <CardTitle title="Income this month" inline />
                  <SquareButton label="Add" accent>
                    <SparkIcon />
                  </SquareButton>
                </div>

                <div className={styles.incomeSection}>
                  <div>
                    <div className={styles.incomeLabel}>Current Income</div>
                    <div className={styles.incomeMonth}>May</div>
                  </div>
                  <div className={styles.incomeValue}>$ 4,000</div>
                </div>

                <div className={styles.incomeSection}>
                  <div className={styles.incomeLabel}>Next Paycheck</div>
                  <div className={styles.incomeRows}>
                    <div className={styles.incomeRow}>
                      <span className={`${styles.incomeDot} ${styles.incomeDotBlue}`}></span>
                      <span>09/Jun You</span>
                      <strong>$ 2,000</strong>
                    </div>
                    <div className={styles.incomeRow}>
                      <span className={`${styles.incomeDot} ${styles.incomeDotOrange}`}></span>
                      <span>13/Jun Partner</span>
                      <strong>$ 4,000</strong>
                    </div>
                  </div>
                </div>

                <div className={styles.incomeFooter}>
                  <div className={styles.incomeFooterRow}>
                    <span className={styles.incomeLabel}>Next Income</span>
                    <strong>$6,000</strong>
                  </div>
                  <div className={styles.progressTrack}>
                    <span className={styles.progressFillWarm}></span>
                    <span className={styles.progressFillCool}></span>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

function badgeClass(token: CalendarBadge) {
  if (token === "gray") return styles.badgeGray;
  if (token === "white") return styles.badgeWhite;
  if (token === "red") return styles.badgeRed;
  if (token === "count") return styles.badgeCount;
  if (token === "google") return styles.badgeGoogle;
  return "";
}

function CardTitle({ title, inline = false }: { title: string; inline?: boolean }) {
  return (
    <div className={`${styles.cardTitleWrap} ${inline ? styles.cardTitleInline : ""}`.trim()}>
      <div className={styles.cardEyebrow}>
        {title}
        <span className={styles.cardChevron}>{">"}</span>
      </div>
    </div>
  );
}

function CircleButton({
  children,
  label,
  bordered = false,
  filled = false,
}: {
  children: ReactNode;
  label: string;
  bordered?: boolean;
  filled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`${styles.circleButton} ${bordered ? styles.circleButtonBordered : ""} ${filled ? styles.circleButtonFilled : ""}`.trim()}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function SquareButton({ children, label, accent = false }: { children: ReactNode; label: string; accent?: boolean }) {
  return (
    <button type="button" className={`${styles.squareButton} ${accent ? styles.squareButtonAccent : ""}`.trim()} aria-label={label}>
      {children}
    </button>
  );
}

function SpendChart() {
  const areaId = useId();
  const compareId = useId();
  const mainPath = buildSmoothPath(spendSeries);
  const mainArea = buildAreaPath(spendSeries);
  const comparePath = buildStepPath(comparisonSeries);
  const endPoint = getSeriesPoint(spendSeries, spendSeries.length - 1);

  return (
    <svg viewBox="0 0 100 54" className={styles.heroChart} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6fb9ff" stopOpacity="0.48" />
          <stop offset="62%" stopColor="#10335f" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#02101e" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={compareId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7f7d72" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#c4bda4" stopOpacity="0.78" />
        </linearGradient>
      </defs>
      <path d={mainArea} fill={`url(#${areaId})`} />
      <path d={comparePath} fill="none" stroke={`url(#${compareId})`} strokeWidth="0.22" strokeDasharray="1.2 0.7" strokeLinecap="round" />
      <path d={mainPath} fill="none" stroke="#199dff" strokeWidth="0.28" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={endPoint.x} cy={endPoint.y} r="0.8" fill="#199dff" stroke="#5aaef2" strokeWidth="0.2" />
    </svg>
  );
}

function CategoryRing() {
  const segments = [
    { dash: "12 92", offset: 6, color: "#70b9ff" },
    { dash: "16 88", offset: 22, color: "#00b6bc" },
    { dash: "14 90", offset: 43, color: "#f2b660" },
    { dash: "10 94", offset: 62, color: "#d98ae2" },
    { dash: "8 96", offset: 76, color: "#c4663e" },
    { dash: "7 97", offset: 87, color: "#7d73ff" },
    { dash: "8 96", offset: 97, color: "#c79a2f" },
  ];

  return (
    <div className={styles.ringWrap}>
      <svg viewBox="0 0 120 120" className={styles.ringChart} aria-hidden="true">
        <circle cx="60" cy="60" r="36" className={styles.ringTrack} />
        {segments.map((segment) => (
          <circle
            key={`${segment.color}-${segment.offset}`}
            cx="60"
            cy="60"
            r="36"
            fill="none"
            stroke={segment.color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={segment.dash}
            strokeDashoffset={segment.offset}
            className={styles.ringSegment}
          />
        ))}
      </svg>

      <div className={styles.ringCenter}>
        <strong>$2,999</strong>
        <span>Total expenses</span>
      </div>
    </div>
  );
}

function SankeyMock() {
  return (
    <div className={styles.sankey}>
      <div className={`${styles.sankeyColumn} ${styles.sankeyLeft}`}>
        <div className={`${styles.sankeyNode} ${styles.sankeyNodeTop}`}>
          <span>Other</span>
          <strong>$1,201.12</strong>
        </div>
        <div className={`${styles.sankeyNode} ${styles.sankeyNodeBottom}`}>
          <span>Income</span>
          <strong>$3,500.00</strong>
        </div>
      </div>

      <svg viewBox="0 0 100 36" className={styles.sankeyFlows} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="flow-one" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#5f6d32" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#7f75ff" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="flow-two" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7b5b31" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#bb7448" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="flow-three" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7a7619" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#b89916" stopOpacity="0.55" />
          </linearGradient>
          <linearGradient id="flow-four" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6f7e36" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#d18ef6" stopOpacity="0.45" />
          </linearGradient>
        </defs>
        <path d="M0 4 C 20 4, 26 4, 48 5 S 75 3, 100 3" stroke="url(#flow-one)" strokeWidth="6" fill="none" />
        <path d="M0 11 C 22 11, 28 10, 51 14 S 77 17, 100 17" stroke="url(#flow-two)" strokeWidth="7" fill="none" />
        <path d="M0 17 C 23 17, 29 18, 51 21 S 78 24, 100 25" stroke="url(#flow-three)" strokeWidth="6" fill="none" />
        <path d="M0 27 C 24 27, 31 27, 53 28 S 80 30, 100 32" stroke="url(#flow-four)" strokeWidth="11" fill="none" />
      </svg>

      <div className={`${styles.sankeyColumn} ${styles.sankeyRight}`}>
        <div className={`${styles.sankeyNode} ${styles.sankeyNodePurple}`}>
          <span>Childcare & Education</span>
          <strong>$2,201.12</strong>
        </div>
        <div className={`${styles.sankeyNode} ${styles.sankeyNodeOrange}`}>
          <span>Auto & transport</span>
          <strong>$950.94</strong>
        </div>
        <div className={`${styles.sankeyNode} ${styles.sankeyNodeGold}`}>
          <span>Drinks & dining</span>
          <strong>$650.94</strong>
        </div>
        <div className={`${styles.sankeyNode} ${styles.sankeyNodePink}`}></div>
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.statBlock}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getSeriesPoint(points: number[], index: number) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const x = (index / (points.length - 1)) * 100;
  const y = 47 - ((points[index] - min) / range) * 34;
  return { x, y };
}

function buildSmoothPath(points: number[]) {
  return points
    .map((value, index, list) => {
      const point = getSeriesPoint(list, index);
      if (index === 0) return `M ${point.x} ${point.y}`;
      const previous = getSeriesPoint(list, index - 1);
      const controlX = (previous.x + point.x) / 2;
      return `C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
    })
    .join(" ");
}

function buildAreaPath(points: number[]) {
  const line = buildSmoothPath(points);
  return `${line} L 100 54 L 0 54 Z`;
}

function buildStepPath(points: number[]) {
  return points
    .map((value, index, list) => {
      const point = getSeriesPoint(list, index);
      if (index === 0) return `M ${point.x} ${point.y}`;
      const previous = getSeriesPoint(list, index - 1);
      return `L ${point.x} ${previous.y} L ${point.x} ${point.y}`;
    })
    .join(" ");
}

function IconBase({ children, viewBox = "0 0 24 24" }: { children: ReactNode; viewBox?: string }) {
  return (
    <svg viewBox={viewBox} aria-hidden="true">
      {children}
    </svg>
  );
}

function UserIcon() { return <IconBase viewBox="0 0 256 256"><path d="M128 128a40 40 0 1 0-40-40 40 40 0 0 0 40 40Zm0 16c-35.35 0-64 18.61-64 41.6a8 8 0 0 0 16 0C80 172.57 101.53 160 128 160s48 12.57 48 25.6a8 8 0 0 0 16 0C192 162.61 163.35 144 128 144Z" /></IconBase>; }
function PlusIcon() { return <IconBase viewBox="0 0 256 256"><path d="M128 56a8 8 0 0 1 8 8v56h56a8 8 0 0 1 0 16h-56v56a8 8 0 0 1-16 0v-56H64a8 8 0 0 1 0-16h56V64a8 8 0 0 1 8-8Z" /></IconBase>; }
function HelpIcon() { return <IconBase viewBox="0 0 256 256"><path d="M140 180a12 12 0 1 1-12-12 12 12 0 0 1 12 12Zm-12-164A112 112 0 1 0 240 128 112.12 112.12 0 0 0 128 16Zm0 208a96 96 0 1 1 96-96 96.11 96.11 0 0 1-96 96Zm-8-72a8 8 0 0 1 8-8 20 20 0 1 0-20-20 8 8 0 0 1-16 0 36 36 0 1 1 44 35.12V160a8 8 0 0 1-16 0Z" /></IconBase>; }
function GearIcon() { return <IconBase><path d="M12 8.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 0 0 0-6.5Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><path d="M19.2 13.1v-2.2l-1.7-.45a5.86 5.86 0 0 0-.5-1.2l.92-1.48-1.55-1.55-1.48.92c-.38-.2-.78-.37-1.2-.5L13.1 4.8h-2.2l-.45 1.7c-.42.13-.82.3-1.2.5l-1.48-.92-1.55 1.55.92 1.48c-.2.38-.37.78-.5 1.2l-1.7.45v2.2l1.7.45c.13.42.3.82.5 1.2l-.92 1.48 1.55 1.55 1.48-.92c.38.2.78.37 1.2.5l.45 1.7h2.2l.45-1.7c.42-.13.82-.3 1.2-.5l1.48.92 1.55-1.55-.92-1.48c.2-.38.37-.78.5-1.2l1.7-.45Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></IconBase>; }
function SparkIcon() { return <IconBase><path d="M12 3.8 14.15 9.85 20.2 12l-6.05 2.15L12 20.2l-2.15-6.05L3.8 12l6.05-2.15Z" fill="currentColor" /></IconBase>; }
function TrendMiniIcon() { return <IconBase><path d="M4.5 15.5 9 11l3 2.8 5-6.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M15.7 7.5H20v4.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></IconBase>; }
function CalendarIcon() { return <IconBase><rect x="4.5" y="5.5" width="15" height="14" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M8 3.9v3M16 3.9v3M4.5 9.5h15" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></IconBase>; }
function ChevronDownIcon() { return <IconBase><path d="m7 10 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></IconBase>; }
function HomeIcon() { return <IconBase><path d="M5 10.2 12 4l7 6.2v8.1h-5v-4.8H10v4.8H5z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></IconBase>; }
function BasketIcon() { return <IconBase><path d="M5 9.8h14l-1.2 7.7H6.2Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="m8.5 9.8 3.5-4 3.5 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></IconBase>; }
function ForkIcon() { return <IconBase><path d="M8 5v6M6.2 5v3.2c0 1 .8 1.8 1.8 1.8S9.8 9.2 9.8 8.2V5M14.5 5v13M17.8 5l-2 4h2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></IconBase>; }
function HealthIcon() { return <IconBase><path d="m12 18.2-5.5-5.4a3.6 3.6 0 0 1 5.1-5.1L12 8.1l.4-.4a3.6 3.6 0 1 1 5.1 5.1Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /><path d="M9.1 12h2l1-2 1.1 4 1-2h1.7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></IconBase>; }
function TicketIcon() { return <IconBase><path d="M5 8.5h14v2a2 2 0 0 0 0 3v2H5v-2a2 2 0 0 0 0-3z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M9 8.5v7M15 8.5v7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1.5 1.5" /></IconBase>; }
function CarIcon() { return <IconBase><path d="M6 14.5h12l-1-3.5a2 2 0 0 0-1.9-1.5H8.9A2 2 0 0 0 7 11z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M6.5 14.5v2.5M17.5 14.5v2.5M7.5 17h9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></IconBase>; }
function DollarIcon() { return <IconBase><circle cx="12" cy="12" r="7.3" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M12 8.2v7.6M14.1 10c-.4-.5-1.2-.8-2-.8-1.2 0-2.1.6-2.1 1.6 0 .9.7 1.2 2 1.5 1.6.4 2.4.9 2.4 1.9 0 1.1-.9 1.9-2.4 1.9-.9 0-1.8-.3-2.4-.9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></IconBase>; }
function EyeSlashIcon() { return <IconBase><path d="m4 5 16 14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><path d="M10.6 6.5A9.7 9.7 0 0 1 12 6.4c4.3 0 7.4 3.3 8.4 5.6-.4.8-1.2 2-2.3 3M8 8.7c-1.8 1-3.1 2.7-3.9 4.3 1 2.2 4.1 5.6 7.9 5.6a7.2 7.2 0 0 0 2.4-.4M10.6 10.6a2.4 2.4 0 0 0 3 3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></IconBase>; }
function RepeatIcon() { return <IconBase><path d="M7 8h8.5l-1.8-1.8M17 16H8.5l1.8 1.8M17 8v2.5M7 16v-2.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></IconBase>; }
function GoogleGlyph() { return <span className={styles.googleGlyph}>G</span>; }
function SplitIcon() { return <IconBase><path d="M9 6v12M9 9h8M9 15h8M16 7l2-2 2 2M16 17l2 2 2-2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></IconBase>; }
function BarsIcon() { return <IconBase><path d="M6 18V11M12 18V6M18 18V9" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><path d="M4.5 18.5h15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></IconBase>; }
function NodesIcon() { return <IconBase><path d="M7 8.5h2.5v2.5H7zm7.5-3h2.5V8h-2.5zM14.5 16h2.5v2.5h-2.5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M9.5 9.7 14.5 7M9.5 11.3 14.5 17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></IconBase>; }
