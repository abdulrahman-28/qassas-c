import { redirect } from "next/navigation";
import Link from "next/link";
import { getPublicUser, getOperatorHistory, getAdminHistory } from "@/lib/server";
import HistoryFilters from "./HistoryFilters";

const PAGE_SIZE = 30;

function pageUrl(
  newPage: number,
  line: string | undefined,
  result: string,
) {
  const p = new URLSearchParams();
  if (line && line !== "all") p.set("line", line);
  if (result !== "all") p.set("result", result);
  if (newPage > 1) p.set("page", String(newPage));
  const s = p.toString();
  return `/history${s ? `?${s}` : ""}`;
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ line?: string; result?: string; page?: string }>;
}) {
  const me = await getPublicUser();
  if (!me) redirect("/auth/sign-in");

  const { line, result, page: pageStr } = await searchParams;

  const lineId = line ? parseInt(line) : undefined;
  const resultType: "all" | "anomaly" | "normal" =
    result === "anomaly" || result === "normal" ? result : "all";
  const page = Math.max(1, parseInt(pageStr ?? "1") || 1);

  const opts = {
    lineId: lineId && !isNaN(lineId) ? lineId : undefined,
    resultType,
    page,
    limit: PAGE_SIZE,
  };

  const { results, total, cameras } =
    me.role === "ADMIN"
      ? await getAdminHistory(opts)
      : await getOperatorHistory(me.id, opts);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const anomalyCount = results.filter((r) => r.isAnomalous).length;
  const normalCount = results.filter((r) => !r.isAnomalous).length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Scan History</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {me.role === "ADMIN"
            ? "All detection results across every production line."
            : "Full detection history across your assigned lines."}
        </p>
      </div>

      {/* Filters */}
      <HistoryFilters
        cameras={cameras}
        currentLine={line}
        currentResult={resultType}
      />

      {/* Table card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

        {/* Summary bar */}
        <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs text-slate-500">
            {total === 0
              ? "No results found"
              : `${total.toLocaleString()} result${total !== 1 ? "s" : ""}${
                  totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""
                }`}
          </p>
          {results.length > 0 && (
            <div className="flex items-center gap-2.5 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                <span className="font-medium text-red-600">{anomalyCount}</span>
                <span className="text-slate-400">anomal{anomalyCount === 1 ? "y" : "ies"}</span>
              </span>
              <span className="text-slate-200">·</span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                <span className="font-medium text-emerald-600">{normalCount}</span>
                <span className="text-slate-400">normal</span>
              </span>
              <span className="text-slate-400">on this page</span>
            </div>
          )}
        </div>

        {/* Table */}
        {results.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            No scan results match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Line</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Result</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Score</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Time</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {results.map((r) => (
                  <tr key={r.id} className={`hover:bg-slate-50/60 transition-colors border-l-[3px] ${
                    r.isAnomalous ? "border-l-red-400" : "border-l-emerald-400"
                  }`}>
                    <td className="px-6 py-3 font-medium text-slate-900">{r.cameraName}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${
                        r.isAnomalous
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}>
                        {r.isAnomalous ? "⚠ Anomaly" : "✓ Normal"}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono text-xs tabular-nums ${
                      r.isAnomalous ? "text-red-600 font-semibold" : "text-slate-500"
                    }`}>
                      {r.anomalyScore.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/history/${r.id}`}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <Link
              href={pageUrl(page - 1, line, resultType)}
              aria-disabled={page <= 1}
              className={`px-3.5 py-1.5 text-sm rounded-lg border transition-colors ${
                page <= 1
                  ? "border-slate-100 text-slate-300 pointer-events-none"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              ← Previous
            </Link>
            <span className="text-xs text-slate-400">
              Page {page} of {totalPages}
            </span>
            <Link
              href={pageUrl(page + 1, line, resultType)}
              aria-disabled={page >= totalPages}
              className={`px-3.5 py-1.5 text-sm rounded-lg border transition-colors ${
                page >= totalPages
                  ? "border-slate-100 text-slate-300 pointer-events-none"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Next →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
