"use client";

import { useMutation, useQuery, useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Clock,
  AlertCircle,
  CreditCard,
  Send,
  Check,
  ExternalLink,
  RefreshCw,
  Car,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useState } from "react";
import { formatDateString, formatTime12h } from "@/lib/time";

type Props = {
  invoiceId: Id<"invoices">;
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-yellow-100 text-yellow-700",
  paid: "bg-green-100 text-green-700",
  overdue: "bg-red-100 text-red-700",
};

export default function PaymentDetailClient({ invoiceId }: Props) {
  const router = useRouter();
  const invoice = useQuery(api.invoices.getByIdAdmin, { invoiceId });
  const updateStatus = useMutation(api.invoices.updateStatus);
  const syncPaymentStatus = useAction(api.payments.syncPaymentStatus);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  if (invoice === undefined) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (invoice === null) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Card className="text-center py-12">
          <CardContent>
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Invoice not found</h3>
            <p className="text-muted-foreground mb-6">
              This invoice may have been deleted.
            </p>
            <Button asChild>
              <Link href="/admin/payments">View All Payments</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleStatusUpdate = async (
    newStatus: "draft" | "sent" | "paid" | "overdue",
  ) => {
    setIsUpdating(true);
    try {
      await updateStatus({
        invoiceId,
        status: newStatus,
        paidDate:
          newStatus === "paid"
            ? new Date().toISOString().split("T")[0]
            : undefined,
      });
      toast.success(`Invoice marked as ${newStatus}`);
    } catch {
      toast.error("Failed to update invoice status");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncPaymentStatus({ invoiceId });
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
      setIsSyncing(false);
    }
  };

  const appointment = invoice.appointment;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/payments">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              Invoice {invoice.invoiceNumber}
              <Badge
                className={`capitalize ${STATUS_STYLES[invoice.status] || ""}`}
              >
                {invoice.status}
              </Badge>
            </h2>
            <p className="text-muted-foreground text-sm">
              Created{" "}
              {new Date(invoice._creationTime).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isSyncing ? "animate-spin" : ""}`}
            />
            Sync Status
          </Button>
          {invoice.stripeInvoiceUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.open(invoice.stripeInvoiceUrl, "_blank", "noopener")
              }
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in Stripe
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Customer Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Customer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="font-semibold text-lg">{invoice.customer}</div>
            {invoice.customerEmail && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4" />
                <a
                  href={`mailto:${invoice.customerEmail}`}
                  className="hover:underline"
                >
                  {invoice.customerEmail}
                </a>
              </div>
            )}
            {invoice.customerPhone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-4 h-4" />
                {invoice.customerPhone}
              </div>
            )}
            {invoice.customerAddress && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>
                  {invoice.customerAddress.street},{" "}
                  {invoice.customerAddress.city},{" "}
                  {invoice.customerAddress.state} {invoice.customerAddress.zip}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Payment Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>${invoice.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span>${invoice.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t pt-2">
              <span>Total</span>
              <span>${invoice.total.toFixed(2)}</span>
            </div>

            {invoice.depositAmount && invoice.depositAmount > 0 && (
              <>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-muted-foreground">
                    Deposit{" "}
                    <Badge
                      variant={invoice.depositPaid ? "default" : "outline"}
                      className="ml-1 text-xs"
                    >
                      {invoice.depositPaid ? "Paid" : "Pending"}
                    </Badge>
                  </span>
                  <span
                    className={invoice.depositPaid ? "text-green-600" : ""}
                  >
                    ${invoice.depositAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Remaining Balance</span>
                  <span>
                    $
                    {(invoice.remainingBalance ?? invoice.total).toFixed(2)}
                  </span>
                </div>
              </>
            )}

            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="text-muted-foreground">Payment Option</span>
              <Badge variant="outline" className="capitalize">
                {invoice.paymentOption?.replace("_", " ") || "deposit"}
              </Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Due Date</span>
              <span>{formatDateString(invoice.dueDate)}</span>
            </div>
            {invoice.paidDate && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Paid Date</span>
                <span className="text-green-600">
                  {formatDateString(invoice.paidDate)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-3 text-left font-medium">Service</th>
                <th className="p-3 text-center font-medium">Qty</th>
                <th className="p-3 text-right font-medium">Unit Price</th>
                <th className="p-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoice.items.map((item, index) => (
                <tr key={index}>
                  <td className="p-3">{item.serviceName}</td>
                  <td className="p-3 text-center">{item.quantity}</td>
                  <td className="p-3 text-right">
                    ${item.unitPrice.toFixed(2)}
                  </td>
                  <td className="p-3 text-right font-medium">
                    ${item.totalPrice.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Appointment Details */}
      {appointment && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Appointment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>{formatDateString(appointment.scheduledDate)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>{formatTime12h(appointment.scheduledTime)}</span>
              </div>
              {appointment.location && (
                <div className="flex items-center gap-2 text-sm sm:col-span-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {appointment.location.street}, {appointment.location.city},{" "}
                    {appointment.location.state} {appointment.location.zip}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant="outline" className="capitalize">
                  {appointment.status.replace("_", " ")}
                </Badge>
              </div>
              {appointment.vehicles && appointment.vehicles.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Car className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {appointment.vehicles
                      .map(
                        (v: { year: number; make: string; model: string }) =>
                          `${v.year} ${v.make} ${v.model}`,
                      )
                      .join(", ")}
                  </span>
                </div>
              )}
            </div>
            <div className="mt-3">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/appointments/${appointment._id}`}>
                  View Appointment
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Actions</CardTitle>
          <CardDescription>Update invoice status or send to customer</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {invoice.status === "draft" && (
              <Button
                variant="outline"
                onClick={() => handleStatusUpdate("sent")}
                disabled={isUpdating}
              >
                <Send className="w-4 h-4 mr-2" />
                Mark as Sent
              </Button>
            )}
            {(invoice.status === "sent" ||
              invoice.status === "draft" ||
              invoice.status === "overdue") && (
              <Button
                variant="default"
                onClick={() => handleStatusUpdate("paid")}
                disabled={isUpdating}
              >
                <Check className="w-4 h-4 mr-2" />
                Mark as Paid
              </Button>
            )}
            {invoice.status === "sent" && (
              <Button
                variant="destructive"
                onClick={() => handleStatusUpdate("overdue")}
                disabled={isUpdating}
              >
                Mark Overdue
              </Button>
            )}
            {invoice.stripeInvoiceUrl && (
              <Button
                variant="outline"
                onClick={() =>
                  window.open(invoice.stripeInvoiceUrl, "_blank", "noopener")
                }
              >
                <CreditCard className="w-4 h-4 mr-2" />
                View Stripe Invoice
              </Button>
            )}
            {invoice.stripeInvoiceId && (
              <Button
                variant="outline"
                onClick={() =>
                  window.open(
                    `https://dashboard.stripe.com/invoices/${invoice.stripeInvoiceId}`,
                    "_blank",
                    "noopener",
                  )
                }
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Stripe Dashboard
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stripe IDs (debug/reference) */}
      {(invoice.stripeInvoiceId || invoice.depositPaymentIntentId || invoice.finalPaymentIntentId) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-muted-foreground">
              Stripe References
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {invoice.stripeInvoiceId && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stripe Invoice ID</span>
                <code className="text-xs bg-muted px-2 py-0.5 rounded">
                  {invoice.stripeInvoiceId}
                </code>
              </div>
            )}
            {invoice.depositPaymentIntentId && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Deposit Payment Intent
                </span>
                <code className="text-xs bg-muted px-2 py-0.5 rounded">
                  {invoice.depositPaymentIntentId}
                </code>
              </div>
            )}
            {invoice.finalPaymentIntentId && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Final Payment Intent
                </span>
                <code className="text-xs bg-muted px-2 py-0.5 rounded">
                  {invoice.finalPaymentIntentId}
                </code>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
