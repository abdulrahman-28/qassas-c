"use client";

import { useState } from "react";
import { X, Pencil } from "lucide-react";
import { updateCamera } from "@/app/actions/cameras";
import { ProductType, CameraStatus } from "@/app/generated/prisma/enums";

type Operator = { id: string; username: string };

type Props = {
  camera: { id: number; name: string; location: string };
  operators: Operator[];
  currentAssignedId: string | null;
  currentProductType: ProductType;
  currentStatus: CameraStatus;
};

const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  BOTTLE: "Bottle",
  CAPSULE: "Capsule",
  PILL: "Pill",
  TOOTHBRUSH: "Toothbrush",
  ALL: "All (generic)",
};

const STATUS_LABELS: Record<CameraStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  MAINTENANCE: "Maintenance",
};

export default function CameraEditModal({
  camera,
  operators,
  currentAssignedId,
  currentProductType,
  currentStatus,
}: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setError(null);
    const name = (formData.get("name") as string ?? "").trim();
    const location = (formData.get("location") as string ?? "").trim();
    if (!name || !location) {
      setError("Name and location are required");
      setSaving(false);
      return;
    }
    const operatorId = formData.get("operatorId") as string;
    const productType = formData.get("productType") as ProductType;
    const status = formData.get("status") as CameraStatus;
    try {
      await updateCamera(camera.id, operatorId === "" ? null : operatorId, productType, status, name, location);
      setSaving(false);
      setOpen(false);
    } catch {
      setError("Failed to save changes");
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => { setError(null); setOpen(true); }}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
      >
        <Pencil size={12} />
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Edit Line</h3>
                <p className="text-xs text-slate-400 mt-0.5">Update production line settings</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="ml-4 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form action={handleSubmit} className="px-6 py-5 space-y-4">
              {error && (
                <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Line Name</label>
                <input
                  name="name"
                  type="text"
                  defaultValue={camera.name}
                  required
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Location</label>
                <input
                  name="location"
                  type="text"
                  defaultValue={camera.location}
                  required
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Status</label>
                <select
                  name="status"
                  defaultValue={currentStatus}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                >
                  {(Object.keys(STATUS_LABELS) as CameraStatus[]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Product Type</label>
                <select
                  name="productType"
                  defaultValue={currentProductType}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                >
                  {(Object.keys(PRODUCT_TYPE_LABELS) as ProductType[]).map((pt) => (
                    <option key={pt} value={pt}>{PRODUCT_TYPE_LABELS[pt]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Assign Operator <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <select
                  name="operatorId"
                  defaultValue={currentAssignedId ?? ""}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                >
                  <option value="">— Unassigned —</option>
                  {operators.map((op) => (
                    <option key={op.id} value={op.id}>{op.username}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
