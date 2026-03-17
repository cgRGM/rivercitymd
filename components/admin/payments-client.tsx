"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatDateString } from "@/lib/time";
import {
  AlertCircle,
  ArrowUpDown,
  Check,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  MoreHorizontal,
  Send,
} from "lucide-react";

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
  paymentOption?: "deposit" | "full" | "in_person";
  depositPaid?: boolean;
  depositAmount?: number;
  remainingBalance?: number;
}

type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

type InvoiceRecord = Invoice & {
  _id: Id<"invoices">;
  status: InvoiceStatus;
  serviceName: string;
};

function InvoicePreview({ invoice }: { invoice: Invoice }) {
  const business = useQuery(api.business.get);

  if (business === undefined) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 border border-gray-200 bg-white p-8">
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
    <div className="mx-auto max-w-4xl border border-gray-200 bg-white p-8" id="invoice-preview">
      <div className="mb-8 flex items-start justify-between">
        <div className="text-sm">
          <h3 className="text-lg font-bold">{businessData.name}</h3>
          <p>{businessData.owner}</p>
          <p>{businessData.address}</p>
          <p>{businessData.cityStateZip}</p>
          <p>{businessData.country}</p>
        </div>
        <div className="text-right">
          <h2 className="text-4xl font-bold uppercase text-gray-300">Invoice</h2>
        </div>
      </div>

      <div className="mb-8 flex justify-between text-sm">
        <div>
          <p className="mb-1 font-bold text-gray-500">BILL TO</p>
          <p className="font-bold">{invoice.customer}</p>
          <p>{invoice.customerEmail}</p>
        </div>
        <div className="text-right">
          <p>
            <span className="font-bold text-gray-500">Invoice #</span> {invoice.invoiceNumber}
          </p>
          <p>
            <span className="font-bold text-gray-500">Date:</span>{" "}
            {new Date(invoice._creationTime).toLocaleDateString()}
          </p>
          <p>
            <span className="font-bold text-gray-500">Due Date:</span> {invoice.dueDate}
          </p>
        </div>
      </div>

      <table className="mb-8 w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-2 text-left font-bold text-gray-600">Item Description</th>
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

      <div className="mb-8 flex justify-end text-sm">
        <div className="w-1/3 space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal</span>
            <span>${invoice.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Sales Tax</span>
            <span>${invoice.tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-lg font-bold">
            <span>Total</span>
            <span>${invoice.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        <div className="mb-4">
          <h4 className="mb-1 font-bold">Notes</h4>
          <p>{invoice.notes || "Thank you for your business!"}</p>
        </div>
        <div>
          <h4 className="mb-1 font-bold">Terms & Conditions</h4>
          <p>Payment is due within 30 days. Late payments are subject to a fee.</p>
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
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invoice Details</DialogTitle>
          <DialogDescription>Invoice #{invoice.invoiceNumber}</DialogDescription>
        </DialogHeader>
        <InvoicePreview invoice={invoice} />
      </DialogContent>
    </Dialog>
  );
}

export default function PaymentsClient() {
  const router = useRouter();
  const invoicesQuery = useQuery(api.invoices.listWithDetails, {});
  const statsQuery = useQuery(api.invoices.getSummaryStats, {});
  const updateInvoiceStatus = useMutation(api.invoices.updateStatus);

  const [updatingId, setUpdatingId] = useState<Id<"invoices"> | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  if (invoicesQuery === undefined || statsQuery === undefined) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Payments</h2>
            <p className="text-muted-foreground">Track your transactions and revenue</p>
          </div>
          <Skeleton className="h-9 w-32" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Skeleton className="mb-2 h-4 w-24" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (invoicesQuery === null || statsQuery === null) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h2 className="text-3xl font-bold">Payments</h2>
          <p className="text-muted-foreground">Track your transactions and revenue</p>
        </div>

        <Card className="py-12 text-center">
          <CardContent>
            <AlertCircle className="mx-auto mb-4 h-16 w-16 text-destructive" />
            <h3 className="mb-2 text-xl font-semibold">Unable to load payments</h3>
            <p className="mb-6 text-muted-foreground">
              There was an error loading the payment data. Please try again later.
            </p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const invoices = invoicesQuery as InvoiceRecord[];
  const stats = statsQuery;

  const getStatusColor = (status: InvoiceStatus) => {
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

  const handleStatusUpdate = async (invoiceId: Id<"invoices">, newStatus: InvoiceStatus) => {
    setUpdatingId(invoiceId);
    try {
      await updateInvoiceStatus({
        invoiceId,
        status: newStatus,
        paidDate: newStatus === "paid" ? new Date().toISOString().split("T")[0] : undefined,
      });
      toast.success(`Invoice marked as ${newStatus}`);
      router.refresh();
    } catch {
      toast.error("Failed to update invoice status");
    } finally {
      setUpdatingId(null);
    }
  };

  const columns: ColumnDef<InvoiceRecord>[] = [
    {
      accessorKey: "customer",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Customer
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="min-w-[180px]">
          <p className="font-medium">{row.original.customer}</p>
          <p className="text-xs text-muted-foreground">{row.original.customerEmail}</p>
        </div>
      ),
    },
    {
      accessorKey: "serviceName",
      header: "Service",
      cell: ({ row }) => (
        <span className="block min-w-[160px] truncate text-sm">{row.original.serviceName}</span>
      ),
    },
    {
      accessorKey: "dueDate",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Due Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span>{formatDateString(row.original.dueDate)}</span>,
    },
    {
      accessorKey: "total",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Amount
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => <span className="font-medium">${row.original.total.toFixed(2)}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant="outline" className={`capitalize ${getStatusColor(row.original.status)}`}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const invoice = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0" disabled={updatingId === invoice._id}>
                <span className="sr-only">Open actions</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              {invoice.status === "draft" && (
                <DropdownMenuItem onClick={() => void handleStatusUpdate(invoice._id, "sent")}>
                  <Send className="mr-2 h-4 w-4" />
                  Send
                </DropdownMenuItem>
              )}
              {(invoice.status === "sent" || (invoice.paymentOption === "in_person" && invoice.depositPaid && invoice.status === "draft")) && (
                <DropdownMenuItem onClick={() => void handleStatusUpdate(invoice._id, "paid")}>
                  <Check className="mr-2 h-4 w-4" />
                  Mark Paid
                </DropdownMenuItem>
              )}
              {invoice.stripeInvoiceUrl && (
                <DropdownMenuItem
                  onClick={() => window.open(invoice.stripeInvoiceUrl, "_blank", "noopener,noreferrer")}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Open Stripe
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSelectedInvoice(invoice)}>
                <Eye className="mr-2 h-4 w-4" />
                View Invoice
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Payments</h2>
          <p className="text-muted-foreground">Track your transactions and revenue</p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">${stats.totalRevenue.toLocaleString()}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
                <DollarSign className="h-6 w-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">${stats.pending.toLocaleString()}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                <CreditCard className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">${stats.completed.toLocaleString()}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={invoices}
        filterColumn="customer"
        filterPlaceholder="Filter by customer..."
        tableMinWidthClass="min-w-[1140px]"
      />

      {selectedInvoice && (
        <InvoiceModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}
    </div>
  );
}
