"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

type ScenarioConfig = {
  key: string;
  title: string;
  description: string;
};

const CUSTOMER_SCENARIOS: ScenarioConfig[] = [
  {
    key: "booking_received",
    title: "Booking Received",
    description:
      "Customer booking-received email plus the paired admin booking alert.",
  },
  {
    key: "appointment_confirmed",
    title: "Appointment Confirmed",
    description:
      "Customer confirmation email plus the paired admin appointment update.",
  },
  {
    key: "appointment_cancelled",
    title: "Appointment Cancelled",
    description:
      "Customer cancellation email plus the paired admin appointment update.",
  },
  {
    key: "appointment_rescheduled",
    title: "Appointment Rescheduled",
    description:
      "Customer reschedule email plus the paired admin appointment update.",
  },
  {
    key: "appointment_started",
    title: "Appointment Started",
    description:
      "Customer in-progress email plus the paired admin appointment update.",
  },
  {
    key: "appointment_completed",
    title: "Appointment Completed",
    description:
      "Customer completion email, admin completion alert, and review-request follow-up.",
  },
  {
    key: "review_request",
    title: "Review Request",
    description: "Standalone customer review-request email after completion.",
  },
  {
    key: "reminder",
    title: "24h Reminder",
    description: "Customer reminder email for the day before service.",
  },
  {
    key: "abandoned_checkout_recovery",
    title: "Abandoned Checkout Recovery",
    description:
      "Customer recovery email for a saved booking draft that was never paid.",
  },
];

const ADMIN_SCENARIOS: ScenarioConfig[] = [
  {
    key: "deposit_paid",
    title: "Deposit Paid",
    description: "Admin finance alert for a successful booking deposit payment.",
  },
  {
    key: "review_submitted",
    title: "Review Submitted",
    description: "Admin alert for a newly submitted customer review.",
  },
  {
    key: "mileage_log_required",
    title: "Mileage Log Required",
    description: "Admin alert when a completed appointment needs a mileage log.",
  },
  {
    key: "payment_failed",
    title: "Payment Failed",
    description:
      "Admin alert for a failed invoice or subscription payment attempt.",
  },
];

const SUBSCRIPTION_SCENARIOS: ScenarioConfig[] = [
  {
    key: "subscription_checkout_link",
    title: "Subscription Checkout Link",
    description:
      "Customer checkout-link email plus the paired admin notification.",
  },
  {
    key: "subscription_appointment_created",
    title: "Subscription Appointment Created",
    description:
      "Customer recurring appointment email plus the paired admin appointment alert.",
  },
];

const FLOW_SCENARIOS: ScenarioConfig[] = [
  {
    key: "full_self_serve_booking",
    title: "Full Flow: Self-Serve Booking",
    description:
      "Booking Received -> Deposit Paid -> Confirmed -> Started -> Completed -> Review Request.",
  },
  {
    key: "full_subscription_flow",
    title: "Full Flow: Subscription",
    description:
      "Checkout Link -> Subscription Appointment Created -> Admin visibility.",
  },
  {
    key: "abandoned_checkout_recovery_flow",
    title: "Full Flow: Abandoned Recovery",
    description:
      "Saved draft checkout recovery email for a customer who did not finish payment.",
  },
];

type TestResult = {
  status: "running" | "success" | "error";
  error?: string;
  warnings?: string[];
};

