"use client";

import React from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, CheckCircle2 } from "lucide-react";

const businessSchema = z.object({
  name: z.string().min(1, "Business name is required"),
  owner: z.string().min(1, "Owner name is required"),
  address: z.string().min(1, "Address is required"),
  cityStateZip: z.string().min(1, "City, State, ZIP is required"),
  country: z.string().min(1, "Country is required"),
});

type BusinessFormData = z.infer<typeof businessSchema>;

type AdminNotificationSettings = {
  emailNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
  events: {
    newCustomerOnboarded: boolean;
    appointmentConfirmed: boolean;
    appointmentCancelled: boolean;
    appointmentRescheduled: boolean;
    appointmentStarted: boolean;
    appointmentCompleted: boolean;
    reviewSubmitted: boolean;
    mileageLogRequired: boolean;
  };
};

const DEFAULT_NOTIFICATION_SETTINGS: AdminNotificationSettings = {
  emailNotifications: true,
  smsNotifications: true,
  marketingEmails: false,
  events: {
    newCustomerOnboarded: true,
    appointmentConfirmed: true,
    appointmentCancelled: true,
    appointmentRescheduled: true,
    appointmentStarted: true,
    appointmentCompleted: true,
    reviewSubmitted: true,
    mileageLogRequired: true,
  },
};

