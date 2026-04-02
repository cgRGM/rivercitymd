"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { Loader2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateStringLong, formatTime12h } from "@/lib/time";

export default function BookingCancelledPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const cancelDraftCheckout = useAction(api.payments.cancelBookingDraftCheckout);
  const draftContext = useQuery(api.bookingDrafts.getPublicContext, token ? { token } : "skip");

  useEffect(() => {
    if (!token) {
      return;
    }

    void cancelDraftCheckout({ token });
  }, [cancelDraftCheckout, token]);

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
            <CardTitle className="text-3xl">Checkout paused</CardTitle>
            <CardDescription className="text-base">
              Your booking details were saved, but payment was not completed.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {token && draftContext === undefined ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Saving your checkout state...
            </div>
          ) : null}

          {draftContext ? (
            <div className="rounded-xl border bg-muted/40 p-5">
              <p className="text-sm font-medium text-muted-foreground">
                {draftContext.serviceNames.join(", ") || "Appointment"} for {draftContext.email}
              </p>
              <p className="mt-2 text-lg font-semibold">
                {formatDateStringLong(draftContext.scheduledDate)} at{" "}
                {formatTime12h(draftContext.scheduledTime)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Use the resume link below any time to finish checkout. If this time
                is no longer available, we&apos;ll bring your details back and let
                you pick a new one.
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="flex-1" disabled={!token}>
              <Link href={token ? `/booking/resume?token=${token}` : "/"}>
                Resume checkout
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/">Return home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
