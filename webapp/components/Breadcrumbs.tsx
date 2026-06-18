"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type Back = { label: string; href: string };

function getBack(pathname: string): Back | null {
  if (pathname === "/operators") return { label: "Dashboard", href: "/dashboard" };
  if (pathname === "/history")   return { label: "Dashboard", href: "/dashboard" };
  if (pathname === "/lines")     return { label: "Dashboard", href: "/dashboard" };
  if (pathname === "/my-lines")  return { label: "Dashboard", href: "/dashboard" };

  if (pathname.startsWith("/history/")) {
    return { label: "History", href: "/history" };
  }

  if (pathname.startsWith("/monitor/")) {
    return { label: "Lines", href: "/my-lines" };
  }

  if (pathname.startsWith("/account/")) {
    return { label: "Dashboard", href: "/dashboard" };
  }

  return null;
}

const HIDE_ON = ["/", "/dashboard"];

export default function Breadcrumbs() {
  const pathname = usePathname();

  if (HIDE_ON.includes(pathname) || pathname.startsWith("/auth/")) return null;

  const back = getBack(pathname);
  if (!back) return null;

  return (
    <div className="px-4 sm:px-6 pt-6 max-w-7xl mx-auto">
      <Link
        href={back.href}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
      >
        <ArrowLeft size={14} />
        {back.label}
      </Link>
    </div>
  );
}
