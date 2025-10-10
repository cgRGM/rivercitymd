"use client";

import { Preloaded, usePreloadedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, DollarSign, CreditCard, CheckCircle2 } from "lucide-react";

type Props = {
  invoicesPreloaded: Preloaded<typeof api.invoices.listWithDetails>;
  statsPreloaded: Preloaded<typeof api.invoices.getSummaryStats>;
};

export default function PaymentsClient({
  invoicesPreloaded,
  statsPreloaded,
}: Props) {
  const invoices = usePreloadedQuery(invoicesPreloaded);
  const stats = usePreloadedQuery(statsPreloaded);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-700";
      case "sent":
      case "draft":
        return "bg-yellow-100 text-yellow-700";
      case "overdue":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Payments</h2>
          <p className="text-muted-foreground">
            Track your transactions and revenue
          </p>
        </div>
        <Button variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="animate-fade-in-up">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">
                  ${stats.totalRevenue.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="animate-fade-in-up" style={{ animationDelay: "50ms" }}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">
                  ${stats.pending.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className="animate-fade-in-up"
          style={{ animationDelay: "100ms" }}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">
                  ${stats.completed.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions List */}
      <Card className="animate-fade-in-up" style={{ animationDelay: "150ms" }}>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {invoices.map((invoice) => (
              <div
                key={invoice._id}
                className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      invoice.status === "paid"
                        ? "bg-green-100"
                        : "bg-yellow-100"
                    }`}
                  >
                    {invoice.status === "paid" ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <CreditCard className="w-5 h-5 text-yellow-600" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{invoice.customer}</div>
                    <div className="text-sm text-muted-foreground">
                      {invoice.serviceName} • {invoice.customerEmail}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-medium">
                      ${invoice.total.toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(invoice.dueDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}
                  >
                    {invoice.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
