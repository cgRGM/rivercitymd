"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Eye, Plus, AlertCircle } from "lucide-react";
import Link from "next/link";

type Invoice = {
  _id: Id<"invoices">;
  _creationTime: number;
  appointmentId: Id<"appointments">;
  userId: Id<"users">;
  invoiceNumber: string;
  items: Array<{
    serviceId: Id<"services">;
    serviceName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  status: "draft" | "sent" | "paid" | "overdue";
  dueDate: string;
  paidDate?: string;
  stripeInvoiceId?: string;
  stripeInvoiceUrl?: string;
  notes?: string;
  appointment: {
    _id: Id<"appointments">;
    services: Array<{
      _id: Id<"services">;
      name: string;
      basePriceSmall?: number;
      basePriceMedium?: number;
      basePriceLarge?: number;
      duration: number;
      isActive: boolean;
    }>;
  } | null;
};

function InvoicePreview({ invoice }: { invoice: Invoice }) {
  const business = useQuery(api.business.get);
  const currentUser = useQuery(api.users.getCurrentUser);

  if (!business || !currentUser) return null;

  return (
    <div
      className="border border-gray-200 p-8 max-w-4xl mx-auto bg-white"
      id="invoice-preview"
    >
      <div className="flex justify-between items-start mb-8">
        <div className="text-sm">
          {business.logoUrl && (
            <Image
              src={business.logoUrl}
              alt="Company Logo"
              width={48}
              height={48}
              className="h-12 mb-2"
            />
          )}
          <h3 className="font-bold text-lg">{business.name}</h3>
          <p>{business.owner}</p>
          <p>{business.address}</p>
          <p>{business.cityStateZip}</p>
          <p>{business.country}</p>
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
          <p className="font-bold">{currentUser.name}</p>
          {currentUser.address && (
            <>
              <p>{currentUser.address.street}</p>
              <p>
                {currentUser.address.city}, {currentUser.address.state}{" "}
                {currentUser.address.zip}
              </p>
            </>
          )}
          <p>{currentUser.email}</p>
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

export default function InvoicesClient() {
  const { isAuthenticated } = useConvexAuth();
  const invoicesQuery = useQuery(api.invoices.getUserInvoices);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Handle unauthenticated state
  if (!isAuthenticated) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h2 className="text-3xl font-bold">My Invoices</h2>
          <p className="text-muted-foreground mt-1">
            View and manage your service invoices
          </p>
        </div>

        <Card className="text-center py-12">
          <CardContent>
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              Authentication Required
            </h3>
            <p className="text-muted-foreground mb-6">
              Please sign in to view your invoices.
            </p>
            <Button onClick={() => (window.location.href = "/sign-in")}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle loading state
  if (invoicesQuery === undefined) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h2 className="text-3xl font-bold">My Invoices</h2>
          <p className="text-muted-foreground mt-1">
            View and manage your service invoices
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              <Skeleton className="h-5 w-20" />
            </CardTitle>
            <CardDescription>
              All your service invoices and payment history
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle error state
  if (invoicesQuery === null) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h2 className="text-3xl font-bold">My Invoices</h2>
          <p className="text-muted-foreground mt-1">
            View and manage your service invoices
          </p>
        </div>

        <Card className="text-center py-12">
          <CardContent>
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              Unable to load invoices
            </h3>
            <p className="text-muted-foreground mb-6">
              There was an error loading your invoices. Please try again later.
            </p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const invoices = invoicesQuery;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge variant="default" className="bg-green-500">
            Paid
          </Badge>
        );
      case "sent":
        return <Badge variant="secondary">Sent</Badge>;
      case "overdue":
        return <Badge variant="destructive">Overdue</Badge>;
      default:
        return <Badge variant="outline">Draft</Badge>;
    }
  };

  if (invoices.length === 0) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h2 className="text-3xl font-bold">My Invoices</h2>
          <p className="text-muted-foreground mt-1">
            View and manage your service invoices
          </p>
        </div>

        <Card className="text-center py-12">
          <CardContent>
            <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No invoices yet</h3>
            <p className="text-muted-foreground mb-6">
              You don&apos;t have any invoices yet. Book an appointment to get
              started!
            </p>
            <Link href="/dashboard/appointments">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Book Appointment
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold">My Invoices</h2>
        <p className="text-muted-foreground mt-1">
          View and manage your service invoices
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Invoices ({invoices.length})
          </CardTitle>
          <CardDescription>
            All your service invoices and payment history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice._id}>
                  <TableCell className="font-medium">
                    {invoice.invoiceNumber}
                  </TableCell>
                  <TableCell>
                    {new Date(invoice._creationTime).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{invoice.dueDate}</TableCell>
                  <TableCell>${invoice.total.toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedInvoice(invoice)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      {invoice.status !== "paid" &&
                        invoice.stripeInvoiceUrl && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() =>
                              window.open(invoice.stripeInvoiceUrl, "_blank")
                            }
                          >
                            Pay Now
                          </Button>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
