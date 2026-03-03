export type ForecastCurvePoint = {
  period: string;
  actual: number;
  target: number;
};

export const forecastCurve: ForecastCurvePoint[] = [
  { period: "2026", actual: 456, target: 450 },
  { period: "2027", actual: 592, target: 605 },
  { period: "2028", actual: 748, target: 735 },
  { period: "2029", actual: 812, target: 790 },
  { period: "2030", actual: 941, target: 910 },
  { period: "2031", actual: 1008, target: 990 },
  { period: "2032", actual: 879, target: 965 },
];

export type SpendDay = {
  day: number;
  amount: number;
};

export const spendByDay: SpendDay[] = [
  { day: 1, amount: 0 },
  { day: 2, amount: 80 },
  { day: 3, amount: 8 },
  { day: 4, amount: 1300 },
  { day: 5, amount: 64 },
  { day: 6, amount: 102 },
  { day: 7, amount: 32 },
  { day: 8, amount: 0 },
  { day: 9, amount: 0 },
  { day: 10, amount: 0 },
  { day: 11, amount: 0 },
  { day: 12, amount: 0 },
  { day: 13, amount: 0 },
  { day: 14, amount: 0 },
  { day: 15, amount: 0 },
  { day: 16, amount: 0 },
  { day: 17, amount: 0 },
  { day: 18, amount: 0 },
  { day: 19, amount: 0 },
  { day: 20, amount: 0 },
  { day: 21, amount: 0 },
  { day: 22, amount: 0 },
  { day: 23, amount: 0 },
  { day: 24, amount: 0 },
  { day: 25, amount: 0 },
  { day: 26, amount: 0 },
  { day: 27, amount: 0 },
  { day: 28, amount: 0 },
  { day: 29, amount: 0 },
  { day: 30, amount: 0 },
  { day: 31, amount: 0 },
];

export type TransactionItem = {
  id: string;
  label: string;
  category: string;
  date: string;
  amount: number;
  direction: "in" | "out";
  icon: "coffee" | "film" | "store" | "wallet" | "truck" | "tool";
};

export const recentTransactions: TransactionItem[] = [
  { id: "txn-001", label: "Starbucks", category: "Site team meeting", date: "Mar 22", amount: 12, direction: "out", icon: "coffee" },
  { id: "txn-002", label: "Netflix", category: "Training media", date: "Mar 22", amount: 29.9, direction: "out", icon: "film" },
  { id: "txn-003", label: "Walmart", category: "Office supplies", date: "Mar 21", amount: 17.5, direction: "out", icon: "store" },
  { id: "txn-004", label: "Client Payment", category: "Progress invoice", date: "Mar 21", amount: 1877.9, direction: "in", icon: "wallet" },
  { id: "txn-005", label: "Fuel Reload", category: "Vehicle fleet", date: "Mar 20", amount: 144.99, direction: "out", icon: "truck" },
  { id: "txn-006", label: "Tool Rental", category: "Temporary equipment", date: "Mar 19", amount: 77.01, direction: "out", icon: "tool" },
];

export type BudgetLine = {
  label: string;
  spent: number;
  limit: number;
  forecast: number;
  color: string;
};

export const budgetLines: BudgetLine[] = [
  { label: "Food", spent: 1120, limit: 2720, forecast: 1400, color: "#f59e0b" },
  { label: "Auto & Transport", spent: 183, limit: 2200, forecast: 420, color: "#f97316" },
  { label: "Everything Else", spent: 1070, limit: 2234, forecast: 1460, color: "#8b5cf6" },
];

export const totalBudget = { spent: 2234, limit: 5000 };

export type AllocationItem = {
  name: string;
  amount: number;
  share: number;
  delta: number;
  color: string;
};

export const allocationMix: AllocationItem[] = [
  { name: "Civil Works", amount: 147413, share: 71, delta: 2.1, color: "#78c6ff" },
  { name: "Electrical", amount: 36432, share: 12, delta: -1.7, color: "#f4de59" },
  { name: "Architectural", amount: 16876, share: 8, delta: 2.2, color: "#d084db" },
  { name: "Mechanical", amount: 6255, share: 3, delta: 0.1, color: "#b6edb9" },
  { name: "Commissioning", amount: 4541, share: 1, delta: 3.3, color: "#f2c295" },
  { name: "Contingency", amount: 4541, share: 1, delta: 1.3, color: "#8fd4d4" },
];

export type MomentumPoint = {
  day: string;
  current: number;
  previous: number;
};

export const momentumSeries: MomentumPoint[] = [
  { day: "01", current: 58, previous: 35 },
  { day: "03", current: 68, previous: 38 },
  { day: "05", current: 84, previous: 47 },
  { day: "07", current: 95, previous: 58 },
  { day: "09", current: 86, previous: 58 },
  { day: "11", current: 102, previous: 63 },
  { day: "13", current: 106, previous: 52 },
  { day: "15", current: 92, previous: 58 },
  { day: "17", current: 118, previous: 72 },
  { day: "19", current: 114, previous: 66 },
  { day: "21", current: 123, previous: 68 },
  { day: "23", current: 126, previous: 74 },
  { day: "25", current: 124, previous: 74 },
  { day: "27", current: 140, previous: 77 },
  { day: "29", current: 147, previous: 86 },
];

export const topMovers = [
  { symbol: "CIV-14", name: "Civil Package", value: 142.8, change: -0.05 },
  { symbol: "MEP-09", name: "MEP Package", value: 148.4, change: 3.27 },
  { symbol: "ARC-22", name: "Architectural", value: 126.1, change: 2.14 },
];

export const reportOutputTrend = [
  { month: "Oct", generated: 102, failed: 3, delivered: 99 },
  { month: "Nov", generated: 109, failed: 4, delivered: 105 },
  { month: "Dec", generated: 116, failed: 3, delivered: 113 },
  { month: "Jan", generated: 123, failed: 2, delivered: 121 },
  { month: "Feb", generated: 146, failed: 1, delivered: 145 },
];
