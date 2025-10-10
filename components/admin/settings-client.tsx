"use client";

import { useState } from "react";
import { Preloaded, usePreloadedQuery, useMutation } from "convex/react";
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

type Props = {
  businessPreloaded: Preloaded<typeof api.business.get>;
  hoursPreloaded: Preloaded<typeof api.availability.getBusinessHours>;
};

export default function SettingsClient({
  businessPreloaded,
  hoursPreloaded,
}: Props) {
  const business = usePreloadedQuery(businessPreloaded);
  const hours = usePreloadedQuery(hoursPreloaded);
  const updateBusiness = useMutation(api.business.update);
  const setBusinessHours = useMutation(api.availability.setBusinessHours);

  const [businessForm, setBusinessForm] = useState({
    name: business?.name || "",
    owner: business?.owner || "",
    address: business?.address || "",
    cityStateZip: business?.cityStateZip || "",
    country: business?.country || "",
  });

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
    return days.map((day, index) => {
      const existing = hours.find((h) => h.dayOfWeek === index);
      return {
        day,
        dayOfWeek: index,
        startTime: existing?.startTime || "09:00",
        endTime: existing?.endTime || "17:00",
        isActive: existing?.isActive ?? index > 0, // Sunday closed by default
      };
    });
  });

  const handleSaveBusiness = async () => {
    try {
      await updateBusiness({
        id: business?._id,
        ...businessForm,
      });
      toast.success("Business information updated");
    } catch {
      toast.error("Failed to update business information");
    }
  };

  const handleSaveHours = async () => {
    try {
      await setBusinessHours({
        schedule: hoursForm.map((hour) => ({
          dayOfWeek: hour.dayOfWeek,
          startTime: hour.startTime,
          endTime: hour.endTime,
          isActive: hour.isActive,
        })),
      });
      toast.success("Business hours updated");
    } catch {
      toast.error("Failed to update business hours");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h2 className="text-3xl font-bold">Settings</h2>
        <p className="text-muted-foreground">
          Manage your business settings and preferences
        </p>
      </div>

      {/* Business Information */}
      <Card className="animate-fade-in-up">
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
          <CardDescription>Update your business details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="business-name">Business Name</Label>
              <Input
                id="business-name"
                value={businessForm.name}
                onChange={(e) =>
                  setBusinessForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner">Owner</Label>
              <Input
                id="owner"
                value={businessForm.owner}
                onChange={(e) =>
                  setBusinessForm((prev) => ({
                    ...prev,
                    owner: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={businessForm.address}
              onChange={(e) =>
                setBusinessForm((prev) => ({
                  ...prev,
                  address: e.target.value,
                }))
              }
            />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cityStateZip">City, State, ZIP</Label>
              <Input
                id="cityStateZip"
                value={businessForm.cityStateZip}
                onChange={(e) =>
                  setBusinessForm((prev) => ({
                    ...prev,
                    cityStateZip: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={businessForm.country}
                onChange={(e) =>
                  setBusinessForm((prev) => ({
                    ...prev,
                    country: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <Button onClick={handleSaveBusiness}>Save Changes</Button>
        </CardContent>
      </Card>

      {/* Operating Hours */}
      <Card className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <CardHeader>
          <CardTitle>Operating Hours</CardTitle>
          <CardDescription>Set your business hours</CardDescription>
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
          <Button onClick={handleSaveHours}>Update Hours</Button>
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
                Receive booking confirmations via email
              </div>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">SMS Notifications</div>
              <div className="text-sm text-muted-foreground">
                Get text alerts for new bookings
              </div>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Marketing Emails</div>
              <div className="text-sm text-muted-foreground">
                Receive tips and updates
              </div>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
