import Link from "next/link";
import {
  Layers, CheckCircle2, AlertTriangle, Users, ScanLine,
  TrendingUp, WifiOff, Wrench, Clock, TriangleAlert,
} from "lucide-react";
import { getAdminDashboardData } from "@/lib/server";

const statusBadge: Record<string, string> = {
  ACTIVE:      "bg-emerald-50 text-emerald-700 border border-emerald-200",
  INACTIVE:    "bg-slate-100   text-slate-600   border border-slate-200",
  MAINTENANCE: "bg-amber-50   text-amber-700   border border-amber-200",
};
const statusDot: Record<string, string> = {
  ACTIVE:      "bg-emerald-500",
  INACTIVE:    "bg-slate-400",
  MAINTENANCE: "bg-amber-400",
};
const productLabels: Record<string, string> = {
  BOTTLE: "Bottle", CAPSULE: "Capsule", PILL: "Pill",
  TOOTHBRUSH: "Toothbrush", ALL: "All",
};

function timeAgo(date: Date) {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function DonutRing({ normal, anomalies }: { normal: number; anomalies: number }) {
  const total = normal + anomalies;
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center w-24 h-24">
        <div className="w-24 h-24 rounded-full border-[10px] border-slate-100 flex items-center justify-center">
          <span className="text-xs text-slate-400">No data</span>
        </div>
      </div>
    );
  }
  const r = 36;
  const circ = 2 * Math.PI * r;
  const normalArc = (normal / total) * circ;
  const anomalyArc = (anomalies / total) * circ;
  const anomalyPct = Math.round((anomalies / total) * 100);

  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg width="96" height="96" className="-rotate-90" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#f1f5f9" strokeWidth="12" />
        <circle cx="48" cy="48" r={r} fill="none" stroke="#10b981" strokeWidth="12"
          strokeDasharray={`${normalArc} ${circ}`} strokeDashoffset="0" strokeLinecap="round" />
        <circle cx="48" cy="48" r={r} fill="none" stroke="#f87171" strokeWidth="12"
          strokeDasharray={`${anomalyArc} ${circ}`} strokeDashoffset={`${-normalArc}`} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className={`text-lg font-black leading-none ${anomalyPct > 20 ? "text-red-600" : anomalyPct > 5 ? "text-amber-600" : "text-emerald-600"}`}>
          {anomalyPct}%
        </p>
        <p className="text-[9px] text-slate-400 mt-0.5 font-medium uppercase tracking-wide">anomaly</p>
      </div>
    </div>
  );
}

