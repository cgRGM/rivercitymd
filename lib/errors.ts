import { ConvexError } from "convex/values";

/**
 * Extracts a clean, human-readable error message from Convex errors,
 * standard Error instances, or unknown error objects.
 *
 * Prefers structured payload data (`error.data.message` or `error.data`)
 * over internal generic wrapper strings like "Server Error Called by client".
 */
export function getErrorMessage(
  error: unknown,
  fallback: string = "An unexpected error occurred",
): string {
  if (!error) return fallback;

  // Handle standard ConvexError instances
  if (error instanceof ConvexError) {
    const data = error.data;
    if (typeof data === "string" && data.trim()) {
      return data.trim();
    }
    if (typeof data === "object" && data !== null) {
      const msg = (data as { message?: unknown }).message;
      if (typeof msg === "string" && msg.trim()) {
        return msg.trim();
      }
    }
  }

  // Handle generic objects or plain error responses containing Convex data
  const anyError = error as { data?: unknown; message?: unknown };
  if (typeof anyError.data === "string" && anyError.data.trim()) {
    return anyError.data.trim();
  }
  if (typeof anyError.data === "object" && anyError.data !== null) {
    const msg = (anyError.data as { message?: unknown }).message;
    if (typeof msg === "string" && msg.trim()) {
      return msg.trim();
    }
  }

  if (typeof anyError.message === "string" && anyError.message.trim()) {
    const msg = anyError.message.trim();
    // Filter out internal generic Convex wrapper messages
    if (
      !msg.includes("Server Error Called by client") &&
      !msg.includes("Uncaught ConvexError") &&
      !msg.startsWith("[CONVEX ")
    ) {
      return msg;
    }
  }

  return fallback;
}
