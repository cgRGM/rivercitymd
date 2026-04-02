export type AppRole = "admin" | "client";

export function getRoleHomePath(role: AppRole, isSetupReady = true) {
  if (role === "admin") {
    return isSetupReady ? "/admin" : "/admin/settings?setup=required";
  }
  return "/dashboard";
}

export function getProtectedRouteRedirect(args: {
  pathname: string;
  role: AppRole;
  isSetupReady?: boolean;
}) {
  const { pathname, role, isSetupReady = true } = args;

  if (role === "admin") {
    if (pathname.startsWith("/dashboard")) {
      return getRoleHomePath(role, isSetupReady);
    }
    if (
      pathname.startsWith("/admin") &&
      !pathname.startsWith("/admin/settings") &&
      !isSetupReady
    ) {
      return "/admin/settings?setup=required";
    }
    return null;
  }

  if (pathname.startsWith("/admin")) {
    return "/dashboard";
  }

  return null;
}

export function getPostVerificationRedirectPath(args: {
  onboardingComplete: boolean;
  paymentSuccess: boolean;
}) {
  if (!args.onboardingComplete) {
    return args.paymentSuccess ? "/onboarding?payment=success" : "/onboarding";
  }

  return args.paymentSuccess
    ? "/dashboard/appointments?payment=success"
    : "/dashboard";
}

export function sanitizeRedirectPath(
  redirectPath: string | null | undefined,
  fallbackPath: string,
) {
  if (!redirectPath) {
    return fallbackPath;
  }

  if (!redirectPath.startsWith("/") || redirectPath.startsWith("//")) {
    return fallbackPath;
  }

  return redirectPath;
}
