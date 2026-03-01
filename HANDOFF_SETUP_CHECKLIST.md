# River City Mobile Detailing - First-Run Setup Checklist

Use this checklist after deployment before enabling public booking.

## 1) Complete Business Information

Go to `/admin/settings` and fill:

- Business name
- Owner name
- Address
- City/State/ZIP
- Country

Expected result:

- Setup checklist marks **Business information** as complete.

## 2) Configure Operating Hours

Go to `/admin/settings` -> Operating hours and configure at least one active day with a minimum 2-hour window.

Notes:

- Closed days should be toggled inactive.
- Public booking default date auto-selects the earliest date with available slots.

Expected result:

- Setup checklist marks **Operating hours** as complete.

## 3) Add at Least One Active Priced Standard Service

Go to `/admin/services` and ensure at least one **standard** service is:

- Active
- Priced above `$0` for at least one vehicle size

Notes:

- Zero-price service configs are blocked in admin forms and backend mutations.

Expected result:

- Setup checklist marks **Priced standard service** as complete.

## 4) Verify Public Booking Readiness

When setup is incomplete:

- Public booking entry buttons from Hero/Pricing/Contact route to `/sign-up`.
- Admin visiting `/admin/*` is redirected to `/admin/settings?setup=required` until setup is complete.

When setup is complete:

- Public booking modal opens normally.
- Preferred date auto-selects to the next bookable date (including skipping closed days).
- Time selection reflects business hours, time blocks, and existing appointments.

## 5) Final Smoke Test (Recommended)

1. From landing page, click **Book Your Detail**.
2. Confirm date auto-fills to earliest valid date.
3. Confirm time options appear and unavailable slots are blocked.
4. Submit booking and confirm appointment/invoice are created.
5. Confirm overlapping start times are blocked with 2-hour minimum spacing.