export default async function AdminDashboard() {
  const { cameras, operatorStats, recentResults, totals } =
    await getAdminDashboardData();

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  const alerts: { level: "critical" | "warning" | "info"; text: string; href?: string }[] = [];
  cameras
    .filter((c) => c.status === "ACTIVE" && !c.assignedToId)
    .forEach((c) =>
      alerts.push({ level: "warning", text: `"${c.name}" is active with no operator assigned`, href: "/lines" }),
    );
  cameras
    .filter((c) => c.imageCount >= 10 && c.anomalyCount / c.imageCount >= 0.2)
    .forEach((c) =>
      alerts.push({
        level: "critical",
        text: `"${c.name}" — ${Math.round((c.anomalyCount / c.imageCount) * 100)}% anomaly rate`,
        href: `/monitor/${c.id}`,
      }),
    );
  cameras
    .filter((c) => c.status === "ACTIVE" && c.lastActive && now - c.lastActive.getTime() > DAY_MS)
    .forEach((c) =>
      alerts.push({ level: "info", text: `"${c.name}" has no scans in over 24 h`, href: `/monitor/${c.id}` }),
    );

  const alertStyles = {
    critical: "text-red-700",
    warning:  "text-amber-700",
    info:     "text-blue-700",
  };
  const alertIcons = {
    critical: <TriangleAlert size={14} className="shrink-0 text-red-500" />,
    warning:  <TriangleAlert size={14} className="shrink-0 text-amber-500" />,
    info:     <Clock        size={14} className="shrink-0 text-blue-500" />,
  };

  const statCards = [
    {
      label: "Production Lines",
      value: totals.lines,
      sub: `${totals.activeLines} active · ${totals.inactiveLines} inactive · ${totals.maintenanceLines} maintenance`,
      icon: Layers,
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      topBorder: "border-t-blue-400",
    },
    {
      label: "Operators",
      value: totals.operators,
      sub: `${totals.unassignedLines} line${totals.unassignedLines !== 1 ? "s" : ""} unassigned`,
      icon: Users,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-600",
      topBorder: "border-t-violet-400",
    },
    {
      label: "Total Scans",
      value: totals.totalScans.toLocaleString(),
      sub: `${totals.scansToday.toLocaleString()} today`,
      icon: ScanLine,
      iconBg: "bg-slate-100",
      iconColor: "text-slate-600",
      topBorder: "border-t-slate-400",
    },
    {
      label: "Anomaly Rate",
      value: `${totals.overallRate}%`,
      sub: `${totals.totalAnomalies.toLocaleString()} total · ${totals.anomaliesToday} today`,
      icon: TrendingUp,
      iconBg: totals.overallRate > 20 ? "bg-red-50" : totals.overallRate > 5 ? "bg-amber-50" : "bg-emerald-50",
      iconColor: totals.overallRate > 20 ? "text-red-600" : totals.overallRate > 5 ? "text-amber-600" : "text-emerald-600",
      topBorder: totals.overallRate > 20 ? "border-t-red-400" : totals.overallRate > 5 ? "border-t-amber-400" : "border-t-emerald-400",
    },
  ];

  const totalForDonut = totals.totalScans;
  const normalForDonut = totalForDonut - totals.totalAnomalies;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Overview of all production lines and operators.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className={`bg-white rounded-xl border border-slate-200 border-t-2 ${s.topBorder} p-5 shadow-sm`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{s.label}</span>
              <div className={`w-8 h-8 rounded-lg ${s.iconBg} flex items-center justify-center shrink-0`}>
                <s.icon size={15} className={s.iconColor} />
              </div>
            </div>
            <p className="text-3xl font-black text-slate-900 tabular-nums">{s.value}</p>
            <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Overview strip: donut + breakdown */}
      {totalForDonut > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5">
          <div className="flex items-center gap-6 flex-wrap">
            <DonutRing normal={normalForDonut} anomalies={totals.totalAnomalies} />
            <div className="flex-1 min-w-0 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">Overall Detection Split</h2>
              {/* Normal bar */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Normal
                  </span>
                  <span className="font-medium text-slate-700 tabular-nums">{normalForDonut.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400 rounded-full transition-all duration-700"
                    style={{ width: `${(normalForDonut / totalForDonut) * 100}%` }} />
                </div>
              </div>
              {/* Anomaly bar */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Anomalies
                  </span>
                  <span className="font-medium text-slate-700 tabular-nums">{totals.totalAnomalies.toLocaleString()}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-400 rounded-full transition-all duration-700"
                    style={{ width: `${(totals.totalAnomalies / totalForDonut) * 100}%` }} />
                </div>
              </div>
            </div>
            <div className="hidden sm:grid grid-cols-2 gap-x-8 gap-y-2 text-right shrink-0">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Today scans</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">{totals.scansToday}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Today anomalies</p>
                <p className={`text-lg font-bold tabular-nums ${totals.anomaliesToday > 0 ? "text-red-600" : "text-slate-900"}`}>{totals.anomaliesToday}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-slate-900">Issues & Alerts</h2>
            <span className="ml-auto text-xs text-slate-400">{alerts.length} item{alerts.length !== 1 ? "s" : ""}</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {alerts.map((a, i) => (
              <li key={i} className={`flex items-center gap-3 px-5 py-3 text-sm border-l-[3px] ${
                a.level === "critical" ? "border-l-red-400 bg-red-50/40" :
                a.level === "warning"  ? "border-l-amber-400 bg-amber-50/40" :
                                         "border-l-blue-400 bg-blue-50/40"
              }`}>
                {alertIcons[a.level]}
                <span className={alertStyles[a.level]}>{a.text}</span>
                {a.href && (
                  <Link href={a.href} className="ml-auto text-xs text-blue-600 hover:text-blue-700 font-medium shrink-0">
                    View →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Production lines */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Production Lines</h2>
            <p className="text-xs text-slate-400 mt-0.5">Status and performance for every line</p>
          </div>
          <Link href="/lines" className="text-xs text-blue-600 hover:text-blue-700 font-medium">Manage →</Link>
        </div>
        {cameras.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">No production lines yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Line</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Operator</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Scans</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Anomalies</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Rate</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cameras.map((cam) => {
                  const rate = cam.imageCount > 0 ? Math.round((cam.anomalyCount / cam.imageCount) * 100) : null;
                  return (
                    <tr key={cam.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[cam.status] ?? "bg-slate-300"}`} />
                          <Link href={`/monitor/${cam.id}`} className="font-medium text-slate-900 hover:text-blue-600 transition-colors">
                            {cam.name}
                          </Link>
                        </div>
                        <p className="text-xs text-slate-400 ml-4">{cam.location}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusBadge[cam.status] ?? ""}`}>
                          {cam.status === "ACTIVE" ? <CheckCircle2 size={10} className="mr-1" /> :
                           cam.status === "INACTIVE" ? <WifiOff size={10} className="mr-1" /> :
                           <Wrench size={10} className="mr-1" />}
                          {cam.status.charAt(0) + cam.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-500">{productLabels[cam.productType] ?? cam.productType}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {cam.assignedTo ?? <span className="text-slate-300 text-xs">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <Link href={`/history?line=${cam.id}`} className="text-blue-600 hover:text-blue-700 font-medium tabular-nums text-sm">
                          {cam.imageCount.toLocaleString()}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {cam.anomalyCount > 0
                          ? <span className="text-sm font-semibold text-red-500">{cam.anomalyCount}</span>
                          : <span className="text-sm text-slate-300">0</span>}
                      </td>
                      <td className="px-4 py-3 w-32">
                        {rate !== null ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${rate > 20 ? "bg-red-400" : rate > 5 ? "bg-amber-400" : "bg-emerald-400"}`}
                                style={{ width: `${Math.min(rate, 100)}%` }}
                              />
                            </div>
                            <span className={`text-xs font-semibold tabular-nums shrink-0 ${rate > 20 ? "text-red-600" : rate > 5 ? "text-amber-600" : "text-emerald-600"}`}>
                              {rate}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{cam.lastActive ? timeAgo(cam.lastActive) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Operator performance */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Operator Performance</h2>
            <p className="text-xs text-slate-400 mt-0.5">All-time activity per operator</p>
          </div>
          <Link href="/operators" className="text-xs text-blue-600 hover:text-blue-700 font-medium">Manage →</Link>
        </div>
        {operatorStats.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">No operators yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Operator</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Lines</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Total Scans</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Anomalies</th>
                  <th className="px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Rate</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {operatorStats.map((op) => (
                  <tr key={op.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-3 font-medium text-slate-900">{op.username}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{op.lineCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{op.scans.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {op.anomalies > 0
                        ? <span className="font-semibold text-red-500">{op.anomalies}</span>
                        : <span className="text-slate-300">0</span>}
                    </td>
                    <td className="px-4 py-3 w-32">
                      {op.rate !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${op.rate > 20 ? "bg-red-400" : op.rate > 5 ? "bg-amber-400" : "bg-emerald-400"}`}
                              style={{ width: `${Math.min(op.rate, 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold tabular-nums shrink-0 ${op.rate > 20 ? "text-red-600" : op.rate > 5 ? "text-amber-600" : "text-emerald-600"}`}>
                            {op.rate}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{op.lastActive ? timeAgo(op.lastActive) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent detections feed */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Recent Detections</h2>
            <p className="text-xs text-slate-400 mt-0.5">Latest scan results across all lines</p>
          </div>
          <Link href="/history" className="text-xs text-blue-600 hover:text-blue-700 font-medium">View all →</Link>
        </div>
        {recentResults.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">No scan results yet.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recentResults.map((r) => (
              <li key={r.id}
                className={`flex items-center gap-4 px-6 py-3 border-l-[3px] hover:bg-slate-50/60 transition-colors ${
                  r.isAnomalous ? "border-l-red-400" : "border-l-emerald-400"
                }`}
              >
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border shrink-0 ${
                  r.isAnomalous
                    ? "bg-red-50 text-red-700 border-red-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}>
                  {r.isAnomalous ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
                  {r.isAnomalous ? "Anomaly" : "Normal"}
                </span>
                <span className="text-sm font-medium text-slate-900 truncate flex-1">
                  {r.cameraId
                    ? <Link href={`/monitor/${r.cameraId}`} className="hover:text-blue-600 transition-colors">{r.cameraName}</Link>
                    : r.cameraName}
                </span>
                <span className={`font-mono text-xs tabular-nums shrink-0 ${r.isAnomalous ? "text-red-600 font-semibold" : "text-slate-400"}`}>
                  {r.anomalyScore.toFixed(4)}
                </span>
                <span className="text-xs text-slate-400 shrink-0 hidden sm:block">
                  {new Date(r.createdAt).toLocaleString()}
                </span>
                <Link href={`/history/${r.id}`} className="text-xs text-blue-600 hover:text-blue-700 font-medium shrink-0">
                  View →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  );
}
