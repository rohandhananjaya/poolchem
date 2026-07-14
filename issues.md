# GDPR / Privacy Compliance Issues

> Generated from codebase audit — 2026-07-11

---

## Critical Gaps (High Priority)

### 1. Cookie Consent Banner

**Status:** ❌ Missing
**Files involved:** `src/app/layout.tsx` (needs new component)

No cookie consent banner exists. Supabase auth session cookies (`sb-*-auth-token`) are set via `@supabase/ssr`. While arguably essential/functional, no notice is given to users.

### 2. Privacy Policy Page

**Status:** ❌ Missing  
**Files involved:** New route needed at `src/app/privacy/page.tsx`

No privacy policy page exists. Must disclose:
- What personal data is collected (email, name, phone, address)
- How it is used (authentication, service delivery, billing)
- Legal basis (contractual necessity, legitimate interest, consent)
- Data retention period
- Users' rights (access, rectification, erasure, portability, objection)
- Third-party data processors (Supabase, Stripe, Google OAuth)

### 3. Terms of Service Page

**Status:** ❌ Missing  
**Files involved:** New route needed at `src/app/terms/page.tsx`

### 4. Footer Links to Privacy / Terms

**Status:** ❌ Missing  
**Files involved:** `src/app/page.tsx:238-246`, `src/app/(dashboard)/layout.tsx`

Current footer only shows: `"© 2026 PoolBench. Water chemistry, handled."` — no links to privacy policy or terms of service.

### 5. Self-Service Account Deletion (Right to Erasure — Art. 17)

**Status:** ❌ Missing  
**Files involved:** `src/components/profile/ProfileForms.tsx`, `src/app/(dashboard)/profile/actions.ts`

Users (TECH/OWNER roles) cannot delete their own accounts. Only SUPER_ADMIN can delete users via the admin panel (`src/app/(dashboard)/admin/companies/actions.ts:217-247`). Homeowners have no login but their personal data (email, phone) is stored in the Pool model with no means to request deletion.

### 6. Data Export / Portability (Right of Access — Art. 15, Art. 20)

**Status:** ❌ Missing  
**Files involved:** `src/components/profile/ProfileForms.tsx`, `src/app/(dashboard)/profile/actions.ts`

No mechanism exists for a user to download their personal data.

---

## Medium Priority

### 7. Google OAuth Consent Notice

**Status:** ❌ Missing  
**Files involved:** `src/app/login/page.tsx:43`

Google OAuth is used for sign-in. The Google sign-in redirect happens immediately with no notice that Google will process personal data (email, name, avatar).

### 8. External QR Code Service

**Status:** ❌ Missing disclosure  
**Files involved:** `src/app/(dashboard)/visits/[visitId]/report/page.tsx:115`

An external service (`api.qrserver.com`) is called from the browser to generate QR codes. This should be either replaced with a self-hosted solution or disclosed.

### 9. Data Retention Policy (Art. 5(1)(e))

**Status:** ❌ Missing  
**Files involved:** `prisma/schema.prisma`, new script needed

No data retention logic exists. The schema has no `deletedAt` or archival fields. Data persists indefinitely until manually deleted by SUPER_ADMIN.

### 10. Homeowner Personal Data Management

**Status:** ❌ Missing  
**Files involved:** `prisma/schema.prisma:82-83`, `src/app/pool/[poolToken]/page.tsx`

The `Pool` model stores `homeownerEmail` and `homeownerPhone`. Homeowners have no way to view, update, or request deletion of their personal data. Their data is displayed on the public homeowner dashboard.

---

## Personal Data Inventory

### Database Schema — Personal Data Fields

| File | Line(s) | Field | Data Type |
|---|---|---|---|
| `prisma/schema.prisma` | 35 | `Company.name` | Company name |
| `prisma/schema.prisma` | 37 | `Company.email` | Email address (required) |
| `prisma/schema.prisma` | 38 | `Company.phone` | Phone number (optional) |
| `prisma/schema.prisma` | 39 | `Company.address` | Physical address (optional) |
| `prisma/schema.prisma` | 55 | `User.email` | Email address (required, unique, links to Supabase Auth) |
| `prisma/schema.prisma` | 56 | `User.name` | Full name (required) |
| `prisma/schema.prisma` | 57 | `User.phone` | Phone number (optional) |
| `prisma/schema.prisma` | 75 | `Pool.address` | Physical address (optional) |
| `prisma/schema.prisma` | 82 | `Pool.homeownerEmail` | Homeowner email (optional) |
| `prisma/schema.prisma` | 83 | `Pool.homeownerPhone` | Homeowner phone (optional) |
| `prisma/schema.prisma` | 84 | `Pool.notes` | Free-text notes (may contain PII) |
| `prisma/schema.prisma` | 101 | `ServiceVisit.notes` | Free-text notes (may contain PII) |

### Forms Collecting Personal Data

| File | Line(s) | Data Collected | Context |
|---|---|---|---|
| `src/app/login/page.tsx` | 76-101 | Email, password | Sign-in form |
| `src/components/profile/ProfileForms.tsx` | 119-137 | Name | Personal account update |
| `src/components/profile/ProfileForms.tsx` | 140-174 | Current password, new password | Password change |
| `src/components/profile/ProfileForms.tsx` | 189-231 | Company name, email, phone, address | Company profile (owner only) |
| `src/app/(dashboard)/admin/companies/[companyId]/company-edit-form.tsx` | 145-180 | Company name, email, phone, address | SUPER_ADMIN company edit |
| `src/app/(dashboard)/admin/companies/[companyId]/create-user-dialog.tsx` | 61-99 | Name, email, password, role | SUPER_ADMIN creates user |
| `src/app/(dashboard)/admin/companies/[companyId]/edit-user-dialog.tsx` | 63-88 | Name, role | SUPER_ADMIN edits user |
| `src/components/pools/AddPoolDialog.tsx` | 72-93 | Pool name, address, notes | Pool creation |
| `src/components/pools/EditPoolDialog.tsx` | 84-118 | Pool name, address, notes | Pool editing |

### Public Page Exposing Personal Data

| File | Line(s) | Data Exposed |
|---|---|---|
| `src/app/pool/[poolToken]/page.tsx` | 298-308 | Company phone and email displayed on the **public, no-login** homeowner dashboard |

---

## Third-Party Services

| Service | Purpose | Location | Consent Required |
|---|---|---|---|
| **Supabase** | Auth, database, sessions | `.env`, `src/lib/supabase/` | Essential — disclose in privacy policy |
| **Google OAuth** | Social login | `src/app/login/page.tsx:43` | **YES** — processes email, name, avatar |
| **QR Server API** | QR code generation | `src/app/(dashboard)/visits/[visitId]/report/page.tsx:115` | **YES** — external browser call |
| **Stripe** | Subscriptions/payments | `prisma/schema.prisma:41-42` (schema fields) | Data processor — needs DPA, disclose |

---

## Already Compliant

| Item | Status |
|---|---|
| **SUPER_ADMIN account deletion** | ✅ Exists (admin-only, service-role key) |
| **Service-role key exposure** | ✅ Server-only, not exposed to client |
