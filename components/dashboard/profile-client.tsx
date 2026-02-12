"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { preloadedQueryResult } from "convex/nextjs";
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
import { toast } from "sonner";

interface ProfileClientProps {
  userPreloaded: ReturnType<typeof preloadedQueryResult>;
}

type NotificationPreferences = {
  emailNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails: boolean;
  serviceReminders: boolean;
  events: {
    appointmentConfirmed: boolean;
    appointmentCancelled: boolean;
    appointmentRescheduled: boolean;
    appointmentStarted: boolean;
    appointmentCompleted: boolean;
  };
};

type SectionName = "personal" | "address" | "notifications";
type UserLike = {
  name?: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  notificationPreferences?: Partial<NotificationPreferences> & {
    events?: Partial<NotificationPreferences["events"]>;
  };
};

function getUserNotificationPreferences(
  user: UserLike | null | undefined,
): NotificationPreferences {
  return {
    emailNotifications: user?.notificationPreferences?.emailNotifications ?? true,
    smsNotifications: user?.notificationPreferences?.smsNotifications ?? true,
    marketingEmails: user?.notificationPreferences?.marketingEmails ?? false,
    serviceReminders: user?.notificationPreferences?.serviceReminders ?? true,
    events: {
      appointmentConfirmed:
        user?.notificationPreferences?.events?.appointmentConfirmed ?? true,
      appointmentCancelled:
        user?.notificationPreferences?.events?.appointmentCancelled ?? true,
      appointmentRescheduled:
        user?.notificationPreferences?.events?.appointmentRescheduled ?? true,
      appointmentStarted:
        user?.notificationPreferences?.events?.appointmentStarted ?? true,
      appointmentCompleted:
        user?.notificationPreferences?.events?.appointmentCompleted ?? true,
    },
  };
}

