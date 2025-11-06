"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";

interface PaymentFormProps {
  invoiceId: Id<"invoices">;
  onCancel?: () => void;
}

export default function PaymentForm({ invoiceId, onCancel }: PaymentFormProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const invoice = useQuery(api.invoices.getById, { invoiceId });
  const createCheckoutSession = useAction(api.payments.createCheckoutSession);

  if (!invoice) {
    return <div>Loading...</div>;
  }

  const handleCheckout = async () => {
    setIsProcessing(true);
    try {
      const { url } = await createCheckoutSession({
        invoiceId,
        successUrl: `${window.location.origin}/dashboard?payment=success`,
        cancelUrl: `${window.location.origin}/dashboard?payment=cancelled`,
      });

      window.location.href = url;
    } catch {
      toast.error("Failed to create checkout session");
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Invoice Payment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">
                Invoice #{invoice.invoiceNumber}
              </span>
              <span className="text-2xl font-bold">
                ${invoice.total.toFixed(2)}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              Due: {new Date(invoice.dueDate).toLocaleDateString()}
            </div>
            <Badge
              variant={invoice.status === "paid" ? "default" : "secondary"}
            >
              {invoice.status}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {invoice.status !== "paid" && (
        <>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                  <CreditCard className="w-8 h-8 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Secure Payment</h3>
                  <p className="text-muted-foreground mb-4">
                    You&apos;ll be redirected to Stripe&apos;s secure checkout
                    page to complete your payment.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button
              onClick={handleCheckout}
              disabled={isProcessing}
              className="flex-1"
            >
              {isProcessing
                ? "Processing..."
                : `Pay $${invoice.total.toFixed(2)} with Stripe`}
            </Button>
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </>
      )}

      {invoice.status === "paid" && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Payment Complete</h3>
              <p className="text-muted-foreground">
                This invoice has been paid on{" "}
                {invoice.paidDate
                  ? new Date(invoice.paidDate).toLocaleDateString()
                  : "N/A"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
