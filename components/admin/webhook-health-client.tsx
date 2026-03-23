"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ShieldAlert } from "lucide-react";

function formatEventTime(timestamp: number | null) {
  if (!timestamp) {
    return "No sync recorded";
  }
  return new Date(timestamp).toLocaleString();
}

export default function WebhookHealthClient() {
  const diagnostics = useQuery(api.webhookDiagnostics.getAdminOverview);

  if (!diagnostics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Webhook Health</CardTitle>
          <CardDescription>Loading current payment and auth drift checks.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const summaryCards = [
    {
      title: "Deposit Follow-up Gaps",
      value: diagnostics.counts.paidDepositsMissingStripeInvoice,
      description: "Confirmed deposit jobs missing a Stripe invoice",
    },
    {
      title: "Guest Clerk Gaps",
      value: diagnostics.counts.paidGuestInvoicesMissingClerkAccount,
      description: "Paid guest bookings with no linked Clerk account",
    },
    {
      title: "Paid Evidence Gaps",
      value: diagnostics.counts.paidInvoicesMissingStripeEvidence,
      description: "Convex invoices marked paid without Stripe evidence",
    },
    {
      title: "Customer Sync Gaps",
      value: diagnostics.counts.usersMissingStripeCustomer,
      description: "Active client users missing a Stripe customer ID",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{card.value}</div>
              <p className="mt-2 text-sm text-muted-foreground">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Guest Booking Records</CardTitle>
          <CardDescription>
            Paid guest bookings that do not have a Clerk-linked user record.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {diagnostics.paidGuestInvoicesMissingClerkAccount.length === 0 ? (
            <p className="text-sm text-muted-foreground">No guest Clerk sync gaps detected.</p>
          ) : (
            diagnostics.paidGuestInvoicesMissingClerkAccount.map((record) => (
              <div
                key={record.invoiceId}
                className="rounded-lg border border-border p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <div className="font-medium">
                      {record.customerName} <span className="text-muted-foreground">({record.customerEmail})</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Invoice {record.invoiceNumber} • Appointment status {record.appointmentStatus}
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary">
                        Last sync: {formatEventTime(record.latestSyncAt)}
                      </Badge>
                      {record.latestSyncResult ? (
                        <Badge
                          variant={
                            record.latestSyncResult === "linked" ||
                            record.latestSyncResult === "invited"
                              ? "default"
                              : "destructive"
                          }
                        >
                          {record.latestSyncResult}
                        </Badge>
                      ) : null}
                    </div>
                    {record.latestSyncMessage ? (
                      <p className="text-xs text-muted-foreground">
                        {record.latestSyncMessage}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Invoice Drift</CardTitle>
            <CardDescription>
              Deposits that should have generated invoices and paid invoices missing Stripe evidence.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                Deposits missing Stripe invoice
              </div>
              {diagnostics.paidDepositsMissingStripeInvoice.length === 0 ? (
                <p className="text-sm text-muted-foreground">No gaps detected.</p>
              ) : (
                diagnostics.paidDepositsMissingStripeInvoice.map((record) => (
                  <div key={record.invoiceId} className="rounded-lg border border-border p-3 text-sm">
                    <div className="font-medium">
                      {record.customerName} • {record.invoiceNumber}
                    </div>
                    <div className="text-muted-foreground">
                      Appointment status {record.appointmentStatus}
                    </div>
                    {record.invoiceGenerationError ? (
                      <p className="mt-1 text-xs text-destructive">
                        {record.invoiceGenerationError}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <ShieldAlert className="h-4 w-4 text-red-600" />
                Paid invoices missing Stripe evidence
              </div>
              {diagnostics.paidInvoicesMissingStripeEvidence.length === 0 ? (
                <p className="text-sm text-muted-foreground">No gaps detected.</p>
              ) : (
                diagnostics.paidInvoicesMissingStripeEvidence.map((record) => (
                  <div key={record.invoiceId} className="rounded-lg border border-border p-3 text-sm">
                    <div className="font-medium">
                      {record.customerName} • {record.invoiceNumber}
                    </div>
                    <div className="text-muted-foreground">{record.customerEmail}</div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Webhook Issues</CardTitle>
            <CardDescription>
              Recent warnings and errors across Stripe, Clerk, and auth sync.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {diagnostics.recentIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent webhook warnings or errors.</p>
            ) : (
              diagnostics.recentIssues.map((issue) => (
                <div key={issue.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={issue.level === "error" ? "destructive" : "secondary"}>
                      {issue.level}
                    </Badge>
                    <Badge variant="outline">{issue.source}</Badge>
                    <span className="font-medium">{issue.eventType}</span>
                  </div>
                  <p className="mt-2">{issue.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(issue.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            )}

            <div className="border-t pt-4">
              <div className="mb-2 text-sm font-medium">Users missing Stripe customer IDs</div>
              {diagnostics.usersMissingStripeCustomer.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active customer sync gaps.</p>
              ) : (
                diagnostics.usersMissingStripeCustomer.map((record) => (
                  <div key={record.userId} className="rounded-lg border border-border p-3 text-sm">
                    <div className="font-medium">{record.customerName}</div>
                    <div className="text-muted-foreground">{record.customerEmail}</div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
