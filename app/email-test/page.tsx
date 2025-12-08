"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

export default function EmailTestPage() {
  const [email, setEmail] = useState("delivered@resend.dev");
  const [loading, setLoading] = useState<string | null>(null);

  const sendTestWelcome = useMutation(api.emails.sendTestWelcomeEmail);
  const sendTestAppointment = useMutation(api.emails.sendTestAppointmentEmail);
  const sendTestInvoice = useMutation(api.emails.sendTestInvoiceEmail);

  const handleSendTest = async (
    type: "welcome" | "appointment" | "invoice",
  ) => {
    if (!email) {
      toast.error("Please enter an email address");
      return;
    }

    setLoading(type);
    try {
      let result;
      switch (type) {
        case "welcome":
          result = await sendTestWelcome({ email });
          break;
        case "appointment":
          result = await sendTestAppointment({ email });
          break;
        case "invoice":
          result = await sendTestInvoice({ email });
          break;
      }

      toast.success(result.message);
    } catch (error) {
      console.error(`Error sending ${type} email:`, error);
      toast.error(`Failed to send ${type} email`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Email Testing</CardTitle>
            <CardDescription>
              Test email templates using Resend test addresses. These emails
              will not be delivered to real addresses.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Test Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="delivered@resend.dev"
              />
              <p className="text-sm text-gray-600">
                Use Resend test addresses: delivered@resend.dev,
                bounced@resend.dev, complained@resend.dev
              </p>
            </div>

            <div className="grid gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Welcome Email</CardTitle>
                  <CardDescription>
                    Test the welcome email sent to new users after completing
                    onboarding.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => handleSendTest("welcome")}
                    disabled={loading === "welcome"}
                    className="w-full"
                  >
                    {loading === "welcome"
                      ? "Sending..."
                      : "Send Welcome Email"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Appointment Confirmation
                  </CardTitle>
                  <CardDescription>
                    Test the appointment confirmation email sent when bookings
                    are created.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => handleSendTest("appointment")}
                    disabled={loading === "appointment"}
                    className="w-full"
                  >
                    {loading === "appointment"
                      ? "Sending..."
                      : "Send Appointment Email"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Invoice Email</CardTitle>
                  <CardDescription>
                    Test the invoice email sent when invoices are created or
                    updated.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => handleSendTest("invoice")}
                    disabled={loading === "invoice"}
                    className="w-full"
                  >
                    {loading === "invoice"
                      ? "Sending..."
                      : "Send Invoice Email"}
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">
                Testing Notes
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>
                  • <strong>delivered@resend.dev</strong> - Test successful
                  delivery
                </li>
                <li>
                  • <strong>bounced@resend.dev</strong> - Test bounce handling
                </li>
                <li>
                  • <strong>complained@resend.dev</strong> - Test spam
                  complaints
                </li>
                <li>
                  • Check Convex dashboard for email status and webhook events
                </li>
                <li>• Emails are sent in test mode (no real delivery)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
