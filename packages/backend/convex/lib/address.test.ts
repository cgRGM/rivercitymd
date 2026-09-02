import { describe, expect, test } from "vitest";
import { isArkansasState, normalizeStateCode } from "./address";

describe("address helpers", () => {
  test("normalizes Arkansas state names and codes", () => {
    expect(normalizeStateCode("Arkansas")).toBe("AR");
    expect(normalizeStateCode("arkansas")).toBe("AR");
    expect(normalizeStateCode(" AR ")).toBe("AR");
    expect(isArkansasState("Arkansas")).toBe(true);
    expect(isArkansasState("AR")).toBe(true);
    expect(isArkansasState("TN")).toBe(false);
  });
});
