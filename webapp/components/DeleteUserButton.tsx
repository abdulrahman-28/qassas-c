"use client";

import { useState } from "react";
import { deleteUserAction } from "@/app/actions/users";

type Props = { userId: string; username: string };

export default function DeleteUserButton({ userId, username }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setDeleting(true);
    setError(null);
    const result = await deleteUserAction(userId);
    if (result.error) {
      setError(result.error);
      setDeleting(false);
      setConfirming(false);
    }
    // On success the row disappears via revalidatePath — no need to reset state
  }

  if (confirming) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-xs text-slate-500">Remove {username}?</span>
        <button
          onClick={handleConfirm}
          disabled={deleting}
          className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50 transition-colors"
        >
          {deleting ? "Removing…" : "Confirm"}
        </button>
        <button
          onClick={() => { setConfirming(false); setError(null); }}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-red-400 hover:text-red-600 transition-colors"
    >
      Delete
    </button>
  );
}
