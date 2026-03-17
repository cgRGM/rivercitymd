"use client";

import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  AlertCircle,
  ExternalLink,
  Calendar,
  FileText,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

type Props = {
  invoiceId: Id<"invoices">;
};

function getStatusBadge(status: string) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    draft: "outline",
    sent: "secondary",
    paid: "default",
    overdue: "destructive",
  };
  return (
    <Badge variant={variants[status] || "outline"}>
      {status.toUpperCase()}
    </Badge>
  );
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(date: string | null | undefined) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function InvoiceDetailClient({ invoiceId }: Props) {
  const router = useRouter();
  const invoice = useQuery(api.invoices.getById, { invoiceId });
  const retryInvoiceGeneration = useMutation(api.appointments.retryInvoiceGeneration);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetryInvoice = async () => {
    setIsRetrying(true);
    try {
      await retryInvoiceGeneration({ invoiceId });
      toast.success("Invoice generation retried. Check back shortly.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to retry invoice generation",
      );
    } finally {
      setIsRetrying(false);
    }
  };

  if (invoice === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (invoice === null) {
    return (
      <div className="space-y-6">
        <Link href="/admin/payments">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Payments
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Invoice Not Found</h3>
            <p className="text-muted-foreground mb-6">
              The invoice you&apos;re looking for doesn&apos;t exist.
            </p>
            <Link href="/admin/payments">
              <Button>Return to Payments</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasDeposit = invoice.depositAmount != null && invoice.depositAmount > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/payments">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Payments
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-bold">{invoice.invoiceNumber}</h2>
              {getStatusBadge(invoice.status)}
            </div>
            <p className="text-muted-foreground">
              Created {formatDate(new Date(invoice._creationTime).toISOString())}
            </p>
          </div>
        </div>
        {invoice.stripeInvoiceUrl && (
          <a
            href={invoice.stripeInvoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline">
              <ExternalLink className="w-4 h-4 mr-2" />
              View in Stripe
            </Button>
          </a>
        )}
      </div>

      {/* Invoice Generation Error Banner */}
      {invoice.invoiceGenerationError && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex items-start gap-4 py-4">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-destructive">
                Stripe Invoice Generation Failed
              </p>
              <p className="text-sm text-muted-foreground mt-1 break-words">
                {invoice.invoiceGenerationError}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryInvoice}
              disabled={isRetrying}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRetrying ? "animate-spin" : ""}`} />
              {isRetrying ? "Retrying..." : "Retry"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(invoice.total)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Due Date</CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDate(invoice.dueDate)}</div>
          </CardContent>
        </Card>

        {hasDeposit && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Deposit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(invoice.depositAmount!)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {invoice.depositPaid ? "Paid" : "Unpaid"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Remaining</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(invoice.remainingBalance ?? invoice.total - (invoice.depositAmount ?? 0))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {invoice.paidDate && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Paid Date</CardTitle>
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDate(invoice.paidDate)}</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.serviceName}</TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.totalPrice)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={3} className="text-right font-medium">
                  Subtotal
                </TableCell>
                <TableCell className="text-right">{formatCurrency(invoice.subtotal)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-medium">
                  Tax
                </TableCell>
                <TableCell className="text-right">{formatCurrency(invoice.tax)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={3} className="text-right text-lg font-bold">
                  Total
                </TableCell>
                <TableCell className="text-right text-lg font-bold">
                  {formatCurrency(invoice.total)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Related Links */}
      <Card>
        <CardHeader>
          <CardTitle>Related</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Link href={`/admin/appointments/${invoice.appointmentId}`}>
            <Button variant="outline" size="sm">
              <Calendar className="w-4 h-4 mr-2" />
              View Appointment
            </Button>
          </Link>
          <Link href={`/admin/customers/${invoice.userId}`}>
            <Button variant="outline" size="sm">
              View Customer
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Notes */}
      {invoice.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{invoice.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
