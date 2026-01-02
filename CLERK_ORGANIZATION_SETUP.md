# Clerk Organization Setup for Role-Based Access

This document explains how to configure Clerk organizations to enable role-based access control.

## Overview

The application uses Clerk organizations to determine user roles:
- **Users in an organization** → `admin` role → Access to `/admin`
- **Users NOT in an organization** → `client` role → Access to `/dashboard`

## Clerk Dashboard Configuration

### 1. Enable Organizations (if not already enabled)

1. Go to your [Clerk Dashboard](https://dashboard.clerk.com)
2. Navigate to **Organizations** in the sidebar
3. Ensure organizations are enabled for your application

### 2. Configure Organization Settings

1. In the **Organizations** page, click on **Settings**
2. Configure the following:

#### Allow Users Without Organizations
- **Enable**: "Allow users to sign up without joining an organization"
- This allows new users to sign up and access the client dashboard without being part of an organization
- Users can be invited to organizations later to gain admin access

#### Organization Creation
- **Set to**: "Invite-only" or "Admin-only"
- This prevents users from creating their own organizations
- Only admins can invite users to the organization

#### Organization Selection Screen
- **Allow users to skip organization selection**: Enable this option
- This prevents the "choose-organization" redirect that blocks sign-up flow

### 3. Update Session Token Claims (if needed)

If you want organization information in session tokens:

1. Go to **Sessions** page
2. Under **Customize session token**, find the **Claims editor**
3. Add organization ID if needed:
```json
{
  "org_id": "{{org.id}}",
  "metadata": "{{user.public_metadata}}"
}
```

Note: The code already checks `orgId` from the auth object, so this is optional.

## How It Works

### Role Assignment Logic

1. **During Sign-Up**:
   - User signs up with Clerk
   - If user is invited to an organization → `orgId` exists → Role set to `admin`
   - If user is NOT in an organization → No `orgId` → Role set to `client`

2. **During Onboarding**:
   - `createUserProfile` checks `identity.orgId`
   - Sets role to `admin` if in organization, `client` otherwise
   - Updates Convex user record with the role

3. **During Authentication**:
   - `getUserRole` query checks both:
     - Convex user record role
     - Current Clerk organization membership (`identity.orgId`)
   - Returns `admin` if user is in an organization, otherwise uses Convex role

4. **In Middleware**:
   - Checks `orgId` from Clerk auth
   - Routes users based on organization membership
   - Organization members → `/admin`
   - Non-organization users → `/dashboard`

### Flow Examples

#### New Client Sign-Up (No Organization)
1. User signs up → No organization invitation
2. Clerk allows sign-up (if configured to allow users without organizations)
3. User redirected to `/onboarding`
4. User completes onboarding → Role set to `client`
5. User redirected to `/dashboard`

#### Admin Invitation (With Organization)
1. Admin invites user to organization via Clerk Dashboard
2. User receives invitation email
3. User accepts invitation → Joins organization
4. User signs in → `orgId` exists
5. Role automatically set to `admin` (via `getUserRole` or `createUserProfile`)
6. User redirected to `/admin`

## Troubleshooting

### Issue: Users redirected to "choose-organization" page

**Solution**: 
1. Go to Clerk Dashboard → Organizations → Settings
2. Enable "Allow users to sign up without joining an organization"
3. Enable "Allow users to skip organization selection"
4. Save changes

### Issue: Users can't access dashboard without organization

**Solution**:
- Verify organization settings allow users without organizations
- Check that `orgId` check in code is working correctly
- Ensure middleware allows access when `orgId` is null

### Issue: Admin users not getting admin role

**Solution**:
- Verify user is actually in the organization (check Clerk Dashboard)
- Check that `identity.orgId` is available in Convex queries
- Verify `getUserRole` is checking organization membership correctly

## Testing

1. **Test Client Sign-Up**:
   - Sign up without organization invitation
   - Should redirect to `/onboarding`
   - After onboarding, should access `/dashboard`
   - Should NOT see organization selection screen

2. **Test Admin Invitation**:
   - Invite user to organization via Clerk Dashboard
   - User accepts invitation
   - User signs in
   - Should redirect to `/admin`
   - Should have admin role in Convex

3. **Test Role Switching**:
   - User starts as client (no organization)
   - Admin invites user to organization
   - User accepts and signs in again
   - Role should update to `admin`
   - Should redirect to `/admin`

