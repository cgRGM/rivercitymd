# River City Mobile Detailing

A comprehensive web application for managing a mobile car detailing business. River City Mobile Detailing connects customers with professional detailers who come directly to customers' locations for convenient, high-quality vehicle detailing services.

## Features

### Public Marketing Website

- Professional landing page showcasing detailing services
- Service offerings: Quick Clean, Full Detail, Paint Correction, Ceramic Coating, Interior Detail, and Subscription Plans
- Pricing information and customer testimonials
- Contact forms and business information

### Customer Portal (Dashboard)

- **Appointment Booking**: Schedule mobile detailing services at your preferred location
- **Vehicle Management**: Add and manage multiple vehicles (year, make, model, license plate, notes)
- **Appointment Tracking**: View upcoming and past appointments with full details
- **Invoice Management**: Access billing history and payment records
- **Review System**: Rate and review completed services
- **Profile Management**: Update personal information and preferences

### Admin Portal

- **Appointment Management**: View, confirm, reschedule, and complete customer appointments
- **Customer Management**: Track customer history, service frequency, and spending
- **Service Catalog**: Create and manage detailing services with pricing tiers
- **Analytics Dashboard**: Business metrics, popular services, revenue tracking
- **Payment Processing**: Handle Stripe payments and invoice generation
- **Business Settings**: Configure availability, notifications, and business information

### Core Business Logic

- **Mobile Service Model**: Technicians travel to customer locations (not a traditional shop)
- **Availability Management**: Business hours and blocked time slots
- **Pricing Structure**: Base prices with size-based adjustments (small/medium/large vehicles)
- **Subscription Plans**: Recurring service discounts
- **Payment Integration**: Stripe for secure payment processing
- **Communication**: In-app chat between customers and admins
- **Review & Rating System**: Customer feedback for service quality

## Tech Stack

- **Web**: Next.js with React, TypeScript, Tailwind CSS, and shadcn/ui components
- **Mobile**: Expo native-bare React Native app with Expo Router and React Native Reusables
- **Backend**: Convex (serverless database with real-time capabilities), shared by web and mobile
- **Authentication**: Clerk + Convex with role-based access (admin vs client), including Clerk native auth UI
- **Database**: Convex with tables for users, vehicles, appointments, services, invoices, reviews, etc.
- **File Storage**: Convex storage for business logos and customer images
- **Payments**: Stripe integration for secure payment processing
- **Real-time Features**: Live appointment updates, chat messaging

## Getting Started

### Prerequisites

- Node.js 22.13+
- pnpm 11+
- Convex account
- Xcode or Android Studio for native builds (optional)

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd rivercitymd
```

2. Install dependencies:

```bash
pnpm install
```

3. Configure the web environment:

```bash
cp apps/web/.env.example apps/web/.env.local
```

Fill in the values in `apps/web/.env.local` using the variables below.

4. Set up or connect the Convex deployment:

```bash
pnpm dev:backend
```

5. Run the web app:

```bash
pnpm dev:web
```

To run the mobile app, copy `apps/native/.env.example` to `apps/native/.env`, set both public keys, then use a development build:

```bash
pnpm dev:native
pnpm --filter native ios     # or: pnpm --filter native android
```

### Workspace Commands

- **Development**: `pnpm dev` (runs package dev tasks), `pnpm dev:web`, `pnpm dev:native`, `pnpm dev:backend`
- **Build**: `pnpm build`
- **Lint**: `pnpm check`
- **Typecheck**: `pnpm typecheck`
- **Test**: `pnpm test`
- **Native UI validation**: `pnpm dlx @react-native-reusables/cli@latest doctor --cwd apps/native --summary`

## Project Structure

```
├── apps/
│   ├── web/              # Existing Next.js web app and shadcn/ui components
│   └── native/           # Expo native-bare app and React Native Reusables UI
├── packages/
│   ├── backend/          # Shared Convex functions, schema, and generated API
│   ├── config/           # Shared TypeScript configuration
│   └── env/              # Explicit web/native environment modules
├── turbo.json            # Workspace task graph
└── pnpm-workspace.yaml   # Workspace package boundaries
```

The native app imports `@rivercitymd/backend/convex/_generated/api`, so mobile screens use the same typed Convex functions as the web app without duplicating backend logic.

## Database Schema

The application uses Convex with the following main tables:

- `users` - Customer and admin accounts
- `vehicles` - Customer vehicles to be detailed
- `services` - Available detailing services
- `appointments` - Scheduled service appointments
- `invoices` - Billing and payment records
- `reviews` - Customer feedback
- `chatMessages` - Communication between customers and admins
- `businessInfo` - Business configuration and settings

## Authentication

The app uses Clerk for authentication and Convex for application data/authorization:

- **Clients**: Can book appointments, manage vehicles, view invoices
- **Admins**: Full access to business management, customer data, analytics

### Authentication Setup

#### Environment Variables

**Convex Environment Variables:**

Add these to your Convex environment:

- `CONVEX_SITE_URL`: Your Convex deployment URL (e.g., `https://your-project.convex.cloud`)
- `STRIPE_SECRET_KEY`: Your Stripe secret key for payment processing

