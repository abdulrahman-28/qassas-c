"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { Upload, AlertTriangle, CheckCircle2, Loader2, RotateCcw, ScanLine, MapPin } from "lucide-react";
import CompareSlider from "@/components/CompareSlider";

type Camera = {
  id: number;
  name: string;
  location: string;
  status: string;
  productType: string;
};

type LineSummary = {
  id: number;
  name: string;
  status: string;
};

const statusDot: Record<string, string> = {
  ACTIVE:      "bg-emerald-500",
  INACTIVE:    "bg-slate-400",
  MAINTENANCE: "bg-amber-400",
};

function LineSwitcher({ lines, currentId }: { lines: LineSummary[]; currentId: number }) {
  if (lines.length <= 1) return null;
  return (
    <div className="bg-slate-50 border-b border-slate-200/80">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider shrink-0 mr-2">
            Lines
          </span>
          {lines.map((line) => {
            const isCurrent = line.id === currentId;
            return (
              <Link
                key={line.id}
                href={`/monitor/${line.id}`}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all duration-150 ${
                  isCurrent
                    ? "bg-white text-slate-900 shadow-sm border border-slate-200 font-semibold"
                    : "text-slate-500 hover:text-slate-800 hover:bg-white/60 hover:shadow-sm"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[line.status] ?? "bg-slate-400"}`} />
                {line.name}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type HistoryItem = {
  id: number;
  captureTime: Date;
  isAnomalous: boolean;
  anomalyScore: number;
};

type DetectResult = {
  is_anomalous: boolean;
  score: number;
  threshold?: number;
  coverage?: number;
  metrics?: {
    L1: number;
    L2: number;
    MS_SSIM: number;
    LPIPS: number;
    Max_Patch: number;
  };
  heatmap: string;
  reconstructed: string;
};

type Severity = "Normal" | "Warning" | "Critical";

function getSeverity(result: DetectResult): Severity {
  if (!result.is_anomalous) return "Normal";
  if (result.coverage != null) {
    if (result.coverage > 20) return "Critical";
    return "Warning";
  }
  const dev = result.threshold != null ? result.score - result.threshold : 0;
  return dev > 0.15 ? "Critical" : "Warning";
}

const severityStyles: Record<Severity, string> = {
  Normal: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Warning: "bg-amber-50 text-amber-700 border-amber-200",
  Critical: "bg-red-50 text-red-700 border-red-200",
};

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  INACTIVE: "bg-slate-100 text-slate-600 border border-slate-200",
  MAINTENANCE: "bg-amber-50 text-amber-700 border border-amber-200",
};

const productTypeLabels: Record<string, string> = {
  BOTTLE: "Bottle",
  CAPSULE: "Capsule",
  PILL: "Pill",
  TOOTHBRUSH: "Toothbrush",
  ALL: "All (generic)",
};

const STEPS = [
  "Uploading image",
  "Preprocessing",
  "Reconstructing product",
  "Analyzing features",
  "Running detection",
];

const STEP_DELAYS_MS = [0, 800, 1800, 14000, 20000];
const SPREAD = 0.35;

export default function MonitorClient({ camera, history, lines = [] }: { camera: Camera; history: HistoryItem[]; lines?: LineSummary[] }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<DetectResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading) { setLoadingStep(0); return; }
    const timers = STEP_DELAYS_MS.map((delay, i) =>
      setTimeout(() => setLoadingStep(i + 1), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, [loading]);

  function loadFile(f: File) {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setError(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) loadFile(f);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("image/")) loadFile(f);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  async function handleSubmit() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    const form = new FormData();
    form.append("file", file);
    form.append("cameraId", String(camera.id));

    try {
      const res = await fetch("/api/detect", { method: "POST", body: form });
      if (!res.ok) {
        let msg = `Server error (${res.status})`;
        try {
          const data = await res.json();
          msg = data.error ?? msg;
        } catch { /* response wasn't JSON */ }
        setError(msg);
        return;
      }
      const data = await res.json();
      setResult(data);
    } catch {
      setError("Could not reach the server. Make sure you are connected.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const barPct = result
    ? result.threshold != null
      ? Math.min(Math.max(50 + ((result.score - result.threshold) / SPREAD) * 50, 0), 100)
      : Math.min(Math.max((result.score + 0.5) * 100, 0), 100)
    : 0;

  return (
    <>
      <LineSwitcher lines={lines} currentId={camera.id} />

    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{camera.name}</h1>
            <p className="text-sm text-slate-500 mt-0.5">Upload a product image to run anomaly detection.</p>
          </div>
          {/* Line info badges */}
          <div className="flex items-center flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <MapPin size={12} className="text-slate-400" />
              {camera.location}
            </span>
            <span className="text-slate-200">·</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusStyles[camera.status] ?? "bg-slate-100 text-slate-600"}`}>
              {camera.status.charAt(0) + camera.status.slice(1).toLowerCase()}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
              {productTypeLabels[camera.productType] ?? camera.productType}
            </span>
          </div>
        </div>
        {(file || result) && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          >
            <RotateCcw size={14} /> Reset
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Upload card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">Image</h2>
          </div>
          <div className="p-5 space-y-4">
            <div
              className={`relative rounded-xl border-2 border-dashed flex flex-col items-center justify-center min-h-52 cursor-pointer transition-all duration-200 ${
                dragging
                  ? "border-blue-400 bg-blue-50 scale-[1.01]"
                  : preview
                  ? "border-slate-200 bg-slate-50"
                  : "border-slate-200 hover:border-blue-300 hover:bg-slate-50"
              }`}
              onClick={() => inputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {preview ? (
                <img src={preview} alt="preview" className="max-h-52 rounded-lg object-contain py-2" />
              ) : (
                <div className="text-center px-6 py-8 select-none">
                  <div className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center transition-colors ${dragging ? "bg-blue-100" : "bg-slate-100"}`}>
                    <Upload size={22} className={dragging ? "text-blue-500" : "text-slate-400"} />
                  </div>
                  <p className="text-sm font-medium text-slate-700">
                    {dragging ? "Drop your image here" : "Drag & drop or click to upload"}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">PNG, JPG, WEBP supported</p>
                </div>
              )}
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            {file && (
              <p className="text-xs text-slate-400 truncate">
                {file.name} · {(file.size / 1024).toFixed(0)} KB
              </p>
            )}

            <button
              className={`w-full py-2.5 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors ${
                !file || loading
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
              disabled={!file || loading}
              onClick={handleSubmit}
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Analyzing…</>
              ) : (
                <><ScanLine size={16} /> Run Detection</>
              )}
            </button>

            {loading && (
              <div className="pt-1 space-y-2.5">
                {STEPS.map((label, i) => {
                  const stepNum = i + 1;
                  const isDone = loadingStep > stepNum;
                  const isActive = loadingStep === stepNum;
                  const isPending = loadingStep < stepNum;
                  return (
                    <div
                      key={label}
                      className={`flex items-center gap-3 transition-all duration-300 ${isPending ? "opacity-25" : "opacity-100"}`}
                    >
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors duration-300 ${
                        isDone ? "bg-blue-50" : isActive ? "bg-blue-600" : "bg-slate-100"
                      }`}>
                        {isDone ? (
                          <CheckCircle2 size={11} className="text-blue-500" />
                        ) : isActive ? (
                          <Loader2 size={10} className="text-white animate-spin" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 block" />
                        )}
                      </div>
                      <span className={`text-xs transition-colors duration-300 ${
                        isActive ? "text-slate-700 font-medium" : isDone ? "text-slate-400" : "text-slate-300"
                      }`}>
                        {label}
                      </span>
                    </div>
                  );
                })}
                <p className="text-xs text-slate-300 pl-8 pt-0.5">This may take 30–90 seconds</p>
              </div>
            )}
          </div>
        </div>

        {/* Result card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">Result</h2>
          </div>
          <div className="p-5">
            {!result && !error && (
              <div className="flex flex-col items-center justify-center min-h-52 text-slate-300">
                <ScanLine size={40} className="mb-3" />
                <p className="text-sm">Awaiting analysis</p>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {result && (() => {
              const severity = getSeverity(result);
              return (
                <div className="space-y-4">
                  {/* Gradient verdict + score card */}
                  <div className={`rounded-2xl p-5 ${
                    result.is_anomalous
                      ? "bg-gradient-to-br from-red-500 to-rose-600"
                      : "bg-gradient-to-br from-emerald-500 to-teal-600"
                  }`}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                        {result.is_anomalous
                          ? <AlertTriangle size={18} className="text-white" />
                          : <CheckCircle2 size={18} className="text-white" />}
                      </div>
                      <div>
                        <p className="font-bold text-white text-sm leading-tight">
                          {result.is_anomalous ? "Anomaly Detected" : "Product Normal"}
                        </p>
                        <span className="text-xs text-white/70">{severity} severity</span>
                      </div>
                    </div>
                    {/* Big score number */}
                    <div className="bg-black/20 rounded-xl px-4 py-3 text-center mb-3">
                      <p className="text-4xl font-black text-white font-mono tabular-nums tracking-tight">
                        {result.score.toFixed(4)}
                      </p>
                      <p className="text-[11px] text-white/60 mt-0.5 uppercase tracking-wider">anomaly score</p>
                    </div>
                    {/* Threshold + deviation */}
                    {result.threshold != null && (
                      <div className="flex items-center justify-between text-xs text-white/70 font-mono">
                        <span>threshold {result.threshold.toFixed(4)}</span>
                        <span className="font-semibold text-white">
                          {result.score - result.threshold > 0 ? "+" : ""}{(result.score - result.threshold).toFixed(4)}
                          {" "}{result.is_anomalous ? "above" : "below"}
                        </span>
                      </div>
                    )}
                    {result.coverage != null && (
                      <p className="text-xs text-white/70 text-center mt-2">
                        <span className="font-semibold text-white">{result.coverage.toFixed(1)}%</span> area affected
                      </p>
                    )}
                  </div>

                  {/* Score bar */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                      <span>Normal</span>
                      <span>Anomalous</span>
                    </div>
                    <div className="relative">
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${result.is_anomalous ? "bg-red-500" : "bg-emerald-500"}`}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-px bg-slate-400/50 rounded-full" />
                    </div>
                  </div>

                  {/* Feature scores */}
                  {result.metrics && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 mb-2">Feature Scores</p>
                      <div className="space-y-1.5">
                        {(Object.entries(result.metrics) as [string, number][]).map(([key, val]) => {
                          const pct = key === "MS_SSIM"
                            ? Math.min((1 - val) * 100, 100)
                            : Math.min(val * 100, 100);
                          return (
                            <div key={key} className="flex items-center gap-3">
                              <span className="text-xs text-slate-400 w-16 shrink-0">{key}</span>
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs font-mono text-slate-500 w-12 text-right">{val.toFixed(4)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Comparison slider + heatmap */}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide">Original vs Reconstructed</h3>
              <span className="text-[10px] text-slate-400">drag to compare</span>
            </div>
            <div className="p-4">
              {preview ? (
                <CompareSlider
                  before={preview}
                  after={`data:image/png;base64,${result.reconstructed}`}
                  beforeLabel="Original"
                  afterLabel="Reconstructed"
                />
              ) : (
                <img
                  src={`data:image/png;base64,${result.reconstructed}`}
                  alt="Reconstructed"
                  className="w-full rounded-lg object-contain"
                />
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide">Anomaly Heatmap</h3>
            </div>
            <div className="p-4">
              <img
                src={`data:image/png;base64,${result.heatmap}`}
                alt="Anomaly heatmap"
                className="w-full rounded-lg object-contain"
              />
              <p className="text-xs text-slate-400 mt-2 text-center">Red/warm areas indicate highest anomaly signal</p>
            </div>
          </div>
        </div>
      )}

      {/* Scan history */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">Scan History</h2>
          <p className="text-xs text-slate-400 mt-0.5">Last {history.length} detections for this line</p>
        </div>
        {history.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-400">
            No scans yet. Run a detection above to see results here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Time</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Result</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {new Date(item.captureTime).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                        item.isAnomalous
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      }`}>
                        {item.isAnomalous ? "Anomaly" : "Normal"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-slate-600 tabular-nums">
                      {item.anomalyScore.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
    </>
  );
}
