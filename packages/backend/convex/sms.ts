"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { components } from "./_generated/api";
import { Twilio } from "@convex-dev/twilio";
import type { HttpRouter } from "convex/server";

type TwilioFromOptions = {
  defaultFrom?: string;
};

function hasTwilioCredentials(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim(),
  );
}

let twilioClient: Twilio<TwilioFromOptions> | null = null;

function getTwilioClient(): Twilio<TwilioFromOptions> | null {
  if (!hasTwilioCredentials()) {
    return null;
  }
  if (!twilioClient) {
    twilioClient = new Twilio<TwilioFromOptions>(components.twilio, {
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID?.trim(),
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN?.trim(),
      defaultFrom: process.env.TWILIO_FROM_NUMBER?.trim(),
    });
  }
  return twilioClient;
}

function shouldSkipSms(): boolean {
  return process.env.CONVEX_TEST === "true" || process.env.NODE_ENV === "test";
}

export function registerTwilioRoutes(http: HttpRouter): void {
  const client = getTwilioClient();
  if (!client) {
    console.warn(
      "[sms] Skipping Twilio route registration: missing TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN",
    );
    return;
  }
  client.registerRoutes(http);
}

export const sendSms = internalAction({
  args: {
    to: v.string(),
    body: v.string(),
    from: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (shouldSkipSms()) return null;

    const defaultFrom = process.env.TWILIO_FROM_NUMBER?.trim();
    const from = args.from?.trim() || defaultFrom;
    if (!from) {
      throw new Error(
        "TWILIO_FROM_NUMBER is not configured and no from number was provided",
      );
    }

    const client = getTwilioClient();
    if (!client) {
      throw new Error(
        "Missing Twilio credentials: set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN",
      );
    }

    await client.sendMessage(ctx, {
      from,
      to: args.to,
      body: args.body,
    });

    return null;
  },
});
