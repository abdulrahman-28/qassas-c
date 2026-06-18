import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { NeonAuthUIProvider } from "@neondatabase/auth/react";
import { authClient } from "@/lib/client";
import SidebarShell from "@/components/SidebarShell";
import Breadcrumbs from "@/components/Breadcrumbs";
import NextTopLoader from "nextjs-toploader";
import { getPublicUser, getUnreadNotificationCount } from "@/lib/server";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Qassas",
  description: "AI-powered anomaly detection for manufacturing",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getPublicUser().catch(() => null);
  const navUser = user ? { username: user.username, role: user.role } : null;
  const unreadCount =
    user?.role === "OPERATOR"
      ? await getUnreadNotificationCount(user.id).catch(() => 0)
      : 0;

  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body className={`${geist.variable} antialiased`}>
        <NeonAuthUIProvider authClient={authClient} redirectTo="/dashboard">
          <NextTopLoader color="#2563eb" height={2} showSpinner={false} />
          <SidebarShell user={navUser} unreadCount={unreadCount}>
            <Breadcrumbs />
            {children}
          </SidebarShell>
        </NeonAuthUIProvider>
      </body>
    </html>
  );
}
