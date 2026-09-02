import * as React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  View,
} from "react-native";
import * as ExpoLinking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useAction, useQuery } from "convex/react";
import { api } from "@rivercitymd/backend/convex/_generated/api";
import type { Id } from "@rivercitymd/backend/convex/_generated/dataModel";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  RefreshCw,
} from "lucide-react-native";

import { EmptyState } from "@/components/empty-state";
import { Screen, ScreenHeader } from "@/components/screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { THEME } from "@/lib/theme";
import { openAuthSession, openBrowser } from "@/lib/browser";
import { ProfilePortalNav } from "@/components/profile-portal-nav";

function formatDate(date: string | undefined) {
  if (!date) return "Date unavailable";
  const value = new Date(`${date}T12:00:00`);
  if (Number.isNaN(value.getTime())) return date;
  return value.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusVariant(status: string) {
  if (status === "paid") return "success" as const;
  if (status === "overdue") return "destructive" as const;
  if (status === "sent") return "accent" as const;
  return "secondary" as const;
}

export default function InvoicesScreen() {
  const { payment } = useLocalSearchParams<{ payment?: string }>();
  const currentUser = useQuery(api.users.getCurrentUser);
  const invoices = useQuery(
    api.invoices.getUserInvoices,
    currentUser ? {} : "skip",
  );
  const createDepositCheckout = useAction(api.payments.createDepositCheckoutSession);
  const createBalanceCheckout = useAction(api.payments.createBalanceCheckoutSession);
  const syncPaymentStatus = useAction(api.payments.syncPaymentStatus);
  const [expandedInvoiceId, setExpandedInvoiceId] = React.useState<Id<"invoices"> | null>(null);
  const [processingInvoiceId, setProcessingInvoiceId] = React.useState<Id<"invoices"> | null>(null);

  const checkoutUrls = React.useMemo(
    () => ({
      success: ExpoLinking.createURL("profile/invoices", {
        queryParams: { payment: "success" },
      }),
      cancel: ExpoLinking.createURL("profile/invoices", {
        queryParams: { payment: "cancelled" },
      }),
    }),
    [],
  );

  const handleHostedInvoice = async (url: string) => {
    try {
      await openBrowser(url);
    } catch {
      Alert.alert("Unable to open invoice", "Please try again or use the invoice link from your email.");
    }
  };

  const handlePayDeposit = async (invoiceId: Id<"invoices">, appointmentId: Id<"appointments">) => {
    setProcessingInvoiceId(invoiceId);
    try {
      const checkout = await createDepositCheckout({
        appointmentId,
        invoiceId,
        successUrl: checkoutUrls.success,
        cancelUrl: checkoutUrls.cancel,
      });
      await openAuthSession(checkout.url, checkoutUrls.success);
    } catch (error) {
      Alert.alert(
        "Payment Error",
        error instanceof Error ? error.message : "Failed to start payment.",
      );
    } finally {
      setProcessingInvoiceId(null);
    }
  };

  const handlePayBalance = async (invoiceId: Id<"invoices">, stripeInvoiceUrl?: string) => {
    if (stripeInvoiceUrl) {
      await handleHostedInvoice(stripeInvoiceUrl);
      return;
    }

    setProcessingInvoiceId(invoiceId);
    try {
      const checkout = await createBalanceCheckout({
        invoiceId,
        successUrl: checkoutUrls.success,
        cancelUrl: checkoutUrls.cancel,
      });
      if (checkout.sessionId.startsWith("in_") || checkout.url.includes("invoice")) {
        await openBrowser(checkout.url);
      } else {
        await openAuthSession(checkout.url, checkoutUrls.success);
      }
    } catch (error) {
      Alert.alert(
        "Payment Error",
        error instanceof Error ? error.message : "Failed to start payment.",
      );
    } finally {
      setProcessingInvoiceId(null);
    }
  };

  const handleSync = async (invoiceId: Id<"invoices">) => {
    setProcessingInvoiceId(invoiceId);
    try {
      const result = await syncPaymentStatus({ invoiceId });
      Alert.alert(
        result.updated ? "Payment Updated" : "No Update Found",
        result.updated
          ? "Your payment status has been refreshed."
          : "Stripe has not reported a new payment for this invoice yet.",
      );
    } catch (error) {
      Alert.alert(
        "Sync Error",
        error instanceof Error ? error.message : "Failed to refresh payment status.",
      );
    } finally {
      setProcessingInvoiceId(null);
    }
  };

  return (
    <Screen>
      <ProfilePortalNav />
      <ScreenHeader
        eyebrow="Customer Portal"
        title="Invoices"
        description="Review deposits, balances, and payment history."
      />

      {payment === "success" ? (
        <View className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
          <Text className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
            Payment submitted. This invoice will update when Stripe confirms it.
          </Text>
        </View>
      ) : null}

      {invoices === undefined ? (
        <View className="items-center gap-2 py-12">
          <ActivityIndicator size="small" color={THEME.light.accent} />
          <Text className="text-xs text-muted-foreground">Loading invoices...</Text>
        </View>
      ) : invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Invoices for your appointments will appear here."
        />
      ) : (
        <View className="gap-3">
          {invoices.map((invoice) => {
            const isExpanded = expandedInvoiceId === invoice._id;
            const isProcessing = processingInvoiceId === invoice._id;
            const hasDeposit = Boolean(invoice.depositAmount && invoice.depositAmount > 0);
            const remainingBalance = invoice.remainingBalance ?? invoice.total;
            const amountDue = hasDeposit && invoice.depositPaid
              ? remainingBalance
              : invoice.total;
            const canPayDeposit = hasDeposit && !invoice.depositPaid && invoice.appointment !== null;
            const canPayBalance = invoice.depositPaid && remainingBalance > 0;

            return (
              <Card key={invoice._id} className="border border-border overflow-hidden">
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setExpandedInvoiceId(isExpanded ? null : invoice._id)}
                  className="active:bg-secondary/30"
                >
                  <CardContent className="gap-3 p-4">
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1 gap-1">
                        <View className="flex-row items-center gap-2">
                          <FileText size={17} color={THEME.light.accent} />
                          <Text className="text-base font-bold">{invoice.invoiceNumber}</Text>
                        </View>
                        <Text className="text-xs text-muted-foreground">
                          {formatDate(invoice.appointment?.scheduledDate)}
                        </Text>
                      </View>
                      <View className="items-end gap-1">
                        <Badge variant={statusVariant(invoice.status)} size="sm" label={invoice.status.toUpperCase()} />
                        <Text className="text-base font-extrabold text-accent">
                          ${Math.max(0, amountDue).toFixed(2)} due
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row items-center justify-between border-t border-border/60 pt-3">
                      <View className="flex-row items-center gap-2">
                        <Calendar size={15} color={THEME.light.mutedForeground} />
                        <Text className="text-xs text-muted-foreground">Due {invoice.dueDate}</Text>
                      </View>
                      {isExpanded ? (
                        <ChevronUp size={17} color={THEME.light.mutedForeground} />
                      ) : (
                        <ChevronDown size={17} color={THEME.light.mutedForeground} />
                      )}
                    </View>
                  </CardContent>
                </Pressable>

                {isExpanded ? (
                  <CardContent className="gap-3 border-t border-border/60 p-4 pt-3">
                    {invoice.items.map((item, index) => (
                      <View key={`${invoice._id}-${index}`} className="flex-row items-center justify-between gap-3">
                        <Text className="flex-1 text-xs text-muted-foreground">
                          {item.serviceName} · {item.quantity}
                        </Text>
                        <Text className="text-xs font-semibold">${item.totalPrice.toFixed(2)}</Text>
                      </View>
                    ))}
                    <View className="gap-1 border-t border-border/60 pt-2">
                      <View className="flex-row justify-between">
                        <Text className="text-xs text-muted-foreground">Total</Text>
                        <Text className="text-xs font-semibold">${invoice.total.toFixed(2)}</Text>
                      </View>
                      {hasDeposit ? (
                        <View className="flex-row justify-between">
                          <Text className="text-xs text-muted-foreground">
                            Deposit {invoice.depositPaid ? "paid" : "pending"}
                          </Text>
                          <Text className="text-xs font-semibold">${invoice.depositAmount!.toFixed(2)}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push(`/appointments/${invoice.appointmentId}`)}
                      className="rounded-lg py-1 active:bg-secondary"
                    >
                      <Text className="text-xs font-semibold text-accent">
                        View appointment · ID {invoice.appointmentId}
                      </Text>
                    </Pressable>

                    {canPayDeposit ? (
                      <Button
                        size="sm"
                        disabled={isProcessing}
                        onPress={() => void handlePayDeposit(invoice._id, invoice.appointment!._id)}
                        className="flex-row items-center justify-center gap-2"
                      >
                        {isProcessing ? <ActivityIndicator size="small" color={THEME.light.primaryForeground} /> : null}
                        <Text className="font-bold text-primary-foreground">Pay Deposit</Text>
                      </Button>
                    ) : canPayBalance ? (
                      <Button
                        size="sm"
                        disabled={isProcessing}
                        onPress={() => void handlePayBalance(invoice._id, invoice.stripeInvoiceUrl)}
                        className="flex-row items-center justify-center gap-2"
                      >
                        {isProcessing ? <ActivityIndicator size="small" color={THEME.light.primaryForeground} /> : <ExternalLink size={15} color={THEME.light.primaryForeground} />}
                        <Text className="font-bold text-primary-foreground">Pay Balance</Text>
                      </Button>
                    ) : invoice.paymentOption === "in_person" && invoice.depositPaid ? (
                      <Text className="text-center text-xs font-semibold text-muted-foreground">
                        Remaining balance is due at the appointment.
                      </Text>
                    ) : invoice.stripeInvoiceUrl && invoice.status !== "paid" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={() => void handleHostedInvoice(invoice.stripeInvoiceUrl!)}
                        className="flex-row items-center justify-center gap-2"
                      >
                        <ExternalLink size={15} color={THEME.light.foreground} />
                        <Text className="font-semibold">Open Hosted Invoice</Text>
                      </Button>
                    ) : null}

                    {invoice.status !== "paid" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isProcessing}
                        onPress={() => void handleSync(invoice._id)}
                        className="flex-row items-center justify-center gap-2"
                      >
                        <RefreshCw size={14} color={THEME.light.mutedForeground} />
                        <Text className="text-xs font-semibold">Refresh Payment Status</Text>
                      </Button>
                    ) : null}
                  </CardContent>
                ) : null}
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
