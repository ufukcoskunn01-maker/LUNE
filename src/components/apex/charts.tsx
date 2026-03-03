"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Series = {
  key: string;
  color: string;
  name: string;
};

const PIE_COLORS = ["#0284c7", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];

export function TrendLines({
  data,
  xKey,
  series,
  height = 280,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  series: Series[];
  height?: number;
}) {
  return (
    <div className="h-[280px] w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="4 4" strokeOpacity={0.2} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={42} />
          <Tooltip />
          <Legend />
          {series.map((item) => (
            <Line
              key={item.key}
              type="monotone"
              dataKey={item.key}
              stroke={item.color}
              name={item.name}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendArea({
  data,
  xKey,
  areaKey,
  lineKey,
  areaColor,
  lineColor,
  height = 280,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  areaKey: string;
  lineKey: string;
  areaColor: string;
  lineColor: string;
  height?: number;
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="4 4" strokeOpacity={0.2} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={42} />
          <Tooltip />
          <Area type="monotone" dataKey={areaKey} fill={areaColor} stroke={areaColor} fillOpacity={0.2} />
          <Line type="monotone" dataKey={lineKey} stroke={lineColor} strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StackedBars({
  data,
  xKey,
  bars,
  height = 280,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  bars: Series[];
  height?: number;
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="4 4" strokeOpacity={0.2} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={42} />
          <Tooltip />
          <Legend />
          {bars.map((bar) => (
            <Bar key={bar.key} dataKey={bar.key} name={bar.name} stackId="stack" fill={bar.color} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimpleBars({
  data,
  xKey,
  barKey,
  color,
  height = 280,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  barKey: string;
  color: string;
  height?: number;
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="4 4" strokeOpacity={0.2} />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} width={42} />
          <Tooltip />
          <Bar dataKey={barKey} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({
  data,
  dataKey,
  nameKey,
  height = 280,
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  nameKey: string;
  height?: number;
}) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey={dataKey} nameKey={nameKey} innerRadius={64} outerRadius={94} paddingAngle={2}>
            {data.map((_, index) => (
              <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
