# Changelog

All notable changes to the River City Mobile Detailing project are documented in this file, structured by releases and version numbers derived from the repository's git commit history.

---

## [v1.0.4] - 2026-06-18
### Added
- **Editable Customer Vehicles (Admin)**: Expanded the admin Customer Detail page to allow inline editing of customer vehicles (Year, Make, Model, Color, License Plate, Notes). This triggers auto-classification on save to update sizes and types without needing deletion.
- **Service Descriptions at Checkout (Dashboard)**: Made services in the customer dashboard appointment booking summary clickable, revealing a Dialog containing complete service descriptions, matching the public booking flow behavior.

### Fixed
- **HEIC Image Upload Fallbacks**: Fixed HEIC/HEIF photo uploads being rejected with a "client error" when browser MIME types fallback to `application/octet-stream`. Falls back to parsing filename extensions and maps them to `image/heic`/`image/heif` or relaxes backend verification to match.
- **Editable Vehicle Mutation**: Expanded `updateVehicle` mutation in `convex/vehicles.ts` to accept optional `year`, `make`, `model`, and `classification` arguments to support fully updating vehicle profiles rather than forcing delete/recreate.

---

## [v1.0.3] - 2026-06-16
### Added
- **Multi-Vehicle Customer Management**: Added a dialog/form to the admin Customer Detail page to register new vehicles directly to a customer's profile.
- **Inline Vehicle Creation in Edit Appointment**: Added a sub-form to add new vehicles directly when editing an appointment, automatically selecting the newly created vehicle for the appointment and updating the pricing breakdown.

---

## [v1.0.2] - 2026-06-15
### Fixed
- **Relay Upload CORS**: Configured the `/api/r2-upload-relay` route as a public route in Clerk middleware (`proxy.ts`). This resolves the CORS issue when unauthenticated guest users try to upload booking photos.

---

## [v1.0.1] - 2026-06-15
### Added
- **R2 Upload Relay Route**: Added `/api/r2-upload-relay` to relay photo uploads to R2 to avoid client CORS/connection errors.
- **UTV/Side-by-side Classification**: Implemented classification rule for UTV/side-by-side vehicle models (e.g., Can-Am Defender, Maverick) and added unit tests.

### Fixed
- **Upload Failover**: Configured `VehicleLookupCard` to fall back to the relay upload route if direct signed URL upload fails.
- **Booking Flow State Cleanup**: Fully reset forms (including active services, expanded index settings) and cleared local storage keys (`booking-storage`, `selectedAddress`, `appointmentFormData`) when resetting/cancelling the booking flow.

---

## [v1.0.0] - 2026-06-13
### Added
- **Coupon Dashboard**: Built a coupons administration panel (`/admin/coupons`) with stats summaries (total coupons, active coupons, and total redemptions) and a dialog to create/delete coupons on Stripe.
- **On-the-Fly Coupon Creation**: Added a "Quick Discount" selector in Invoice/Appointment details, supporting automatic creation of Stripe coupons on application if they don't exist.
- **Navigation Integration**: Linked the Coupons dashboard in both desktop and mobile sidebars (using Lucide's ticket icon).
- **Contiguous Travel Sliders**: Integrated interactive double-thumb range sliders directly inside Tier 1 and Tier 2 travel fee cards.
- **Smart Range Validation**: Added real-time contiguous validation checks inside travel rules to prevent saving if gaps or overlaps exist between tiers.
- **Appointments Pricing Sync**: Updated appointments list view to show invoice-specific discounted totals and render cancelled appointments as `$0.00` in red alongside crossed-out original prices.
- **Test Coverage**: Added comprehensive integration test suites for coupon voiding, reissuing, and db updates.

---

## [v0.8.0] - 2026-05-15 to 2026-06-12
### Added
- **In-Progress Adjustments**: Supported adjusting services, vehicles, and prices on appointments already marked "in-progress" before invoicing.
- **Booking Photo Previews**: Surfaced vehicle "before" photos and counts directly inside the admin appointment list rows.
- **Trip Log Automation**: Added automated backfills of required trip logs for completed appointments.
- **Isolated Service Editing**: Moved service editing panels to dedicated sub-routes instead of inline modals.

---

## [v0.7.0] - 2026-04-10 to 2026-05-14
### Added
- **Configurable Travel Origin**: Allowed admins to change coordinates and starting addresses for travel calculations.
- **Configurable Travel Rates**: Enabled per-mile rate configuration fields for travel pricing.
- **Travel Buffers**: Added travel buffer times dynamically for long-distance bookings.
- **Out-of-Area Workflow**: Built review workflows and deposit detail reviews for booking drafts outside the service radius.

---

## [v0.6.0] - 2026-03-01 to 2026-04-09
### Added
- **Booking Flow Relocation**: Moved scheduling flow to a clean, public `/book` route.
- **Clerk Public Routes**: Configured middleware to allow unauthenticated access to the booking funnel.
- **Accordion Selection**: Redesigned the vehicles and services selection step into collapsible accordions.
- **Vehicle Suggestion Cleanup**: Removed redundant EPA/NHTSA classification tags from vehicle search suggestions.

---

## [v0.5.0] - 2026-01-24 to 2026-02-28
### Added
- **Vehicle-Size Pricing**: Implemented SUV/Truck/Car pricing tiers for detailing packages and add-ons.
- **Vehicle Filtering**: Filtered available booking products based on selected vehicle types.
- **UI Polish**: Clamped service description lengths in admin lists and resolved duration sync issues.

---

## [v0.4.0] - 2026-01-01 to 2026-01-23
### Added
- **Clerk Auth Migration**: Migrated from custom `@convex-dev/auth` schema to Clerk authentication.
- **Clerk Onboarding**: Set up onboarding redirect layouts and mapped user role permissions to Clerk `publicMetadata`.
- **Role Assignment**: Created organization-based role checking middleware to redirect authenticated users.
- **Webhook Sync**: Added Clerk webhook handlers to create, update, and delete corresponding Convex user records.

---

## [v0.3.0] - 2025-12-08 to 2025-12-31
### Added
- **Radar address autocomplete**: Integrated Radar SDK address selection inside booking modals.
- **Post-Deposit Stripe Invoices**: Automated Stripe invoice creation after deposit payment completes.
- **Integration Test Setup**: Added compatibility mocks for Response objects and fetch endpoints in vitest suites.
- **Unified Address Fields**: Standardized address forms across customer dashboard.

---

## [v0.2.0] - 2025-11-07 to 2025-12-07
### Added
- **Resend Email Integration**: Configured Resend email infrastructure for customer confirmations.
- **Email Testing**: Created localhost mock email delivery tools.
- **Time Slot Blocking**: Implemented 2-hour slot blocking rules for 90-minute services.
- **Business Hours Setup**: Created admin configuration pages for business availability settings.

---

## [v0.1.0] - 2025-10-09 to 2025-11-06
### Added
- **Platform Base**: Initial repository setup and Convex table structures.
- **Booking Funnel**: Developed multi-step booking forms (replacing external cal.com embedding).
- **Stripe Mappings**: Mapped user sign-ups to Stripe customer registration profiles.
- **Admin CRUD**: Built initial user and service management views.
