"use client";

import type React from "react";

import { useState } from "react";
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft } from "lucide-react";
import { useSignUp } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";

export default function SignUpPage() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { isLoaded, signUp, setActive } = useSignUp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState("");

  // Redirect if already signed in
  if (isSignedIn) {
    router.push("/onboarding");
    return null;
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;

    setError(null);
    setIsLoading(true);

    try {
      const result = await signUp.create({
        emailAddress: email,
        password,
      });

      // If email verification is required
      if (result.status === "missing_requirements") {
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
        setPendingVerification(true);
      } else if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push("/onboarding");
      }
    } catch (err: any) {
      console.error("Sign up error:", err);

      // Handle specific error messages gracefully
      let errorMessage = "Failed to create account";

      if (err.errors) {
        const firstError = err.errors[0];
        if (firstError.code === "form_identifier_exists") {
          errorMessage =
            "An account with this email already exists. Try signing in instead.";
        } else if (firstError.code === "form_password_pwned") {
          errorMessage =
            "This password has been found in a data breach. Please choose a different password.";
        } else if (firstError.code === "form_password_length_too_short") {
          errorMessage =
            "Password is too short. Please choose a password with at least 8 characters.";
        } else if (firstError.message) {
          errorMessage = firstError.message;
        }
      } else if (err instanceof Error) {
        const message = err.message.toLowerCase();
        if (message.includes("network") || message.includes("fetch")) {
          errorMessage =
            "Network error. Please check your connection and try again.";
        }
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signUp) return;

    setError(null);
    setIsLoading(true);

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status === "complete") {
        await setActive({ session: completeSignUp.createdSessionId });
        router.push("/onboarding");
      } else {
        setError("Verification failed. Please try again.");
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      setError(
        err.errors?.[0]?.message || "Invalid verification code. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while Clerk initializes
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show email verification form if needed
  if (pendingVerification) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
        <div className="w-full max-w-md space-y-8">
          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold">
                Verify your email
              </CardTitle>
              <CardDescription>
                We sent a verification code to {email}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerifyEmail} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Verification Code</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="Enter code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                {error && (
                  <div className="bg-red-500/20 border-2 border-red-500/50 rounded-md p-3">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {error}
                    </p>
                  </div>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isLoading}
                >
                  {isLoading ? "Verifying..." : "Verify Email"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
      <div className="w-full max-w-md space-y-8">
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

        {/* Sign Up Card */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">
              Create an account
            </CardTitle>
            <CardDescription>
              Get started with premium mobile detailing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters
                </p>
              </div>
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={agreeToTerms}
                  onCheckedChange={(checked) =>
                    setAgreeToTerms(checked as boolean)
                  }
                  disabled={isLoading}
                />
                <label
                  htmlFor="terms"
                  className="text-sm text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I agree to the{" "}
                  <Link href="#" className="text-accent hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="#" className="text-accent hover:underline">
                    Privacy Policy
                  </Link>
                </label>
              </div>
              {error && (
                <div className="bg-red-500/20 border-2 border-red-500/50 rounded-md p-3">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </p>
                  {error.includes("already exists") ||
                  error.includes("already registered") ? (
                    <Link
                      href="/sign-in"
                      className="text-sm text-red-600 dark:text-red-400 underline mt-2 inline-block"
                    >
                      Go to sign in →
                    </Link>
                  ) : null}
                </div>
              )}
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={!agreeToTerms || isLoading}
              >
                {isLoading ? "Creating account..." : "Create Account"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="text-sm text-center text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/sign-in"
                className="text-accent hover:underline font-medium"
              >
                Sign in
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
