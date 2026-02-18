"use client";

import { useSignUp, useUser } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function SignUpVerifyPage() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded: signUpLoaded, signUp, setActive } = useSignUp();
  
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"loading" | "set_password" | "success" | "check_email">("loading");

  const ticket = searchParams.get("__clerk_ticket");
  const email = searchParams.get("email");
  const isPaymentSuccess = searchParams.get("payment") === "success";

  // Redirect if already signed in
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push("/dashboard");
    }
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    if (!signUpLoaded) return;

    if (ticket) {
      // If we have a ticket, we can set the password
      setStep("set_password");
    } else if (isPaymentSuccess) {
      // Came from payment but no ticket directly in URL
      // This means they likely need to check email for the invitation link
      setStep("check_email");
    } else {
      // Default fallback
      setStep("check_email");
    }
  }, [signUpLoaded, ticket, isPaymentSuccess]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signUpLoaded || !signUp || !ticket) return;

    setIsLoading(true);
    try {
      // Create sign up with ticket strategy
      console.log("Creating sign up with ticket:", ticket);
      const result = await signUp.create({
        strategy: "ticket",
        ticket,
        password,
      });

      console.log("Sign up result:", result);

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        setStep("success");
        toast.success("Account created successfully!");
        setTimeout(() => {
           router.push("/dashboard/appointments?payment=success");
        }, 1500);
      } else {
        console.error("Sign up incomplete:", result);
        toast.error("Could not complete sign up. Please try again.");
      }
    } catch (err: any) {
      console.error("Sign up error:", err);
      toast.error(err.errors?.[0]?.message || "Failed to create account");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isLoaded || !signUpLoaded || step === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (step === "check_email") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Check Your Email</CardTitle>
            <CardDescription className="text-center">
              {email ? `We sent an invitation to ${email}.` : "We sent you an invitation."}
              <br />
              Please click the link in the email to complete your account setup.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center flex-col gap-4">
             <div className="bg-muted p-4 rounded-md text-sm text-center">
                <p><strong>Note:</strong> Your appointment has been secured.</p>
             </div>
             <Button variant="outline" onClick={() => router.push("/")}>
               Return to Home
             </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "success") {
      return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md border-green-200 bg-green-50 dark:bg-green-900/10">
          <CardHeader>
            <CardTitle className="text-2xl text-center text-green-700">Account Created!</CardTitle>
            <CardDescription className="text-center">
              Redirecting you to your dashboard...
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
             <Loader2 className="h-8 w-8 animate-spin text-green-600" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Complete Account Setup</CardTitle>
          <CardDescription className="text-center">
            Set a password to finish creating your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Create Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Minimum 8 characters"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                "Create Account & View Booking"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
