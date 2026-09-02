"use client";

import type React from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import DashboardMobileNav from "@/components/dashboard/dashboard-mobile-nav";
import DashboardSidebar from "@/components/dashboard/dashboard-sidebar";
import { Authenticated, Unauthenticated } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Authenticated>
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
      </Authenticated>
      <Unauthenticated>
        <RedirectToSignIn />
      </Unauthenticated>
    </>
  );
}

function RedirectToSignIn() {
  const router = useRouter();

  useEffect(() => {
    router.push("/sign-in");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirecting to sign in...</p>
      </div>
    </div>
  );
}
