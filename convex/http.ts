import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { resend } from "./emails";

const http = httpRouter();

// Stripe webhook endpoint
http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response("Missing Stripe signature", { status: 400 });
    }

    try {
      await ctx.runAction(api.payments.handleWebhook, {
        body,
        signature,
      });

      return new Response("Webhook processed", { status: 200 });
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response("Webhook error", { status: 400 });
    }
  }),
});

// Resend webhook endpoint for email status tracking
http.route({
  path: "/resend-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    return await resend.handleResendEventWebhook(ctx, req);
  }),
});

export default http;
