"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, Users, Car, BarChart3, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";

const navItems = [
  {
    title: "Overview",
    icon: LayoutDashboard,
    href: "/admin",
  },
  {
    title: "Appointments",
    icon: Calendar,
    href: "/admin/appointments",
  },
  {
    title: "Customers",
    icon: Users,
    href: "/admin/customers",
  },
  {
    title: "Services",
    icon: Car,
    href: "/admin/services",
  },
  {
    title: "Analytics",
    icon: BarChart3,
    href: "/admin/analytics",
  },
  {
    title: "Reviews",
    icon: Star,
    href: "/admin/reviews",
  },
];

export default function AdminMobileNav() {
  const pathname = usePathname();
  const pendingAppointmentsCount = useQuery(api.appointments.getPendingCount) ?? 0;
  const newCustomersCount = useQuery(api.users.getNewCustomersCount) ?? 0;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          // Get count for specific menu items
          let count = 0;
          if (item.href === "/admin/appointments") {
            count = pendingAppointmentsCount;
          } else if (item.href === "/admin/customers") {
            count = newCustomersCount;
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors relative",
                isActive ? "text-accent" : "text-muted-foreground",
              )}
            >
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-1 bg-accent rounded-b-full" />
              )}
              <div className="relative">
                <Icon className="w-5 h-5" />
                {count > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-4 min-w-4 px-1 flex items-center justify-center text-[10px]"
                  >
                    {count > 99 ? "99+" : count}
                  </Badge>
                )}
              </div>
              <span className="text-xs font-medium">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
