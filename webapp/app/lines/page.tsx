import { redirect } from "next/navigation";
import { getCamerasWithStats, getOperators, getPublicUser } from "@/lib/server";
import CameraEditModal from "@/components/CameraEditModal";
import AddLineModal from "@/components/AddLineModal";

const statusStyles: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  INACTIVE: "bg-slate-100 text-slate-600 border border-slate-200",
  MAINTENANCE: "bg-amber-50 text-amber-700 border border-amber-200",
};

export default async function LinesPage() {
  const me = await getPublicUser();
  if (me?.role !== "ADMIN") redirect("/dashboard");

  const [cameras, operators] = await Promise.all([
    getCamerasWithStats(),
    getOperators(),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Production Lines</h1>
          <p className="text-sm text-slate-500 mt-0.5">Add, edit, and manage all inspection lines.</p>
        </div>
        <AddLineModal operators={operators} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Location</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Assigned to</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Scans</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Anomalies</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Last Active</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cameras.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-sm text-slate-400">
                    No production lines yet. Click &quot;Add Line&quot; to get started.
                  </td>
                </tr>
              ) : cameras.map((cam) => (
                <tr key={cam.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-6 py-3.5 font-medium text-slate-900">{cam.name}</td>
                  <td className="px-4 py-3.5 text-slate-500">{cam.location}</td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusStyles[cam.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {cam.status.charAt(0) + cam.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
                      {cam.productType.charAt(0) + cam.productType.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">
                    {cam.assignedTo ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3.5 text-right text-slate-600 tabular-nums">{cam.imageCount.toLocaleString()}</td>
                  <td className="px-4 py-3.5 text-right tabular-nums">
                    {cam.anomalyCount > 0
                      ? <span className="font-semibold text-amber-600">{cam.anomalyCount}</span>
                      : <span className="text-slate-400">0</span>}
                  </td>
                  <td className="px-4 py-3.5 text-slate-400 text-xs">
                    {cam.lastActive ? new Date(cam.lastActive).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3.5">
                    <CameraEditModal
                      camera={{ id: cam.id, name: cam.name, location: cam.location }}
                      operators={operators}
                      currentAssignedId={cam.assignedToId}
                      currentProductType={cam.productType}
                      currentStatus={cam.status}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
