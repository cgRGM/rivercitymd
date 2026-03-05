import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

type ConvexFunctionType =
  | "query"
  | "mutation"
  | "internalQuery"
  | "internalMutation"
  | "action"
  | "internalAction";

type FunctionContext = {
  functionName: string;
  functionType: ConvexFunctionType;
  depth: number;
};

const FORBIDDEN_FUNCTION_TYPES = new Set<ConvexFunctionType>([
  "query",
  "mutation",
  "internalQuery",
  "internalMutation",
]);

function countBraceDelta(line: string): number {
  const opens = (line.match(/{/g) || []).length;
  const closes = (line.match(/}/g) || []).length;
  return opens - closes;
}

function collectViolations(filePath: string): string[] {
  const source = fs.readFileSync(filePath, "utf8");
  const lines = source.split(/\r?\n/);
  const violations: string[] = [];
  let context: FunctionContext | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!context) {
      const exportMatch = line.match(
        /^export const (\w+)\s*=\s*(query|mutation|internalQuery|internalMutation|action|internalAction)\s*\(/,
      );
      if (exportMatch) {
        context = {
          functionName: exportMatch[1],
          functionType: exportMatch[2] as ConvexFunctionType,
          depth: 0,
        };
      }
    }

    if (
      context &&
      FORBIDDEN_FUNCTION_TYPES.has(context.functionType) &&
      (line.includes("fetch(") || line.includes("stripeApiCall("))
    ) {
      const callName = line.includes("stripeApiCall(")
        ? "stripeApiCall("
        : "fetch(";
      violations.push(
        `${path.basename(filePath)}:${index + 1} ${context.functionType} ${context.functionName} uses ${callName}`,
      );
    }

    if (context) {
      context.depth += countBraceDelta(line);
      if (context.depth <= 0) {
        context = null;
      }
    }
  }

  return violations;
}

describe("convex forbidden network calls", () => {
  test("queries and mutations do not call fetch/stripeApiCall", () => {
    const convexDir = path.resolve(__dirname);
    const files = fs
      .readdirSync(convexDir)
      .filter((file) => file.endsWith(".ts"))
      .filter((file) => !file.endsWith(".test.ts"))
      .filter((file) => file !== "test.setup.ts")
      .filter((file) => !file.startsWith("_generated"));

    const violations = files.flatMap((file) =>
      collectViolations(path.join(convexDir, file)),
    );

    expect(violations).toEqual([]);
  });
});
