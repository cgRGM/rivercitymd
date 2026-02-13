"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import Image from "next/image";
import { RefreshCw } from "lucide-react";
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
  // Deposit fields
  depositAmount?: number;
  depositPaid?: boolean;
  depositPaymentIntentId?: string;
  remainingBalance?: number;
  finalPaymentIntentId?: string;
  customer?: string;
  customerEmail?: string;
  customerAddress?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
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

  if (business === undefined || currentUser === undefined) {
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
    logoUrl: null,
  };

  const customerName = currentUser?.name || invoice.customer || "Customer";
  const customerEmail = currentUser?.email || invoice.customerEmail || "";
  const customerAddress = currentUser?.address || invoice.customerAddress;

  return (
    <div
      className="border border-gray-200 p-8 max-w-4xl mx-auto bg-white"
      id="invoice-preview"
    >
      <div className="flex justify-between items-start mb-8">
        <div className="text-sm">
          {businessData.logoUrl && (
            <Image
              src={businessData.logoUrl}
              alt="Company Logo"
              width={48}
              height={48}
              className="h-12 mb-2"
            />
          )}
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
          <p className="font-bold">{customerName}</p>
          {customerAddress && (
            <>
              <p>{customerAddress.street}</p>
              <p>
                {customerAddress.city}, {customerAddress.state}{" "}
                {customerAddress.zip}
              </p>
            </>
          )}
          <p>{customerEmail}</p>
        </div>
        <div className="text-right">
          <p>
            <span className="font-bold text-gray-500">Invoice #</span>{" "}
            {invoice.invoiceNumber}
          </p>
          <p>
            <span className="font-bold text-gray-500">Date:</span>{" "}
            {new Date(invoice._creationTime).toISOString().split("T")[0]}
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
          {invoice.depositAmount && invoice.depositAmount > 0 && (
            <>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-600">Total</span>
                <span>${invoice.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">
                  Deposit {invoice.depositPaid ? "(Paid)" : "(Pending)"}
                </span>
                <span className={invoice.depositPaid ? "text-green-600" : ""}>
                  -${invoice.depositAmount.toFixed(2)}
                </span>
              </div>
            </>
          )}
          <div className="flex justify-between font-bold text-lg border-t pt-2">
            <span>
              {invoice.depositAmount && invoice.depositAmount > 0
                ? "Remaining Balance"
                : "Total"}
            </span>
            <span className="text-lg">
              $
              {invoice.remainingBalance !== undefined
                ? invoice.remainingBalance.toFixed(2)
                : invoice.total.toFixed(2)}
            </span>
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
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const queryArgs = isAuthenticated ? {} : ("skip" as const);
  const invoicesQuery = useQuery(api.invoices.getUserInvoices, queryArgs);
  const createDepositCheckout = useAction(api.payments.createDepositCheckoutSession);
  // Remaining balance payments are now handled via Stripe Invoice hosted page
  const syncPaymentStatus = useAction(api.payments.syncPaymentStatus);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [syncingInvoiceId, setSyncingInvoiceId] = useState<Id<"invoices"> | null>(null);

  // Handle loading state
  if (isAuthLoading || (isAuthenticated && invoicesQuery === undefined)) {
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

  const invoices = invoicesQuery ?? [];

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
                    {new Date(invoice._creationTime).toISOString().split("T")[0]}
                  </TableCell>
                  <TableCell>{invoice.dueDate}</TableCell>
                  <TableCell>
                    {invoice.depositAmount && invoice.depositAmount > 0 ? (
                      <div>
                        <div className="font-medium">
                          ${invoice.remainingBalance !== undefined
                            ? invoice.remainingBalance.toFixed(2)
                            : invoice.total.toFixed(2)}
                        </div>
                        {invoice.depositPaid && (
                          <div className="text-xs text-muted-foreground">
                            Deposit: ${invoice.depositAmount.toFixed(2)} paid
                          </div>
                        )}
                      </div>
                    ) : (
                      `$${invoice.total.toFixed(2)}`
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {getStatusBadge(invoice.status)}
                      {invoice.depositAmount && invoice.depositAmount > 0 && (
                        <Badge
                          variant={invoice.depositPaid ? "default" : "outline"}
                          className="text-xs w-fit"
                        >
                          Deposit {invoice.depositPaid ? "Paid" : "Pending"}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
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
                      {invoice.status !== "paid" && (
                        <>
                          {!invoice.depositPaid &&
                            invoice.depositAmount &&
                            invoice.depositAmount > 0 ? (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const { url } = await createDepositCheckout({
                                      appointmentId: invoice.appointmentId,
                                      invoiceId: invoice._id,
                                      successUrl: `${window.location.origin}/dashboard/invoices?payment=success`,
                                      cancelUrl: `${window.location.origin}/dashboard/invoices?payment=cancelled`,
                                    });
                                    window.location.href = url;
                                  } catch (error) {
                                    toast.error(
                                      error instanceof Error
                                        ? error.message
                                        : "Failed to create deposit payment",
                                    );
                                  }
                                }}
                              >
                                Pay Deposit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={syncingInvoiceId === invoice._id}
                                onClick={async () => {
                                  setSyncingInvoiceId(invoice._id);
                                  try {
                                    const result = await syncPaymentStatus({
                                      invoiceId: invoice._id,
                                    });
                                    if (result.updated) {
                                      toast.success("Payment status synced successfully");
                                    } else {
                                      toast.info("No payment updates found");
                                    }
                                  } catch (error) {
                                    toast.error(
                                      error instanceof Error
                                        ? error.message
                                        : "Failed to sync payment status",
                                    );
                                  } finally {
                                    setSyncingInvoiceId(null);
                                  }
                                }}
                              >
                                <RefreshCw
                                  className={`w-4 h-4 mr-2 ${
                                    syncingInvoiceId === invoice._id
                                      ? "animate-spin"
                                      : ""
                                  }`}
                                />
                                Sync
                              </Button>
                            </>
                          ) : invoice.depositPaid &&
                            invoice.remainingBalance &&
                            invoice.remainingBalance > 0 ? (
                            // Deposit paid, show payment option for remaining balance
                            <>
                              {invoice.stripeInvoiceUrl ? (
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() =>
                                    window.open(invoice.stripeInvoiceUrl, "_blank")
                                  }
                                >
                                  Pay Invoice
                                </Button>
                              ) : (
                                <Button
                                  variant="default"
                                  size="sm"
                                  disabled
                                  title="Invoice is being prepared. Please check back soon."
                                >
                                  Pay Balance
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={syncingInvoiceId === invoice._id}
                                onClick={async () => {
                                  setSyncingInvoiceId(invoice._id);
                                  try {
                                    const result = await syncPaymentStatus({
                                      invoiceId: invoice._id,
                                    });
                                    if (result.updated) {
                                      toast.success("Payment status synced successfully");
                                    } else {
                                      toast.info("No payment updates found");
                                    }
                                  } catch (error) {
                                    toast.error(
                                      error instanceof Error
                                        ? error.message
                                        : "Failed to sync payment status",
                                    );
                                  } finally {
                                    setSyncingInvoiceId(null);
                                  }
                                }}
                              >
                                <RefreshCw
                                  className={`w-4 h-4 mr-2 ${
                                    syncingInvoiceId === invoice._id
                                      ? "animate-spin"
                                      : ""
                                  }`}
                                />
                                Sync
                              </Button>
                            </>
                          ) : invoice.stripeInvoiceUrl ? (
                            // No deposit or deposit not required, show invoice payment
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() =>
                                window.open(invoice.stripeInvoiceUrl, "_blank")
                              }
                            >
                              Pay Invoice
                            </Button>
                          ) : invoice.depositPaid &&
                            invoice.remainingBalance &&
                            invoice.remainingBalance > 0 ? (
                            // Deposit paid but no Stripe invoice URL yet - invoice being prepared
                            <Button
                              variant="default"
                              size="sm"
                              disabled
                              title="Invoice is being prepared. Please check back soon."
                            >
                              Pay Balance
                            </Button>
                          ) : null}
                        </>
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
