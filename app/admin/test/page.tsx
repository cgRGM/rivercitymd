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
  { key: "welcome_email", title: "Welcome Email", description: "Sends welcome email to test customer" },
  { key: "appointment_confirmed", title: "Appointment Confirmed", description: "Confirmation email + admin notification + SMS" },
  { key: "appointment_cancelled", title: "Appointment Cancelled", description: "Cancellation email + admin notification + SMS" },
  { key: "appointment_rescheduled", title: "Appointment Rescheduled", description: "Reschedule email + admin notification + SMS" },
  { key: "appointment_started", title: "Appointment Started", description: "In-progress email + admin notification + SMS" },
  { key: "appointment_completed", title: "Appointment Completed", description: "Completion + review request emails + SMS" },
  { key: "reminder", title: "24h Reminder", description: "Appointment reminder email to customer" },
];

const ADMIN_SCENARIOS: ScenarioConfig[] = [
  { key: "new_customer_onboarded", title: "New Customer Onboarded", description: "Admin email + SMS for new customer" },
  { key: "deposit_paid", title: "Deposit Paid", description: "Admin notification for deposit payment" },
  { key: "review_submitted", title: "Review Submitted", description: "Admin email + SMS for new review" },
  { key: "mileage_log_required", title: "Mileage Log Required", description: "Admin email + SMS for pending mileage log" },
];

const FLOW_SCENARIOS: ScenarioConfig[] = [
  { key: "full_guest_checkout", title: "Full Flow: Guest Checkout", description: "New Customer -> Deposit Paid -> Confirmed -> Started -> Completed" },
  { key: "full_returning_customer", title: "Full Flow: Returning Customer", description: "Welcome -> Confirmed -> Started -> Completed" },
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
  const [results, setResults] = useState<Record<string, TestResult>>({});

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
          Run end-to-end tests of the notification pipeline. Emails sent to
          dustin@rivercitymd.com and cg@rocktownlabs.com. SMS sent to admin
          phone.
        </p>
      </div>

      <ScenarioSection
        title="Customer Emails"
        scenarios={CUSTOMER_SCENARIOS}
        results={results}
        onRun={handleRun}
      />

      <ScenarioSection
        title="Admin Emails"
        scenarios={ADMIN_SCENARIOS}
        results={results}
        onRun={handleRun}
      />

      <ScenarioSection
        title="Full Flows"
        scenarios={FLOW_SCENARIOS}
        results={results}
        onRun={handleRun}
      />
    </div>
  );
}
