# Changelog

All notable changes to River City Mobile Detailing are documented in this file.

## [0.1.0] - 2026-06-04

### Added

- Added admin-managed vehicle types with inline creation from service pricing.
- Added per-vehicle-type pricing, availability, and appointment duration for services, subscriptions, and add-ons.
- Added vehicle search and classification using FuelEconomy.gov with NHTSA vPIC fallback.
- Added reusable vehicle autocomplete across onboarding and booking flows.
- Added optional customer before-photo uploads backed by Cloudflare R2.
- Added an admin before-photo gallery grouped by vehicle with full-size previews.
- Added before-photo counts and direct appointment links to admin booking email and SMS notifications.
- Added Radar-backed address selection and server-verified travel fee calculation.
- Added travel fees that begin at $40 for 25 miles and increase by $40 for each additional 50-mile band.
- Added a 12-hour minimum booking lead time and duration-aware 30-minute travel buffers between appointments.
- Added dedicated pages for creating and editing services.

### Changed

- Refactored product creation from fixed Small, Medium, and Large pricing fields to a vehicle-type pricing editor.
- Updated booking totals and durations to use the selected vehicle, service pricing matrix, add-ons, pet fees, and travel fees.
- Updated onboarding to collect personal information, Radar-verified service address, and searchable vehicles in a shorter flow.
- Updated dashboard appointment booking to default to the customer's saved address while allowing a new Radar-verified address.
- Kept legacy Small, Medium, and Large pricing fields populated for landing-page and rollout compatibility.
- Upgraded Convex from 1.31.2 to 1.40.0.

### Fixed

- Prevented low-confidence vehicle classifications from silently receiving Car pricing.
- Prevented appointment slots from overlapping when service duration, pet-fee time, and travel buffers are considered.
- Fixed vehicle autocomplete so searches work without entering a year first and results close after selection.
- Fixed onboarding authentication and redirect loops.
- Fixed dashboard invoice queries running before Convex authentication is ready.
- Improved preview authentication and deployment stability.
