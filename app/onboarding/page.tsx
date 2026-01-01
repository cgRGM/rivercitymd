"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
import { ArrowLeft, Plus, X } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { completeOnboarding } from "./_actions";

type Vehicle = {
  year: number;
  make: string;
  model: string;
  color: string;
};

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoaded: isUserLoaded } = useUser();
  const createUserProfile = useMutation(api.users.createUserProfile);
  const currentUser = useQuery(api.auth.getCurrentUser);

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read step from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const stepParam = urlParams.get("step");
    if (stepParam && !isNaN(Number(stepParam))) {
      const stepNumber = Math.max(1, Math.min(3, Number(stepParam)));
      setStep(stepNumber);
    }
  }, []);

  // Step 1: Personal Info
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Auto-populate email from auth system
  useEffect(() => {
    if (currentUser?.email) {
      setEmail(currentUser.email);
    }
  }, [currentUser]);

  // Step 2: Service Address
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");

  // Step 3: Vehicles
  const [vehicles, setVehicles] = useState<Vehicle[]>([
    { year: 0, make: "", model: "", color: "" },
  ]);

  const addVehicle = () => {
    setVehicles([...vehicles, { year: 0, make: "", model: "", color: "" }]);
  };

  const removeVehicle = (index: number) => {
    if (vehicles.length > 1) {
      setVehicles(vehicles.filter((_, i) => i !== index));
    }
  };

  const updateVehicle = (
    index: number,
    field: keyof Vehicle,
    value: string | number,
  ) => {
    const updated = [...vehicles];
    if (field === "year") {
      updated[index][field] = value as number;
    } else {
      updated[index][field] = value as string;
    }
    setVehicles(updated);
  };

  const handleNext = () => {
    setError(null);
    if (step === 1) {
      if (!name.trim() || !email.trim() || !phone.trim()) {
        setError("Please fill in all fields");
        return;
      }
      const newStep = 2;
      setStep(newStep);
      updateUrlStep(newStep);
    } else if (step === 2) {
      if (!street.trim() || !city.trim() || !state.trim() || !zipCode.trim()) {
        setError("Please fill in all address fields");
        return;
      }
      const newStep = 3;
      setStep(newStep);
      updateUrlStep(newStep);
    }
  };

  const handleBack = () => {
    setError(null);
    if (step > 1) {
      const newStep = step - 1;
      setStep(newStep);
      updateUrlStep(newStep);
    }
  };

  const updateUrlStep = (stepNumber: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set("step", stepNumber.toString());
    window.history.replaceState({}, "", url.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate vehicles
    const validVehicles = vehicles.filter(
      (v) => v.year > 0 && v.make && v.model && v.color,
    );

    if (validVehicles.length === 0) {
      setError("Please add at least one vehicle with all fields filled");
      return;
    }

    // Ensure user is loaded before proceeding
    if (!isUserLoaded || !user) {
      setError("Please wait for your account to load...");
      return;
    }

    setIsLoading(true);

    try {
      // First, save the profile data to Convex
      await createUserProfile({
        name,
        phone,
        address: {
          street,
          city,
          state,
          zip: zipCode,
        },
        vehicles: validVehicles,
      });

      // Then, update Clerk's publicMetadata to mark onboarding as complete
      // This is done asynchronously and doesn't block navigation
      // The middleware uses Convex user record as the source of truth, not Clerk metadata
      completeOnboarding().catch((err) => {
        // Log error but don't block navigation - Convex record is the source of truth
        console.error("Failed to update Clerk metadata:", err);
      });

      // Navigate immediately - middleware will check Convex user record
      // which was just updated by createUserProfile, so it will be accurate
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to complete onboarding",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Logo and Back Button */}
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 transition-transform group-hover:scale-105">
              <Image
                src="/BoldRiverCityMobileDetailingLogo.png"
                alt="River City Mobile Detail"
                fill
                className="object-contain"
              />
            </div>
            <span className="font-bold text-lg">River City MD</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 rounded-full transition-all ${
                s === step
                  ? "w-12 bg-accent"
                  : s < step
                    ? "w-8 bg-accent/60"
                    : "w-8 bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Onboarding Card */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">
              {step === 1 && "Personal Information"}
              {step === 2 && "Service Address"}
              {step === 3 && "Your Vehicles"}
            </CardTitle>
            <CardDescription>
              {step === 1 && "Let's get to know you better"}
              {step === 2 && "Where should we provide our services?"}
              {step === 3 && "Tell us about your vehicles"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Step 1: Personal Info */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      Email from your account
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(501) 555-0123"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Service Address */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="street">Street Address</Label>
                    <Input
                      id="street"
                      type="text"
                      placeholder="123 Main St"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        type="text"
                        placeholder="Little Rock"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        type="text"
                        placeholder="AR"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        required
                        maxLength={2}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">ZIP Code</Label>
                    <Input
                      id="zipCode"
                      type="text"
                      placeholder="72201"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      required
                      maxLength={5}
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Vehicles */}
              {step === 3 && (
                <div className="space-y-4">
                  {vehicles.map((vehicle, index) => (
                    <div
                      key={index}
                      className="p-4 border rounded-lg space-y-4 relative"
                    >
                      {vehicles.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-8 w-8"
                          onClick={() => removeVehicle(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      <h4 className="font-medium text-sm text-muted-foreground">
                        Vehicle {index + 1}
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`year-${index}`}>Year</Label>
                          <Input
                            id={`year-${index}`}
                            type="number"
                            placeholder="2020"
                            value={vehicle.year || ""}
                            onChange={(e) =>
                              updateVehicle(
                                index,
                                "year",
                                parseInt(e.target.value) || 0,
                              )
                            }
                            min={1900}
                            max={new Date().getFullYear() + 1}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`make-${index}`}>Make</Label>
                          <Input
                            id={`make-${index}`}
                            type="text"
                            placeholder="Toyota"
                            value={vehicle.make}
                            onChange={(e) =>
                              updateVehicle(index, "make", e.target.value)
                            }
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor={`model-${index}`}>Model</Label>
                          <Input
                            id={`model-${index}`}
                            type="text"
                            placeholder="Camry"
                            value={vehicle.model}
                            onChange={(e) =>
                              updateVehicle(index, "model", e.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`color-${index}`}>Color</Label>
                          <Input
                            id={`color-${index}`}
                            type="text"
                            placeholder="Silver"
                            value={vehicle.color}
                            onChange={(e) =>
                              updateVehicle(index, "color", e.target.value)
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={addVehicle}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Another Vehicle
                  </Button>
                </div>
              )}

              {error && (
                <div className="bg-red-500/20 border-2 border-red-500/50 rounded-md p-3">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </p>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex gap-4 pt-4">
                {step > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    className="flex-1"
                    disabled={isLoading}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                )}
                {step < 3 ? (
                  <Button type="button" onClick={handleNext} className="flex-1">
                    Continue
                  </Button>
                ) : (
                  <Button type="submit" className="flex-1" disabled={isLoading}>
                    {isLoading ? "Saving..." : "Complete Setup"}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
