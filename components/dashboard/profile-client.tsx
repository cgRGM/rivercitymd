"use client";

import { useState } from "react";
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

export default function ProfileClient({ userPreloaded }: ProfileClientProps) {
  const user = preloadedQueryResult(userPreloaded);
  const updateUserProfile = useMutation(api.users.updateUserProfile);

  const [personalInfo, setPersonalInfo] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });

  const [addressInfo, setAddressInfo] = useState({
    street: user?.address?.street || "",
    city: user?.address?.city || "",
    state: user?.address?.state || "",
    zip: user?.address?.zip || "",
  });

  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    smsNotifications: true,
    promotionalEmails: false,
    serviceReminders: true,
  });

  const handleUpdatePersonalInfo = async () => {
    try {
      await updateUserProfile({
        name: personalInfo.name || undefined,
        email: personalInfo.email || undefined,
        phone: personalInfo.phone || undefined,
      });
      toast.success("Personal information updated successfully");
    } catch {
      toast.error("Failed to update personal information");
    }
  };

  const handleUpdateAddress = async () => {
    try {
      await updateUserProfile({
        address: {
          street: addressInfo.street,
          city: addressInfo.city,
          state: addressInfo.state,
          zip: addressInfo.zip,
        },
      });
      toast.success("Address updated successfully");
    } catch {
      toast.error("Failed to update address");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h2 className="text-3xl font-bold">Profile Settings</h2>
        <p className="text-muted-foreground">
          Manage your account information and preferences
        </p>
      </div>

      {/* Personal Information */}
      <Card className="animate-fade-in-up">
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={personalInfo.name}
              onChange={(e) =>
                setPersonalInfo((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Enter your full name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={personalInfo.email}
              onChange={(e) =>
                setPersonalInfo((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder="Enter your email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              value={personalInfo.phone}
              onChange={(e) =>
                setPersonalInfo((prev) => ({ ...prev, phone: e.target.value }))
              }
              placeholder="Enter your phone number"
            />
          </div>
          <Button onClick={handleUpdatePersonalInfo}>Save Changes</Button>
        </CardContent>
      </Card>

      {/* Service Address */}
      <Card className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <CardHeader>
          <CardTitle>Service Address</CardTitle>
          <CardDescription>
            Where we&apos;ll come to service your vehicles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="street">Street Address</Label>
            <Input
              id="street"
              value={addressInfo.street}
              onChange={(e) =>
                setAddressInfo((prev) => ({ ...prev, street: e.target.value }))
              }
              placeholder="Enter your street address"
            />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={addressInfo.city}
                onChange={(e) =>
                  setAddressInfo((prev) => ({ ...prev, city: e.target.value }))
                }
                placeholder="City"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={addressInfo.state}
                onChange={(e) =>
                  setAddressInfo((prev) => ({ ...prev, state: e.target.value }))
                }
                placeholder="State"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP Code</Label>
              <Input
                id="zip"
                value={addressInfo.zip}
                onChange={(e) =>
                  setAddressInfo((prev) => ({ ...prev, zip: e.target.value }))
                }
                placeholder="ZIP"
              />
            </div>
          </div>

          <Button onClick={handleUpdateAddress}>Update Address</Button>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card className="animate-fade-in-up" style={{ animationDelay: "200ms" }}>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Choose how you want to be notified</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Email Notifications</div>
              <div className="text-sm text-muted-foreground">
                Receive booking confirmations and updates via email
              </div>
            </div>
            <Switch
              checked={notifications.emailNotifications}
              onCheckedChange={(checked) =>
                setNotifications((prev) => ({
                  ...prev,
                  emailNotifications: checked,
                }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">SMS Notifications</div>
              <div className="text-sm text-muted-foreground">
                Get text alerts for appointments and reminders
              </div>
            </div>
            <Switch
              checked={notifications.smsNotifications}
              onCheckedChange={(checked) =>
                setNotifications((prev) => ({
                  ...prev,
                  smsNotifications: checked,
                }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Promotional Emails</div>
              <div className="text-sm text-muted-foreground">
                Receive special offers and seasonal promotions
              </div>
            </div>
            <Switch
              checked={notifications.promotionalEmails}
              onCheckedChange={(checked) =>
                setNotifications((prev) => ({
                  ...prev,
                  promotionalEmails: checked,
                }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Service Reminders</div>
              <div className="text-sm text-muted-foreground">
                Get reminders when it&apos;s time for your next detail
              </div>
            </div>
            <Switch
              checked={notifications.serviceReminders}
              onCheckedChange={(checked) =>
                setNotifications((prev) => ({
                  ...prev,
                  serviceReminders: checked,
                }))
              }
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