**Next.js Environment Variables:**

Add these to your `.env.local` file:

- `NEXT_PUBLIC_SITE_URL`: Your production site URL for SEO metadata (Open Graph, structured data, sitemap)
  - Current (Vercel): `https://your-app.vercel.app`
  - Production: `https://rivercitymd.com`
  - Used for: Social media previews, structured data, canonical URLs

#### Clerk + Convex Configuration

Authentication is powered by Clerk in the web and native apps and synchronized into Convex in `packages/backend/convex/auth.ts`, `packages/backend/convex/users.ts`, and `packages/backend/convex/http.ts`.

Required web environment variables include:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLERK_WEBHOOK_SECRET`
- `NEXT_PUBLIC_CONVEX_URL`

For the native app, set these in `apps/native/.env`:

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_CONVEX_URL` (use your computer's LAN IP for local device development, not `localhost`)

The native auth screens use Clerk's `AuthView` from `@clerk/expo/native`. This is a native component and requires `expo-dev-client` plus an iOS/Android development build; it is not available in Expo Go. Enable Clerk's Native API and register the app's iOS bundle ID / Android package name in the Clerk Dashboard before testing sign-in.

### Webhook Endpoints

Configure these server endpoints in production:

- Stripe: `/stripe/webhook`
- Clerk: `/clerk-users-webhook`
- Resend: `/resend-webhook`

Recommended Stripe event subscriptions for `/stripe/webhook`:

- `checkout.session.completed`
- `customer.created`
- `customer.updated`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.created`
- `invoice.finalized`
- `invoice.paid`
- `invoice.payment_failed`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

Recommended Clerk event subscriptions for `/clerk-users-webhook`:

- `user.created`
- `user.updated`
- `user.deleted`

#### Troubleshooting Auth Issues

- **Auth initialization failures**: Check Clerk keys and `NEXT_PUBLIC_CONVEX_URL`
- **Sign-in failures**: Verify Clerk users and webhook configuration
- **Guest payment follow-up issues**: Check `/stripe/webhook` logs and the admin webhook health panel
- **Server errors**: Check Convex dashboard for deployment issues or missing env vars

## Payment Processing

Integrated with Stripe for secure payment processing:

- Payment method storage
- Invoice generation
- Subscription management
- Automatic payment processing

## Contributing

1. Follow the code style guidelines in `AGENTS.md`
2. Run `pnpm test` before submitting changes
3. Ensure linting and types pass: `pnpm check && pnpm typecheck`
4. Test the affected app in development mode: `pnpm dev:web` or `pnpm dev:native`

## License

This project is private and proprietary to River City Mobile Detailing.
