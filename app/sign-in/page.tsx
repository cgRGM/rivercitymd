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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { useSignIn } from "@clerk/nextjs";
import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Authenticated, Unauthenticated } from "convex/react";

export default function SignInPage() {
  const router = useRouter();
  const { isSignedIn, userId } = useAuth();
  const { isLoaded, signIn, setActive } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check if user is already authenticated
  const currentUser = useQuery(api.users.getCurrentUser);
  const userRole = useQuery(api.auth.getUserRole);

  useEffect(() => {
    if (isSignedIn && currentUser && userRole) {
      // User is authenticated, redirect based on role
      if (userRole.type === "admin") {
        router.push("/admin");
      } else {
        router.push("/dashboard");
      }
    }
  }, [isSignedIn, currentUser, userRole, router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded || !signIn) return;

    setError(null);
    setIsLoading(true);

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.refresh();
      } else {
        setError("Sign in incomplete. Please try again.");
      }
    } catch (err: any) {
      console.error("Sign in error:", err);

      // Handle specific error messages gracefully
      let errorMessage = "Failed to sign in";

      if (err.errors) {
        const firstError = err.errors[0];
        if (firstError.code === "form_identifier_not_found") {
          errorMessage =
            "No account found with this email. Please check your email or sign up.";
        } else if (firstError.code === "form_password_incorrect") {
          errorMessage =
            "Invalid password. Please check your password and try again.";
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

        {/* Sign In Card */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
            <CardDescription>
              Sign in to your account to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    href="#"
                    className="text-sm text-accent hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="text-sm text-center text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link
                href="/sign-up"
                className="text-accent hover:underline font-medium"
              >
                Sign up
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
