"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

type Camera = { id: number; name: string };

export default function HistoryFilters({
  cameras,
  currentLine,
  currentResult,
}: {
  cameras: Camera[];
  currentLine: string | undefined;
  currentResult: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Line</label>
        <select
          value={currentLine ?? "all"}
          onChange={(e) => update("line", e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition min-w-[180px]"
        >
          <option value="all">All lines</option>
          {cameras.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-slate-500">Result</label>
        <select
          value={currentResult}
          onChange={(e) => update("result", e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition min-w-[160px]"
        >
          <option value="all">All results</option>
          <option value="anomaly">Anomalies only</option>
          <option value="normal">Normal only</option>
        </select>
      </div>
    </div>
  );
}
