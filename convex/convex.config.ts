import { defineApp } from "convex/server";
import resend from "@convex-dev/resend/convex.config.js";
import workflow from "@convex-dev/workflow/convex.config.js";
import stripe from "@convex-dev/stripe/convex.config.js";

const app = defineApp();
app.use(resend);
app.use(workflow);
app.use(stripe);

export default app;