export default function ProfileClient({ userPreloaded }: ProfileClientProps) {
  const user = preloadedQueryResult(userPreloaded);
  const updateUserProfile = useMutation(api.users.updateUserProfile);

  const currentPersonal = useMemo(
    () => ({
      name: user?.name || "",
      email: user?.email || "",
      phone: user?.phone || "",
    }),
    [user?.name, user?.email, user?.phone],
  );

  const currentAddress = useMemo(
    () => ({
      street: user?.address?.street || "",
      city: user?.address?.city || "",
      state: user?.address?.state || "",
      zip: user?.address?.zip || "",
    }),
    [user?.address?.street, user?.address?.city, user?.address?.state, user?.address?.zip],
  );

  const currentNotifications = useMemo(
    () => getUserNotificationPreferences(user as UserLike | null | undefined),
    [user],
  );

  const [personalInfo, setPersonalInfo] = useState(currentPersonal);
  const [addressInfo, setAddressInfo] = useState(currentAddress);
  const [notifications, setNotifications] = useState<NotificationPreferences>(
    currentNotifications,
  );

  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isEditingNotifications, setIsEditingNotifications] = useState(false);

  const [isPersonalDirty, setIsPersonalDirty] = useState(false);
  const [isAddressDirty, setIsAddressDirty] = useState(false);
  const [isNotificationsDirty, setIsNotificationsDirty] = useState(false);

  const [savingSection, setSavingSection] = useState<SectionName | null>(null);
  const [savedSection, setSavedSection] = useState<SectionName | null>(null);

  useEffect(() => {
    if (!isEditingPersonal && !isPersonalDirty) {
      setPersonalInfo(currentPersonal);
    }
  }, [currentPersonal, isEditingPersonal, isPersonalDirty]);

  useEffect(() => {
    if (!isEditingAddress && !isAddressDirty) {
      setAddressInfo(currentAddress);
    }
  }, [currentAddress, isEditingAddress, isAddressDirty]);

  useEffect(() => {
    if (!isEditingNotifications && !isNotificationsDirty) {
      setNotifications(currentNotifications);
    }
  }, [
    currentNotifications,
    isEditingNotifications,
    isNotificationsDirty,
  ]);

  const markSaved = (section: SectionName) => {
    setSavedSection(section);
    setTimeout(() => setSavedSection((current) => (current === section ? null : current)), 2500);
  };

  const handleSavePersonalInfo = async () => {
    setSavingSection("personal");
    try {
      await updateUserProfile({
        name: personalInfo.name || undefined,
        email: personalInfo.email || undefined,
        phone: personalInfo.phone || undefined,
      });
      setIsEditingPersonal(false);
      setIsPersonalDirty(false);
      markSaved("personal");
      toast.success("Personal information saved");
    } catch {
      toast.error("Failed to save personal information");
    } finally {
      setSavingSection(null);
    }
  };

  const handleCancelPersonalInfo = () => {
    setPersonalInfo(currentPersonal);
    setIsPersonalDirty(false);
    setIsEditingPersonal(false);
  };

  const handleSaveAddress = async () => {
    setSavingSection("address");
    try {
      await updateUserProfile({
        address: {
          street: addressInfo.street,
          city: addressInfo.city,
          state: addressInfo.state,
          zip: addressInfo.zip,
        },
      });
      setIsEditingAddress(false);
      setIsAddressDirty(false);
      markSaved("address");
      toast.success("Address saved");
    } catch {
      toast.error("Failed to save address");
    } finally {
      setSavingSection(null);
    }
  };

  const handleCancelAddress = () => {
    setAddressInfo(currentAddress);
    setIsAddressDirty(false);
    setIsEditingAddress(false);
  };

  const handleSaveNotifications = async () => {
    setSavingSection("notifications");
    try {
      await updateUserProfile({
        notificationPreferences: {
          ...notifications,
          emailNotifications: true,
          smsNotifications: true,
        },
      });
      setIsEditingNotifications(false);
      setIsNotificationsDirty(false);
      markSaved("notifications");
      toast.success("Notification preferences saved");
    } catch {
      toast.error("Failed to save notification preferences");
    } finally {
      setSavingSection(null);
    }
  };

  const handleCancelNotifications = () => {
    setNotifications(currentNotifications);
    setIsNotificationsDirty(false);
    setIsEditingNotifications(false);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h2 className="text-3xl font-bold">Profile Settings</h2>
        <p className="text-muted-foreground">
          Manage your account information and preferences
        </p>
      </div>

      <Card className="animate-fade-in-up">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Edit and save your personal details
              </CardDescription>
            </div>
            {!isEditingPersonal ? (
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditingPersonal(true);
                  setSavedSection((section) =>
                    section === "personal" ? null : section,
                  );
                }}
              >
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancelPersonalInfo}
                  disabled={savingSection === "personal"}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSavePersonalInfo}
                  disabled={savingSection === "personal"}
                >
                  {savingSection === "personal" ? "Saving..." : "Save"}
                </Button>
              </div>
            )}
          </div>
          {savedSection === "personal" && (
            <p className="text-sm text-green-600">Saved</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={personalInfo.name}
              readOnly={!isEditingPersonal}
              onChange={(e) => {
                setIsPersonalDirty(true);
                setPersonalInfo((prev) => ({ ...prev, name: e.target.value }));
              }}
              placeholder="Enter your full name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={personalInfo.email}
              readOnly={!isEditingPersonal}
              onChange={(e) => {
                setIsPersonalDirty(true);
                setPersonalInfo((prev) => ({ ...prev, email: e.target.value }));
              }}
              placeholder="Enter your email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={personalInfo.phone}
              readOnly={!isEditingPersonal}
              onChange={(e) => {
                setIsPersonalDirty(true);
                setPersonalInfo((prev) => ({ ...prev, phone: e.target.value }));
              }}
              placeholder="Enter your phone number"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Service Address</CardTitle>
              <CardDescription>
                Where we&apos;ll come to service your vehicles
              </CardDescription>
            </div>
            {!isEditingAddress ? (
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditingAddress(true);
                  setSavedSection((section) =>
                    section === "address" ? null : section,
                  );
                }}
              >
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancelAddress}
                  disabled={savingSection === "address"}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveAddress}
                  disabled={savingSection === "address"}
                >
                  {savingSection === "address" ? "Saving..." : "Save"}
                </Button>
              </div>
            )}
          </div>
          {savedSection === "address" && (
            <p className="text-sm text-green-600">Saved</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="street">Street Address</Label>
            <Input
              id="street"
              value={addressInfo.street}
              readOnly={!isEditingAddress}
              onChange={(e) => {
                setIsAddressDirty(true);
                setAddressInfo((prev) => ({ ...prev, street: e.target.value }));
              }}
              placeholder="Enter your street address"
            />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={addressInfo.city}
                readOnly={!isEditingAddress}
                onChange={(e) => {
                  setIsAddressDirty(true);
                  setAddressInfo((prev) => ({ ...prev, city: e.target.value }));
                }}
                placeholder="City"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={addressInfo.state}
                readOnly={!isEditingAddress}
                onChange={(e) => {
                  setIsAddressDirty(true);
                  setAddressInfo((prev) => ({ ...prev, state: e.target.value }));
                }}
                placeholder="State"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP Code</Label>
              <Input
                id="zip"
                value={addressInfo.zip}
                readOnly={!isEditingAddress}
                onChange={(e) => {
                  setIsAddressDirty(true);
                  setAddressInfo((prev) => ({ ...prev, zip: e.target.value }));
                }}
                placeholder="ZIP"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose which events trigger notifications
              </CardDescription>
            </div>
            {!isEditingNotifications ? (
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditingNotifications(true);
                  setSavedSection((section) =>
                    section === "notifications" ? null : section,
                  );
                }}
              >
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleCancelNotifications}
                  disabled={savingSection === "notifications"}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveNotifications}
                  disabled={savingSection === "notifications"}
                >
                  {savingSection === "notifications" ? "Saving..." : "Save"}
                </Button>
              </div>
            )}
          </div>
          {savedSection === "notifications" && (
            <p className="text-sm text-green-600">Saved</p>
          )}
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
                Receive special offers and promotions
              </div>
            </div>
            <Switch
              checked={notifications.marketingEmails}
              disabled={!isEditingNotifications}
              onCheckedChange={(checked) => {
                if (!isEditingNotifications) return;
                setIsNotificationsDirty(true);
                setNotifications((prev) => ({
                  ...prev,
                  marketingEmails: checked,
                }));
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Service Reminders</div>
              <div className="text-sm text-muted-foreground">
                Reminder notifications for upcoming appointments
              </div>
            </div>
            <Switch
              checked={notifications.serviceReminders}
              disabled={!isEditingNotifications}
              onCheckedChange={(checked) => {
                if (!isEditingNotifications) return;
                setIsNotificationsDirty(true);
                setNotifications((prev) => ({
                  ...prev,
                  serviceReminders: checked,
                }));
              }}
            />
          </div>

          <div className="pt-2 border-t">
            <p className="text-sm font-medium mb-3">Appointment Event Alerts</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Appointment Confirmed</div>
                </div>
                <Switch
                  checked={notifications.events.appointmentConfirmed}
                  disabled={!isEditingNotifications}
                  onCheckedChange={(checked) => {
                    if (!isEditingNotifications) return;
                    setIsNotificationsDirty(true);
                    setNotifications((prev) => ({
                      ...prev,
                      events: { ...prev.events, appointmentConfirmed: checked },
                    }));
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Appointment Cancelled</div>
                </div>
                <Switch
                  checked={notifications.events.appointmentCancelled}
                  disabled={!isEditingNotifications}
                  onCheckedChange={(checked) => {
                    if (!isEditingNotifications) return;
                    setIsNotificationsDirty(true);
                    setNotifications((prev) => ({
                      ...prev,
                      events: { ...prev.events, appointmentCancelled: checked },
                    }));
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Appointment Rescheduled</div>
                </div>
                <Switch
                  checked={notifications.events.appointmentRescheduled}
                  disabled={!isEditingNotifications}
                  onCheckedChange={(checked) => {
                    if (!isEditingNotifications) return;
                    setIsNotificationsDirty(true);
                    setNotifications((prev) => ({
                      ...prev,
                      events: {
                        ...prev.events,
                        appointmentRescheduled: checked,
                      },
                    }));
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Appointment Started</div>
                </div>
                <Switch
                  checked={notifications.events.appointmentStarted}
                  disabled={!isEditingNotifications}
                  onCheckedChange={(checked) => {
                    if (!isEditingNotifications) return;
                    setIsNotificationsDirty(true);
                    setNotifications((prev) => ({
                      ...prev,
                      events: { ...prev.events, appointmentStarted: checked },
                    }));
                  }}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Appointment Completed</div>
                </div>
                <Switch
                  checked={notifications.events.appointmentCompleted}
                  disabled={!isEditingNotifications}
                  onCheckedChange={(checked) => {
                    if (!isEditingNotifications) return;
                    setIsNotificationsDirty(true);
                    setNotifications((prev) => ({
                      ...prev,
                      events: { ...prev.events, appointmentCompleted: checked },
                    }));
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
