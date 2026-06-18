"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@neondatabase/auth/react";
import { LayoutDashboard, Users, Layers } from "lucide-react";

type NavUser = { username: string; role: string } | null;

const ADMIN_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lines",     label: "Lines",     icon: Layers },
  { href: "/operators", label: "Users",     icon: Users },
];
const OPERATOR_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

// Pages where the app navbar is suppressed (they have their own header or are standalone)
const HIDDEN_ON = ["/", "/auth"];

export default function NavbarContent({ user }: { user: NavUser }) {
  const pathname = usePathname();

  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }

  const links =
    user?.role === "ADMIN"
      ? ADMIN_LINKS
      : user
      ? OPERATOR_LINKS
      : [];

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">

        {/* Left: logo + nav links */}
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/" className="text-base font-bold text-slate-900 tracking-tight shrink-0">
            Qassas
          </Link>

          {links.length > 0 && (
            <nav className="hidden md:flex items-center gap-0.5">
              {links.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      isActive
                        ? "bg-slate-100 text-slate-900 font-medium"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        {/* Right: user info + button */}
        <div className="flex items-center gap-3 shrink-0">
          {user && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm text-slate-600 truncate max-w-[120px]">{user.username}</span>
              <span className={`text-xs px-2 py-0.5 rounded-md font-medium border ${
                user.role === "ADMIN"
                  ? "bg-blue-50 text-blue-700 border-blue-100"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              }`}>
                {user.role}
              </span>
            </div>
          )}
          {user ? (
            <UserButton size="icon" />
          ) : (
            <Link
              href="/auth/sign-in"
              className="px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>

      </div>
    </header>
  );
}