export default function SettingsPage() {
  const business = useQuery(api.business.get);
  const businessHours = useQuery(api.availability.getBusinessHours);
  const setupReadiness = useQuery(api.setupReadiness.getAdminSetupReadiness);
  const updateBusiness = useMutation(api.business.update);
  const setBusinessHours = useMutation(api.availability.setBusinessHours);

  const [isLoading, setIsLoading] = useState(false);
  const [isHoursLoading, setIsHoursLoading] = useState(false);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [notificationSettings, setNotificationSettings] =
    useState<AdminNotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);

  // Business hours state - initialize with default values or loaded data
  const [hoursForm, setHoursForm] = useState(() => {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    if (businessHours && businessHours.length > 0) {
      // Use existing hours data
      return days.map((day, index) => {
        const existing = businessHours?.find(
          (h: { dayOfWeek: number }) => h.dayOfWeek === index,
        );
        return {
          day,
          dayOfWeek: index,
          startTime: existing?.startTime || "09:00",
          endTime: existing?.endTime || "17:00",
          isActive: existing?.isActive ?? index > 0, // Sunday closed by default
        };
      });
    } else {
      // Default hours
      return days.map((day, index) => ({
        day,
        dayOfWeek: index,
        startTime: "09:00",
        endTime: "17:00",
        isActive: index > 0, // Sunday closed by default
      }));
    }
  });

  // Handle case where no business exists yet (first-time setup)
  const isFirstTimeSetup = business === null;

  const form = useForm<BusinessFormData>({
    resolver: zodResolver(businessSchema),
    defaultValues: {
      name: "",
      owner: "",
      address: "",
      cityStateZip: "",
      country: "",
    },
  });

  // Update form when business data loads
  React.useEffect(() => {
    if (business) {
      form.reset({
        name: business.name,
        owner: business.owner,
        address: business.address,
        cityStateZip: business.cityStateZip,
        country: business.country,
      });
      setNotificationSettings({
        emailNotifications:
          business.notificationSettings?.emailNotifications ?? true,
        smsNotifications: business.notificationSettings?.smsNotifications ?? true,
        marketingEmails:
          business.notificationSettings?.marketingEmails ?? false,
        events: {
          newCustomerOnboarded:
            business.notificationSettings?.events?.newCustomerOnboarded ?? true,
          appointmentConfirmed:
            business.notificationSettings?.events?.appointmentConfirmed ?? true,
          appointmentCancelled:
            business.notificationSettings?.events?.appointmentCancelled ?? true,
          appointmentRescheduled:
            business.notificationSettings?.events?.appointmentRescheduled ??
            true,
          appointmentStarted:
            business.notificationSettings?.events?.appointmentStarted ?? true,
          appointmentCompleted:
            business.notificationSettings?.events?.appointmentCompleted ?? true,
          reviewSubmitted:
            business.notificationSettings?.events?.reviewSubmitted ?? true,
          mileageLogRequired:
            business.notificationSettings?.events?.mileageLogRequired ?? true,
        },
      });
    }
  }, [business, form]);

  const onSubmit = async (data: BusinessFormData) => {
    setIsLoading(true);
    try {
      await updateBusiness({
        id: business?._id, // Only pass id if updating existing record
        name: data.name,
        owner: data.owner,
        address: data.address,
        cityStateZip: data.cityStateZip,
        country: data.country,
        notificationSettings: {
          ...notificationSettings,
          emailNotifications: true,
          smsNotifications: true,
        },
      });
      toast.success(
        isFirstTimeSetup
          ? "Business information created successfully"
          : "Business information updated successfully",
      );
    } catch {
      toast.error(
        isFirstTimeSetup
          ? "Failed to create business information"
          : "Failed to update business information",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveHours = async () => {
    setIsHoursLoading(true);
    try {
      await setBusinessHours({
        schedule: hoursForm.map((hour) => ({
          dayOfWeek: hour.dayOfWeek,
          startTime: hour.startTime,
          endTime: hour.endTime,
          isActive: hour.isActive,
        })),
      });
      toast.success("Business hours updated successfully");
    } catch {
      toast.error("Failed to update business hours");
    } finally {
      setIsHoursLoading(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!business?._id) {
      toast.error("Create business information first");
      return;
    }

    setIsNotificationsLoading(true);
    try {
      await updateBusiness({
        id: business._id,
        notificationSettings: {
          ...notificationSettings,
          emailNotifications: true,
          smsNotifications: true,
        },
      });
      toast.success("Notification settings saved");
    } catch {
      toast.error("Failed to save notification settings");
    } finally {
      setIsNotificationsLoading(false);
    }
  };

  const blockers = new Set(
    setupReadiness?.blockers.map((blocker: { code: string }) => blocker.code) || [],
  );
  const setupChecklistItems = [
    {
      code: "missing_business_info",
      label: "Complete business information",
      description: "Name, owner, address, and country are required.",
      actionLabel: "Business section",
      actionHref: "#business-information",
    },
    {
      code: "missing_availability",
      label: "Configure operating hours",
      description: "Set at least one active day with a minimum 2-hour window.",
      actionLabel: "Hours section",
      actionHref: "#operating-hours",
    },
    {
      code: "missing_bookable_service_pricing",
      label: "Add a priced standard service",
      description:
        "At least one active standard service must have pricing greater than $0.",
      actionLabel: "Go to services",
      actionHref: "/admin/services",
    },
  ] as const;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h2 className="text-3xl font-bold">Settings</h2>
        <p className="text-muted-foreground">
          {isFirstTimeSetup
            ? "Set up your business information"
            : "Manage your business settings and preferences"}
        </p>
      </div>

      <Card
        className={
          setupReadiness && !setupReadiness.isReady
            ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20"
            : "border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20"
        }
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {setupReadiness && !setupReadiness.isReady ? (
              <AlertCircle className="h-5 w-5 text-amber-600" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            )}
            Setup Checklist
          </CardTitle>
          <CardDescription>
            {setupReadiness && !setupReadiness.isReady
              ? "Complete these items before booking can go live."
              : "Booking setup is complete."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {setupChecklistItems.map((item) => {
            const isBlocked = blockers.has(item.code);
            return (
              <div
                key={item.code}
                className="flex items-start justify-between gap-4 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isBlocked ? (
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      Required
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Complete
                    </span>
                  )}
                  {isBlocked && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={item.actionHref}>{item.actionLabel}</Link>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Business Information */}
      <Card id="business-information" className="animate-fade-in-up">
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
          <CardDescription>
            {isFirstTimeSetup
              ? "Enter your business details to get started"
              : "Update your business details"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Business Name</Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  placeholder="Enter business name"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner">Owner Name</Label>
                <Input
                  id="owner"
                  {...form.register("owner")}
                  placeholder="Enter owner name"
                />
                {form.formState.errors.owner && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.owner.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                {...form.register("address")}
                placeholder="Enter street address"
              />
              {form.formState.errors.address && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.address.message}
                </p>
              )}
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cityStateZip">City, State, ZIP</Label>
                <Input
                  id="cityStateZip"
                  {...form.register("cityStateZip")}
                  placeholder="e.g., Little Rock, AR 72201"
                />
                {form.formState.errors.cityStateZip && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.cityStateZip.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  {...form.register("country")}
                  placeholder="e.g., United States"
                />
                {form.formState.errors.country && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.country.message}
                  </p>
                )}
              </div>
            </div>
            <Button type="submit" disabled={isLoading}>
              {isLoading
                ? "Saving..."
                : isFirstTimeSetup
                  ? "Create Business"
                  : "Save Changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Operating Hours */}
      <Card
        id="operating-hours"
        className="animate-fade-in-up"
        style={{ animationDelay: "100ms" }}
      >
        <CardHeader>
          <CardTitle>Operating Hours</CardTitle>
          <CardDescription>
            Set your business hours for appointment availability
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hoursForm.map((schedule, index) => (
            <div
              key={schedule.dayOfWeek}
              className="flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4 min-w-0 flex-1">
                <span className="font-medium w-20">{schedule.day}</span>
                <Switch
                  checked={schedule.isActive}
                  onCheckedChange={(checked) =>
                    setHoursForm((prev) =>
                      prev.map((h, i) =>
                        i === index ? { ...h, isActive: checked } : h,
                      ),
                    )
                  }
                />
              </div>
              {schedule.isActive && (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    className="w-32"
                    value={schedule.startTime}
                    onChange={(e) =>
                      setHoursForm((prev) =>
                        prev.map((h, i) =>
                          i === index ? { ...h, startTime: e.target.value } : h,
                        ),
                      )
                    }
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    type="time"
                    className="w-32"
                    value={schedule.endTime}
                    onChange={(e) =>
                      setHoursForm((prev) =>
                        prev.map((h, i) =>
                          i === index ? { ...h, endTime: e.target.value } : h,
                        ),
                      )
                    }
                  />
                </div>
              )}
            </div>
          ))}
          <Button onClick={handleSaveHours} disabled={isHoursLoading}>
            {isHoursLoading ? "Saving..." : "Update Hours"}
          </Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            Manage your notification preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Email Notifications</div>
              <div className="text-sm text-muted-foreground">
                Required for operational notifications
              </div>
            </div>
            <Switch checked disabled />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">SMS Notifications</div>
              <div className="text-sm text-muted-foreground">
                Required for operational notifications
              </div>
            </div>
            <Switch checked disabled />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Marketing Emails</div>
              <div className="text-sm text-muted-foreground">
                Receive tips and updates
              </div>
            </div>
            <Switch
              checked={notificationSettings.marketingEmails}
              onCheckedChange={(checked) =>
                setNotificationSettings((prev) => ({
                  ...prev,
                  marketingEmails: checked,
                }))
              }
            />
          </div>

          <div className="pt-2 border-t">
            <p className="text-sm font-medium mb-3">Event Notifications</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">New Customer Onboarded</div>
                  <div className="text-sm text-muted-foreground">
                    Notify admin when onboarding completes
                  </div>
                </div>
                <Switch
                  checked={notificationSettings.events.newCustomerOnboarded}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      events: { ...prev.events, newCustomerOnboarded: checked },
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Appointment Confirmed</div>
                  <div className="text-sm text-muted-foreground">
                    Notify after deposit is paid
                  </div>
                </div>
                <Switch
                  checked={notificationSettings.events.appointmentConfirmed}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      events: { ...prev.events, appointmentConfirmed: checked },
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Appointment Cancelled</div>
                  <div className="text-sm text-muted-foreground">
                    Notify when appointments are cancelled
                  </div>
                </div>
                <Switch
                  checked={notificationSettings.events.appointmentCancelled}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      events: { ...prev.events, appointmentCancelled: checked },
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Appointment Rescheduled</div>
                  <div className="text-sm text-muted-foreground">
                    Notify when date or time changes
                  </div>
                </div>
                <Switch
                  checked={notificationSettings.events.appointmentRescheduled}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      events: {
                        ...prev.events,
                        appointmentRescheduled: checked,
                      },
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Appointment Started</div>
                  <div className="text-sm text-muted-foreground">
                    Notify when work begins
                  </div>
                </div>
                <Switch
                  checked={notificationSettings.events.appointmentStarted}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      events: { ...prev.events, appointmentStarted: checked },
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Appointment Completed</div>
                  <div className="text-sm text-muted-foreground">
                    Notify when service is complete
                  </div>
                </div>
                <Switch
                  checked={notificationSettings.events.appointmentCompleted}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      events: { ...prev.events, appointmentCompleted: checked },
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Review Submitted</div>
                  <div className="text-sm text-muted-foreground">
                    Notify when a customer leaves a review
                  </div>
                </div>
                <Switch
                  checked={notificationSettings.events.reviewSubmitted}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      events: { ...prev.events, reviewSubmitted: checked },
                    }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Mileage Log Required</div>
                  <div className="text-sm text-muted-foreground">
                    Notify when completed appointments need tax log entries
                  </div>
                </div>
                <Switch
                  checked={notificationSettings.events.mileageLogRequired}
                  onCheckedChange={(checked) =>
                    setNotificationSettings((prev) => ({
                      ...prev,
                      events: { ...prev.events, mileageLogRequired: checked },
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <Button
            onClick={handleSaveNotifications}
            disabled={isNotificationsLoading || isFirstTimeSetup}
          >
            {isNotificationsLoading ? "Saving..." : "Save Notification Settings"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
