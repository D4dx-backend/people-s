# People ERP — Complete API Documentation

> **For Flutter / Mobile App Team**
> Base URL: `https://<franchise-slug>.yourdomain.com` or set `X-Franchise-Slug` header.
> All protected endpoints require `Authorization: Bearer <token>`.
> All responses follow the structure `{ success, message, data, timestamp }`.

---

## Table of Contents

1. [Authentication & Session](#1-authentication--session)
2. [Regional Admin Authentication](#2-regional-admin-authentication)
3. [Beneficiary Authentication](#3-beneficiary-authentication)
4. [Users](#4-users)
5. [Projects](#5-projects)
6. [Schemes](#6-schemes)
7. [Form Configurations (Scheme Forms)](#7-form-configurations-scheme-forms)
8. [Scheme Targets](#8-scheme-targets)
9. [Applications (Admin)](#9-applications-admin)
10. [Applications (Beneficiary Self-Service)](#10-applications-beneficiary-self-service)
11. [Beneficiaries (Admin Management)](#11-beneficiaries-admin-management)
12. [Payments & PDF Receipts](#12-payments--pdf-receipts)
13. [Recurring Payments](#13-recurring-payments)
14. [Donors](#14-donors)
15. [Donations](#15-donations)
16. [Donor Follow-ups](#16-donor-follow-ups)
17. [Interviews](#17-interviews)
18. [Dashboard](#18-dashboard)
19. [Budget](#19-budget)
20. [Locations (Cascading Selection)](#20-locations-cascading-selection)
21. [Mobile Helpers](#21-mobile-helpers)
22. [Notifications](#22-notifications)
23. [Reports (Application Reports)](#23-reports-application-reports)
24. [Admin Reports](#24-admin-reports)
25. [Program Reports](#25-program-reports)
26. [File Upload](#26-file-upload)
27. [SMS](#27-sms)
28. [Speech (Audio Transcription)](#28-speech-audio-transcription)
29. [Website Management](#29-website-management)
30. [Application Configuration / Settings](#30-application-configuration--settings)
31. [RBAC — Roles & Permissions](#31-rbac--roles--permissions)
32. [Master Data](#32-master-data)
33. [Activity Logs](#33-activity-logs)
34. [Login Logs](#34-login-logs)
35. [Error Logs](#35-error-logs)
36. [Regional Admin Panel](#36-regional-admin-panel)
37. [Global Admin (Franchise Management)](#37-global-admin-franchise-management)
38. [Common Response Formats](#38-common-response-formats)

---

## 1. Authentication & Session

> Base path: `/api/auth`

### POST `/api/auth/send-otp`
Send OTP to admin phone number.

**Access:** Public

**Request Body:**
```json
{
  "phone": "9999999999",
  "purpose": "login"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phone` | string | Yes | 10-digit Indian mobile number |
| `purpose` | string | No | `login` \| `registration` \| `phone_verification` (default: `login`) |

**Response `200`:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "data": {
    "phone": "9999999999",
    "expiresIn": 10,
    "staticOTP": "123456"
  }
}
```
> `staticOTP` is only returned in development mode.

---

### POST `/api/auth/verify-otp`
Verify OTP. Returns either a JWT **or** a `selectionToken` when the user has multiple franchises/roles.

**Access:** Public

**Request Body:**
```json
{
  "phone": "9999999999",
  "otp": "123456",
  "purpose": "login"
}
```

**Response `200` — Single franchise/role (direct login):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "<JWT>",
    "refreshToken": "<JWT>",
    "user": {
      "id": "...",
      "name": "Admin Name",
      "phone": "9999999999",
      "role": "state_admin",
      "franchise": { "id": "...", "name": "Kerala" }
    }
  }
}
```

**Response `200` — Multiple franchises/roles (needs selection):**
```json
{
  "success": true,
  "message": "Role selection required",
  "data": {
    "requiresSelection": true,
    "selectionToken": "<SHORT_LIVED_TOKEN>",
    "franchises": [
      {
        "franchiseId": "...",
        "franchiseName": "Kerala",
        "franchiseSlug": "kerala",
        "roles": ["state_admin", "district_admin"]
      },
      {
        "franchiseId": "...",
        "franchiseName": "Tamil Nadu",
        "franchiseSlug": "tamilnadu",
        "roles": ["area_admin"]
      }
    ]
  }
}
```
> When `requiresSelection: true`, show a franchise + role picker UI and call `/api/auth/select-role`.

---

### POST `/api/auth/select-role`
Exchange a `selectionToken` (from multi-franchise OTP verify) for a full JWT by choosing franchise + role.

**Access:** Public (requires valid `selectionToken`)

**Request Body:**
```json
{
  "selectionToken": "<selectionToken from verify-otp>",
  "franchiseId": "63f1a2b3c4d5e6f7a8b9c0d1",
  "role": "state_admin"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `selectionToken` | string | Yes | Short-lived token from `verify-otp` |
| `franchiseId` | string | Yes | MongoDB ID of chosen franchise |
| `role` | string | No | Specific role to use in that franchise |

**Response `200`:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "<JWT>",
    "refreshToken": "<JWT>",
    "user": {
      "id": "...",
      "name": "Admin Name",
      "role": "state_admin",
      "franchise": { "id": "...", "name": "Kerala" }
    }
  }
}
```

---

### GET `/api/auth/my-franchises`
Get all franchises and roles accessible to the current user.

**Access:** Private

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "franchises": [
      {
        "franchiseId": "...",
        "franchiseName": "Kerala",
        "franchiseSlug": "kerala",
        "roles": ["state_admin"]
      }
    ]
  }
}
```

---

### POST `/api/auth/refresh-token`
Get a new access token using a refresh token.

**Access:** Public

**Request Body:**
```json
{ "refreshToken": "<refreshToken>" }
```

**Response `200`:**
```json
{
  "success": true,
  "data": { "token": "<new JWT>" }
}
```

---

### POST `/api/auth/logout`
Logout and invalidate tokens.

**Access:** Private

**Response `200`:**
```json
{ "success": true, "message": "Logged out successfully" }
```

---

### GET `/api/auth/profile`
Get current user's full profile.

**Access:** Private

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "Admin Name",
    "phone": "9999999999",
    "email": "admin@example.com",
    "role": "state_admin",
    "isActive": true,
    "profile": {
      "dateOfBirth": "1990-01-15",
      "gender": "male"
    }
  }
}
```

---

### GET `/api/auth/me`
Alias for `/api/auth/profile`.

---

### PUT `/api/auth/profile`
Update profile.

**Access:** Private

**Request Body:**
```json
{
  "name": "New Name",
  "email": "new@email.com",
  "profile": {
    "dateOfBirth": "1990-01-15",
    "gender": "male"
  }
}
```

---

### POST `/api/auth/change-password`
Change own password.

**Access:** Private

**Request Body:**
```json
{
  "currentPassword": "old_password",
  "newPassword": "new_password_min6"
}
```

---

### POST `/api/auth/change-phone`
Change phone number (requires OTP on new number).

**Access:** Private

**Request Body:**
```json
{
  "newPhone": "9876543210",
  "otp": "123456"
}
```

---

### POST `/api/auth/register-device`
Register device for push notifications (FCM).

**Access:** Private

**Request Body:**
```json
{
  "deviceId": "device-unique-id",
  "platform": "android",
  "fcmToken": "FCM_TOKEN_HERE"
}
```

| `platform` values | `android` \| `ios` \| `web` |
|---|---|

---

### GET `/api/auth/status`
Check if current JWT token is valid.

**Access:** Private

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "user": { "id": "...", "name": "...", "role": "..." }
  }
}
```

---

### POST `/api/auth/complete-registration`
Complete registration after OTP verification (first-time user setup).

**Access:** Public

**Request Body:**
```json
{
  "tempUserId": "507f1f77bcf86cd799439011",
  "name": "Mohammed Ali",
  "email": "ali@example.com",
  "profile": {
    "dateOfBirth": "1990-01-15",
    "gender": "male"
  }
}
```

---

## 2. Regional Admin Authentication

> Base path: `/api/regional-admin`
> For unit admins, area admins, area presidents, and district admins.

### POST `/api/regional-admin/auth/send-otp`
Send OTP for regional admin login.

**Access:** Public

**Request Body:**
```json
{ "phone": "9999999999" }
```

---

### POST `/api/regional-admin/auth/verify-otp`
Verify OTP for regional admin. Returns JWT or selection prompt.

**Access:** Public

**Request Body:**
```json
{
  "phone": "9999999999",
  "otp": "123456"
}
```

**Response:** Same format as `/api/auth/verify-otp`.

---

### GET `/api/regional-admin/auth/profile`
Get regional admin profile.

**Access:** Private — `unit_admin`, `area_president`, `area_admin`, `district_admin`

---

## 3. Beneficiary Authentication

> Base path: `/api/beneficiary`

### POST `/api/beneficiary/auth/send-otp`
Send OTP for beneficiary login/registration.

**Access:** Public

**Request Body:**
```json
{ "phone": "9999999999" }
```

---

### POST `/api/beneficiary/auth/verify-otp`
Verify OTP and login as beneficiary.

**Access:** Public

**Request Body:**
```json
{
  "phone": "9999999999",
  "otp": "123456"
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "token": "<JWT>",
    "refreshToken": "<JWT>",
    "user": {
      "id": "...",
      "name": "Beneficiary Name",
      "phone": "9999999999",
      "role": "beneficiary"
    }
  }
}
```

---

### POST `/api/beneficiary/auth/resend-otp`
Resend OTP.

**Access:** Public

**Request Body:**
```json
{ "phone": "9999999999" }
```

---

### GET `/api/beneficiary/auth/locations`
Get districts/areas/units for registration (no auth).

**Access:** Public

**Query Params:**

| Param | Type | Description |
|-------|------|-------------|
| `type` | string | `district` \| `area` \| `unit` |
| `parent` | string | Parent location ID (for cascading) |

---

### GET `/api/beneficiary/auth/profile`
Get beneficiary's own profile.

**Access:** Private — `beneficiary`

---

### PUT `/api/beneficiary/auth/profile`
Update beneficiary profile.

**Access:** Private — `beneficiary`

---

### DELETE `/api/beneficiary/auth/account`
Soft delete own account (frees phone for re-registration; data retained in DB).

**Access:** Private — `beneficiary`

---

## 4. Users

> Base path: `/api/users`

### GET `/api/users`
Get all users with pagination and filters.

**Access:** Private — `users.read.regional` permission

**Query Params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number |
| `limit` | int | 10 | Items per page |
| `role` | string | — | Filter by role |
| `isActive` | boolean | — | Filter by active status |
| `region` | string | — | Filter by region ID |
| `search` | string | — | Search by name/phone |
| `sort` | string | `createdAt` | Sort field |
| `order` | string | `desc` | `asc` \| `desc` |

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "...",
        "name": "User Name",
        "phone": "9999999999",
        "role": "district_admin",
        "isActive": true,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "pages": 5,
      "limit": 10
    }
  }
}
```

---

### GET `/api/users/statistics`
Get user count statistics.

**Access:** Private — `users.read.regional`

---

### GET `/api/users/role/:role`
Get users by specific role.

**Access:** Private — `users.read.regional`

**Roles:** `state_admin` | `project_coordinator` | `scheme_coordinator` | `district_admin` | `area_admin` | `unit_admin` | `beneficiary`

---

### GET `/api/users/export`
Export users as CSV or JSON.

**Access:** Private — `users.read.regional`

**Query:** `?format=csv` or `?format=json`

---

### GET `/api/users/:id`
Get single user by ID.

---

### POST `/api/users`
Create a new user.

**Access:** Private — senior admin roles

**Request Body:**
```json
{
  "name": "New Admin",
  "phone": "9876543210",
  "email": "admin@example.com",
  "role": "district_admin",
  "district": "...",
  "area": "...",
  "unit": "..."
}
```

---

### PUT `/api/users/:id`
Update user.

---

### PUT `/api/users/:id/role`
Assign role to user.

**Request Body:**
```json
{
  "role": "area_admin",
  "area": "<areaId>"
}
```

---

### PATCH `/api/users/:id/activate`
Activate user.

### PATCH `/api/users/:id/deactivate`
Deactivate user.

### DELETE `/api/users/:id`
Delete user.

---

## 5. Projects

> Base path: `/api/projects`

### GET `/api/projects`
Get all projects with filters.

**Access:** Private (authenticated)

**Query Params:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | int | Page number |
| `limit` | int | Items per page |
| `status` | string | `draft` \| `approved` \| `active` \| `on_hold` \| `completed` \| `cancelled` |
| `category` | string | `education` \| `healthcare` \| `housing` \| `livelihood` \| `emergency_relief` \| `infrastructure` \| `social_welfare` \| `other` |
| `priority` | string | `low` \| `medium` \| `high` \| `critical` |
| `scope` | string | `state` \| `district` \| `area` \| `unit` \| `multi_region` |
| `search` | string | Search by name/code |

---

### GET `/api/projects/stats`
Get project statistics.

---

### GET `/api/projects/:id`
Get single project.

---

### POST `/api/projects`
Create project.

**Access:** Private — senior admin roles

**Request Body:**
```json
{
  "name": "Health Scheme 2024",
  "code": "HEALTH_2024",
  "description": "...",
  "category": "healthcare",
  "priority": "high",
  "scope": "district",
  "targetRegions": ["<districtId>"],
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "budget": { "total": 500000 },
  "coordinator": "<userId>"
}
```

---

### PUT `/api/projects/:id`
Update project.

### DELETE `/api/projects/:id`
Delete project.

### GET `/api/projects/export`
Export projects as CSV/JSON.

---

## 6. Schemes

> Base path: `/api/schemes`

### GET `/api/schemes`
Get all schemes.

**Query Params:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | `draft` \| `active` \| `suspended` \| `closed` \| `completed` |
| `category` | string | See project categories |
| `priority` | string | `low` \| `medium` \| `high` \| `critical` |
| `project` | string | Filter by project ID |
| `search` | string | Search by name/code |

---

### GET `/api/schemes/active`
Get all active schemes accepting applications.

---

### GET `/api/schemes/stats`
Get scheme statistics.

---

### GET `/api/schemes/:id`
Get single scheme with full details including form configuration.

---

### POST `/api/schemes`
Create scheme.

**Access:** Private — `super_admin`, `state_admin`

---

### PUT `/api/schemes/:id`
Update scheme.

### DELETE `/api/schemes/:id`
Delete scheme.

### GET `/api/schemes/export`
Export schemes as CSV/JSON.

---

## 7. Form Configurations (Scheme Forms)

> Scheme forms (dynamic form builder) are linked to schemes.

### GET `/api/schemes/:schemeId/form-config`
Get form configuration for a scheme.

**Access:** Private

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "formConfig": {
      "id": "...",
      "pages": [
        {
          "pageNumber": 1,
          "title": "Personal Information",
          "fields": [
            {
              "id": "field_001",
              "type": "text",
              "label": "Full Name",
              "required": true,
              "placeholder": "Enter full name"
            },
            {
              "id": "field_002",
              "type": "select",
              "label": "Gender",
              "options": [
                { "value": "male", "label": "Male" },
                { "value": "female", "label": "Female" }
              ]
            }
          ]
        }
      ],
      "isPublished": true
    }
  }
}
```

---

### PUT `/api/schemes/:schemeId/form-config`
Update form configuration.

**Access:** Private — `super_admin`, `state_admin`, `district_admin`

---

### PATCH `/api/schemes/:schemeId/form-config/publish` (via formConfigurationRoutes)
Publish or unpublish a form configuration.

**Request Body:**
```json
{ "isPublished": true }
```

---

### GET `/api/form-configurations`
Get all form configurations (admin list view).

**Access:** Private — admin roles

---

## 8. Scheme Targets

> Base path: `/api/scheme-targets`

### GET `/api/scheme-targets/:schemeId`
Get target configuration for a scheme.

### GET `/api/scheme-targets/:schemeId/progress`
Get auto-tracked progress from applications.

### GET `/api/scheme-targets/:schemeId/form-fields`
Get form fields eligible for criteria mapping.

### PUT `/api/scheme-targets/:schemeId`
Create or update target configuration.

**Request Body:**
```json
{
  "totalTarget": 1000,
  "description": "Target 1000 beneficiaries",
  "monthlyTargets": [
    { "month": 1, "target": 100 }
  ]
}
```

---

## 9. Applications (Admin)

> Base path: `/api/applications`

### GET `/api/applications`
Get all applications with filters and pagination.

**Access:** Private — admin + coordinator roles

**Query Params:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | int | Page number |
| `limit` | int | Items per page |
| `status` | string | `pending` \| `under_review` \| `approved` \| `rejected` \| `completed` |
| `scheme` | string | Filter by scheme ID |
| `project` | string | Filter by project ID |
| `search` | string | Search by application number or beneficiary name |
| `district` | string | Filter by district ID |
| `area` | string | Filter by area ID |
| `unit` | string | Filter by unit ID |

---

### GET `/api/applications/consolidation`
Get consolidated application statistics by region.

**Access:** Private — `super_admin`, `state_admin`, `district_admin`, `area_admin`, `unit_admin`

---

### GET `/api/applications/receipts`
Get list of completed payment receipts for all applications.

**Access:** Private — admin + coordinator roles

**Query Params:** `page`, `limit`, `search`, `scheme`, `project`, `dateFrom`, `dateTo`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "receipts": [
      {
        "paymentId": "...",
        "paymentNumber": "PAY-2024-001",
        "applicationNumber": "APP-2024-001",
        "beneficiaryName": "John Doe",
        "schemeName": "Health Support",
        "amount": 5000,
        "status": "completed",
        "method": "bank_transfer",
        "completedAt": "2024-05-01T10:00:00.000Z"
      }
    ],
    "pagination": { "total": 100, "page": 1, "pages": 10 }
  }
}
```

---

### GET `/api/applications/renewal-due`
Get applications due for renewal.

---

### GET `/api/applications/:id`
Get single application with full details.

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "application": {
      "id": "...",
      "applicationNumber": "APP-2024-001",
      "beneficiary": { "id": "...", "name": "John Doe", "phone": "..." },
      "scheme": { "id": "...", "name": "Health Support" },
      "project": { "id": "...", "name": "Project Alpha" },
      "status": "approved",
      "requestedAmount": 5000,
      "approvedAmount": 5000,
      "stages": [...],
      "documents": [...],
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

---

### GET `/api/applications/:id/duplicates`
Get duplicate applications for an application.

---

### GET `/api/applications/:id/available-revert-roles`
Get list of roles the application can be reverted to.

---

### GET `/api/applications/:id/renewal-history`
Get renewal history for an application.

---

### GET `/api/applications/:id/pdf`
Download filled application form as PDF.

**Access:** Private — admin + coordinator roles

**Response:** `application/pdf` file download.

---

### POST `/api/applications`
Create new application for a beneficiary.

**Access:** Private — `super_admin`, `state_admin`, `district_admin`, `area_admin`, `unit_admin`, `area_president`

**Request Body:**
```json
{
  "beneficiary": "<beneficiaryId>",
  "scheme": "<schemeId>",
  "project": "<projectId>",
  "requestedAmount": 5000,
  "documents": [
    { "type": "identity", "url": "uploads/doc1.pdf" }
  ]
}
```

---

### PUT `/api/applications/:id`
Full application update (senior admin only).

**Access:** Private — `super_admin`, `state_admin`, `district_admin`

---

### PATCH `/api/applications/:id/review`
Review application (set status).

**Access:** Private — `super_admin`, `state_admin`, `district_admin`

**Request Body:**
```json
{
  "status": "under_review",
  "comments": "Needs document verification"
}
```
`status` options: `under_review` | `field_verification` | `approved` | `rejected`

---

### PATCH `/api/applications/:id/approve`
Approve application with amount.

**Access:** Private — `super_admin`, `state_admin`, `district_admin`

**Request Body:**
```json
{
  "approvedAmount": 5000,
  "comments": "Approved after review"
}
```

---

### PATCH `/api/applications/:id/stage`
Update application stage.

---

### PATCH `/api/applications/:id/location`
Correct application location (district/area/unit).

**Access:** Private — `super_admin`, `state_admin`, `district_admin`, `area_admin`, `unit_admin`, `area_president`

**Request Body:**
```json
{
  "area": "<areaId>",
  "unit": "<unitId>",
  "reason": "Wrong area assigned initially"
}
```

---

### PATCH `/api/applications/:id/revert`
Revert application to a previous stage/role.

---

### POST `/api/applications/:id/stage/comment`
Add comment to a stage.

---

### POST `/api/applications/:id/stage/document`
Upload document for a stage.

---

### GET `/api/applications/export`
Export applications as CSV/JSON.

---

## 10. Applications (Beneficiary Self-Service)

> Base path: `/api/beneficiary`

### GET `/api/beneficiary/schemes`
Get available schemes for the beneficiary.

**Access:** Private — `beneficiary`

**Query:** `category`, `search`, `status`

---

### GET `/api/beneficiary/schemes/:id`
Get scheme details with form configuration.

**Access:** Private — `beneficiary`

---

### GET `/api/beneficiary/schemes/:id/form-pdf/blank`
Download blank application form as PDF (before filling).

**Access:** Private — `beneficiary`

**Response:** `application/pdf`

---

### POST `/api/beneficiary/applications/draft`
Save a draft application.

**Access:** Private — `beneficiary`

**Request Body:**
```json
{
  "schemeId": "<schemeId>",
  "formData": { "field_001": "John Doe", "field_002": "male" },
  "currentPage": 0
}
```

---

### PUT `/api/beneficiary/applications/draft/:id`
Update draft.

---

### GET `/api/beneficiary/applications/draft/scheme/:schemeId`
Get draft for a specific scheme.

---

### DELETE `/api/beneficiary/applications/draft/:id`
Delete draft.

---

### POST `/api/beneficiary/applications`
Submit application.

**Access:** Private — `beneficiary`

**Request Body:**
```json
{
  "schemeId": "<schemeId>",
  "formData": {
    "field_001": "John Doe",
    "field_002": "male",
    "field_003": "1990-01-15"
  },
  "documents": [
    { "type": "identity", "url": "uploads/aadhaar.pdf" }
  ]
}
```

---

### GET `/api/beneficiary/applications`
Get my applications.

**Query:** `status`, `page`, `limit`

---

### GET `/api/beneficiary/applications/:id`
Get application details.

---

### GET `/api/beneficiary/applications/:id/pdf`
Download own application as PDF.

**Response:** `application/pdf`

---

### PUT `/api/beneficiary/applications/:id/cancel`
Cancel application.

**Request Body:**
```json
{ "reason": "No longer needed" }
```

---

### GET `/api/beneficiary/track/:applicationId`
Track application status.

---

### GET `/api/beneficiary/stats`
Get my application statistics.

---

### GET `/api/beneficiary/applications/renewal-due`
Get applications due for renewal.

---

### GET `/api/beneficiary/applications/:id/renewal-form`
Get renewal form for an application.

---

### POST `/api/beneficiary/applications/:id/renew`
Submit renewal.

**Request Body:**
```json
{
  "formData": { ... },
  "documents": []
}
```

---

## 11. Beneficiaries (Admin Management)

> Base path: `/api/beneficiaries`

### GET `/api/beneficiaries`
Get all beneficiaries (admin view).

**Access:** Private — admin roles

**Query Params:** `page`, `limit`, `search`, `district`, `area`, `unit`, `isActive`

---

### GET `/api/beneficiaries/:id`
Get single beneficiary with full details.

---

### POST `/api/beneficiaries`
Create beneficiary (admin-managed).

**Access:** Private — `super_admin`, `state_admin`, `district_admin`, `area_admin`, `unit_admin`, `area_president`

**Request Body:**
```json
{
  "name": "John Doe",
  "phone": "9999999999",
  "state": "<stateId>",
  "district": "<districtId>",
  "area": "<areaId>",
  "unit": "<unitId>",
  "personalInfo": {
    "dateOfBirth": "1990-01-15",
    "gender": "male",
    "address": "...",
    "aadhaar": "1234-5678-9012"
  }
}
```

---

### PUT `/api/beneficiaries/:id`
Update beneficiary.

### DELETE `/api/beneficiaries/:id`
Deactivate beneficiary.

### GET `/api/beneficiaries/export`
Export as CSV/JSON.

---

## 12. Payments & PDF Receipts

> Base path: `/api/payments`

### GET `/api/payments`
Get all payments (one-time + recurring) with pagination and search.

**Access:** Private — `finances.read.regional` permission

**Query Params:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | int | Page number |
| `limit` | int | Items per page |
| `status` | string | `pending` \| `processing` \| `completed` \| `failed` \| `cancelled` |
| `type` | string | Payment type |
| `method` | string | `bank_transfer` \| `cheque` \| `cash` \| `digital_wallet` \| `upi` |
| `project` | string | Filter by project ID |
| `scheme` | string | Filter by scheme ID |
| `search` | string | Search by payment number, beneficiary name, application number |
| `gender` | string | Filter by beneficiary gender |

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": "...",
        "paymentNumber": "PAY-2024-001",
        "beneficiaryName": "John Doe",
        "beneficiaryGender": "male",
        "schemeName": "Health Support",
        "projectName": "Project Alpha",
        "amount": 5000,
        "type": "one_time",
        "method": "bank_transfer",
        "status": "completed",
        "completedAt": "2024-05-01T10:00:00.000Z",
        "isRecurring": false
      }
    ],
    "pagination": { "total": 50, "page": 1, "pages": 5 }
  }
}
```

---

### GET `/api/payments/:id`
Get single payment details.

---

### POST `/api/payments`
Create/initiate a payment for an approved application.

**Access:** Private — `finances.create` permission

**Request Body:**
```json
{
  "applicationId": "<appId>",
  "amount": 5000,
  "method": "bank_transfer",
  "type": "one_time",
  "referenceNumber": "UTR123456",
  "notes": "First installment"
}
```

---

### PATCH `/api/payments/:id`
Update payment status.

---

### GET `/api/payments/:id/receipt`
Generate and download PDF receipt for a **completed** payment.

**Access:** Private — admin + coordinator roles

**Response:** `application/pdf` — downloadable file.

**Headers:**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="receipt-PAY-2024-001.pdf"
```

> Receipt contains: Organization logo, payment number, beneficiary details, scheme/project info, amount, payment method, date, and authorized signatures.

---

### POST `/api/payments/:id/receipt/file`
Generate receipt and return file path (for server-side use).

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "fileName": "receipt-PAY-2024-001.pdf",
    "paymentNumber": "PAY-2024-001",
    "downloadUrl": "/api/payments/<id>/receipt"
  }
}
```

---

### POST `/api/payments/bulk-receipt`
Generate receipts for multiple payments.

**Request Body:**
```json
{
  "paymentIds": ["id1", "id2", "id3"]
}
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "generated": [
      { "paymentId": "...", "paymentNumber": "PAY-001", "fileName": "receipt-PAY-001.pdf" }
    ],
    "errors": [],
    "summary": { "total": 3, "successful": 3, "failed": 0 }
  }
}
```

---

### GET `/api/payments/export`
Export payments as CSV/JSON.

---

## 13. Recurring Payments

> Base path: `/api/recurring-payments`

### POST `/api/recurring-payments/generate-schedule/:applicationId`
Generate recurring payment schedule for an application.

**Request Body:**
```json
{
  "recurringConfig": {
    "period": "monthly",
    "numberOfPayments": 12,
    "amountPerPayment": 1000,
    "startDate": "2024-01-01"
  }
}
```
`period` options: `monthly` | `quarterly` | `semi_annually` | `annually`

---

### GET `/api/recurring-payments/applications`
Get all applications with recurring payment schedules.

**Query:** `scheme`, `project`, `status`, `district`

---

### GET `/api/recurring-payments/applications/:applicationId/schedule`
Get full schedule for a specific application.

---

### GET `/api/recurring-payments/upcoming`
Get upcoming recurring payments.

**Query:** `days` (1–365), `scheme`, `project`

---

### GET `/api/recurring-payments/overdue`
Get overdue recurring payments.

---

### GET `/api/recurring-payments/forecast`
Get budget forecast based on recurring payments.

**Query:** `months` (1–60), `scheme`, `project`

---

### GET `/api/recurring-payments/dashboard`
Get recurring payment dashboard statistics.

---

### GET `/api/recurring-payments/:paymentId`
Get single recurring payment details.

---

### POST `/api/recurring-payments/:paymentId/record`
Mark a recurring payment as completed.

**Request Body:**
```json
{
  "amount": 1000,
  "method": "bank_transfer",
  "referenceNumber": "UTR123456",
  "notes": "Month 3 payment"
}
```
`method` options: `bank_transfer` | `cheque` | `cash` | `digital_wallet` | `upi`

---

## 14. Donors

> Base path: `/api/donors`

### GET `/api/donors`
Get all donors.

**Access:** Private — `donors.read.regional`

**Query:** `page`, `limit`, `search`, `isActive`, `sort`, `order`

---

### GET `/api/donors/history`
Get full donation history from the Donation model.

**Query:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | int | Page number |
| `limit` | int | Items per page |
| `donorId` | string | Filter by specific donor |
| `status` | string | `pending` \| `completed` \| `failed` etc. |
| `method` | string | Payment method |
| `startDate` | date | From date |
| `endDate` | date | To date |
| `minAmount` | number | Minimum amount |
| `maxAmount` | number | Maximum amount |

---

### GET `/api/donors/:id`
Get single donor.

### POST `/api/donors`
Create donor.

### PUT `/api/donors/:id`
Update donor.

### DELETE `/api/donors/:id`
Delete donor.

### GET `/api/donors/export`
Export donors as CSV/JSON.

---

## 15. Donations

> Base path: `/api/donations`

### GET `/api/donations`
Get all donations with filters.

**Query:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | int | Page |
| `limit` | int | Items per page |
| `search` | string | Donor name or payment number |
| `status` | string | `pending` \| `processing` \| `completed` \| `failed` \| `cancelled` |
| `method` | string | `online` \| `bank_transfer` \| `cash` \| `cheque` \| `card` |
| `dateFrom` | date | Start date |
| `dateTo` | date | End date |
| `sortBy` | string | Sort field |
| `sortOrder` | string | `asc` \| `desc` |

---

### GET `/api/donations/:id`
Get single donation.

### POST `/api/donations`
Create donation.

### PUT `/api/donations/:id`
Update donation.

### DELETE `/api/donations/:id`
Delete donation.

### GET `/api/donations/export`
Export as CSV/JSON.

---

## 16. Donor Follow-ups

> Base path: `/api/donor-followups`

### GET `/api/donor-followups`
Get all follow-ups.

### GET `/api/donor-followups/dashboard`
Dashboard stats for follow-ups.

### GET `/api/donor-followups/upcoming`
Upcoming follow-ups.

### GET `/api/donor-followups/overdue`
Overdue follow-ups.

### GET `/api/donor-followups/lapsed`
Lapsed donor follow-ups.

### GET `/api/donor-followups/by-donor/:donorId`
Get follow-ups for a specific donor.

### POST `/api/donor-followups`
Create follow-up.

### GET `/api/donor-followups/:id`
Get single follow-up.

### PUT `/api/donor-followups/:id`
Update follow-up.

### PATCH `/api/donor-followups/:id/assign`
Assign follow-up to a staff member.

### PATCH `/api/donor-followups/:id/complete`
Mark follow-up as completed.

### PATCH `/api/donor-followups/:id/cancel`
Cancel follow-up.

### POST `/api/donor-followups/:id/notes`
Add a note to a follow-up.

### POST `/api/donor-followups/:id/send-reminder`
Send reminder for a follow-up.

### POST `/api/donor-followups/process-reminders`
Manually trigger reminder processing (admin).

---

## 17. Interviews

> Base path: `/api/interviews`

### GET `/api/interviews`
Get all scheduled interviews.

**Query:**

| Param | Type | Description |
|-------|------|-------------|
| `page` | int | Page |
| `limit` | int | Items per page |
| `status` | string | `scheduled` \| `completed` \| `cancelled` |
| `date` | date | Filter by date |
| `search` | string | Search by applicant name |

---

### GET `/api/interviews/:id`
Get single interview details.

### POST `/api/interviews/application/:applicationId`
Schedule interview for an application.

**Request Body:**
```json
{
  "date": "2024-06-01",
  "time": "10:00",
  "type": "offline",
  "location": "District Office",
  "meetingLink": null,
  "interviewers": ["<userId>"],
  "notes": "Bring original documents"
}
```
`type`: `offline` | `online`

### PATCH `/api/interviews/:id`
Update interview.

### PATCH `/api/interviews/:id/complete`
Mark interview as completed with result.

**Request Body:**
```json
{ "result": "passed", "notes": "Passed all criteria" }
```
`result`: `pending` | `passed` | `failed`

### DELETE `/api/interviews/:id`
Cancel/delete interview.

---

## 18. Dashboard

> Base path: `/api/dashboard`

### GET `/api/dashboard/overview`
Get main dashboard statistics.

**Access:** Private — read permissions

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "totalBeneficiaries": 1500,
    "totalApplications": 3200,
    "pendingApplications": 120,
    "approvedApplications": 2900,
    "totalDisbursed": 15000000,
    "activeProjects": 5,
    "activeSchemes": 12
  }
}
```

---

### GET `/api/dashboard/recent-applications`
Get recent applications (last N).

**Query:** `limit` (default: 10)

---

### GET `/api/dashboard/recent-payments`
Get recent payments.

**Query:** `limit` (default: 10)

---

### GET `/api/dashboard/monthly-trends`
Get monthly trends for charts.

**Query:** `months` (default: 6)

**Response includes:** applications per month, disbursements per month.

---

### GET `/api/dashboard/project-performance`
Get project-wise performance data.

---

## 19. Budget

> Base path: `/api/budget`

### GET `/api/budget/overview`
Budget overview and statistics.

**Response `200`:**
```json
{
  "data": {
    "totalBudget": 50000000,
    "disbursed": 15000000,
    "remaining": 35000000,
    "utilizationPercentage": 30
  }
}
```

### GET `/api/budget/projects`
Budget breakdown by projects.

### GET `/api/budget/schemes`
Budget breakdown by schemes.

### GET `/api/budget/transactions`
Recent transactions.

**Query:** `limit` (default: 10)

---

## 20. Locations (Cascading Selection)

> Base path: `/api/locations`

### GET `/api/locations`
Get locations with filtering. Primary endpoint for cascading district → area → unit selection.

**Access:** Private

**Query Params:**

| Param | Type | Description |
|-------|------|-------------|
| `type` | string | `state` \| `district` \| `area` \| `unit` |
| `parent` | string | Parent location ID (required for area/unit) |
| `search` | string | Search by name or code |
| `isActive` | boolean | Filter by active status |
| `page` | int | Page (default: 1) |
| `limit` | int | Items per page (max 2000, default: 10) |
| `sort` | string | Sort field (default: `name`) |
| `order` | string | `asc` \| `desc` |

**Cascading Selection Flow:**

```
Step 1 — Get all districts:
GET /api/locations?type=district&limit=100

Step 2 — Get areas in selected district:
GET /api/locations?type=area&parent=<districtId>&limit=100

Step 3 — Get units in selected area:
GET /api/locations?type=unit&parent=<areaId>&limit=100
```

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "locations": [
      {
        "_id": "507f1f77bcf86cd799439021",
        "name": "Tirur",
        "code": "TRR",
        "type": "area",
        "parent": {
          "_id": "507f1f77bcf86cd799439011",
          "name": "Malappuram",
          "type": "district"
        },
        "isActive": true
      }
    ],
    "pagination": { "total": 45, "page": 1, "pages": 5 }
  }
}
```

---

### GET `/api/locations/by-type/:type`
Get locations by type (alternate endpoint).

**Query:** `parent` (optional, for cascading)

---

### GET `/api/locations/hierarchy`
Get complete hierarchical tree (state → district → area → unit).

---

### GET `/api/locations/:id`
Get single location.

### POST `/api/locations`
Create location.

**Access:** Private — `super_admin`, `state_admin`

**Request Body:**
```json
{
  "name": "New Area",
  "type": "area",
  "code": "NEW_AREA",
  "parent": "<districtId>"
}
```

### PUT `/api/locations/:id`
Update location.

### DELETE `/api/locations/:id`
Delete/deactivate location.

### GET `/api/locations/export`
Export as CSV/JSON.

---

## 21. Mobile Helpers

> Base path: `/api/mobile`
> Optimized for mobile apps with large default limits.

### GET `/api/mobile/districts`
Get all districts optimized for mobile.

**Query:** `search`, `isActive`, `page`, `limit` (max 10000), `sort`, `order`

---

### GET `/api/mobile/areas`
Get all areas.

**Query:** `district` (filter by district ID), `search`, `isActive`, `page`, `limit`, `sort`, `order`

---

### GET `/api/mobile/units`
Get all units.

**Query:** `district`, `area`, `search`, `isActive`, `page`, `limit`, `sort`, `order`

---

## 22. Notifications

> Base path: `/api/notifications`

### GET `/api/notifications/me`
Get current user's notifications.

**Access:** Private

**Query:** `page`, `limit`, `read` (boolean)

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "...",
        "title": "Application Approved",
        "body": "Your application APP-2024-001 has been approved.",
        "type": "application_approved",
        "isRead": false,
        "createdAt": "2024-05-01T10:00:00.000Z"
      }
    ],
    "unreadCount": 5
  }
}
```

---

### GET `/api/notifications/me/count`
Get unread notification count (for bell badge).

**Response `200`:**
```json
{
  "success": true,
  "data": { "unreadCount": 5 }
}
```

---

### PATCH `/api/notifications/:id/read`
Mark a single notification as read.

---

### PATCH `/api/notifications/read-all`
Mark all notifications as read.

---

### DELETE `/api/notifications/:id`
Delete a notification.

---

## 23. Reports (Application Reports)

> Base path: `/api/reports`

### GET `/api/reports/application/:applicationId`
Get all reports for an application.

**Access:** Private — `reports.read` permission

**Params:** `applicationId` — application number (e.g., `APP-2024-001`) or MongoDB ObjectId

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "applicationId": "APP-2024-001",
    "reports": [
      {
        "id": "...",
        "reportNumber": "RPT-001",
        "reportDate": "2024-05-01",
        "reportType": "field_visit",
        "title": "Home Visit Report",
        "details": "...",
        "status": "submitted",
        "priority": "normal",
        "followUpRequired": false,
        "createdBy": "Admin Name",
        "createdAt": "2024-05-01T10:00:00.000Z"
      }
    ]
  }
}
```

---

### POST `/api/reports/application/:applicationId`
Create report for an application.

**Request Body:**
```json
{
  "reportType": "field_visit",
  "title": "Home Visit Report",
  "details": "Visited beneficiary home...",
  "priority": "normal",
  "followUpRequired": false,
  "followUpDate": null,
  "isPublic": false
}
```

---

## 24. Admin Reports

> Base path: `/api/admin-reports`
> Dynamic form-based reports for admin teams.

### GET `/api/admin-reports`
Get all admin report templates.

**Access:** Private — admin roles

### POST `/api/admin-reports`
Create admin report template.

**Access:** Private — `super_admin`

### GET `/api/admin-reports/:id`
Get report template.

### PUT `/api/admin-reports/:id`
Update report template.

### DELETE `/api/admin-reports/:id`
Delete report template.

### GET `/api/admin-reports/:id/form-config`
Get form configuration for admin report.

### PUT `/api/admin-reports/:id/form-config`
Update form configuration.

### PATCH `/api/admin-reports/:id/form-config/publish`
Publish/unpublish form.

### GET `/api/admin-reports/:id/submissions`
Get all submissions for a report.

### POST `/api/admin-reports/:id/submissions`
Save/create submission.

### PATCH `/api/admin-reports/:id/submissions/:submissionId/submit`
Submit a draft submission.

### PATCH `/api/admin-reports/:id/submissions/:submissionId`
Update a submission.

### DELETE `/api/admin-reports/:id/submissions/:submissionId`
Delete submission.

---

## 25. Program Reports

> Base path: `/api/program-reports`
> Field-level program reporting with file attachments.

### GET `/api/program-reports`
Get all program report templates.

### POST `/api/program-reports`
Create program report template (super_admin only).

### GET `/api/program-reports/:id`
Get report template.

### PUT `/api/program-reports/:id`
Update report template.

### DELETE `/api/program-reports/:id`
Delete report template.

### GET `/api/program-reports/:id/form-config`
Get form configuration.

### PUT `/api/program-reports/:id/form-config`
Update form configuration.

### PATCH `/api/program-reports/:id/form-config/publish`
Publish form.

### GET `/api/program-reports/:id/submissions`
Get submissions.

### POST `/api/program-reports/:id/submissions`
Save submission (field admins: `district_admin`, `area_admin`, `unit_admin`, `area_president`).

### PATCH `/api/program-reports/:id/submissions/:submissionId/submit`
Submit draft.

### PATCH `/api/program-reports/:id/submissions/:submissionId`
Update submission.

### DELETE `/api/program-reports/:id/submissions/:submissionId`
Delete submission.

### POST `/api/program-reports/:id/submissions/:submissionId/attachments`
Upload file attachments (multipart/form-data, field name: `files`, max 50 files).

### DELETE `/api/program-reports/:id/submissions/:submissionId/attachments/:attachmentId`
Remove attachment.

---

## 26. File Upload

> Base path: `/api/upload`

### POST `/api/upload/single`
Upload a single file.

**Access:** Private

**Request:** `multipart/form-data`, field name: `file`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "url": "uploads/2024/05/filename.pdf",
    "fileName": "filename.pdf",
    "mimeType": "application/pdf",
    "size": 102400
  }
}
```

---

### POST `/api/upload/multiple`
Upload multiple files (max 10).

**Request:** `multipart/form-data`, field name: `files`

---

### POST `/api/upload/form`
Upload files for form builder (max 10).

**Request:** `multipart/form-data`, field name: `files`

---

### DELETE `/api/upload/:fileKey`
Delete a file by its key/path.

---

### POST `/api/upload/delete-multiple`
Delete multiple files.

**Request Body:**
```json
{ "fileKeys": ["uploads/2024/05/file1.pdf", "uploads/2024/05/file2.jpg"] }
```

---

### GET `/api/upload/metadata/:fileKey`
Get file metadata.

---

### GET `/api/upload/list`
List files in a folder.

**Query:** `folder` — folder path

---

### POST `/api/upload/presigned-url`
Generate a presigned URL for temporary file access.

**Request Body:**
```json
{
  "fileKey": "uploads/2024/05/filename.pdf",
  "expiresIn": 3600
}
```

---

## 27. SMS

> Base path: `/api/sms`

### POST `/api/sms/send`
Send a single SMS.

**Access:** Private — `state_admin`, `district_admin`, `area_admin`, `unit_admin`, `area_president`

**Request Body:**
```json
{
  "phone": "9999999999",
  "message": "Your application has been approved.",
  "priority": "normal"
}
```
Or using a template:
```json
{
  "phone": "9999999999",
  "templateKey": "application_approved",
  "variables": { "name": "John", "appNumber": "APP-001" },
  "priority": "high"
}
```

`priority` options: `low` | `normal` | `high` | `critical`

---

### POST `/api/sms/send-bulk`
Send bulk SMS (max 1000 recipients).

**Request Body:**
```json
{
  "recipients": [
    { "phone": "9999999999", "name": "John" },
    { "phone": "9876543210", "name": "Jane" }
  ],
  "templateKey": "event_reminder",
  "variables": { "date": "2024-06-01" }
}
```

---

### GET `/api/sms/templates`
Get available SMS templates.

### GET `/api/sms/templates/:key`
Get a specific template.

### POST `/api/sms/templates/:key/preview`
Preview a template with variables.

**Request Body:**
```json
{ "variables": { "name": "John", "amount": "5000" } }
```

### GET `/api/sms/logs`
Get SMS delivery logs.

### GET `/api/sms/stats`
Get SMS statistics.

---

## 28. Speech (Audio Transcription)

> Base path: `/api/speech`

### POST `/api/speech/transcribe`
Convert audio to Malayalam text (Google Speech-to-Text).

**Access:** Private

**Request:** `multipart/form-data`, field name: `audio`

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "transcript": "Transcribed Malayalam text here",
    "confidence": 0.95,
    "language": "ml-IN"
  }
}
```

---

## 29. Website Management

### Banners — `/api/banners`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/banners/public` | Public | Get active banners (for website) |
| GET | `/api/banners` | Private | Get all banners |
| GET | `/api/banners/:id` | Private | Get single banner |
| POST | `/api/banners` | Private — `website.write` | Create banner (multipart: `image`) |
| PUT | `/api/banners/:id` | Private — `website.write` | Update banner |
| DELETE | `/api/banners/:id` | Private — `website.delete` | Delete banner |

---

### News & Events — `/api/news-events`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/news-events/public` | Public | Get published news/events |
| GET | `/api/news-events` | Private | Get all news/events |
| GET | `/api/news-events/:id` | Public | Get single news/event |
| POST | `/api/news-events` | Private — `news.write` | Create (multipart: `image`) |
| PUT | `/api/news-events/:id` | Private — `news.write` | Update |
| DELETE | `/api/news-events/:id` | Private — `news.delete` | Delete |

---

### Brochures — `/api/brochures`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/brochures/public` | Public | Get active brochures |
| GET | `/api/brochures` | Private | Get all brochures |
| GET | `/api/brochures/:id` | Public | Get single brochure |
| POST | `/api/brochures` | Private — `brochures.write` | Create (multipart: `file`) |
| PUT | `/api/brochures/:id` | Private — `brochures.write` | Update |
| DELETE | `/api/brochures/:id` | Private — `brochures.delete` | Delete |
| POST | `/api/brochures/:id/download` | Public | Track download count |

---

### Partners — `/api/partners`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/partners/public` | Public | Get active partners |
| GET | `/api/partners/public/:id` | Public | Get partner details |
| GET | `/api/partners` | Private | Get all partners |
| GET | `/api/partners/:id` | Private | Get single partner |
| POST | `/api/partners` | Private — `partners.write` | Create (multipart: `logo`) |
| PUT | `/api/partners/:id` | Private — `partners.write` | Update |
| DELETE | `/api/partners/:id` | Private — `partners.delete` | Delete |
| GET | `/api/partners/export` | Private | Export |

---

### Website Settings — `/api/website`

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/website/public-settings` | Public | Get public website settings |
| GET | `/api/website/settings` | Private | Get all settings |
| PUT | `/api/website/settings` | Private — `settings.write` | Update settings |
| POST | `/api/website/settings/counter` | Private — `settings.write` | Add counter |
| PUT | `/api/website/settings/counter/:id` | Private — `settings.write` | Update counter |
| DELETE | `/api/website/settings/counter/:id` | Private — `settings.write` | Delete counter |

---

## 30. Application Configuration / Settings

> Base path: `/api/config`

### GET `/api/config/public`
Get public organization configuration (no auth).

**Response `200`:**
```json
{
  "success": true,
  "data": {
    "orgName": "People's Welfare Organization",
    "logoUrl": "/assets/logo.png",
    "primaryColor": "#1a5276",
    "contactEmail": "info@example.com"
  }
}
```

---

### GET `/api/config`
Get all configurations (admin).

**Access:** Private — `config.read` or `settings.read`

### GET `/api/config/:id`
Get single configuration.

### POST `/api/config`
Create configuration.

**Access:** Private — `config.write`

### PUT `/api/config/:id`
Update configuration.

### PUT `/api/config/bulk/update`
Bulk update multiple configurations.

**Request Body:**
```json
{
  "updates": [
    { "id": "...", "value": "new value" }
  ]
}
```

### DELETE `/api/config/:id`
Delete configuration.

### POST `/api/config/logo`
Upload organization logo.

**Request:** `multipart/form-data`, field: `logo`

---

### GET `/api/config/integrations`
Get SMS/Email integration settings.

**Access:** Private — `super_admin`

### PUT `/api/config/integrations`
Update integration settings.

**Access:** Private — `super_admin`

---

## 31. RBAC — Roles & Permissions

> Base path: `/api/rbac`

### GET `/api/rbac/roles`
Get all roles.

**Query:** `category` (`admin`|`coordinator`|`staff`|`beneficiary`|`external`), `type` (`system`|`custom`), `isActive`

### GET `/api/rbac/roles/hierarchy`
Get role hierarchy tree.

### GET `/api/rbac/roles/:id`
Get single role.

### POST `/api/rbac/roles`
Create custom role.

**Request Body:**
```json
{
  "name": "field_officer",
  "displayName": "Field Officer",
  "description": "Field level officer with limited access",
  "level": 5,
  "category": "staff",
  "permissions": ["<permissionId>"],
  "scopeConfig": {
    "allowedScopeLevels": ["area", "unit"],
    "defaultScopeLevel": "area",
    "maxScopes": 5
  }
}
```

### PUT `/api/rbac/roles/:id`
Update role.

### DELETE `/api/rbac/roles/:id`
Delete role.

### GET `/api/rbac/permissions`
Get all permissions.

### POST `/api/rbac/permissions`
Create permission.

### GET `/api/rbac/user-roles/:userId`
Get roles assigned to a user.

### POST `/api/rbac/user-roles/:userId`
Assign role(s) to user.

### DELETE `/api/rbac/user-roles/:userId/:roleId`
Remove role from user.

### GET `/api/rbac/roles/export`
Export roles as CSV/JSON.

---

## 32. Master Data

> Base path: `/api/master-data`

### GET `/api/master-data`
Get all master data configurations.

**Query:**

| Param | Type | Description |
|-------|------|-------------|
| `type` | string | `scheme_stages` \| `project_stages` \| `application_stages` \| `distribution_timeline_templates` \| `status_configurations` |
| `scope` | string | `global` \| `state` \| `district` \| `area` \| `unit` \| `project_specific` \| `scheme_specific` |
| `status` | string | `draft` \| `active` \| `inactive` \| `archived` |

### GET `/api/master-data/:id`
Get single master data entry.

### POST `/api/master-data`
Create master data.

**Request Body:**
```json
{
  "type": "scheme_stages",
  "name": "Standard Welfare Stages",
  "description": "Default stages for welfare schemes",
  "scope": "global",
  "status": "active",
  "configuration": {
    "stages": [
      { "name": "Pending", "order": 1 },
      { "name": "Under Review", "order": 2 }
    ]
  },
  "effectiveFrom": "2024-01-01"
}
```

### PUT `/api/master-data/:id`
Update master data.

### DELETE `/api/master-data/:id`
Delete master data.

---

## 33. Activity Logs

> Base path: `/api/activity-logs`
> Access: `activity_logs.read` permission (super_admin level)

### GET `/api/activity-logs`
Get activity logs with filters and pagination.

**Query:** `page`, `limit`, `action`, `resource`, `userId`, `dateFrom`, `dateTo`, `severity`

### GET `/api/activity-logs/stats`
Get activity statistics.

### GET `/api/activity-logs/trends`
Get activity trends for charts.

### GET `/api/activity-logs/recent`
Get recent activity (dashboard widget).

### GET `/api/activity-logs/filters`
Get available filter options.

### GET `/api/activity-logs/users/:userId/summary`
Get activity summary for a user.

### GET `/api/activity-logs/:id`
Get single activity log entry.

### GET `/api/activity-logs/export`
Export logs.

### DELETE `/api/activity-logs/cleanup`
Clean old logs.

---

## 34. Login Logs

> Base path: `/api/login-logs`
> Access: `login_logs.read` permission

### GET `/api/login-logs`
Get login logs.

### GET `/api/login-logs/stats`
Get login statistics.

### GET `/api/login-logs/suspicious`
Get suspicious login activity.

### GET `/api/login-logs/devices`
Get device breakdown.

### GET `/api/login-logs/locations`
Get geographic location breakdown.

### GET `/api/login-logs/otp-stats`
Get OTP statistics.

### GET `/api/login-logs/export`
Export login logs.

---

## 35. Error Logs

> Base path: `/api/error-logs`
> Access: `error_logs.read` permission

### GET `/api/error-logs`
Get error logs.

### GET `/api/error-logs/stats`
Get error statistics.

### GET `/api/error-logs/grouped`
Get grouped errors (unique errors with occurrence counts).

### GET `/api/error-logs/:id`
Get single error log.

### PATCH `/api/error-logs/:id/resolve`
Mark error as resolved.

### GET `/api/error-logs/export`
Export error logs.

### DELETE `/api/error-logs/cleanup`
Clean old error logs.

---

## 36. Regional Admin Panel

> Base path: `/api/regional-admin`

### GET `/api/regional-admin/applications`
Get applications in scope (READ ONLY for unit/area/district admin).

**Access:** Private — `unit_admin`, `area_president`, `area_admin`, `district_admin`

**Query:** `page`, `limit`, `status`, `sortBy`, `sortOrder`

---

### GET `/api/regional-admin/applications/:id`
Get single application details.

---

### PUT `/api/regional-admin/applications/:id/status`
Update application status (area_admin only).

**Access:** Private — `area_admin`

**Request Body:**
```json
{
  "status": "under_review",
  "comments": "Reviewed and forwarded",
  "approvedAmount": 5000
}
```
`status`: `under_review` | `approved` | `rejected`

---

### GET `/api/regional-admin/dashboard/stats`
Get dashboard statistics for the admin's region.

---

## 37. Global Admin (Franchise Management)

> Base path: `/api/global`
> Access: `isSuperAdmin: true` on user account (global super admin only)

### GET `/api/global/franchises`
List all franchises.

### POST `/api/global/franchises`
Create a new franchise.

**Request Body:**
```json
{
  "name": "Tamil Nadu Chapter",
  "slug": "tamilnadu",
  "domain": "tamilnadu.example.com",
  "settings": { ... }
}
```

### GET `/api/global/franchises/:id`
Get franchise details.

### PUT `/api/global/franchises/:id`
Update franchise.

### DELETE `/api/global/franchises/:id`
Deactivate franchise.

### GET `/api/global/franchises/:id/stats`
Get franchise statistics.

### POST `/api/global/franchises/:id/domains`
Add custom domain to franchise.

**Request Body:** `{ "domain": "custom.domain.com" }`

### DELETE `/api/global/franchises/:id/domains`
Remove domain.

### GET `/api/global/franchises/:id/admins`
List franchise admins.

### POST `/api/global/franchises/:id/admins`
Create franchise admin (super admin for that franchise).

**Request Body:**
```json
{
  "name": "State Admin",
  "phone": "9999999999",
  "email": "admin@franchise.com"
}
```

### DELETE `/api/global/franchises/:id/admins/:userId`
Deactivate franchise admin.

### POST `/api/global/franchises/:id/initialize-rbac`
Initialize default RBAC roles/permissions for a franchise.

### GET `/api/global/stats`
Get cross-franchise analytics.

---

## 38. Common Response Formats

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... },
  "timestamp": "2024-05-24T10:00:00.000Z"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "total": 100,
      "page": 1,
      "pages": 10,
      "limit": 10
    }
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    { "field": "phone", "message": "Phone number is required" }
  ],
  "timestamp": "2024-05-24T10:00:00.000Z"
}
```

---

## Authentication Headers

All protected endpoints require:
```
Authorization: Bearer <JWT_TOKEN>
```

For multi-franchise setup, also send:
```
X-Franchise-Slug: kerala
```
Or access via subdomain: `https://kerala.yourdomain.com/api/...`

---

## Role Hierarchy

| Role | Level | Scope |
|------|-------|-------|
| `super_admin` | Global | All franchises, all data |
| `state_admin` | Franchise | All districts in franchise |
| `district_admin` | District | All areas in district |
| `area_admin` | Area | All units in area |
| `area_president` | Area | Limited write (same as area_admin) |
| `unit_admin` | Unit | Single unit only |
| `project_coordinator` | Project | Assigned project data |
| `scheme_coordinator` | Scheme | Assigned scheme data |
| `beneficiary` | Self | Own applications and profile only |

---

## Multi-Franchise / Multi-Role Flow

1. User calls `POST /api/auth/send-otp` with phone number.
2. User calls `POST /api/auth/verify-otp` with OTP.
3. **If single franchise/role** → receives `token` + `refreshToken` directly.
4. **If multiple franchises or roles** → receives `requiresSelection: true` + `selectionToken` + `franchises[]`.
5. Show franchise picker and role picker UI.
6. User calls `POST /api/auth/select-role` with `selectionToken`, chosen `franchiseId`, and optionally `role`.
7. Receives full `token` + `refreshToken` for that franchise/role context.

---

## PDF Receipt Flow

1. Payment must have `status: "completed"`.
2. Call `GET /api/payments/:id/receipt` to download PDF directly.
3. Or call `POST /api/payments/:id/receipt/file` to get a download URL.
4. For bulk: `POST /api/payments/bulk-receipt` with `paymentIds[]`.

---

*Last updated: May 24, 2026*
