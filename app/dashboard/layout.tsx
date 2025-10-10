import type React from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import DashboardMobileNav from "@/components/dashboard/dashboard-mobile-nav";
import DashboardSidebar from "@/components/dashboard/dashboard-sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <DashboardSidebar />
        <main className="flex-1 overflow-auto">
          <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 sm:px-6 py-0">
            <SidebarTrigger />
            <h1 className="text-lg font-semibold">My Dashboard</h1>
          </div>
          <div className="p-4 sm:p-6 lg:p-8 pb-20 md:pb-8">{children}</div>
        </main>
      </div>
      <DashboardMobileNav />
    </SidebarProvider>
  );
}
