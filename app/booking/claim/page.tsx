"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useClerk, useUser } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateStringLong, formatTime12h } from "@/lib/time";

function buildAuthHref(pathname: "/sign-in" | "/sign-up", token: string, email?: string) {
  const params = new URLSearchParams();
  params.set("redirect_url", `/booking/claim?token=${token}`);
  if (email) {
    params.set("email_address", email);
  }
  return `${pathname}?${params.toString()}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "We couldn't attach this booking to your account.";
}

export default function BookingClaimPage() {
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn } = useUser();
  const clerk = useClerk();
  const claimBooking = useMutation(api.bookingDrafts.claimConvertedDraft);
  const token = searchParams.get("token");
  const claimContext = useQuery(api.bookingDrafts.getPublicContext, token ? { token } : "skip");

  const [status, setStatus] = useState<"idle" | "claiming" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const signInHref = useMemo(
    () => (token ? buildAuthHref("/sign-in", token, claimContext?.email) : "/sign-in"),
    [claimContext?.email, token],
  );
  const signUpHref = useMemo(
    () => (token ? buildAuthHref("/sign-up", token, claimContext?.email) : "/sign-up"),
    [claimContext?.email, token],
  );

  useEffect(() => {
    if (!token || !isLoaded || !isSignedIn || !claimContext || status !== "idle") {
      return;
    }

    if (claimContext.status === "expired") {
      setStatus("error");
      setError(
        "This booking link has expired. Please contact us and we can send you a fresh account link.",
      );
      return;
    }
    if (claimContext.status !== "converted") {
      return;
    }

    let isCancelled = false;

    setStatus("claiming");
    claimBooking({ token })
      .then(({ redirectPath }) => {
        if (isCancelled) {
          return;
        }
        window.location.href = redirectPath;
      })
      .catch((claimError) => {
        if (isCancelled) {
          return;
        }
        setStatus("error");
        setError(getErrorMessage(claimError));
      });

    return () => {
      isCancelled = true;
    };
  }, [claimBooking, claimContext, isLoaded, isSignedIn, status, token]);

  const handleSwitchAccount = async () => {
    await clerk.signOut({ redirectUrl: signInHref });
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <CardTitle>Booking link missing</CardTitle>
            <CardDescription>
              We couldn&apos;t find the booking claim token in this URL.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link href="/">Return home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/30 to-background p-4">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto relative h-12 w-12">
            <Image
              src="/BoldRiverCityMobileDetailingLogo.png"
              alt="River City Mobile Detail"
              fill
              className="object-contain"
            />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl">Attach your booking</CardTitle>
            <CardDescription className="text-base">
              We&apos;re connecting your paid appointment to your account now.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {claimContext === undefined ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Looking up your booking...
            </div>
          ) : !claimContext ? (
            <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
              This booking link is invalid or no longer available.
            </div>
          ) : (
            <div className="rounded-xl border bg-muted/40 p-5">
              <p className="text-sm font-medium text-muted-foreground">
                {claimContext.email}
              </p>
              <p className="mt-2 text-lg font-semibold">
                {formatDateStringLong(claimContext.scheduledDate)} at{" "}
                {formatTime12h(claimContext.scheduledTime)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {claimContext.serviceNames.join(", ") || "Appointment"}
              </p>
            </div>
          )}

          {!isLoaded ||
          (isSignedIn &&
            (status === "claiming" || claimContext?.status !== "converted")) ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              {isSignedIn && claimContext?.status !== "converted"
                ? "Finalizing your booking..."
                : isSignedIn
                  ? "Attaching your booking..."
                  : "Loading account status..."}
            </div>
          ) : null}

          {!isSignedIn && claimContext ? (
            <div className="space-y-4">
              <p className="text-center text-sm text-muted-foreground">
                Sign in or create an account with {claimContext.email} to finish attaching this booking.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild className="flex-1">
                  <Link href={signUpHref}>Create account</Link>
                </Button>
                <Button asChild variant="outline" className="flex-1">
                  <Link href={signInHref}>Sign in</Link>
                </Button>
              </div>
            </div>
          ) : null}

          {status === "error" ? (
            <div className="space-y-4 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
              <p className="text-sm text-destructive">{error}</p>
              {claimContext ? (
                <p className="text-sm text-muted-foreground">
                  Use {claimContext.email} to claim this booking.
                </p>
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row">
                {claimContext ? (
                  <>
                    <Button asChild className="flex-1">
                      <Link href={signUpHref}>Create the right account</Link>
                    </Button>
                    <Button asChild variant="outline" className="flex-1">
                      <Link href={signInHref}>Use the booking email</Link>
                    </Button>
                  </>
                ) : (
                  <Button asChild className="flex-1">
                    <Link href="/">Return home</Link>
                  </Button>
                )}
              </div>
              {isSignedIn ? (
                <Button variant="ghost" className="w-full" onClick={handleSwitchAccount}>
                  Sign out and switch accounts
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
