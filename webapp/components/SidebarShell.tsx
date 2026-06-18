"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { UserButton } from "@neondatabase/auth/react";
import {
  LayoutDashboard, Layers, Users, Menu, X, Clock,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import NotificationBell from "./NotificationBell";

type NavUser = { username: string; role: string } | null;

const ADMIN_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lines",     label: "Lines",     icon: Layers },
  { href: "/history",   label: "History",   icon: Clock },
  { href: "/operators", label: "Users",     icon: Users },
];

const OPERATOR_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/my-lines",  label: "Lines",     icon: Layers },
  { href: "/history",   label: "History",   icon: Clock },
];

const HIDE_ON = ["/", "/auth"];

function NavLinks({
  user,
  collapsed,
  onNavigate,
}: {
  user: NavUser;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const links = user?.role === "ADMIN" ? ADMIN_LINKS : user ? OPERATOR_LINKS : [];

  return (
    <nav className={`flex-1 py-3 space-y-0.5 overflow-y-auto ${collapsed ? "px-2" : "px-3"}`}>
      {links.map(({ href, label, icon: Icon }) => {
        const isActive =
          pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={`flex items-center rounded-lg text-sm transition-colors ${
              collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5"
            } ${
              isActive
                ? "bg-blue-50 text-blue-700 font-medium shadow-[inset_3px_0_0_#2563eb]"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Icon
              size={16}
              strokeWidth={isActive ? 2.5 : 2}
              className={isActive ? "text-blue-600" : "text-slate-400"}
            />
            {!collapsed && label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserSection({
  user,
  unreadCount,
  collapsed,
}: {
  user: NavUser;
  unreadCount: number;
  collapsed: boolean;
}) {
  if (!user) return null;

  if (collapsed) {
    return (
      <div className="border-t border-slate-100 p-3 flex flex-col items-center gap-3">
        {user.role === "OPERATOR" && (
          <NotificationBell unreadCount={unreadCount} />
        )}
        <UserButton size="icon" />
      </div>
    );
  }

  return (
    <div className="border-t border-slate-100 p-4 space-y-2">
      {user.role === "OPERATOR" && (
        <div className="flex items-center gap-2 px-1">
          <NotificationBell unreadCount={unreadCount} />
          <span className="text-xs text-slate-500">Notifications</span>
          {unreadCount > 0 && (
            <span className="ml-auto text-xs font-medium text-red-600">
              {unreadCount} new
            </span>
          )}
        </div>
      )}
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900 truncate">{user.username}</p>
          <span
            className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5 ${
              user.role === "ADMIN"
                ? "bg-blue-100 text-blue-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {user.role}
          </span>
        </div>
        <UserButton size="icon" />
      </div>
    </div>
  );
}

export default function SidebarShell({
  user,
  unreadCount = 0,
  children,
}: {
  user: NavUser;
  unreadCount?: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const showSidebar = !HIDE_ON.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (!showSidebar) return <>{children}</>;

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside
        className={`hidden lg:flex flex-col fixed inset-y-0 left-0 bg-white border-r border-slate-200 z-30 transition-[width] duration-200 ease-in-out overflow-hidden ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {/* Logo + collapse toggle */}
        <div className={`flex items-center border-b border-slate-100 shrink-0 ${
          collapsed ? "flex-col gap-2 px-0 py-3" : "px-4 py-[14px]"
        }`}>
          {/* Logo — always visible */}
          <Link href="/" className="inline-flex shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                <span className="text-white text-xs font-bold leading-none">Q</span>
              </div>
              {!collapsed && (
                <span className="text-[15px] font-bold text-slate-900 tracking-tight whitespace-nowrap">
                  Qassas
                </span>
              )}
            </div>
          </Link>
          {/* Collapse toggle */}
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={`flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors ${
              collapsed ? "w-7 h-7" : "ml-auto w-7 h-7"
            }`}
          >
            {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
        </div>

        {/* Nav links */}
        <NavLinks user={user} collapsed={collapsed} />

        {/* User section */}
        <UserSection user={user} unreadCount={unreadCount} collapsed={collapsed} />
      </aside>

      {/* ── Mobile top bar ──────────────────────────────────── */}
      <div className="lg:hidden fixed inset-x-0 top-0 h-14 bg-white border-b border-slate-200 z-30 flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="p-1.5 -ml-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <Menu size={20} />
        </button>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-md flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-bold">Q</span>
          </div>
          <span className="text-sm font-bold text-slate-900">Qassas</span>
        </Link>
        {user && (
          <div className="ml-auto">
            <UserButton size="icon" />
          </div>
        )}
      </div>

      {/* ── Mobile drawer ───────────────────────────────────── */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="lg:hidden fixed inset-y-0 left-0 w-72 bg-white z-50 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                  <span className="text-white text-xs font-bold leading-none">Q</span>
                </div>
                <span className="text-[15px] font-bold text-slate-900 tracking-tight">Qassas</span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <NavLinks user={user} collapsed={false} onNavigate={() => setMobileOpen(false)} />
            <UserSection user={user} unreadCount={unreadCount} collapsed={false} />
          </aside>
        </>
      )}

      {/* ── Main content ────────────────────────────────────── */}
      <div
        className={`pt-14 lg:pt-0 min-h-screen transition-[padding-left] duration-200 ease-in-out ${
          collapsed ? "lg:pl-16" : "lg:pl-60"
        }`}
      >
        {children}
      </div>

    </div>
  );
}
