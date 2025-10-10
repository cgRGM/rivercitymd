import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, DollarSign, CreditCard, CheckCircle2 } from "lucide-react";

const transactions = [
  {
    id: 1,
    customer: "John Smith",
    service: "Full Detail",
    amount: "$225",
    date: "Oct 2, 2025",
    status: "completed",
    method: "Credit Card",
  },
  {
    id: 2,
    customer: "Sarah Johnson",
    service: "Paint Correction",
    amount: "$400",
    date: "Oct 1, 2025",
    status: "completed",
    method: "Credit Card",
  },
  {
    id: 3,
    customer: "Mike Davis",
    service: "Quick Clean",
    amount: "$115",
    date: "Sep 30, 2025",
    status: "completed",
    method: "Cash",
  },
  {
    id: 4,
    customer: "Emily Brown",
    service: "Interior Detail",
    amount: "$150",
    date: "Sep 29, 2025",
    status: "pending",
    method: "Credit Card",
  },
];

export default function PaymentsPage() {
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
                <p className="text-2xl font-bold">$12,450</p>
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
                <p className="text-2xl font-bold">$890</p>
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
                <p className="text-2xl font-bold">$11,560</p>
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
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      transaction.status === "completed"
                        ? "bg-green-100"
                        : "bg-yellow-100"
                    }`}
                  >
                    {transaction.status === "completed" ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <CreditCard className="w-5 h-5 text-yellow-600" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold">{transaction.customer}</div>
                    <div className="text-sm text-muted-foreground">
                      {transaction.service} • {transaction.method}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-lg">{transaction.amount}</div>
                  <div className="text-sm text-muted-foreground">
                    {transaction.date}
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
