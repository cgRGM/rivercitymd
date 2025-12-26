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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Line,
  LineChart,
} from "recharts";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type Props = {};

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "hsl(var(--chart-1))",
  },
  bookings: {
    label: "Bookings",
    color: "hsl(var(--chart-2))",
  },
};

export default function AnalyticsClient({}: Props) {
  const analytics = useQuery(api.analytics.getDashboardAnalytics, {
    months: 6,
  }) || {
    monthlyData: [],
    topServices: [],
    customerInsights: {
      newCustomers: 0,
      returningCustomers: 0,
      retentionRate: "0",
    },
    totalDeposits: 0,
    depositsChange: "0",
  };
  const monthlyStats = useQuery(api.analytics.getMonthlyStats) || {
    totalDeposits: 0,
    depositsChange: "0",
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold">Analytics</h2>
        <p className="text-muted-foreground">Track your business performance</p>
      </div>

      {/* Revenue Chart */}
      <Card className="animate-fade-in-up">
        <CardHeader>
          <CardTitle>Revenue Overview</CardTitle>
          <CardDescription>
            Monthly revenue for the past {analytics.monthlyData.length} months
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
            <BarChart accessibilityLayer data={analytics.monthlyData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${value}`}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="revenue"
                fill="var(--color-revenue)"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Bookings Chart */}
      <Card className="animate-fade-in-up" style={{ animationDelay: "50ms" }}>
        <CardHeader>
          <CardTitle>Appointments Trend</CardTitle>
          <CardDescription>
            Number of appointments over the past {analytics.monthlyData.length}{" "}
            months
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
            <LineChart accessibilityLayer data={analytics.monthlyData}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                type="monotone"
                dataKey="bookings"
                stroke="var(--color-bookings)"
                strokeWidth={2}
                dot={{ fill: "var(--color-bookings)" }}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Service Performance */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card
          className="animate-fade-in-up"
          style={{ animationDelay: "100ms" }}
        >
          <CardHeader>
            <CardTitle>Top Services</CardTitle>
            <CardDescription>Most booked services this month</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.topServices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No service bookings this month</p>
              </div>
            ) : (
              <div className="space-y-4">
                {analytics.topServices.map(
                  (
                    service: {
                      name: string;
                      bookings: number;
                      trend: string;
                      change: string;
                    },
                    index: number,
                  ) => (
                    <div
                      key={index}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">{service.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {service.bookings} bookings
                        </div>
                      </div>
                      <div
                        className={`flex items-center gap-1 text-sm ${
                          service.trend === "up"
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {service.trend === "up" ? (
                          <TrendingUp className="w-4 h-4" />
                        ) : (
                          <TrendingDown className="w-4 h-4" />
                        )}
                        {service.change}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card
          className="animate-fade-in-up"
          style={{ animationDelay: "200ms" }}
        >
          <CardHeader>
            <CardTitle>Customer Insights</CardTitle>
            <CardDescription>Key customer metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    New Customers
                  </span>
                  <span className="font-semibold">
                    {analytics.customerInsights.newCustomers}
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{
                      width: `${Math.min(
                        (analytics.customerInsights.newCustomers / 50) * 100,
                        100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    Returning Customers
                  </span>
                  <span className="font-semibold">
                    {analytics.customerInsights.returningCustomers}
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{
                      width: `${Math.min(
                        (analytics.customerInsights.returningCustomers / 200) *
                          100,
                        100,
                      )}%`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    Customer Retention
                  </span>
                  <span className="font-semibold">
                    {analytics.customerInsights.retentionRate}%
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{
                      width: `${analytics.customerInsights.retentionRate}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              $
              {analytics.monthlyData
                .reduce(
                  (sum: number, month: { revenue: number }) =>
                    sum + month.revenue,
                  0,
                )
                .toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total Revenue ({analytics.monthlyData.length} months)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {analytics.monthlyData.reduce(
                (sum: number, month: { bookings: number }) =>
                  sum + month.bookings,
                0,
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total Appointments ({analytics.monthlyData.length} months)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              $
              {analytics.monthlyData.length > 0
                ? (
                    analytics.monthlyData.reduce(
                      (sum: number, month: { revenue: number }) =>
                        sum + month.revenue,
                      0,
                    ) / analytics.monthlyData.length
                  ).toLocaleString(undefined, { maximumFractionDigits: 0 })
                : 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Average Monthly Revenue
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              ${monthlyStats.totalDeposits.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Deposits This Month
            </p>
            <p
              className={`text-xs mt-1 ${
                parseFloat(monthlyStats.depositsChange) >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {parseFloat(monthlyStats.depositsChange) >= 0 ? "+" : ""}
              {monthlyStats.depositsChange}% from last month
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
