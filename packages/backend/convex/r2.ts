import { R2 } from "@convex-dev/r2";
import { components } from "./_generated/api";

// `components.r2` is injected when the component is mounted in convex.config.ts.
export const r2 = new R2((components as any).r2);
