/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as analytics from "../analytics.js";
import type * as appointments from "../appointments.js";
import type * as auth from "../auth.js";
import type * as availability from "../availability.js";
import type * as business from "../business.js";
import type * as chat from "../chat.js";
import type * as http from "../http.js";
import type * as invoices from "../invoices.js";
import type * as reviews from "../reviews.js";
import type * as services from "../services.js";
import type * as users from "../users.js";
import type * as vehicles from "../vehicles.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  analytics: typeof analytics;
  appointments: typeof appointments;
  auth: typeof auth;
  availability: typeof availability;
  business: typeof business;
  chat: typeof chat;
  http: typeof http;
  invoices: typeof invoices;
  reviews: typeof reviews;
  services: typeof services;
  users: typeof users;
  vehicles: typeof vehicles;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
