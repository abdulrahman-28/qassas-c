"use client";

import { useState } from "react";
import { X, UserPlus } from "lucide-react";
import { createUserAction } from "@/app/actions/users";

export default function AddUserModal() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    setError(null);
    const result = await createUserAction({}, formData);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setOpen(false);
    }
  }

  function handleOpen() {
    setError(null);
    setOpen(true);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <UserPlus size={14} />
        Add User
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">

            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Add New User</h3>
                <p className="text-xs text-slate-400 mt-0.5">Create a new operator or admin account</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="ml-4 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <form action={handleSubmit} className="px-6 py-5 space-y-4">
              {error && (
                <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Email</label>
                <input
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Full Name</label>
                <input
                  name="name"
                  type="text"
                  placeholder="Full name"
                  required
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Password</label>
                <input
                  name="password"
                  type="password"
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Role</label>
                <select
                  name="role"
                  defaultValue="OPERATOR"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                >
                  <option value="OPERATOR">Operator</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? "Creating…" : "Create User"}
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
