import Link from "next/link";
import {
  getPublicUser,
  getCamerasByOperator,
  getOperatorStats,
  getRecentAnomaliesForOperator,
  getOperatorTrendData,
} from "@/lib/server";
import TrendChart from "./TrendChart";
import { CheckCircle2, ScanLine, AlertTriangle, TrendingUp } from "lucide-react";

export default async function OperatorDashboard() {
  const publicUser = await getPublicUser();
  const [cameras, stats, recentAnomalies, trendData] = await Promise.all([
    publicUser ? getCamerasByOperator(publicUser.id) : [],
    publicUser ? getOperatorStats(publicUser.id) : { scansToday: 0, anomaliesToday: 0, anomalyRate: 0, totalScans: 0 },
    publicUser ? getRecentAnomaliesForOperator(publicUser.id, 15) : [],
    publicUser ? getOperatorTrendData(publicUser.id) : [],
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">
          Welcome back, {publicUser?.username}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {cameras.length > 0
            ? `${cameras.length} line${cameras.length !== 1 ? "s" : ""} assigned`
            : "No production lines assigned yet"}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 border-t-2 border-t-blue-400 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Scans Today</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <ScanLine size={15} className="text-blue-600" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 tabular-nums">{stats.scansToday.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1.5">{stats.totalScans.toLocaleString()} total all time</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 border-t-2 border-t-amber-400 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Anomalies Today</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <AlertTriangle size={15} className="text-amber-600" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 tabular-nums">{stats.anomaliesToday.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1.5">
            {stats.scansToday > 0 ? `out of ${stats.scansToday} scans today` : "no scans today yet"}
          </p>
        </div>

        <div className={`bg-white rounded-xl border border-slate-200 border-t-2 p-5 shadow-sm ${
          stats.anomalyRate > 20 ? "border-t-red-400" : stats.anomalyRate > 5 ? "border-t-amber-400" : "border-t-emerald-400"
        }`}>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Anomaly Rate Today</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              stats.anomalyRate > 20 ? "bg-red-50" : stats.anomalyRate > 5 ? "bg-amber-50" : "bg-emerald-50"
            }`}>
              <TrendingUp size={15} className={
                stats.anomalyRate > 20 ? "text-red-600" : stats.anomalyRate > 5 ? "text-amber-600" : "text-emerald-600"
              } />
            </div>
          </div>
          <p className={`text-3xl font-black tabular-nums ${
            stats.anomalyRate > 20 ? "text-red-600" : stats.anomalyRate > 5 ? "text-amber-600" : "text-slate-900"
          }`}>
            {stats.anomalyRate}%
          </p>
          <p className="text-xs text-slate-400 mt-1.5">
            {stats.anomalyRate === 0 && stats.scansToday === 0 ? "no data yet today" :
              stats.anomalyRate <= 5 ? "within normal range" :
              stats.anomalyRate <= 20 ? "above normal — monitor closely" :
              "high — action may be needed"}
          </p>
        </div>
      </div>

      {/* 7-day trend chart */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-slate-900">7-Day Scan Trend</h2>
          <p className="text-xs text-slate-400 mt-0.5">Normal vs anomalous detections over the last 7 days</p>
        </div>
        <TrendChart data={trendData} />
      </div>

      {/* Recent anomalies feed */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Recent Anomalies</h2>
          <p className="text-xs text-slate-400 mt-0.5">Latest anomaly detections across your lines</p>
        </div>
        {recentAnomalies.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={20} className="text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-slate-700">No anomalies detected</p>
            <p className="text-xs text-slate-400 mt-1">All clear — no issues found on your lines yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">ID</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Line</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Score</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Detected</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentAnomalies.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-3 font-mono text-xs text-slate-400">#{r.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.cameraName}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-red-600 tabular-nums font-semibold">
                      {r.anomalyScore.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/history/${r.id}`}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View anomaly
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
