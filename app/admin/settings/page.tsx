"use client";

import React from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const businessSchema = z.object({
  name: z.string().min(1, "Business name is required"),
  owner: z.string().min(1, "Owner name is required"),
  address: z.string().min(1, "Address is required"),
  cityStateZip: z.string().min(1, "City, State, ZIP is required"),
  country: z.string().min(1, "Country is required"),
});

type BusinessFormData = z.infer<typeof businessSchema>;

export default function SettingsPage() {
  const business = useQuery(api.business.get);
  const updateBusiness = useMutation(api.business.update);

  const [isLoading, setIsLoading] = useState(false);

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

      {/* Business Information */}
      <Card className="animate-fade-in-up">
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
      <Card className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <CardHeader>
          <CardTitle>Operating Hours</CardTitle>
          <CardDescription>Set your business hours</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { day: "Monday", hours: "7:00 AM - 8:00 PM" },
            { day: "Tuesday", hours: "7:00 AM - 8:00 PM" },
            { day: "Wednesday", hours: "7:00 AM - 8:00 PM" },
            { day: "Thursday", hours: "7:00 AM - 8:00 PM" },
            { day: "Friday", hours: "7:00 AM - 8:00 PM" },
            { day: "Saturday", hours: "7:00 AM - 8:00 PM" },
            { day: "Sunday", hours: "Closed" },
          ].map((schedule, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="font-medium w-32">{schedule.day}</span>
              <Input className="max-w-xs" defaultValue={schedule.hours} />
            </div>
          ))}
          <Button>Update Hours</Button>
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
