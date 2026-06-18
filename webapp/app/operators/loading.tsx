export default function OperatorsLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-pulse">

      {/* Header */}
      <div className="space-y-2">
        <div className="h-6 w-52 bg-slate-200 rounded-lg" />
        <div className="h-4 w-56 bg-slate-100 rounded" />
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-4 w-16 bg-slate-100 rounded" />
            <div className="h-3 w-24 bg-slate-100 rounded" />
          </div>
          <div className="h-8 w-20 bg-slate-100 rounded-lg" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-6 py-3.5 flex items-center gap-8">
              <div className="h-4 w-32 bg-slate-100 rounded" />
              <div className="h-5 w-16 bg-slate-100 rounded-md" />
              <div className="flex gap-3 ml-auto">
                <div className="h-4 w-8 bg-slate-100 rounded" />
                <div className="h-4 w-12 bg-slate-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
