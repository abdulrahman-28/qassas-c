import { getAllUsers, getPublicUser } from "@/lib/server";
import { ShieldX } from "lucide-react";
import AddUserModal from "@/components/AddUserModal";
import DeleteUserButton from "@/components/DeleteUserButton";

export default async function Operators() {
  const user = await getPublicUser();

  if (user?.role !== "ADMIN") {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center bg-slate-50">
        <div className="text-center px-6">
          <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldX size={24} className="text-red-500" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Access Denied</h1>
          <p className="text-sm text-slate-400 mt-1">This page is for admins only.</p>
        </div>
      </div>
    );
  }

  const allUsers = await getAllUsers();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">User Management</h1>
        <p className="text-sm text-slate-500 mt-0.5">Add, edit, or remove operator and admin accounts.</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Users</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {allUsers.length} user{allUsers.length !== 1 ? "s" : ""} total
            </p>
          </div>
          <AddUserModal />
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60">
              <th className="text-left px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Name</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wide">Role</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {allUsers.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-sm text-slate-400">
                  No users yet. Add one to get started.
                </td>
              </tr>
            ) : allUsers.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-6 py-3.5 font-medium text-slate-900">{u.username}</td>
                <td className="px-4 py-3.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                    u.role === "ADMIN"
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "bg-slate-100 text-slate-600 border border-slate-200"
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  {u.id !== user.id && (
                    <DeleteUserButton userId={u.id} username={u.username} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