function ScenarioCard({
  scenario,
  result,
  onRun,
}: {
  scenario: ScenarioConfig;
  result?: TestResult;
  onRun: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{scenario.title}</CardTitle>
          {result?.status === "success" && !result.warnings?.length && (
            <Badge variant="default" className="bg-green-600">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Sent
            </Badge>
          )}
          {result?.status === "success" && result.warnings?.length && (
            <Badge variant="default" className="bg-yellow-600">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Partial
            </Badge>
          )}
          {result?.status === "error" && (
            <Badge variant="destructive">
              <XCircle className="mr-1 h-3 w-3" />
              Failed
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          {scenario.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {result?.status === "error" && result.error && (
          <p className="mb-2 text-xs text-red-500">{result.error}</p>
        )}
        {result?.warnings?.map((w, i) => (
          <p key={i} className="mb-1 text-xs text-yellow-600">{w}</p>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={result?.status === "running"}
          onClick={onRun}
        >
          {result?.status === "running" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            "Run Test"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

function ScenarioSection({
  title,
  scenarios,
  results,
  onRun,
}: {
  title: string;
  scenarios: ScenarioConfig[];
  results: Record<string, TestResult>;
  onRun: (key: string) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {scenarios.map((scenario) => (
          <ScenarioCard
            key={scenario.key}
            scenario={scenario}
            result={results[scenario.key]}
            onRun={() => onRun(scenario.key)}
          />
        ))}
      </div>
    </div>
  );
}

export default function TestNotificationsPage() {
  const runTest = useAction(api.testFlows.runTestScenarioPublic);
  const cleanupTestData = useAction(api.testFlows.cleanupAllTestDataPublic);
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [cleanupResult, setCleanupResult] = useState<{
    status: "idle" | "running" | "done" | "error";
    message?: string;
  }>({ status: "idle" });

  const handleRun = async (scenarioKey: string) => {
    setResults((prev) => ({
      ...prev,
      [scenarioKey]: { status: "running" },
    }));

    try {
      const result = await runTest({ scenario: scenarioKey });
      if (result.success) {
        setResults((prev) => ({
          ...prev,
          [scenarioKey]: { status: "success", warnings: result.warnings },
        }));
      } else {
        setResults((prev) => ({
          ...prev,
          [scenarioKey]: { status: "error", error: result.error || "Unknown error", warnings: result.warnings },
        }));
      }
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [scenarioKey]: {
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        },
      }));
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Test Notifications & Flows
        </h1>
        <p className="text-sm text-muted-foreground">
          Run safe internal notification tests against the current production
          event catalog. These scenarios send test emails to internal inboxes
          only and mirror the live booking, subscription, failure, and recovery
          flows without contacting real customers. SMS delivery still rides the
          live Twilio notification path, so this screen is focused on template
          and scenario coverage.
        </p>
      </div>

      <ScenarioSection
        title="Booking & Customer Lifecycle"
        scenarios={CUSTOMER_SCENARIOS}
        results={results}
        onRun={handleRun}
      />

      <ScenarioSection
        title="Admin Operations"
        scenarios={ADMIN_SCENARIOS}
        results={results}
        onRun={handleRun}
      />

      <ScenarioSection
        title="Subscription Notifications"
        scenarios={SUBSCRIPTION_SCENARIOS}
        results={results}
        onRun={handleRun}
      />

      <ScenarioSection
        title="Full Flows"
        scenarios={FLOW_SCENARIOS}
        results={results}
        onRun={handleRun}
      />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Cleanup</h2>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Purge Old Test Data
            </CardTitle>
            <CardDescription className="text-xs">
              Delete all remaining isTest records from production tables
              (appointments, invoices, reviews).
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {cleanupResult.status === "done" && cleanupResult.message && (
              <p className="mb-2 text-xs text-green-600">{cleanupResult.message}</p>
            )}
            {cleanupResult.status === "error" && cleanupResult.message && (
              <p className="mb-2 text-xs text-red-500">{cleanupResult.message}</p>
            )}
            <Button
              size="sm"
              variant="destructive"
              className="w-full"
              disabled={cleanupResult.status === "running"}
              onClick={async () => {
                setCleanupResult({ status: "running" });
                try {
                  const result = await cleanupTestData({});
                  setCleanupResult({
                    status: "done",
                    message: `Deleted ${result.deletedAppointments} appointments, ${result.deletedInvoices} invoices, ${result.deletedReviews} reviews, ${result.deletedSubscriptions} subscriptions.`,
                  });
                } catch (err) {
                  setCleanupResult({
                    status: "error",
                    message: err instanceof Error ? err.message : "Unknown error",
                  });
                }
              }}
            >
              {cleanupResult.status === "running" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cleaning up...
                </>
              ) : (
                "Clean Up Test Data"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
