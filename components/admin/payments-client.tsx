"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  DollarSign,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Eye,
  Send,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

interface InvoiceItem {
  serviceName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Invoice {
  _creationTime: number;
  invoiceNumber: string;
  customer: string;
  customerEmail: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  stripeInvoiceUrl?: string;
  notes?: string;
}

function InvoicePreview({ invoice }: { invoice: Invoice }) {
  const business = useQuery(api.business.get);

  if (business === undefined) {
    return (
      <div className="border border-gray-200 p-8 max-w-4xl mx-auto bg-white space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const businessData = business ?? {
    name: "River City Mobile Detailing",
    owner: "",
    address: "",
    cityStateZip: "",
    country: "",
  };

  return (
    <div
      className="border border-gray-200 p-8 max-w-4xl mx-auto bg-white"
      id="invoice-preview"
    >
      <div className="flex justify-between items-start mb-8">
        <div className="text-sm">
          <h3 className="font-bold text-lg">{businessData.name}</h3>
          <p>{businessData.owner}</p>
          <p>{businessData.address}</p>
          <p>{businessData.cityStateZip}</p>
          <p>{businessData.country}</p>
        </div>
        <div className="text-right">
          <h2 className="text-4xl font-bold uppercase text-gray-300">
            Invoice
          </h2>
        </div>
      </div>

      <div className="flex justify-between mb-8 text-sm">
        <div>
          <p className="font-bold text-gray-500 mb-1">BILL TO</p>
          <p className="font-bold">{invoice.customer}</p>
          <p>{invoice.customerEmail}</p>
        </div>
        <div className="text-right">
          <p>
            <span className="font-bold text-gray-500">Invoice #</span>{" "}
            {invoice.invoiceNumber}
          </p>
          <p>
            <span className="font-bold text-gray-500">Date:</span>{" "}
            {new Date(invoice._creationTime).toLocaleDateString()}
          </p>
          <p>
            <span className="font-bold text-gray-500">Due Date:</span>{" "}
            {invoice.dueDate}
          </p>
        </div>
      </div>

      <table className="w-full mb-8 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 text-left font-bold text-gray-600">
              Item Description
            </th>
            <th className="p-2 text-center font-bold text-gray-600">Qty</th>
            <th className="p-2 text-right font-bold text-gray-600">Price</th>
            <th className="p-2 text-right font-bold text-gray-600">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {invoice.items.map((item, index) => (
            <tr key={index}>
              <td className="p-2">{item.serviceName}</td>
              <td className="p-2 text-center">{item.quantity}</td>
              <td className="p-2 text-right">${item.unitPrice.toFixed(2)}</td>
              <td className="p-2 text-right">${item.totalPrice.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end text-sm mb-8">
        <div className="w-1/3 space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal</span>
            <span>${invoice.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Sales Tax</span>
            <span>${invoice.tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t pt-2">
            <span>Total</span>
            <span>${invoice.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        <div className="mb-4">
          <h4 className="font-bold mb-1">Notes</h4>
          <p>{invoice.notes || "Thank you for your business!"}</p>
        </div>
        <div>
          <h4 className="font-bold mb-1">Terms & Conditions</h4>
          <p>
            Payment is due within 30 days. Late payments are subject to a fee.
          </p>
        </div>
      </div>
    </div>
  );
}

function InvoiceModal({
  invoice,
  onClose,
}: {
  invoice: Invoice;
  onClose: () => void;
}) {
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invoice Details</DialogTitle>
          <DialogDescription>
            Invoice #{invoice.invoiceNumber}
          </DialogDescription>
        </DialogHeader>
        <InvoicePreview invoice={invoice} />
      </DialogContent>
    </Dialog>
  );
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type Props = {};

export default function PaymentsClient({}: Props) {
  const invoicesQuery = useQuery(api.invoices.listWithDetails, {});
  const statsQuery = useQuery(api.invoices.getSummaryStats, {});
  const updateInvoiceStatus = useMutation(api.invoices.updateStatus);

  const [updatingId, setUpdatingId] = useState<Id<"invoices"> | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Handle loading state
  if (invoicesQuery === undefined || statsQuery === undefined) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Payments</h2>
            <p className="text-muted-foreground">
              Track your transactions and revenue
            </p>
          </div>
          <Skeleton className="h-9 w-32" />
        </div>

        {/* Summary Cards Skeleton */}
        <div className="grid md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-fade-in-up">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                  <Skeleton className="w-12 h-12 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Transactions List Skeleton */}
        <Card className="animate-fade-in-up">
          <CardContent className="pt-6">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <Skeleton className="h-4 w-16 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-6 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle error state
  if (invoicesQuery === null || statsQuery === null) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h2 className="text-3xl font-bold">Payments</h2>
          <p className="text-muted-foreground">
            Track your transactions and revenue
          </p>
        </div>

        <Card className="text-center py-12">
          <CardContent>
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              Unable to load payments
            </h3>
            <p className="text-muted-foreground mb-6">
              There was an error loading the payment data. Please try again
              later.
            </p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const invoices = invoicesQuery;
  const stats = statsQuery;

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

  const handleStatusUpdate = async (
    invoiceId: Id<"invoices">,
    newStatus: string,
  ) => {
    setUpdatingId(invoiceId);
    try {
      await updateInvoiceStatus({
        invoiceId,
        status: newStatus as "draft" | "sent" | "paid" | "overdue",
        paidDate:
          newStatus === "paid"
            ? new Date().toISOString().split("T")[0]
            : undefined,
      });
      toast.success(`Invoice marked as ${newStatus}`);
    } catch {
      toast.error("Failed to update invoice status");
    } finally {
      setUpdatingId(null);
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
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Recent Invoices</h3>
              <p className="text-sm text-muted-foreground">
                Manage invoice status and track payments
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {invoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No invoices found</p>
              </div>
            ) : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              invoices.map((invoice: any) => (
                <div
                  key={invoice._id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        invoice.status === "paid"
                          ? "bg-green-100"
                          : invoice.status === "overdue"
                            ? "bg-red-100"
                            : "bg-yellow-100"
                      }`}
                    >
                      {invoice.status === "paid" ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : invoice.status === "overdue" ? (
                        <AlertCircle className="w-5 h-5 text-red-600" />
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
                        Due: {new Date(invoice.dueDate).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`capitalize ${getStatusColor(invoice.status)}`}
                    >
                      {invoice.status}
                    </Badge>
                    <div className="flex gap-1">
                      {invoice.status === "draft" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleStatusUpdate(invoice._id, "sent")
                          }
                          disabled={updatingId === invoice._id}
                        >
                          <Send className="w-3 h-3 mr-1" />
                          Send
                        </Button>
                      )}
                      {invoice.status === "sent" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleStatusUpdate(invoice._id, "paid")
                          }
                          disabled={updatingId === invoice._id}
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Mark Paid
                        </Button>
                      )}
                      {invoice.stripeInvoiceUrl && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            window.open(invoice.stripeInvoiceUrl, "_blank")
                          }
                        >
                          <CreditCard className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedInvoice(invoice)}
                      >
                        <Eye className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {selectedInvoice && (
        <InvoiceModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}
