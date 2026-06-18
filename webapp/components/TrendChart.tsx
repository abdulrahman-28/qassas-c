"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type DayData = { date: string; anomalies: number; normal: number };

export default function TrendChart({ data }: { data: DayData[] }) {
  const hasData = data.some((d) => d.anomalies > 0 || d.normal > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-slate-400">
        No scan data in the last 7 days.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} barGap={4} barCategoryGap="40%">
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip
          cursor={{ fill: "#f8fafc" }}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            fontSize: "12px",
            padding: "8px 12px",
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
          iconType="circle"
          iconSize={7}
        />
        <Bar dataKey="normal" name="Normal" fill="#10b981" radius={[3, 3, 0, 0]} />
        <Bar dataKey="anomalies" name="Anomalies" fill="#f87171" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
