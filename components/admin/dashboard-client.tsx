"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Calendar,
  DollarSign,
  Users,
  TrendingUp,
  Clock,
  CheckCircle2,
  CreditCard,
} from "lucide-react";
import Link from "next/link";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type Props = {};

export default function DashboardClient({}: Props) {
  const stats = useQuery(api.analytics.getMonthlyStats) || {
    totalRevenue: 0,
    revenueChange: "0",
    bookingsCount: 0,
    bookingsChange: "0",
    activeCustomers: 0,
    avgServiceTime: "0",
    totalDeposits: 0,
    depositsChange: "0",
  };
  const upcomingAppointments = useQuery(api.appointments.getUpcoming) || [];

  const statsData = [
    {
      title: "Total Revenue",
      value: `$${stats.totalRevenue.toLocaleString()}`,
      change: `${stats.revenueChange}%`,
      icon: DollarSign,
      trend: parseFloat(stats.revenueChange) >= 0 ? "up" : "down",
    },
    {
      title: "Appointments This Month",
      value: stats.bookingsCount.toString(),
      change: `${stats.bookingsChange}%`,
      icon: Calendar,
      trend: parseFloat(stats.bookingsChange) >= 0 ? "up" : "down",
    },
    {
      title: "Active Customers",
      value: stats.activeCustomers.toString(),
      change: "+15.3%",
      icon: Users,
      trend: "up",
    },
    {
      title: "Avg. Service Time",
      value: `${stats.avgServiceTime} hrs`,
      change: "-5.1%",
      icon: Clock,
      trend: "down",
    },
    {
      title: "Deposits Collected",
      value: `$${stats.totalDeposits.toLocaleString()}`,
      change: `${stats.depositsChange}%`,
      icon: CreditCard,
      trend: parseFloat(stats.depositsChange) >= 0 ? "up" : "down",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {statsData.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card
              key={index}
              className="animate-fade-in-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p
                  className={`text-xs ${stat.trend === "up" ? "text-green-600" : "text-red-600"} flex items-center gap-1 mt-1`}
                >
                  <TrendingUp className="w-3 h-3" />
                  {stat.change} from last month
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Appointments */}
      <Card className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        <CardHeader>
          <CardTitle>Upcoming Appointments</CardTitle>
          <CardDescription>
            Your upcoming appointments for the next week
          </CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingAppointments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No upcoming appointments</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {upcomingAppointments.slice(0, 4).map((appointment: any) => {
                const date = new Date(appointment.scheduledDate);
                const formattedDate = date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                });

                return (
                  <div
                    key={appointment._id}
                    className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          appointment.status === "confirmed"
                            ? "bg-green-100 text-green-600"
                            : "bg-yellow-100 text-yellow-600"
                        }`}
                      >
                        {appointment.status === "confirmed" ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <Clock className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold">
                          {appointment.userName || "Unknown Customer"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {appointment.serviceIds.length} service(s) •{" "}
                          {appointment.vehicleIds.length} vehicle(s)
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formattedDate}</div>
                      <div className="text-sm text-muted-foreground">
                        {appointment.scheduledTime}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-4">
        <Link href="/admin/appointments">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">New Appointment</CardTitle>
              <CardDescription>Schedule a new appointment</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/admin/customers">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">Add Customer</CardTitle>
              <CardDescription>Create a new customer profile</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/admin/analytics">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">View Reports</CardTitle>
              <CardDescription>Check analytics and insights</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
