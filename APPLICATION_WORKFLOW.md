# Application Workflow — Complete Guide

> **People ERP** – Form Submission to Disbursement

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites — Form Configuration](#prerequisites--form-configuration)
3. [Role Hierarchy & Access Scope](#role-hierarchy--access-scope)
4. [Phase 1 — Beneficiary Submits Application](#phase-1--beneficiary-submits-application)
5. [Phase 2 — Application Stages (Default Workflow)](#phase-2--application-stages-default-workflow)
   - Stage 1: Application Received
   - Stage 2: Document Verification
   - Stage 3: Field Verification
   - Stage 4: Interview Process (Optional)
   - Stage 5: Final Review
   - Stage 6: Approved
   - Stage 7: Disbursement
   - Stage 8: Completed
6. [Application Status vs Stage — Difference Explained](#application-status-vs-stage--difference-explained)
7. [Role-wise Actions at Each Stage](#role-wise-actions-at-each-stage)
   - Unit Admin
   - Area Admin
   - District Admin
   - State Admin
   - Super Admin
   - Interviewer / Scheme Coordinator
8. [Who Can Move to Next Stage?](#who-can-move-to-next-stage)
9. [Auto-Reject via Eligibility Scoring](#auto-reject-via-eligibility-scoring)
10. [Notifications Sent at Each Step](#notifications-sent-at-each-step)
11. [Approval & Payment Flow](#approval--payment-flow)
12. [Renewal Workflow](#renewal-workflow)
13. [Custom Stage Configuration (Scheme-level Override)](#custom-stage-configuration-scheme-level-override)
14. [Complete End-to-End Flow Diagram](#complete-end-to-end-flow-diagram)

---

## Overview

**People ERP** is a multi-tenant (franchise-based) welfare management system. A **Scheme** is a welfare programme (education, healthcare, housing, etc.). Each scheme can have a **custom form** configured by admins. Beneficiaries submit that form through the mobile/web app. The submitted application then moves through multiple review stages managed by admins at different geographic levels (Unit → Area → District → State).

---

## Prerequisites — Form Configuration

Before a beneficiary can apply, the following must be in place:

| Prerequisite | Who Does It | Where |
|---|---|---|
| Scheme must be `active` | State Admin / Super Admin | Schemes page |
| Form Configuration must exist and be `enabled` | Any admin with scheme access | Form Builder |
| Form must have at least one page with fields | Admin | Form Builder |
| Application window (startDate – endDate) must be open | Admin | Scheme Settings |
| Beneficiary's profile must have location (District, Area, Unit) | Beneficiary | Profile Completion |

> **Important:** If the scheme does not have a valid, enabled Form Configuration in the database, the beneficiary **cannot** see the Apply button. The API returns an error: *"Application form is not available for this scheme"*.

---

## Role Hierarchy & Access Scope

The system has a regional hierarchy: **State → District → Area → Unit**

| Role | Scope | Can See Applications From |
|---|---|---|
| `super_admin` | Global (all franchises) | Everything |
| `state_admin` | Entire state / franchise | All districts, areas, units |
| `district_admin` | One or more districts | Applications tagged to their district(s) |
| `area_admin` | One or more areas | Applications tagged to their area(s) |
| `unit_admin` | One or more units | Applications tagged to their unit(s) |
| `scheme_coordinator` / `project_coordinator` | Scheme/project level | Based on scheme assignment |

Access is determined by the **beneficiary's location** (district/area/unit set during profile completion). An application is automatically tagged with the beneficiary's location at submission time.

---

## Phase 1 — Beneficiary Submits Application

### Step-by-step

```
1. Beneficiary logs in via mobile app / web (BeneficiaryLogin)
2. Completes profile with location (District → Area → Unit)
3. Opens "Schemes" page (BeneficiarySchemes)
4. Selects a scheme with an active form config
5. Views scheme details and clicks "Apply"
6. Fills the multi-page form (BeneficiaryApplication)
7. Submits the form
```

### What happens on the backend at submission

1. **Beneficiary record auto-created/updated** — The system looks up a `Beneficiary` document matching the user's phone number. If not found, it creates one using the location from the user's profile.
2. **Duplicate check** — If the beneficiary already has a non-rejected application for the same scheme, submission is blocked (error: *"You have already applied for this scheme"*). Exception: if a **draft** exists, it is converted to a `pending` application.
3. **Application Number generated** — Format: `APP{YEAR}{6-digit-counter}` (e.g., `APP2026000042`).
4. **Application Stages initialized** — Stages are populated from the scheme's `statusStages` config (or the default 8-stage workflow).
5. **Eligibility Score calculated** — If the form has scoring enabled, every field answer is scored against the defined rules. If the score is below the threshold and auto-reject is ON, the application is immediately set to `rejected`.
6. **Application saved** with status `pending` and `currentStage = "Application Received"`.
7. **Notification sent** — All relevant admins are notified of the new submission.

---

## Phase 2 — Application Stages (Default Workflow)

When no custom stages are configured on the scheme, the following **8 default stages** are used:

---

### Stage 1 — Application Received

| Field | Value |
|---|---|
| Order | 1 |
| Required | Yes |
| Auto-transition | **Yes** (set automatically when application is submitted) |
| Allowed Roles | super_admin, state_admin, district_admin, area_admin, unit_admin |

**What happens:** This stage is set automatically the moment the application is submitted. No manual action needed. The application moves to this stage automatically.

---

### Stage 2 — Document Verification

| Field | Value |
|---|---|
| Order | 2 |
| Required | Yes |
| Auto-transition | No |
| Allowed Roles | super_admin, state_admin, district_admin, area_admin, unit_admin |
| Comment Enabled For | **Unit Admin** (optional comment) |

**What happens:** An admin (typically Unit Admin or Area Admin) reviews the documents uploaded by the beneficiary. They verify that all required documents are present and valid.

**Actions available:**
- View application details and documents
- Add a comment (Unit Admin can add optional comment)
- Upload stage-specific required documents (if configured)
- Mark stage as **Complete** to advance to next stage
- Reject the application

---

### Stage 3 — Field Verification

| Field | Value |
|---|---|
| Order | 3 |
| Required | No (optional stage) |
| Auto-transition | No |
| Allowed Roles | super_admin, state_admin, district_admin, area_admin, unit_admin |
| Comment Enabled For | **Area Admin** (optional comment) |

**What happens:** Physical/field verification of the beneficiary's information. Typically done by an Area Admin or Unit Admin visiting the beneficiary.

**Actions available:**
- Add field verification notes/comment
- Upload verification evidence documents
- Mark stage as **Complete** to proceed
- Mark as **Reverted** to send back to previous stage

> Since `isRequired = false`, this stage can be skipped if not applicable.

---

### Stage 4 — Interview Process

| Field | Value |
|---|---|
| Order | 4 |
| Required | Only if scheme has `requiresInterview = true` |
| Auto-transition | No |
| Allowed Roles | super_admin, state_admin, district_admin, area_admin, unit_admin, **scheme_coordinator** |

**What happens:** If the scheme requires an interview, this stage is where the interview is scheduled and conducted.

**Actions available (via Interviews section):**
- **Schedule interview** — set date, time, type (offline/online), location/meeting link, assign interviewers
- **Complete interview** — record result (`passed`/`failed`), add interviewer comments and report
- **Reschedule** — change date/time with a reason
- **Cancel** interview

After interview is completed with `result = passed`, the stage is marked complete.

> If `requiresInterview = false` on the scheme, this stage is marked `isRequired: false` and can be skipped.

---

### Stage 5 — Final Review

| Field | Value |
|---|---|
| Order | 5 |
| Required | Yes |
| Auto-transition | No |
| Allowed Roles | super_admin, state_admin, **district_admin**, **area_admin** |
| Comment Enabled For | **District Admin** (optional comment) |

**What happens:** A senior admin (District Admin or above) does the final review of all gathered information — form data, documents, field verification notes, interview results (if any) — and decides whether to approve or reject.

**Actions available:**
- View complete application with all stage history
- View eligibility score breakdown
- Add final review comment
- **Approve** → moves to Stage 6 (Approved)
- **Reject** → application status changes to `rejected`
- **Put on hold** → status becomes `on_hold`

---

### Stage 6 — Approved

| Field | Value |
|---|---|
| Order | 6 |
| Required | Yes |
| Auto-transition | No |
| Allowed Roles | super_admin, state_admin, district_admin, area_admin |

**What happens:** The application is formally approved. The approving admin sets the **approved amount** (≤ requested amount). The system:
- Sets `status = approved`
- Records `approvedBy`, `approvedAt`, `approvalComments`
- Creates **Payment records** from the scheme's distribution timeline
- If scheme is renewable, sets `expiryDate` and `renewalDueDate`
- Sends **WhatsApp / notification to beneficiary** informing them of approval

---

### Stage 7 — Disbursement

| Field | Value |
|---|---|
| Order | 7 |
| Required | Yes |
| Auto-transition | No |
| Allowed Roles | super_admin, state_admin, district_admin, area_admin |

**What happens:** The payment is processed and disbursed to the beneficiary. Each installment (from the distribution timeline) is tracked as a separate `Payment` document.

**Payment statuses per installment:** `pending → scheduled → processing → completed / failed`

**Actions available:**
- View payment records
- Mark payments as processed
- Handle failed payments

---

### Stage 8 — Completed

| Field | Value |
|---|---|
| Order | 8 |
| Required | Yes |
| Auto-transition | **Yes** (set automatically when all disbursements are complete) |
| Allowed Roles | super_admin, state_admin, district_admin, area_admin |

**What happens:** All disbursements are done. The application is marked as `completed`. No further action needed.

---

## Application Status vs Stage — Difference Explained

These are two different concepts that run in parallel:

| Concept | Purpose | Values |
|---|---|---|
| **`status`** | High-level application state | `draft`, `pending`, `under_review`, `interview_scheduled`, `interview_completed`, `pending_committee_approval`, `approved`, `rejected`, `on_hold`, `cancelled`, `disbursed`, `completed` |
| **`currentStage`** | Current position in the review pipeline | Stage name string (e.g., `"Document Verification"`) |
| **`applicationStages[]`** | Full history of all stages with completion timestamps | Array of stage objects, each with `status: pending/completed/reverted` |

The `status` field gives the overall disposition of the application. The `applicationStages` array tracks the granular pipeline progress.

---

## Role-wise Actions at Each Stage

### Unit Admin
- **Scope:** Applications from their assigned unit(s)
- **Can view:** All applications from their unit
- **Can do:**
  - View application details, form data, documents
  - Add comments during Document Verification stage
  - Upload documents at stages where required
  - Move stages forward (Document Verification, Field Verification)
  - Cannot approve or make final decisions
- **Cannot do:**
  - Access applications outside their unit
  - Approve/reject applications (Final Review is restricted to District Admin+)
  - Access other franchises' data

---

### Area Admin
- **Scope:** Applications from their assigned area(s)
- **Can view:** All applications from their area (includes all units under it)
- **Can do:**
  - Everything Unit Admin can do
  - Add comments during Field Verification stage
  - Schedule and manage interviews
  - Move applications through Document Verification and Field Verification stages
  - Participate in Final Review stage (can approve if allowed)
- **Cannot do:**
  - Access applications outside their area

---

### District Admin
- **Scope:** Applications from their assigned district(s)
- **Can view:** All applications from their district (includes all areas and units)
- **Can do:**
  - Everything Area Admin can do
  - Add comments during Final Review stage
  - **Approve or reject** applications at the Final Review stage
  - Move applications to Approved stage
  - Oversee disbursement
- **Cannot do:**
  - Access applications outside their district

---

### State Admin
- **Scope:** All applications within the franchise/state
- **Can view:** All applications — no regional restriction
- **Can do:**
  - All actions across all stages
  - Approve, reject, put on hold
  - Override any stage
  - Manage scheme configuration
  - View all dashboards and reports
- **Cannot do:**
  - Access other franchises' data

---

### Super Admin
- **Scope:** Global (all franchises)
- **Can view:** Everything across all franchises
- **Can do:**
  - All actions in all franchises
  - Manage franchise settings
  - Override everything

---

### Interviewer / Scheme Coordinator
- **Scope:** Assigned to Interview Process stage
- **Can do:**
  - View applications scheduled for interview
  - Conduct and complete interviews
  - Record interview results and comments
  - Schedule/reschedule interviews
- **Cannot do:**
  - Approve or reject applications
  - View or act on non-interview stages

---

## Who Can Move to Next Stage?

Stage advancement is controlled by the `allowedRoles` array on each stage. For the **default stages**:

| Stage | Roles That Can Advance |
|---|---|
| Application Received → Document Verification | Auto (all roles) |
| Document Verification → Field Verification | super_admin, state_admin, district_admin, area_admin, **unit_admin** |
| Field Verification → Interview Process | super_admin, state_admin, district_admin, area_admin, **unit_admin** |
| Interview Process → Final Review | super_admin, state_admin, district_admin, area_admin, unit_admin, **scheme_coordinator** |
| Final Review → Approved | super_admin, state_admin, **district_admin**, **area_admin** |
| Approved → Disbursement | super_admin, state_admin, district_admin, area_admin |
| Disbursement → Completed | Auto (after all payments complete) |

> **Key rule:** A user can only act on an application if their assigned region matches the application's tagged region. For example, a `district_admin` for District A cannot see or act on applications from District B.

### Stage Revert
Any admin with access can **revert** a stage — sending it back to a previous stage. When reverting, a reason/comment is required.

---

## Auto-Reject via Eligibility Scoring

If the Form Configuration has scoring enabled (`scoringConfig.enabled = true`):

1. Each field answer is scored against defined rules.
2. A total score percentage is calculated.
3. If the score is **below the threshold** AND `scoringConfig.autoReject = true`:
   - Application `status` is immediately set to `rejected`
   - `reviewComments` is auto-populated: *"Auto-rejected: Eligibility score X% is below the minimum threshold of Y%"*
   - The beneficiary is notified
4. If auto-reject is disabled, the low score is shown to admins as a warning — they can still manually approve.

Admins can view the **score breakdown** (field-by-field) in the Application Detail view.

---

## Notifications Sent at Each Step

| Event | Who Gets Notified | Channel |
|---|---|---|
| Application Submitted | Relevant area admins and coordinators | In-app notification |
| Application moved to Under Review | Area coordinators | In-app notification |
| Application Approved | **Beneficiary** | WhatsApp message |
| Application Rejected | **Beneficiary** | WhatsApp message |
| Interview Scheduled | Beneficiary + interviewers | In-app notification |
| Application Forwarded to next stage | Target role users | In-app notification |
| Renewal Due (approaching expiry) | Beneficiary + admins | Auto-notification (scheduled) |

---

## Approval & Payment Flow

When an application is **approved** (`status = approved`):

```
1. Admin sets approvedAmount (must be ≤ requestedAmount)
2. System checks scheme's distributionTimeline:
   - If scheme has custom timeline → use percentages defined there
   - If no custom timeline → check MasterData templates
   - If no template → default: 100% single payment in 30 days
3. Payment records created for each installment:
   - paymentNumber: PAY{YEAR}{6-digit-counter}
   - Each payment has: amount, expectedDate, status=pending
4. If scheme is renewable:
   - expiryDate = approvedAt + renewalPeriodDays
   - renewalDueDate = expiryDate - autoNotifyBeforeDays
5. Beneficiary notified via WhatsApp
```

**Payment statuses:** `pending → scheduled → processing → completed`

If a payment fails, it is tracked separately and can be retried.

---

## Renewal Workflow

If the scheme has `renewalSettings.isRenewable = true`:

1. After approval, an expiry date is set (default: 365 days).
2. System auto-sends renewal notification to beneficiary **X days before expiry** (configurable via `autoNotifyBeforeDays`, default: 30 days).
3. Beneficiary submits a **Renewal Application** via the **Renewal Form** (separate form configuration per scheme).
4. Renewal application goes through the same stage workflow from the beginning.
5. If `requiresReapproval = false`, renewal is auto-approved.
6. `maxRenewals` controls how many times a beneficiary can renew (0 = unlimited).

---

## Custom Stage Configuration (Scheme-level Override)

Admins can define **custom stages** for a specific scheme under `Scheme → Status Stages`. When custom stages exist:

- The default 8-stage workflow is **replaced entirely** by the custom stages.
- Each stage can have:
  - Custom name and description
  - Custom order
  - Whether it is required (`isRequired`)
  - Which roles can act on it (`allowedRoles`)
  - Whether it auto-transitions
  - Per-role comment configuration (unit admin, area admin, district admin — each can be enabled/required independently)
  - Required documents that must be uploaded before advancing

This allows each scheme to have its own unique approval pipeline (e.g., a 3-step fast-track for emergency relief vs. an 8-step process for housing loans).

---

## Complete End-to-End Flow Diagram

```
ADMIN SIDE                              BENEFICIARY SIDE
──────────────────────────────────────  ────────────────────────────────────────

[Super Admin / State Admin]
  └─ Creates Scheme (active)
  └─ Configures Form (Form Builder)
       - Adds fields, scoring rules
       - Enables form
       - Configures stage workflow

                                        [Beneficiary]
                                          └─ Registers / Logs in
                                          └─ Completes Profile
                                               (sets District, Area, Unit)
                                          └─ Opens Schemes list
                                          └─ Selects scheme
                                          └─ Fills and submits form

[System — Automatic]
  └─ Creates/updates Beneficiary record
  └─ Checks for duplicate applications
  └─ Generates Application Number
  └─ Initializes application stages
  └─ Calculates Eligibility Score
        ├─ Score OK → status = "pending"
        │              currentStage = "Application Received" (auto)
        └─ Score too low + autoReject ON → status = "rejected"
                                           Notify beneficiary

[STAGE 1: Application Received — AUTO]
  └─ currentStage updated automatically
  └─ All admins in the region notified

[STAGE 2: Document Verification]
  Actor: unit_admin / area_admin / district_admin / state_admin / super_admin
  └─ Review documents
  └─ Unit Admin adds comment (optional)
  └─ Upload additional documents if needed
  └─ Mark stage complete → advance to Stage 3
     OR Reject application

[STAGE 3: Field Verification]  ← optional
  Actor: unit_admin / area_admin / district_admin / state_admin / super_admin
  └─ Physical/field verification
  └─ Area Admin adds comment (optional)
  └─ Mark complete → advance to Stage 4
     OR Revert to Stage 2
     OR Reject

[STAGE 4: Interview Process]  ← only if requiresInterview = true
  Actor: scheme_coordinator / area_admin / district_admin / state_admin / super_admin
  └─ Schedule interview (date, time, online/offline, interviewers)
      → Beneficiary & interviewers notified
  └─ Conduct interview
  └─ Record result (passed / failed) + comments
  └─ If passed → Mark complete → advance to Stage 5
     If failed → Reject or re-schedule

[STAGE 5: Final Review]
  Actor: district_admin / area_admin / state_admin / super_admin
  └─ Review all gathered data:
       - Form data
       - Documents
       - Field verification notes
       - Interview report
       - Eligibility score breakdown
  └─ District Admin adds review comment (optional)
  └─ Decision:
       ├─ APPROVE → advance to Stage 6 (Approved)
       ├─ REJECT  → status = "rejected", notify beneficiary
       └─ HOLD    → status = "on_hold"

[STAGE 6: Approved]
  Actor: district_admin / area_admin / state_admin / super_admin
  └─ Set approvedAmount
  └─ System creates Payment records (installments)
  └─ Renewal expiry date set (if renewable scheme)
  └─ Beneficiary notified via WhatsApp ✓

[STAGE 7: Disbursement]
  Actor: district_admin / area_admin / state_admin / super_admin
  └─ Process each payment installment
  └─ Track payment status per phase

[STAGE 8: Completed — AUTO]
  └─ All payments disbursed
  └─ status = "completed"
  └─ renewalStatus = "active" (if renewable)
       └─ Auto-notification X days before expiry
           → Beneficiary submits renewal application
           → Same workflow repeats
```

---

## Summary of Key Rules

1. **Form must be enabled** in the database for a scheme before any beneficiary can apply.
2. **Beneficiary profile location** (unit/area/district) determines which admins can see and act on the application.
3. **Stage advancement** requires the acting user's role to be in that stage's `allowedRoles` list.
4. **Regional access** is enforced strictly — an admin can only access applications within their assigned geographic scope.
5. **Eligibility scoring** can auto-reject applications below the defined threshold.
6. **Approval** is restricted to district_admin and above (by default).
7. **Unit Admin** is the entry-level admin — can review documents and field verify, but cannot approve.
8. **Custom stages** per scheme completely replace the default 8-stage pipeline.
9. **Payments** are automatically created as installment records upon approval, based on the scheme's distribution timeline.
10. **Renewals** are triggered automatically by the system when the approval period approaches expiry.
