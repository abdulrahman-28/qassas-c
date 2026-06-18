import { redirect } from "next/navigation";
import Link from "next/link";
import { getPublicUser, getOperatorCamerasWithStats } from "@/lib/server";
import {
  CheckCircle2, WifiOff, Wrench, Activity,
  ScanLine, AlertTriangle, Clock, MapPin,
} from "lucide-react";

const productTypeLabels: Record<string, string> = {
  BOTTLE: "Bottle",
  CAPSULE: "Capsule",
  PILL: "Pill",
  TOOTHBRUSH: "Toothbrush",
  ALL: "All",
};

const statusConfig: Record<string, { label: string; style: string; icon: React.ReactNode; dot: string }> = {
  ACTIVE: {
    label: "Active",
    style: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    icon: <CheckCircle2 size={13} className="text-emerald-600" />,
    dot: "bg-emerald-500",
  },
  INACTIVE: {
    label: "Inactive",
    style: "bg-slate-100 text-slate-600 border border-slate-200",
    icon: <WifiOff size={13} className="text-slate-400" />,
    dot: "bg-slate-400",
  },
  MAINTENANCE: {
    label: "Maintenance",
    style: "bg-amber-50 text-amber-700 border border-amber-200",
    icon: <Wrench size={13} className="text-amber-600" />,
    dot: "bg-amber-500",
  },
};

function timeAgo(date: Date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function MyLinesPage() {
  const me = await getPublicUser();
  if (!me) redirect("/auth/sign-in");
  if (me.role === "ADMIN") redirect("/lines");

  const cameras = await getOperatorCamerasWithStats(me.id);
  const activeCount = cameras.filter((c) => c.status === "ACTIVE").length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">My Lines</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {cameras.length === 0
            ? "No production lines assigned yet."
            : `${activeCount} of ${cameras.length} lines active`}
        </p>
      </div>

      {cameras.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm py-20 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity size={22} className="text-slate-400" />
          </div>
          <h2 className="text-sm font-semibold text-slate-700">No lines assigned</h2>
          <p className="text-sm text-slate-400 mt-1">
            Contact your admin to get assigned to a production line.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {cameras.map((cam) => {
            const cfg = statusConfig[cam.status] ?? statusConfig.INACTIVE;
            const isActive = cam.status === "ACTIVE";
            const anomalyRate =
              cam.imageCount > 0
                ? Math.round((cam.anomalyCount / cam.imageCount) * 100)
                : null;

            return (
              <div
                key={cam.id}
                className={`bg-white rounded-xl border shadow-sm flex flex-col transition-all ${
                  isActive
                    ? "border-slate-200 hover:border-blue-200 hover:shadow-md"
                    : "border-slate-200 opacity-70"
                }`}
              >
                {/* Card header */}
                <div className="p-5 flex-1 space-y-4">
                  {/* Badges row */}
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${cfg.style}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
                      {productTypeLabels[cam.productType] ?? cam.productType}
                    </span>
                  </div>

                  {/* Name + location */}
                  <div>
                    <h3 className="font-semibold text-slate-900 text-base leading-tight">{cam.name}</h3>
                    <p className="text-sm text-slate-400 mt-1 flex items-center gap-1">
                      <MapPin size={12} className="shrink-0" />
                      {cam.location}
                    </p>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 mx-auto mb-1.5">
                        <ScanLine size={14} className="text-blue-600" />
                      </div>
                      <p className="text-base font-bold text-slate-900 tabular-nums">{cam.imageCount.toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400">Total scans</p>
                    </div>

                    <div className="text-center">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-lg mx-auto mb-1.5 ${cam.anomalyCount > 0 ? "bg-red-50" : "bg-emerald-50"}`}>
                        <AlertTriangle size={14} className={cam.anomalyCount > 0 ? "text-red-500" : "text-emerald-500"} />
                      </div>
                      <p className={`text-base font-bold tabular-nums ${cam.anomalyCount > 0 ? "text-red-600" : "text-slate-900"}`}>
                        {cam.anomalyCount.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-400">Anomalies</p>
                    </div>

                    <div className="text-center">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50 mx-auto mb-1.5">
                        <Clock size={14} className="text-slate-500" />
                      </div>
                      <p className="text-base font-bold text-slate-900 tabular-nums">
                        {anomalyRate !== null ? `${anomalyRate}%` : "—"}
                      </p>
                      <p className="text-[10px] text-slate-400">Anomaly rate</p>
                    </div>
                  </div>

                  {/* Last active */}
                  {cam.lastActive && (
                    <p className="text-xs text-slate-400">
                      Last scan {timeAgo(new Date(cam.lastActive))} · {new Date(cam.lastActive).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Action */}
                <div className="px-5 pb-5">
                  {isActive ? (
                    <Link
                      href={`/monitor/${cam.id}`}
                      className="w-full py-2 text-sm font-medium text-center block bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Monitor Line
                    </Link>
                  ) : (
                    <button
                      disabled
                      className="w-full py-2 text-sm font-medium text-center block bg-slate-100 text-slate-400 rounded-lg cursor-not-allowed"
                    >
                      Unavailable
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
