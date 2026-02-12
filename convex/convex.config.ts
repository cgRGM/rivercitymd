import { defineApp } from "convex/server";
import resend from "@convex-dev/resend/convex.config.js";
import workflow from "@convex-dev/workflow/convex.config.js";
import stripe from "@convex-dev/stripe/convex.config.js";
import workpool from "@convex-dev/workpool/convex.config.js";
import twilio from "@convex-dev/twilio/convex.config.js";

const app = defineApp();
app.use(resend);
app.use(workflow);
app.use(workpool, { name: "notificationsWorkpool" });
app.use(twilio);
app.use(stripe);

export default app;
