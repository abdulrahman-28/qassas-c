"use client";

import { useState } from "react";
import { Bell, X, CheckCheck } from "lucide-react";
import Link from "next/link";
import { markAllNotificationsRead } from "@/app/actions/notifications";

type NotificationItem = {
  id: number;
  message: string;
  isRead: boolean;
  timestamp: string;
  cameraId: number | null;
  cameraName: string;
};

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell({
  unreadCount,
}: {
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [localUnread, setLocalUnread] = useState(unreadCount);
  const [marking, setMarking] = useState(false);

  async function handleOpen() {
    setOpen(true);
    if (items !== null) return;
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkAllRead() {
    setMarking(true);
    await markAllNotificationsRead();
    setLocalUnread(0);
    setItems((prev) => prev?.map((n) => ({ ...n, isRead: true })) ?? prev);
    setMarking(false);
  }

  return (
    <>
      <button
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
      >
        <Bell size={17} />
        {localUnread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {localUnread > 9 ? "9+" : localUnread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setOpen(false)}
          />

          {/* Slide-in panel from the right */}
          <div className="fixed right-0 top-0 bottom-0 w-80 sm:w-96 bg-white z-50 shadow-2xl flex flex-col border-l border-slate-200">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {localUnread > 0 ? `${localUnread} unread` : "All caught up"}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {localUnread > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    disabled={marking}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <CheckCheck size={13} />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="w-2 h-2 rounded-full bg-slate-100 mt-2 shrink-0" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-3 bg-slate-100 rounded w-4/5" />
                        <div className="h-2 bg-slate-100 rounded w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !items || items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-20 px-6 text-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                    <Bell size={22} className="text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">No notifications yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Anomaly alerts will appear here when detected.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {items.map((n) => (
                    <li
                      key={n.id}
                      className={`flex gap-3 px-5 py-4 hover:bg-slate-50/60 transition-colors ${
                        !n.isRead ? "bg-blue-50/40" : ""
                      }`}
                    >
                      <div className="pt-1.5 shrink-0">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            !n.isRead ? "bg-red-500" : "bg-slate-200"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-800 leading-snug">{n.message}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-xs text-slate-400">{timeAgo(n.timestamp)}</span>
                          {n.cameraId && (
                            <>
                              <span className="text-slate-200 text-xs">·</span>
                              <Link
                                href={`/monitor/${n.cameraId}`}
                                onClick={() => setOpen(false)}
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                              >
                                View line →
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
