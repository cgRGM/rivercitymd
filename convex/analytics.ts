import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get monthly statistics for dashboard
export const getMonthlyStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayOfLastMonth = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1,
    );

    // Get all appointments
    const appointments = await ctx.db.query("appointments").collect();
    const users = await ctx.db.query("users").collect();

    // Filter by month
    const thisMonth = appointments.filter((a) => {
      const date = new Date(a.scheduledDate);
      return date >= firstDayOfMonth;
    });

    const lastMonth = appointments.filter((a) => {
      const date = new Date(a.scheduledDate);
      return date >= firstDayOfLastMonth && date < firstDayOfMonth;
    });

    // Calculate revenue
    const thisMonthRevenue = thisMonth.reduce(
      (sum, a) => sum + a.totalPrice,
      0,
    );
    const lastMonthRevenue = lastMonth.reduce(
      (sum, a) => sum + a.totalPrice,
      0,
    );

    // Calculate changes
    const revenueChange =
      lastMonthRevenue > 0
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : 0;

    const bookingsChange =
      lastMonth.length > 0
        ? ((thisMonth.length - lastMonth.length) / lastMonth.length) * 100
        : 0;

    // Active customers
    const activeClients = users.filter((u) => u.status === "active");

    // Average service time in hours
    const totalDuration = thisMonth.reduce((sum, a) => sum + a.duration, 0);
    const avgDuration =
      thisMonth.length > 0 ? totalDuration / thisMonth.length / 60 : 0;

    // Calculate deposits
    const invoices = await ctx.db.query("invoices").collect();
    const thisMonthInvoices = invoices.filter((inv) => {
      const date = new Date(inv._creationTime);
      return date >= firstDayOfMonth && inv.depositPaid === true;
    });
    const lastMonthInvoices = invoices.filter((inv) => {
      const date = new Date(inv._creationTime);
      return (
        date >= firstDayOfLastMonth &&
        date < firstDayOfMonth &&
        inv.depositPaid === true
      );
    });

    const thisMonthDeposits = thisMonthInvoices.reduce(
      (sum, inv) => sum + (inv.depositAmount || 0),
      0,
    );
    const lastMonthDeposits = lastMonthInvoices.reduce(
      (sum, inv) => sum + (inv.depositAmount || 0),
      0,
    );

    const depositsChange =
      lastMonthDeposits > 0
        ? ((thisMonthDeposits - lastMonthDeposits) / lastMonthDeposits) * 100
        : 0;

    return {
      totalRevenue: thisMonthRevenue,
      revenueChange: revenueChange.toFixed(1),
      bookingsCount: thisMonth.length,
      bookingsChange: bookingsChange.toFixed(1),
      activeCustomers: activeClients.length,
      avgServiceTime: avgDuration.toFixed(1),
      totalDeposits: thisMonthDeposits,
      depositsChange: depositsChange.toFixed(1),
    };
  },
});

// Get comprehensive analytics for analytics page
export const getDashboardAnalytics = query({
  args: {
    months: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const monthCount = args.months || 6;
    const today = new Date();

    // Get all data
    const appointments = await ctx.db.query("appointments").collect();
    const users = await ctx.db.query("users").collect();
    const services = await ctx.db.query("services").collect();

    // Monthly revenue data for chart
    const monthlyData = [];
    for (let i = monthCount - 1; i >= 0; i--) {
      const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthEnd = new Date(
        today.getFullYear(),
        today.getMonth() - i + 1,
        0,
      );

      const monthAppointments = appointments.filter((a) => {
        const date = new Date(a.scheduledDate);
        return date >= monthStart && date <= monthEnd;
      });

      monthlyData.push({
        month: monthStart.toLocaleDateString("en-US", { month: "short" }),
        revenue: monthAppointments.reduce((sum, a) => sum + a.totalPrice, 0),
        bookings: monthAppointments.length,
      });
    }

    // Top services with trends
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1,
    );

    const topServices = services
      .map((service) => {
        const thisMonth = appointments.filter(
          (a) =>
            new Date(a.scheduledDate) >= thisMonthStart &&
            a.serviceIds.includes(service._id),
        ).length;

        const lastMonth = appointments.filter(
          (a) =>
            new Date(a.scheduledDate) >= lastMonthStart &&
            new Date(a.scheduledDate) < thisMonthStart &&
            a.serviceIds.includes(service._id),
        ).length;

        const change =
          lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

        return {
          name: service.name,
          bookings: thisMonth,
          trend: change >= 0 ? "up" : "down",
          change: `${change >= 0 ? "+" : ""}${change.toFixed(0)}%`,
        };
      })
      .sort((a, b) => b.bookings - a.bookings)
      .slice(0, 4);

    // Customer insights
    const newCustomers = users.filter((u) => {
      const created = new Date(u._creationTime);
      return created >= thisMonthStart;
    }).length;

    const returningCustomers = users.filter(
      (u) => (u.timesServiced || 0) > 1,
    ).length;
    const totalCustomers = users.length;
    const retentionRate =
      totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;

    // Calculate deposits for analytics
    const invoices = await ctx.db.query("invoices").collect();
    const thisMonthInvoices = invoices.filter((inv) => {
      const date = new Date(inv._creationTime);
      return date >= thisMonthStart && inv.depositPaid === true;
    });
    const lastMonthInvoices = invoices.filter((inv) => {
      const date = new Date(inv._creationTime);
      return (
        date >= lastMonthStart &&
        date < thisMonthStart &&
        inv.depositPaid === true
      );
    });

    const thisMonthDeposits = thisMonthInvoices.reduce(
      (sum, inv) => sum + (inv.depositAmount || 0),
      0,
    );
    const lastMonthDeposits = lastMonthInvoices.reduce(
      (sum, inv) => sum + (inv.depositAmount || 0),
      0,
    );

    const depositsChange =
      lastMonthDeposits > 0
        ? ((thisMonthDeposits - lastMonthDeposits) / lastMonthDeposits) * 100
        : 0;

    return {
      monthlyData,
      topServices,
      customerInsights: {
        newCustomers,
        returningCustomers,
        retentionRate: retentionRate.toFixed(0),
      },
      totalDeposits: thisMonthDeposits,
      depositsChange: depositsChange.toFixed(1),
    };
  },
});
