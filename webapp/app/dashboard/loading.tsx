export default function DashboardLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-pulse">

      {/* Header */}
      <div className="space-y-2">
        <div className="h-6 w-44 bg-slate-200 rounded-lg" />
        <div className="h-4 w-64 bg-slate-100 rounded" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="h-4 w-20 bg-slate-100 rounded" />
              <div className="h-8 w-8 bg-slate-100 rounded-lg" />
            </div>
            <div className="h-8 w-12 bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      {/* Main table card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-4 w-36 bg-slate-100 rounded" />
            <div className="h-3 w-24 bg-slate-100 rounded" />
          </div>
          <div className="h-8 w-20 bg-slate-100 rounded-lg" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-6 py-3.5 flex items-center gap-8">
              <div className="h-4 w-32 bg-slate-100 rounded" />
              <div className="h-4 w-24 bg-slate-100 rounded" />
              <div className="h-5 w-16 bg-slate-100 rounded-md" />
              <div className="h-4 w-20 bg-slate-100 rounded ml-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Secondary table card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="h-4 w-24 bg-slate-100 rounded" />
          <div className="h-8 w-20 bg-slate-100 rounded-lg" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="px-6 py-3.5 flex items-center gap-8">
              <div className="h-4 w-28 bg-slate-100 rounded" />
              <div className="h-5 w-14 bg-slate-100 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
