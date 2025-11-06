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

- **Frontend**: Next.js 14 with React, TypeScript, Tailwind CSS, shadcn/ui components
- **Backend**: Convex (serverless database with real-time capabilities)
- **Authentication**: Convex Auth with role-based access (admin vs client)
- **Database**: Convex with tables for users, vehicles, appointments, services, invoices, reviews, etc.
- **File Storage**: Convex storage for business logos and customer images
- **Payments**: Stripe integration for secure payment processing
- **Real-time Features**: Live appointment updates, chat messaging

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Convex account

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd rivercitymd
```

2. Install dependencies:

```bash
npm install
```

3. Set up Convex:

```bash
npx convex dev --once
```

4. Configure environment variables:
   - Copy `.env.example` to `.env.local`
   - Add your Convex URL and other required environment variables

5. Run the development server:

```bash
npm run dev
```

### Build Commands

- **Development**: `npm run dev` (runs frontend and backend in parallel)
- **Build**: `npm run build` (Next.js production build)
- **Lint**: `npm run lint` (Next.js ESLint)
- **Test**: `npm run test` (vitest), `npm run test:once` (single run), `npm run test:coverage` (with coverage)

## Project Structure

```
├── app/                    # Next.js app router pages
│   ├── admin/             # Admin dashboard pages
│   ├── dashboard/         # Customer dashboard pages
│   ├── onboarding/        # User onboarding flow
│   └── sign-in/          # Authentication pages
├── components/            # Reusable UI components
│   ├── admin/            # Admin-specific components
│   ├── dashboard/        # Customer dashboard components
│   ├── home/             # Marketing website components
│   └── ui/               # shadcn/ui components
├── convex/               # Backend functions and schema
│   ├── appointments.ts   # Appointment management
│   ├── services.ts       # Service catalog management
│   ├── users.ts          # User management
│   ├── payments.ts       # Payment processing
│   └── schema.ts         # Database schema
└── lib/                  # Utility functions
```

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

The app uses Convex Auth with role-based access control:

- **Clients**: Can book appointments, manage vehicles, view invoices
- **Admins**: Full access to business management, customer data, analytics

## Payment Processing

Integrated with Stripe for secure payment processing:

- Payment method storage
- Invoice generation
- Subscription management
- Automatic payment processing

## Contributing

1. Follow the code style guidelines in `AGENTS.md`
2. Run tests before submitting changes: `npm run test:once`
3. Ensure linting passes: `npm run lint`
4. Test in development mode: `npm run dev`

## License

This project is private and proprietary to River City Mobile Detailing.
