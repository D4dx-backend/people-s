# People's Foundation ERP - Complete Project Documentation

> A production-grade, multi-tenant NGO/Charity Management ERP system built for managing beneficiaries, donors, schemes, projects, payments, and organizational operations across multiple franchise organizations.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Multi-Tenancy & Franchise System](#4-multi-tenancy--franchise-system)
5. [Authentication System](#5-authentication-system)
6. [Role-Based Access Control (RBAC)](#6-role-based-access-control-rbac)
7. [Core Modules & Features](#7-core-modules--features)
   - [Dashboard](#71-dashboard)
   - [Beneficiary Management](#72-beneficiary-management)
   - [Application Workflow](#73-application-workflow-engine)
   - [Dynamic Form Builder](#74-dynamic-form-builder)
   - [Scheme Management](#75-scheme-management)
   - [Project Management](#76-project-management)
   - [Donor Management](#77-donor-management)
   - [Donation Tracking](#78-donation-tracking)
   - [Payment System](#79-payment-system)
   - [Recurring Payments](#710-recurring-payments)
   - [Budget & Financial Analytics](#711-budget--financial-analytics)
   - [Interview Management](#712-interview-management)
   - [Committee Approval](#713-committee-approval)
   - [Communications](#714-communications-engine)
   - [Notification System](#715-notification-system)
   - [Location Hierarchy](#716-location-hierarchy)
   - [User Management](#717-user-management)
   - [Website Management (CMS)](#718-website-management-cms)
   - [Global Admin Panel](#719-global-admin-panel)
8. [Reporting & Analytics](#8-reporting--analytics)
9. [Security Features](#9-security-features)
10. [Data Export System](#10-data-export-system)
11. [File Management](#11-file-management)
12. [Theming & Customization](#12-theming--customization)
13. [API Documentation](#13-api-documentation)
14. [Deployment & Infrastructure](#14-deployment--infrastructure)
15. [Database Schema Overview](#15-database-schema-overview)
16. [Project Structure](#16-project-structure)

---

## 1. Project Overview

**People's Foundation ERP** is a comprehensive Enterprise Resource Planning system designed specifically for NGOs, charitable organizations, and social welfare foundations. It provides end-to-end management of beneficiary applications, donor relationships, financial operations, scheme/project administration, and organizational hierarchy -- all within a multi-tenant architecture that supports multiple franchise organizations from a single codebase.

### Key Highlights

- **Multi-Tenant Architecture**: Single deployment serves multiple NGO organizations (franchises) with complete data isolation
- **OTP-Only Authentication**: Passwordless login via WhatsApp/SMS for enhanced security and accessibility
- **Hierarchical RBAC**: 8-level role hierarchy with 100+ granular permissions and scope-based access
- **Dynamic Form Builder**: Visual WYSIWYG form designer with conditional logic, scoring rules, and multi-page support
- **Complete Application Lifecycle**: Draft > Submit > Review > Interview > Committee Approval > Disbursement > Renewal
- **Multi-Channel Communications**: Integrated WhatsApp, SMS, Email, and Push Notification support
- **Donor CRM**: Full donor lifecycle management with follow-ups, reminders, engagement scoring, and analytics
- **Financial Management**: Multi-level payment approvals, recurring payments, budget tracking, and donation reconciliation
- **Cross-Franchise Operations**: Admins managing multiple organizations can switch and view data across franchises

---

## 2. Tech Stack

### Backend

| Technology | Purpose |
|---|---|
| **Node.js** (>=18.0.0) | Runtime environment |
| **Express.js** 4.18 | Web framework |
| **MongoDB Atlas** | Cloud database |
| **Mongoose** 8.0 | ODM / Schema management |
| **JWT** (jsonwebtoken) | Token-based authentication |
| **Firebase Admin** 13.6 | Push notifications |
| **AWS SDK** / DigitalOcean Spaces | Cloud file storage (S3-compatible) |
| **Nodemailer** | Email delivery (Gmail SMTP) |
| **PDFKit** | Server-side PDF generation (receipts, reports) |
| **Multer** | File upload handling |
| **Helmet.js** | HTTP security headers |
| **Express-validator** / **Joi** | Request validation |
| **Swagger UI Express** | Interactive API documentation |
| **Node-cron** | Scheduled tasks (reminders, recurring payments) |
| **Morgan** | HTTP request logging |
| **Jest** + **Supertest** | Testing framework |

### Frontend

| Technology | Purpose |
|---|---|
| **React** 18.3 | UI framework |
| **TypeScript** 5.8 | Type-safe development |
| **Vite** 5.4 | Build tool & dev server |
| **Tailwind CSS** 3.4 | Utility-first styling |
| **Shadcn/ui** (Radix UI) | Component library (56 components) |
| **React Router** 6.30 | Client-side routing |
| **TanStack React Query** 5.83 | Server state management & caching |
| **React Hook Form** + **Zod** | Form handling & schema validation |
| **Recharts** | Data visualization & charts |
| **Lucide React** | Icon library |
| **Sonner** | Toast notifications |
| **jsPDF** + **jspdf-autotable** | Client-side PDF generation |
| **date-fns** | Date manipulation |
| **Embla Carousel** | Carousel component |
| **Next Themes** | Dark mode support |

### Infrastructure

| Service | Purpose |
|---|---|
| **DigitalOcean App Platform** | Backend hosting |
| **Netlify** | Frontend hosting with CDN |
| **MongoDB Atlas** | Managed database |
| **DigitalOcean Spaces** (BLR1) | File/asset storage |
| **DXing** | SMS & WhatsApp API provider |
| **Gmail SMTP** | Transactional email |
| **Firebase Cloud Messaging** | Push notifications |

---

## 3. Architecture

### High-Level Architecture

```
                    ┌──────────────────────┐
                    │    Netlify (CDN)      │
                    │  React SPA Frontend   │
                    └──────────┬───────────┘
                               │ HTTPS
                               ▼
                    ┌──────────────────────┐
                    │  DigitalOcean App     │
                    │  Express.js API       │
                    │  ┌────────────────┐   │
                    │  │ Tenant Resolver│   │
                    │  │ Auth Middleware│   │
                    │  │ RBAC Middleware│   │
                    │  │ Route Handlers │   │
                    │  └────────────────┘   │
                    └──┬───┬───┬───┬───────┘
                       │   │   │   │
              ┌────────┘   │   │   └────────┐
              ▼            ▼   ▼            ▼
        ┌──────────┐ ┌────────┐ ┌───────┐ ┌──────────┐
        │ MongoDB  │ │ DO     │ │ DXing │ │ Firebase │
        │ Atlas    │ │ Spaces │ │ SMS/  │ │ FCM      │
        │          │ │ (S3)   │ │ WA    │ │          │
        └──────────┘ └────────┘ └───────┘ └──────────┘
```

### Middleware Pipeline

Every API request flows through this pipeline:

```
Request → Helmet (Security) → CORS → Compression → Morgan (Logging)
  → Tenant Resolver (Franchise Identification)
  → JWT Authentication
  → RBAC Permission Check
  → Regional Scope Validation
  → Activity Logger
  → Controller Handler
  → Response
```

### Key Architectural Patterns

| Pattern | Implementation |
|---|---|
| **Multi-Tenancy** | Franchise model with Mongoose plugin for automatic query scoping |
| **RBAC** | Role → Permission mapping with inheritance and scope-based filtering |
| **OTP Authentication** | Passwordless via WhatsApp/SMS with static OTP for dev |
| **Franchise Isolation** | Mongoose pre-hooks enforce franchise filters on all queries |
| **Cross-Franchise** | Multi-franchise users can read across franchises, write to primary |
| **Eligibility Scoring** | Rule-based scoring engine evaluates form responses against thresholds |
| **Multi-Level Approval** | Payments escalate through unit → area → district → state → finance |
| **Event Logging** | All CRUD operations logged with severity levels |

---

## 4. Multi-Tenancy & Franchise System

The system supports multiple NGO organizations (called "franchises") from a single deployment with complete data isolation.

### Franchise Model

Each franchise has:
- **Identity**: Unique slug (used as subdomain), display name, registration number
- **Custom Domains**: Support for multiple custom domains per franchise
- **Branding**: Logo, color theme, tagline, about text, social media links
- **Feature Flags**: Enable/disable specific modules per franchise
- **Limits**: Max users, max beneficiaries, storage quota
- **Integration Config**: Per-franchise SMS, email, and payment gateway settings

### Tenant Resolution

The system identifies the active franchise through a priority chain:

1. **Custom Domain Lookup** -- e.g., `erp.peoplefoundation.org` maps to a franchise
2. **Subdomain Extraction** -- e.g., `people.peopleerp.com` extracts slug `people`
3. **HTTP Header** -- `X-Franchise-Slug` header (for API testing / dev tools)
4. **Environment Fallback** -- `DEFAULT_FRANCHISE_SLUG` env var for local development

### Data Isolation

- A **Mongoose plugin** (`franchisePlugin`) is applied to all tenant-scoped models
- Adds a `franchise` field (ObjectId, indexed) to every document
- Pre-query hooks automatically inject franchise filter into `find`, `findOne`, `update`, `delete`, and aggregation operations
- **Strict Mode**: When `FRANCHISE_STRICT=true`, unfiltered queries throw errors (for testing/auditing)
- Write operations always target the user's primary franchise (`req.franchiseId`)

### Cross-Franchise Access

District, Area, and Unit admins who operate across multiple franchises get:
- `req.isCrossFranchise = true`
- `req.crossFranchiseIds` = array of accessible franchise IDs
- A franchise filter dropdown in the UI to switch views
- Read access across all assigned franchises, write access to primary franchise only

### Global (Non-Scoped) Models

Some data is shared across all franchises:
- **Locations** (State → District → Area → Unit hierarchy)
- **Users** (global identity; franchise-specific roles via `UserFranchise` junction table)

---

## 5. Authentication System

The system uses **OTP-only (passwordless) authentication** for enhanced security and accessibility.

### Authentication Flow

```
User enters phone number
  → System generates 6-digit OTP
  → OTP sent via WhatsApp (primary) or SMS (fallback)
  → User enters OTP
  → System verifies OTP + loads franchise-specific role
  → JWT access token + refresh token issued
  → User redirected to role-appropriate dashboard
```

### Three Separate Auth Flows

| Flow | Users | Endpoint |
|---|---|---|
| **Super/State Admin** | Super Admin, State Admin | `/api/auth/send-otp`, `/api/auth/verify-otp` |
| **Regional Admin** | District, Area, Unit admins, Coordinators | `/api/regional-admin/auth/*` |
| **Beneficiary** | Beneficiary end-users | `/api/beneficiaries/auth/*` |

### Security Measures

- **Rate Limiting**: Maximum 1 OTP per minute, 5 OTPs per day per phone number
- **Account Lockout**: 5 failed verification attempts triggers 2-hour lock
- **Token Expiry**: Access tokens expire in 7 days (configurable)
- **Refresh Tokens**: Separate longer-lived refresh tokens for seamless re-authentication
- **Static OTP**: `123456` available only in development mode (runtime-checked)
- **JWT Payload**: Contains userId, role, adminScope, franchiseId, isSuperAdmin flag

### Token Structure

```json
{
  "userId": "ObjectId",
  "email": "user@example.com",
  "phone": "+91XXXXXXXXXX",
  "role": "district_admin",
  "adminScope": {
    "level": "district",
    "regions": ["districtId1"],
    "projects": [],
    "schemes": []
  },
  "franchiseId": "ObjectId",
  "isSuperAdmin": false
}
```

---

## 6. Role-Based Access Control (RBAC)

### Role Hierarchy

```
Level 0: super_admin        ← Full platform access, bypasses all checks
Level 1: state_admin         ← Full access within assigned state
Level 2: district_admin      ← District-scoped access, can span franchises
Level 3: area_admin           ← Area/block-scoped access
Level 4: unit_admin           ← Unit/village-scoped access
Level 5: project_coordinator  ← Project-specific access
Level 5: scheme_coordinator   ← Scheme-specific access
Level 6: beneficiary          ← Self-service portal access only
```

### Permission Model

Permissions follow the format: `module.action` or `module.action.scope`

**Examples:**
- `applications.read.all` -- Read all applications (global scope)
- `applications.read.regional` -- Read applications within assigned region only
- `applications.approve` -- Approve applications
- `schemes.create` -- Create new schemes
- `finances.read.regional` -- View financial data within region
- `donors.manage` -- Full donor management access
- `users.manage` -- User administration access

### Permission Features

- **100+ system permissions** organized by module (users, applications, schemes, donations, etc.)
- **Permission Inheritance**: Child roles inherit from parent roles
- **Implied Permissions**: Granting `applications.manage` may imply `applications.read`
- **Conflicting Permissions**: Mutual exclusion rules (e.g., cannot have both approve and self-approve)
- **Time Restrictions**: Permissions can be limited to specific hours/days
- **IP Restrictions**: Permissions can be limited to specific IP ranges
- **Field-Level Access**: Read-only, write, or hidden per field per permission
- **Security Levels**: public, internal, confidential, restricted, top_secret
- **Audit Trail**: Sensitive permissions require audit logging

### Scope-Based Access

Each user's access is constrained by their **admin scope**:

```json
{
  "level": "district",
  "regions": ["districtObjectId1", "districtObjectId2"],
  "districts": [],
  "areas": [],
  "units": [],
  "projects": ["projectId1"],
  "schemes": ["schemeId1"]
}
```

All data queries are automatically filtered by the user's scope, ensuring they only see data within their jurisdiction.

### UserRole Junction Model

The `UserRole` model links users to roles with:
- **Scope Assignment**: Which regions, projects, or schemes the role applies to
- **Temporal Constraints**: `validFrom` and `validUntil` dates for time-bound roles
- **Approval Workflow**: Roles can require approval (pending → approved → active)
- **Delegation**: Users can temporarily delegate their role to another user
- **Additional/Restricted Permissions**: Per-assignment permission overrides
- **History Tracking**: All modifications are logged with timestamps and reasons

---

## 7. Core Modules & Features

### 7.1 Dashboard

**Admin Dashboard** displays:
- **Key Metrics Cards**: Total Projects, Total Applications, Total Beneficiaries, Budget Utilization %
- **Recent Applications**: Latest 5 applications with status, beneficiary, and date
- **Financial Summary**: Total budget, allocated, disbursed, pending, available balance, donations
- **Top Projects**: Top 3 projects by budget with utilization percentage
- All data is permission-gated -- users only see metrics they have access to

**Beneficiary Dashboard** displays:
- **Application Summary**: Counts by status (submitted, under review, approved, rejected, completed)
- **Approved Amounts**: Total approved payment amounts
- **Renewal Status**: Applications due for renewal with warning indicators
- **Quick Actions**: Apply for new scheme, Track application, Renew application

---

### 7.2 Beneficiary Management

- **Registration**: OTP-based self-registration with profile completion workflow
- **Profile Management**: Name, phone, location (state/district/area/unit), documents
- **Verification**: Admin-verified status with `verifiedBy` and `verifiedAt` tracking
- **Application Access**: Beneficiaries can view and apply for eligible schemes
- **Self-Service Portal**: Dedicated login, dashboard, application tracking, and renewal
- **Location Filtering**: Beneficiaries filtered by geographic hierarchy
- **Export**: CSV/PDF export of beneficiary data

---

### 7.3 Application Workflow Engine

The application system is the core of the ERP, featuring a multi-stage approval workflow:

#### Application Lifecycle

```
┌─────────┐   ┌─────────┐   ┌──────────────┐   ┌──────────────────────┐
│  Draft   │──▶│ Pending │──▶│ Under Review │──▶│ Field Verification   │
│(auto-save│   │         │   │              │   │ (optional)           │
│ every 30s│   └─────────┘   └──────────────┘   └──────────────────────┘
└─────────┘                                                │
                                                           ▼
┌───────────┐   ┌────────────────────────┐   ┌──────────────────────────┐
│ Approved  │◀──│ Committee Approval     │◀──│ Interview Completed      │
│           │   │ (if required)          │   │                          │
└─────┬─────┘   └────────────────────────┘   └──────────────────────────┘
      │                                                    ▲
      ▼                                                    │
┌───────────┐                                 ┌──────────────────────────┐
│ Disbursed │                                 │ Interview Scheduled      │
│(payments) │                                 │ (online / offline)       │
└─────┬─────┘                                 └──────────────────────────┘
      │
      ▼
┌───────────┐   ┌───────────┐
│ Completed │   │  Renewal  │──▶ (New application cycle)
└───────────┘   └───────────┘
```

#### Key Features

- **Draft Auto-Save**: Applications auto-save every 30 seconds with page-level progress tracking
- **Multi-Page Forms**: Dynamic forms configured per scheme via Form Builder
- **Eligibility Scoring**: Automated scoring engine evaluates responses against scheme-defined rules
- **Auto-Rejection**: Applications scoring below threshold are automatically rejected
- **Stage-Based Workflow**: Custom stages per scheme with role-based transitions
- **Stage Comments & Documents**: Each stage can have comments and required document uploads
- **Modification History**: Post-approval amount modifications tracked with full audit trail
- **Application Number**: Auto-generated unique identifier per franchise
- **Distribution Timeline**: Installment-based payment schedule generated on approval
- **Renewal System**: Applications can expire and be renewed, linking to parent application

---

### 7.4 Dynamic Form Builder

A visual WYSIWYG form designer for creating application forms per scheme.

#### Capabilities

- **Page-Based Structure**: Forms organized into multiple pages with titles and descriptions
- **30+ Field Types**: text, textarea, email, phone, number, date, select, radio, checkbox, file upload, matrix (table), and more
- **Field Configuration**:
  - Required / Optional toggle
  - Enable / Disable toggle
  - Placeholder text and help text
  - Custom validation patterns
  - Conditional visibility (show/hide based on other field values)
- **Scoring System**:
  - Per-field point allocation
  - Scoring rules with conditions (equals, greater_than, less_than, between, contains, etc.)
  - Configurable threshold for auto-pass/fail
  - Admin-only score visibility
- **Page-Level Conditionals**: Entire pages can be shown/hidden based on field values
- **Renewal Forms**: Separate form configuration for renewal applications
- **Version Control**: Draft and published states with modification tracking
- **Live Preview**: Test forms before publishing

---

### 7.5 Scheme Management

Schemes define benefit programs that beneficiaries can apply for.

- **Scheme Configuration**: Name, code, category, priority, description
- **Categories**: education, healthcare, housing, livelihood, emergency_relief, infrastructure, social_welfare
- **Eligibility Criteria**: Age range, gender, income limit, family size, education level, employment status, required documents
- **Benefit Definition**: Type (cash, kind, service, scholarship, loan, subsidy), amount, frequency, duration
- **Application Settings**: Start/end dates, max applications, max beneficiaries, field verification required, interview required
- **Distribution Timeline**: Phase-based payment configuration with percentage splits, due dates, and verification requirements
- **Custom Workflow Stages**: Per-scheme application stages with role-based transition rules
- **Targets**: Monthly targets by demographics with progress tracking
- **Status Lifecycle**: draft → active → suspended → closed → completed
- **Export**: CSV/PDF export with filtering

---

### 7.6 Project Management

Projects are organizational units that group schemes and track budgets.

- **Project Details**: Name, unique code, description, category, priority
- **Scope**: State-level, district-level, area-level, unit-level, or multi-region
- **Budget Tracking**: Total budget, allocated amount, spent amount
- **Team Management**: Coordinator, managers, supervisors, field officers, volunteers with role assignments
- **Timeline**: Start date, end date, status tracking
- **Status Lifecycle**: Configurable project statuses
- **Scheme Linking**: Projects can contain multiple schemes

---

### 7.7 Donor Management

Full CRM for managing donor relationships and engagement.

- **Donor Profiles**: Name, email, phone, type (individual/corporate/foundation/trust/NGO)
- **Auto-Categorization**: Donors automatically categorized as regular, patron, major, corporate, or recurring based on donation amounts
- **Tax Details**: PAN number, GST, exemption certificate tracking
- **Communication Preferences**: Per-channel (email, SMS, WhatsApp, newsletter) opt-in/out
- **Engagement Scoring**: Algorithmic scoring based on donation frequency, amounts, and interaction history
- **Donation Statistics**: Total donated, count, average, first/last/largest donation, year-to-date
- **Follow-Up Status**: active, pending_reminder, overdue, lapsed, no_followup
- **Source Tracking**: Website, event, referral, social media, campaign, direct
- **Staff Assignment**: Donors assigned to staff members for relationship management
- **Verification**: Admin-verified donor profiles
- **Export**: CSV/PDF export

---

### 7.8 Donation Tracking

Comprehensive donation recording and lifecycle management.

- **Auto-Generated Donation Number**: Unique per franchise
- **Payment Methods**: Online (Razorpay/PayU/CCAvenue), bank transfer (NEFT/RTGS/IMPS/UPI), card, UPI, cheque, cash, digital wallet
- **Method-Specific Details**:
  - *Bank Transfer*: Transaction ID, UTR number, account details, transfer mode
  - *Online*: Gateway, payment ID, order ID, signature verification
  - *Cheque*: Number, bank, branch, dates, clearance status
  - *Cash*: Received by, receipt number, location, date
  - *UPI*: UPI ID, transaction ID, provider
- **Status Workflow**: pending → processing → completed / failed / cancelled / refunded
- **Anonymous Donations**: Support for anonymous donors with optional info
- **Tax Compliance**: PAN required for donations above threshold, exemption certificate tracking
- **Receipt Generation**: Auto-generated PDF receipts with email delivery tracking
- **Campaign Tracking**: UTM parameters, referrer, source, medium for attribution
- **Verification**: Multi-step verification with documents
- **Recurring Donations**: Frequency-based recurring setup with auto-scheduling
- **Refund Processing**: Full refund workflow with reason, amount, method, and status tracking
- **Notification History**: Track all SMS/email/WhatsApp/push notifications per donation

---

### 7.9 Payment System

Multi-level approval payment system for beneficiary disbursements.

- **Payment Types**: Full payment, installment, advance, refund, adjustment
- **Payment Methods**: Bank transfer, cheque, cash, digital wallet, UPI
- **Multi-Level Approval Workflow**:
  ```
  Created → Unit Admin Approval → Area Admin Approval → District Admin Approval
    → State Finance Approval → Processing → Completed
  ```
  Each level can approve or reject with comments
- **Installment Tracking**: Payment number, total installments, per-installment descriptions
- **Verification**: Status tracking with verifier info, notes, and supporting documents
- **Financial Reconciliation**: Reconciled flag with date and reconciler tracking
- **Failure Handling**: Error code, error message, retry count, canRetry flag
- **Refund Processing**: Reason, refund amount, refund method, status tracking
- **PDF Receipts**: Server-side PDF generation with organization branding

---

### 7.10 Recurring Payments

Automated recurring payment schedule management.

- **Schedule Generation**: Auto-generate payment records from application's distribution timeline
- **Payment Cycles**: Support for multiple cycles and phases within a schedule
- **Status Tracking**: scheduled → due → overdue → processing → completed / failed / skipped / cancelled
- **Budget Forecasting**: Predict future payment obligations with date-range projections
- **Overdue Detection**: Automatic identification of overdue payments
- **Dashboard**: Overview of all active recurring schedules with calendar view
- **Bulk Operations**: Process multiple recurring payments simultaneously

---

### 7.11 Budget & Financial Analytics

- **Budget Overview**: Total budget, allocated, spent, available across all projects/schemes
- **Project Budget Breakdown**: Per-project allocation, spending, and utilization rates
- **Scheme Budget Breakdown**: Per-scheme financial tracking
- **Category Analysis**: Budget distribution by project/scheme category
- **Monthly Summaries**: Month-over-month spending trends
- **Recent Transactions**: Latest financial activities
- **Period Filtering**: Current year, last year, custom date ranges
- **Currency Formatting**: Indian numbering system (Lakh, Crore)

---

### 7.12 Interview Management

- **Scheduling**: Date, time, type (offline / online)
- **Interview Types**:
  - *Offline*: Location-based with address
  - *Online*: Meeting link (Zoom, Google Meet, etc.)
- **Interviewer Assignment**: Multiple interviewers per interview
- **Status Tracking**: scheduled → completed / cancelled / rescheduled
- **Result Recording**: passed / failed with notes
- **Rescheduling**: Full history with reasons and original interview reference
- **Auto-Generated Interview Number**: Unique identifier per interview

---

### 7.13 Committee Approval

A dedicated approval gateway for applications requiring committee-level decisions.

- **Decision Workflow**: Approve or reject with customizable comments
- **Recurring Payment Configuration**: Setup monthly, quarterly, semi-annual, or annual payment schedules during approval
- **Distribution Timeline Management**: Configure installment phases with percentage splits
- **Amount Adjustment**: Committee can modify approved amounts (tracked with history)
- **Batch Processing**: Review and decide on multiple applications
- **Filter Integration**: Uses shared application filters for consistent data views

---

### 7.14 Communications Engine

Multi-channel communication platform integrated throughout the system.

#### Channels

| Channel | Provider | Use Cases |
|---|---|---|
| **WhatsApp** | DXing API | OTP delivery, application updates, payment notifications, donor reminders |
| **SMS** | DXing API | OTP fallback, bulk notifications, reminders |
| **Email** | Gmail SMTP (Nodemailer) | Receipts, reports, formal notifications, newsletters |
| **Push Notifications** | Firebase Cloud Messaging | Real-time alerts, status updates |

#### Automated Communications

- **OTP Delivery**: WhatsApp (primary) with SMS fallback
- **Application Status Updates**: Notifications at each workflow transition
- **Payment Confirmations**: Receipt delivery on payment completion
- **Donor Reminders**: Scheduled reminders based on follow-up rules
- **Interview Notifications**: Schedule confirmations and reminders

#### Donor Follow-Up System

```
Donation Recorded
  → Calculate Next Due Date (based on frequency)
  → Schedule First Reminder (7 days before due)
  → Send First Reminder via WhatsApp/SMS/Email
  → Schedule Final Reminder (on due date)
  → Send Final Reminder
  → If no response after 7 days → Mark Overdue → Assign to Staff
  → If no response after 30 days → Mark Lapsed
  → When donation received → Mark Completed → Schedule Next Cycle
```

---

### 7.15 Notification System

- **In-App Notifications**: Bell icon with unread badge in header
- **Read/Unread Management**: Mark individual or all as read
- **Notification Categories**: System, application, payment, auth
- **Paginated Retrieval**: Load notifications with pagination
- **Real-Time Updates**: Live notification count updates

---

### 7.16 Location Hierarchy

A global (non-franchise-scoped) hierarchical location system.

```
State
 └── District
      └── Area / Block
           └── Unit / Village
```

- **Hierarchy Enforcement**: Strict parent-child validation (a unit must belong to an area, etc.)
- **Geographic Data**: Coordinates (with 2dsphere index for geo queries), GeoJSON boundary polygons
- **Statistics**: Population, area (sq km), contact person
- **Methods**: `getFullPath()`, `getAllChildren()`, `getHierarchyTree()`, `validateHierarchy()`
- **Admin Scope Integration**: User access tied to location assignments
- **CRUD**: Full create/read/update/delete with cascading checks

---

### 7.17 User Management

- **User CRUD**: Create, update, delete users with role assignment
- **Role Assignment**: Assign franchise-specific roles with scope
- **Status Management**: Active/inactive toggle
- **Statistics**: User counts by role, login activity
- **Permission Audit**: View effective permissions for any user
- **Profile Management**: Avatar, contact info, emergency contact
- **Device Management**: FCM token registration for push notifications
- **Login Tracking**: Last login timestamp, failed attempt count, account lockout

---

### 7.18 Website Management (CMS)

A built-in content management system for public-facing organizational websites.

- **Website Settings**: Organization info, counters, display configuration
- **Banner Management**: Homepage banners with image upload, ordering, and scheduling
- **News & Events**: CRUD for news articles and events with public/private visibility
- **Brochures**: Document management with download tracking
- **Partners**: Partner organization logos, links, and descriptions
- **Public API**: Separate unauthenticated endpoints for website content delivery

---

### 7.19 Global Admin Panel

A super-admin control panel for managing the entire multi-tenant platform.

- **Franchise Management**: Create, edit, activate/deactivate franchise organizations
- **Domain Management**: Assign custom domains to franchises
- **Admin Assignment**: Assign state-level admins to franchises
- **RBAC Initialization**: Bootstrap roles and permissions for new franchises
- **Platform Statistics**: Cross-franchise analytics and metrics
- **System Configuration**: Global settings and feature flags

---

## 8. Reporting & Analytics

### Activity Logs
- **User Action Tracking**: All CRUD operations logged with timestamp, user, and severity
- **Severity Levels**: low, medium, high
- **Trend Analysis**: Activity patterns over time with charts
- **Per-User Activity**: Individual user activity summaries
- **Export**: Downloadable activity reports

### Login Logs
- **Login Attempt Tracking**: Success/failure with device fingerprinting
- **Device Detection**: Browser, OS, device type identification
- **Geographic Tracking**: IP-based location logging
- **Suspicious Activity Detection**: Automated flagging of unusual patterns
- **Analytics Dashboard**: Login trends, success rates, device distribution

### Error Logs
- **Error Tracking**: Application errors with stack traces and error codes
- **Error Grouping**: Similar errors grouped for pattern identification
- **Resolution Status**: Track error investigation and resolution
- **Error Rate Trends**: Monitor error frequency over time
- **Analytics**: Error distribution by category and severity

### Security Events
- **Permission Denials**: Track unauthorized access attempts
- **Suspicious Patterns**: Behavioral anomaly detection
- **System Events**: Configuration changes, backup status
- **Audit Trail**: Complete record of security-relevant operations

---

## 9. Security Features

| Feature | Implementation |
|---|---|
| **Passwordless Auth** | OTP-only login eliminates password-related vulnerabilities |
| **JWT Tokens** | Short-lived access tokens with refresh token rotation |
| **Helmet.js** | Comprehensive HTTP security headers |
| **CORS** | Multi-origin whitelisting with configurable origins |
| **Rate Limiting** | Configurable request limits (default: 100 req/15 min) |
| **Account Lockout** | 5 failed attempts → 2-hour automatic lockout |
| **Input Validation** | Express-validator + Joi on all endpoints |
| **Franchise Isolation** | Mongoose plugin enforces tenant data boundaries |
| **Role Hierarchy** | Users cannot manage those of equal or higher rank |
| **Scope Enforcement** | Data access restricted to assigned regions/projects/schemes |
| **Audit Logging** | All sensitive operations logged with user attribution |
| **Sensitive Field Protection** | `select: false` on passwords, API keys, configs |
| **File Upload Validation** | Type, size, and extension checks on all uploads |
| **Environment Validation** | Required env vars checked at startup |

---

## 10. Data Export System

A generic, configurable export system supporting multiple entities and formats.

### Supported Exports

| Entity | Formats | Configurable Columns |
|---|---|---|
| Applications | CSV, JSON, PDF | Status, beneficiary, scheme, amounts, dates, location |
| Beneficiaries | CSV, JSON, PDF | Name, phone, location, status, verification |
| Donors | CSV, JSON, PDF | Name, type, category, total donated, engagement score |
| Donations | CSV, JSON, PDF | Amount, method, status, donor, project, dates |
| Payments | CSV, JSON, PDF | Amount, status, beneficiary, approvals, dates |
| Users | CSV, JSON, PDF | Name, role, status, last login |
| Schemes | CSV, JSON, PDF | Name, category, budget, beneficiary count |
| Projects | CSV, JSON, PDF | Name, budget, utilization, status |
| Locations | CSV, JSON, PDF | Name, type, hierarchy, statistics |
| Activity Logs | CSV, JSON | Action, user, timestamp, severity |

### Export Features

- **Column Selection**: Configurable columns per entity via `exportConfigs.js`
- **Filter Support**: Export filtered subsets matching current view
- **Nested Object Handling**: Flattens nested data for CSV compatibility
- **Type-Specific Formatting**: Dates, currencies, and enums formatted for readability
- **Server-Side PDF**: PDFKit-generated reports with organization branding
- **Client-Side PDF**: jsPDF with autotable for browser-generated documents

---

## 11. File Management

- **Storage**: DigitalOcean Spaces (S3-compatible, BLR1 region)
- **Upload Handling**: Multer middleware with size and type validation
- **File Types**: jpg, jpeg, png, pdf, doc, docx (configurable)
- **Max Size**: 10MB per file (configurable)
- **Signed URLs**: Secure, time-limited download URLs
- **Use Cases**: Application documents, donor verification files, profile avatars, brochures, banners, partner logos
- **PDF Receipt Generation**: Server-side PDFKit with organization branding for donation receipts

---

## 12. Theming & Customization

### Color Themes

Three built-in color themes applied via CSS custom properties:

| Theme | Primary Color | Use Case |
|---|---|---|
| **Blue** | Blue palette | Default / neutral |
| **Purple** | Purple palette | Alternative branding |
| **Green** | Green palette | Baithuzzakath branding |

### Dark Mode

- Toggle between light and dark modes
- Powered by Next Themes library
- Applied via `.dark` class on document root
- Persistent preference storage

### Organization Branding

Each franchise can customize:
- Logo, favicon
- Display name, ERP title, tagline
- Color theme preference
- About text, copyright text
- Contact information
- Social media links
- Community values label and description

### Menu Configuration

- **Styles**: Compact, Comfortable, Spacious
- **Sidebar Position**: Left (default)
- **Search**: Toggleable sidebar search
- **Command Palette**: `Ctrl/Cmd+K` for keyboard-driven navigation

---

## 13. API Documentation

- **Swagger/OpenAPI 3.0** documentation available at `/api-docs`
- **Interactive UI**: Swagger UI Express for testing endpoints
- **150+ API Endpoints** across 37 route files
- **Health Check**: `GET /health` for monitoring

### Route Organization

| Category | Routes | Endpoints |
|---|---|---|
| Authentication | 3 route files | ~15 endpoints |
| User & RBAC | 2 route files | ~20 endpoints |
| Beneficiary | 2 route files | ~15 endpoints |
| Applications | 1 route file | ~20 endpoints |
| Schemes & Projects | 4 route files | ~25 endpoints |
| Financial (Payments, Donations, Budget) | 4 route files | ~30 endpoints |
| Donors | 2 route files | ~15 endpoints |
| Website CMS | 5 route files | ~25 endpoints |
| Locations & Master Data | 2 route files | ~15 endpoints |
| Logs & Analytics | 3 route files | ~20 endpoints |
| System & Config | 5 route files | ~15 endpoints |

---

## 14. Deployment & Infrastructure

### Frontend (Netlify)

- **Build**: `npm run build` via Vite
- **Output**: Static files in `/erp/dist`
- **SPA Routing**: `/*` → `/index.html` (200 status)
- **Cache Headers**: Static asset caching configured
- **Environment**: `VITE_API_URL` points to backend

### Backend (DigitalOcean App Platform)

- **Runtime**: Node.js >= 18
- **Entry**: `node src/app.js`
- **Port**: 8000
- **Region**: z2lzp

### Database (MongoDB Atlas)

- **Cluster**: Shared/dedicated Atlas cluster
- **Connection**: `mongodb+srv://` connection string with retry writes
- **Indexes**: Compound indexes on all major query patterns

### File Storage (DigitalOcean Spaces)

- **Region**: BLR1 (Bangalore)
- **Bucket**: `people-erp`
- **Access**: S3-compatible API via AWS SDK

### Development Setup

```bash
# Backend
cd api
npm install
npm run dev          # Starts Express on port 8000

# Frontend
cd erp
npm install
npm run dev          # Starts Vite on port 8080 (proxies /api to :8000)
```

---

## 15. Database Schema Overview

### Models (35+ Mongoose schemas)

| Model | Scope | Purpose |
|---|---|---|
| **User** | Global | User identity, auth, admin scope |
| **UserFranchise** | Global | User ↔ Franchise role mapping |
| **Role** | Franchise | Role definitions with permissions |
| **Permission** | Franchise | Granular permission definitions |
| **UserRole** | Franchise | User ↔ Role assignments with scope |
| **Franchise** | Global | Tenant organization configuration |
| **Location** | Global | Hierarchical geographic data |
| **Beneficiary** | Franchise | Benefit recipients |
| **Application** | Franchise | Benefit applications with workflow |
| **Scheme** | Franchise | Benefit program definitions |
| **FormConfiguration** | Franchise | Dynamic form schemas per scheme |
| **Project** | Franchise | Organizational project units |
| **Donor** | Franchise | Donor profiles and CRM |
| **Donation** | Franchise | Donation records and tracking |
| **DonorFollowUp** | Franchise | Follow-up schedules and reminders |
| **Payment** | Franchise | Beneficiary disbursement records |
| **RecurringPayment** | Franchise | Recurring payment schedules |
| **Interview** | Franchise | Interview scheduling and results |
| **Dashboard** | Franchise | Widget configuration per user |
| **MasterData** | Franchise | Configurable stages, statuses, templates |
| **Banner** | Franchise | Website homepage banners |
| **NewsEvent** | Franchise | News and event articles |
| **Brochure** | Franchise | Downloadable documents |
| **Partner** | Franchise | Partner organization listings |
| **WebsiteSettings** | Franchise | Public website configuration |
| **ApplicationConfig** | Franchise | System configuration per franchise |
| **ActivityLog** | Franchise | User action audit trail |
| **LoginLog** | Franchise | Login attempt records |
| **ErrorLog** | Franchise | Application error records |
| **Notification** | Franchise | User notification records |

---

## 16. Project Structure

```
people-erp/
├── api/                              # Backend (Express.js)
│   ├── src/
│   │   ├── app.js                    # Entry point (Express setup)
│   │   ├── config/                   # Configuration (7 files)
│   │   │   ├── database.js           # MongoDB connection
│   │   │   ├── environment.js        # Env var loading
│   │   │   ├── orgConfig.js          # Multi-org configuration
│   │   │   ├── swagger.js            # OpenAPI documentation
│   │   │   ├── exportConfigs.js      # Export column definitions
│   │   │   ├── staticOTP.js          # Dev-only static OTP
│   │   │   └── validateEnv.js        # Startup validation
│   │   ├── controllers/              # Request handlers (35 files)
│   │   ├── models/                   # Mongoose schemas (35+ files)
│   │   ├── routes/                   # API route definitions (37 files)
│   │   ├── middleware/               # Express middleware (10 files)
│   │   │   ├── auth.js               # JWT authentication
│   │   │   ├── rbacMiddleware.js     # Permission enforcement
│   │   │   ├── tenantResolver.js     # Multi-tenant identification
│   │   │   ├── activityLogger.js     # Action audit logging
│   │   │   ├── crossFranchiseResolver.js
│   │   │   ├── errorHandler.js
│   │   │   ├── exportHandler.js
│   │   │   ├── syncStages.js
│   │   │   ├── upload.js
│   │   │   └── validation.js
│   │   ├── services/                 # Business logic (18+ files)
│   │   │   ├── authService.js
│   │   │   ├── rbacService.js
│   │   │   ├── notificationService.js
│   │   │   ├── emailService.js
│   │   │   ├── smsService.js
│   │   │   ├── dxingSmsService.js
│   │   │   ├── dxingWhatsappService.js
│   │   │   ├── firebaseService.js
│   │   │   ├── pdfReceiptService.js
│   │   │   ├── donorReminderService.js
│   │   │   ├── recurringPaymentService.js
│   │   │   ├── activityLogService.js
│   │   │   ├── loginLogService.js
│   │   │   └── fileUploadService.js
│   │   ├── utils/                    # Utilities (14 files)
│   │   │   ├── franchisePlugin.js    # Mongoose tenant plugin
│   │   │   ├── franchiseCache.js     # TTL franchise cache
│   │   │   ├── franchiseFilterHelper.js
│   │   │   ├── scoringEngine.js      # Eligibility scoring
│   │   │   ├── responseHelper.js     # Standardized responses
│   │   │   ├── csvHelper.js          # CSV generation
│   │   │   ├── s3Upload.js           # Cloud storage
│   │   │   └── templates/            # Email templates
│   │   ├── scripts/                  # Migration & seed scripts (20+ files)
│   │   └── assets/                   # Static assets (logos)
│   ├── package.json
│   ├── uploads/                      # Local file uploads
│   ├── receipts/                     # Generated PDF receipts
│   └── logs/                         # Application logs
│
├── erp/                              # Frontend (React + Vite)
│   ├── src/
│   │   ├── main.tsx                  # Vite entry point
│   │   ├── App.tsx                   # Router configuration
│   │   ├── pages/                    # Page components (57+ files)
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Applications.tsx
│   │   │   ├── FormBuilder.tsx
│   │   │   ├── CommitteeApproval.tsx
│   │   │   ├── Schemes.tsx
│   │   │   ├── Projects.tsx
│   │   │   ├── Budget.tsx
│   │   │   ├── Beneficiaries.tsx
│   │   │   ├── GlobalAdmin.tsx
│   │   │   ├── applications/         # Application sub-pages
│   │   │   ├── payments/             # Payment tracking pages
│   │   │   ├── recurring-payments/   # Recurring payment pages
│   │   │   └── donors/              # Donor module pages
│   │   ├── components/               # React components (22 directories)
│   │   │   ├── ui/                   # Shadcn components (56 files)
│   │   │   ├── modals/              # Modal dialogs (29 files)
│   │   │   ├── formbuilder/         # Form builder components
│   │   │   ├── filters/             # Filter components
│   │   │   ├── donors/              # Donor components
│   │   │   ├── Layout.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── CommandPalette.tsx
│   │   │   └── AuthGuard.tsx
│   │   ├── hooks/                    # Custom hooks (19 files)
│   │   │   ├── useAuth.tsx
│   │   │   ├── useRBAC.tsx
│   │   │   ├── useCrossFranchise.tsx
│   │   │   ├── useApplicationFilters.ts
│   │   │   ├── useNotifications.ts
│   │   │   ├── useExport.ts
│   │   │   └── use-toast.ts
│   │   ├── contexts/                 # React contexts (5 files)
│   │   │   ├── ConfigContext.tsx
│   │   │   ├── FranchiseContext.tsx
│   │   │   └── AuthContext (in useAuth.tsx)
│   │   ├── services/                 # API service layer (11 files)
│   │   ├── lib/
│   │   │   ├── api.ts               # Main API client (2000+ lines)
│   │   │   ├── menuConfig.ts        # Navigation menu config
│   │   │   └── utils.ts
│   │   ├── themes/                   # CSS theme files
│   │   │   ├── blue-theme.css
│   │   │   ├── purple-theme.css
│   │   │   └── green-theme.css
│   │   ├── types/                    # TypeScript interfaces
│   │   └── utils/                    # Helper functions
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── netlify.toml
│   └── package.json
│
├── areas.json                        # Master data: area definitions
├── districts.json                    # Master data: district definitions
├── units.json                        # Master data: unit definitions
├── unitadmins.json                   # Master data: unit admin records
└── .gitignore
```

---

## Summary

People's Foundation ERP is a feature-complete, production-deployed NGO management platform that handles the full lifecycle of social welfare operations -- from beneficiary registration and scheme application to donor management and financial disbursement. Its multi-tenant architecture, granular RBAC system, and automated workflow engine make it suitable for organizations of any scale, while the dynamic form builder and configurable scheme system provide flexibility for diverse benefit programs.

**Key Statistics:**
- **150+ API endpoints** across 37 route files
- **35+ database models** with comprehensive indexing
- **100+ RBAC permissions** across 8 role levels
- **57+ frontend pages** with responsive design
- **56 Shadcn/UI components** for consistent UX
- **4 communication channels** (WhatsApp, SMS, Email, Push)
- **3 color themes** with dark mode support
- **Multi-tenant** with cross-franchise operations
