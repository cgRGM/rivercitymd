import { describe, expect, test } from "vitest";
import { ConvexError } from "convex/values";
import { getErrorMessage } from "./errors";

describe("getErrorMessage", () => {
  test("extracts message from ConvexError object payload", () => {
    const error = new ConvexError({
      code: "SERVICE_NOT_BOOKABLE",
      message: 'Service "Steam clean" is not available for Car.',
    });
    expect(getErrorMessage(error, "Fallback")).toBe(
      'Service "Steam clean" is not available for Car.',
    );
  });

  test("extracts message from ConvexError string payload", () => {
    const error = new ConvexError("Outside business hours");
    expect(getErrorMessage(error, "Fallback")).toBe("Outside business hours");
  });

  test("extracts message from plain object containing Convex error data", () => {
    const error = {
      data: {
        code: "TIME_SLOT_UNAVAILABLE",
        message: "Selected time is no longer available.",
      },
      message: "[CONVEX M(payments:createBookingCheckout)] Server Error Called by client",
    };
    expect(getErrorMessage(error, "Fallback")).toBe(
      "Selected time is no longer available.",
    );
  });

  test("extracts message from standard Error when message is clear", () => {
    const error = new Error("Invalid promo code");
    expect(getErrorMessage(error, "Fallback")).toBe("Invalid promo code");
  });

  test("uses fallback when message is a generic Convex server error wrapper", () => {
    const error = new Error("[CONVEX M(appointments:update)] Server Error Called by client");
    expect(getErrorMessage(error, "Failed to update appointment")).toBe(
      "Failed to update appointment",
    );
  });

  test("uses fallback for null or undefined errors", () => {
    expect(getErrorMessage(null, "Default error")).toBe("Default error");
    expect(getErrorMessage(undefined, "Default error")).toBe("Default error");
  });
});
