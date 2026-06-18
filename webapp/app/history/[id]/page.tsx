import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getPublicUser, getResultDetail } from "@/lib/server";
import { CheckCircle2, AlertTriangle } from "lucide-react";

const productTypeLabels: Record<string, string> = {
  BOTTLE: "Bottle",
  CAPSULE: "Capsule",
  PILL: "Pill",
  TOOTHBRUSH: "Toothbrush",
  ALL: "All",
};

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500 capitalize">{label.replace(/_/g, " ")}</span>
      <span className="text-sm font-mono font-medium text-slate-900">{value}</span>
    </div>
  );
}

export default async function ResultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await getPublicUser();
  if (!me) redirect("/auth/sign-in");

  const { id } = await params;
  const resultId = parseInt(id);
  if (isNaN(resultId)) notFound();

  const result = await getResultDetail(resultId, me.id);
  if (!result) notFound();

  const camera = result.image.camera;
  const metrics = result.metrics as Record<string, number> | null;

  // coverage is already 0–100 from the API
  const coveragePercent =
    result.coverage != null ? result.coverage.toFixed(1) : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Scan #{result.id}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {camera?.name ?? "Unknown line"} · {new Date(result.createdAt).toLocaleString()}
            </p>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border ${
              result.isAnomalous
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}
          >
            {result.isAnomalous ? (
              <AlertTriangle size={14} />
            ) : (
              <CheckCircle2 size={14} />
            )}
            {result.isAnomalous ? "Anomaly Detected" : "Normal"}
          </span>
        </div>
      </div>

      {/* Top row: metrics + heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Metrics card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-1">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Detection Metrics</h2>

          {/* Key stats — gradient score card */}
          <div className={`rounded-2xl p-5 mb-4 ${result.isAnomalous ? "bg-gradient-to-br from-red-500 to-rose-600" : "bg-gradient-to-br from-emerald-500 to-teal-600"}`}>
            <div className="flex items-center gap-2 mb-3">
              {result.isAnomalous
                ? <AlertTriangle size={15} className="text-white/80" />
                : <CheckCircle2 size={15} className="text-white/80" />}
              <span className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                {result.isAnomalous ? "Anomaly Detected" : "Product Normal"}
              </span>
            </div>
            <div className="bg-black/20 rounded-xl px-4 py-3 text-center mb-3">
              <p className="text-4xl font-black text-white font-mono tabular-nums tracking-tight">
                {result.anomalyScore.toFixed(4)}
              </p>
              <p className="text-[11px] text-white/60 mt-0.5 uppercase tracking-wider">anomaly score</p>
            </div>
            {result.threshold != null && (
              <div className="flex justify-between text-xs text-white/70 font-mono">
                <span>threshold {result.threshold.toFixed(4)}</span>
                <span className="font-semibold text-white">
                  {result.isAnomalous
                    ? `+${(result.anomalyScore - result.threshold).toFixed(4)} above`
                    : `${(result.threshold - result.anomalyScore).toFixed(4)} below`}
                </span>
              </div>
            )}
          </div>

          {/* Secondary stats */}
          <div>
            {coveragePercent && (
              <MetricRow label="Anomaly Coverage" value={`${coveragePercent}%`} />
            )}
            {metrics &&
              Object.entries(metrics).map(([key, val]) => (
                <MetricRow
                  key={key}
                  label={key}
                  value={typeof val === "number" ? val.toFixed(4) : String(val)}
                />
              ))}
          </div>

          {/* Line info */}
          {camera && (
            <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Line</span>
                <Link
                  href={`/monitor/${camera.id}`}
                  className="font-medium text-blue-600 hover:text-blue-700"
                >
                  {camera.name} →
                </Link>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Location</span>
                <span className="text-slate-700">{camera.location}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Product Type</span>
                <span className="text-slate-700">
                  {productTypeLabels[camera.productType] ?? camera.productType}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Scanned At</span>
                <span className="text-slate-700">
                  {new Date(result.image.captureTime).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Heatmap */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">Anomaly Heatmap</h2>
          {result.heatmapData ? (
            <div className="rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${result.heatmapData}`}
                alt="Anomaly heatmap"
                className="w-full object-contain max-h-72"
              />
            </div>
          ) : (
            <div className="rounded-lg bg-slate-50 border border-slate-200 h-56 flex items-center justify-center">
              <p className="text-sm text-slate-400">No heatmap available</p>
            </div>
          )}
          <p className="text-xs text-slate-400 mt-2">
            Red/warm areas indicate regions with the highest anomaly signal.
          </p>
        </div>
      </div>

      {/* Reconstructed image */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Reconstructed Image</h2>
        <p className="text-xs text-slate-400 mb-4">
          The model's reconstruction of the input — anomalies appear as differences from the original.
        </p>
        {result.reconstructedData ? (
          <div className="rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${result.reconstructedData}`}
              alt="Reconstructed image"
              className="w-full object-contain max-h-80"
            />
          </div>
        ) : (
          <div className="rounded-lg bg-slate-50 border border-slate-200 h-56 flex items-center justify-center">
            <p className="text-sm text-slate-400">No reconstructed image available</p>
          </div>
        )}
      </div>

    </div>
  );
}
