# CEDI Loan Platform — Master Build Blueprint

> **How to use this document:** Every section ends with a `### Build Tasks` checklist. Work top-to-bottom. Tick each box as you implement it. The document is self-contained — you can pick it up at any time and know exactly what is done and what is next.
>
> **Architecture Scope:** Admin Portal · Backend API · cedLoan PWA
> **Database:** PostgreSQL (Sequelize ORM) — schemas: `cedi_auth`, `cedi_loans`, `cedi_payments`, `cedi_notifications`, `cedi_config`
> **Last Revised:** 2026-05-06

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Role Hierarchy & Permissions Matrix](#2-role-hierarchy--permissions-matrix)
3. [Data Flow: End-to-End Loan Lifecycle](#3-data-flow-end-to-end-loan-lifecycle)
4. [cedLoan PWA — Customer-Facing Features](#4-cedloan-pwa--customer-facing-features)
5. [Admin Portal — User Menu](#5-admin-portal--user-menu)
6. [Admin Portal — Order Menu](#6-admin-portal--order-menu)
7. [Admin Portal — Credit Review Menu](#7-admin-portal--credit-review-menu)
8. [Admin Portal — Pre-Collection Menu](#8-admin-portal--pre-collection-menu)
9. [Admin Portal — Collection Menu](#9-admin-portal--collection-menu)
10. [Admin Portal — Config Menu](#10-admin-portal--config-menu)
11. [Admin Portal — Marketing & Notifications](#11-admin-portal--marketing--notifications)
12. [Loan Status State Machine](#12-loan-status-state-machine)
13. [KYC Data Requirements](#13-kyc-data-requirements)
14. [Backend API Route Map](#14-backend-api-route-map)
15. [Worker App Usage Tracking](#15-worker-app-usage-tracking)
16. [Master Implementation Checklist](#16-master-implementation-checklist)

---

## 1. System Architecture Overview

```
+-------------------------------------------------------------------------+
|                        CEDI LOAN PLATFORM                               |
|                                                                         |
|  +-----------------+   +-----------------+   +-----------------+        |
|  |  cedLoan PWA    |   |  Admin Portal   |   |  Worker View    |        |
|  | (React/TS + SW) |   |  (React SPA)    |   | (Admin Portal   |        |
|  | Customer-facing |   | Management &    |   |  officer mode)  |        |
|  | Loan requests   |   | Operations      |   | Case management |        |
|  +--------+--------+   +--------+--------+   +--------+--------+        |
|           +---------------------+-----------------------+               |
|                                 |                                       |
|                   +-------------+-------------+                         |
|                   |     Express.js Backend    |                         |
|                   |  Node.js REST API+Socket  |                         |
|                   |  JWT Auth · Firebase OTP  |                         |
|                   +-------------+-------------+                         |
|             +----------------+--+------------------+                   |
|  +----------+----------+  +--+------+  +-----------+-------+           |
|  |  PostgreSQL DB      |  | Firebase |  |  File Storage    |           |
|  |  5 Schemas          |  | (OTP)    |  |  (POP / Docs)    |           |
|  |  Sequelize ORM      |  +----------+  +------------------+           |
|  +---------------------+                                               |
+-------------------------------------------------------------------------+
```

### Technology Stack

| Layer         | Technology                               | Notes                              |
| ------------- | ---------------------------------------- | ---------------------------------- |
| Customer PWA  | React + TypeScript, Tailwind CSS         | Service Worker for offline support |
| Admin SPA     | React (JS), Tailwind CSS, Netlify deploy |                                    |
| Backend       | Node.js, Express.js                      | JWT + Firebase OTP                 |
| Database      | PostgreSQL via Sequelize                 | 5 logical schemas                  |
| Real-time     | Socket.IO (WebSocket service)            | Case updates, notifications        |
| Notifications | SMS + Email (configurable provider)      |                                    |
| File Upload   | Multer to local/cloud storage            | POP images, ID docs                |

### Database Schemas

| Schema               | Models                                           | Purpose                     |
| -------------------- | ------------------------------------------------ | --------------------------- |
| `cedi_auth`          | `Role`, `User`, `Admin`                          | Authentication & identity   |
| `cedi_loans`         | `LoanLevel`, `LoanTerm`, `Loan`, `LoanClearance` | All loan data               |
| `cedi_payments`      | `Payment`                                        | MoMo / bank payment records |
| `cedi_notifications` | `Notification`                                   | All notification records    |
| `cedi_config`        | `AppConfig`, `Content`                           | App-wide configuration      |

### Build Tasks

- [ ] Verify all 5 PostgreSQL schemas exist and Sequelize connects cleanly (`backend/config/database.js`)
- [ ] Confirm Firebase project is set up and OTP works end-to-end
- [ ] Confirm file upload endpoint (`/api/uploads`) is working for ID docs and POP images
- [ ] Confirm Socket.IO server initialises on backend startup (`backend/services/websocketService.js`)
- [ ] Confirm Netlify deploys are configured for both `admin/` and `cedLoan/`

---

## 2. Role Hierarchy & Permissions Matrix

> Roles stored in `cedi_auth.roles`. `permissions` column is JSONB with keys: `menus{}`, `subMenus{}`, `dataAccess{}`, `actions{}`, `uiElements{}`, `bulkActions{}`.

### Role Definitions

| Hierarchy | Role Enum               | Display Name           | Scope                                           |
| --------- | ----------------------- | ---------------------- | ----------------------------------------------- |
| 1         | `super-admin`           | Super Admin            | Full system access + server logs + bin restore  |
| 2         | `admin`                 | Admin                  | All operational menus                           |
| 3         | `local-manager`         | Local Manager          | Regional/branch operations                      |
| 4         | `review-lead`           | Review Lead            | Supervises review officers                      |
| 5         | `review-officer`        | Review Officer         | Loan review & POP review                        |
| 6         | `collection-lead`       | Collection Lead        | Manages collection officers                     |
| 7         | `collection-officer`    | Collection Officer     | Assigned collection cases                       |
| 8         | `precollection-lead`    | Pre-Collection Lead    | Manages pre-collection officers                 |
| 9         | `precollection-officer` | Pre-Collection Officer | Assigned pre-collection cases                   |
| 10        | `customer-service`      | Customer Service       | User lookups, basic support                     |

### Menu Access by Role

| Menu / Sub-menu                     | Super Admin | Admin | Local Mgr | Review Lead | Review Officer | Collection Lead | Collection Officer | PreColl Lead | PreColl Officer |
| ----------------------------------- | :---------: | :---: | :-------: | :---------: | :------------: | :-------------: | :----------------: | :----------: | :-------------: |
| **Users > User List**               |      Y      |   Y   |     Y     |      R      |       -        |        -        |         -          |      -       |        -        |
| **Users > Find One**                |      Y      |   Y   |     Y     |      Y      |       Y        |        Y        |         Y          |      Y       |        Y        |
| **Users > Manual Registration**     |      Y      |   Y   |     Y     |      -      |       -        |        -        |         -          |      -       |        -        |
| **Users > User Management**         |      Y      |   Y   |     Y     |      -      |       -        |        -        |         -          |      -       |        -        |
| **Users > Level Assignment**        |      Y      |   Y   |     -     |      -      |       -        |        -        |         -          |      -       |        -        |
| **Marketing**                       |      Y      |   Y   |     Y     |      -      |       -        |        -        |         -          |      -       |        -        |
| **Notification Manager**            |      Y      |   Y   |     -     |      -      |       -        |        -        |         -          |      -       |        -        |
| **Orders > Order Lending**          |      Y      |   Y   |     Y     |      Y      |       -        |        -        |         -          |      -       |        -        |
| **Orders > Order Repayment**        |      Y      |   Y   |     Y     |      Y      |       Y        |        -        |         -          |      -       |        -        |
| **Orders > Review Payment**         |      Y      |   Y   |     Y     |      Y      |       Y        |        -        |         -          |      -       |        -        |
| **Orders > Extension Order**        |      Y      |   Y   |     Y     |      Y      |       Y        |        -        |         -          |      -       |        -        |
| **Credit Review > Assign**          |      Y      |   Y   |     Y     |      Y      |       -        |        -        |         -          |      -       |        -        |
| **Credit Review > List**            |      Y      |   Y   |     Y     |      Y      |       Y        |        -        |         -          |      -       |        -        |
| **Credit Review > Count**           |      Y      |   Y   |     Y     |      Y      |       -        |        -        |         -          |      -       |        -        |
| **Pre-Collection > Pre-Assignment** |      Y      |   Y   |     Y     |      -      |       -        |        -        |         -          |      Y       |        -        |
| **Pre-Collection > Pre-Repayment**  |      Y      |   Y   |     Y     |      -      |       -        |        -        |         -          |      Y       |        Y        |
| **Pre-Collection > Rank 1**         |      Y      |   Y   |     Y     |      -      |       -        |        -        |         -          |      Y       |        -        |
| **Pre-Collection > Shiftiest**      |      Y      |   Y   |     Y     |      -      |       -        |        -        |         -          |      Y       |        Y        |
| **Collection > List**               |      Y      |   Y   |     Y     |      -      |       -        |        Y        |         Y          |      -       |        -        |
| **Collection > Rank 1**             |      Y      |   Y   |     Y     |      -      |       -        |        Y        |         -          |      -       |        -        |
| **Collection > Rank 2**             |      Y      |   Y   |     Y     |      -      |       -        |        Y        |         -          |      -       |        -        |
| **Collection > App Usage**          |      Y      |   Y   |     Y     |      -      |       -        |        Y        |         -          |      Y       |        -        |
| **Config**                          |      Y      |   Y   |     -     |      -      |       -        |        -        |         -          |      -       |        -        |
| **Server Logs / Bin**               |      Y      |   -   |     -     |      -      |       -        |        -        |         -          |      -       |        -        |

> Y = Full access, R = Read-only, - = No access

### Build Tasks

- [ ] Run `backend/scripts/seedRoles.js` — verify all 10 roles exist in DB with correct `hierarchy` values
- [ ] Implement `backend/middleware/roleAuth.js` — extract role from JWT, compare against required role for each route
- [ ] Implement `backend/middleware/permissions.js` — check `permissions.menus[menuKey]` JSONB before serving any admin route
- [ ] In Admin Portal: read `admin.role` from JWT on login; store in `AuthContext`; hide/show nav items based on role using the matrix above
- [ ] Implement `customPermissions` override merge in `permissions.js` — if admin has a custom override, it takes precedence over role default

---

## 3. Data Flow: End-to-End Loan Lifecycle

```
CUSTOMER (cedLoan)            BACKEND                       ADMIN PORTAL
------------------            -------                       ------------

1. Register (lightweight)
   Phone OTP -> Firebase
   Name + DOB + gender +
   address + PIN only
          |
          v
2. Login (Phone + PIN)
          |
          v
3. Tap "Apply for Loan"
   -----------------------------------------------------------------------
   BACKEND GUARD 1: Active loan check
   if activeLoan (status IN [pending, under-review, approved,
   disbursed, active, overdue]) -> HTTP 409

   BACKEND GUARD 2: KYC completeness check
   if kycIsComplete(user) === false -> HTTP 422
   + list of missing KYC fields returned
          |
          | (if KYC incomplete - first time only)
          v
   KYC GATE (inside loan application flow)
   ----------------------------------------
   Step K1: Work Info (employer, income, status)
   Step K2: Education Info
   Step K3: Emergency Contacts (min 1)
   Step K4: ID Verification (type, number, upload)
   -> PATCH /api/users/me/kyc
   -> kycComplete = true
   -> proceed to loan form
   ----------------------------------------
          |
          | (if KYC complete)
          v
4. Loan Application Form
   Level / Amount / Term / Purpose
   Live fee breakdown shown
   Confirm & Submit
   -> POST /api/loans/apply
          |
          v
   BACKEND: Save Loan (status=pending)
   Auto-approval check:
     if amount <= auto_approval_limit AND level criteria met
     -> status = approved immediately
     else -> status = pending -> under-review
          |
          v
5. Loan Under Review <----------- Review Lead assigns review officer
   (status: under-review)         (Admin: Credit Review -> Assign)
          |                       Officer reviews, approves or rejects
          v
6. Loan Approved <--------------- status = approved
   Customer notified              Disbursement triggered (MoMo/bank)
   (SMS + push)
          |
          +-- Disbursement SUCCESS -> status = disbursed -> active
          |     dueDate = disbursementDate + termInDays
          |     Notify customer: "GH@ X disbursed to your account"
          |
          +-- Disbursement FAILURE -> appears in Orders > Order Lending
                Admin: Retry or Mark Manual Send
                On success -> same as SUCCESS path above
          |
          v
7. Loan Active (countdown running)
   Pre-Collection officers assigned (D-7 to D-1 before due)
   Officers call customers to remind about repayment
          |
          v
8. Repayment
   +-- Customer pays via cedLoan (MoMo)
   |       Payment API -> Payment record
   |       If full -> status = completed
   |
   +-- Manual (bank/cash/MoMo outside system)
           Admin: Orders > Order Repayment (submit POP)
           Admin: Orders > Review Payment (confirm POP)
           On confirmation -> loan balance updated
           If remainingBalance <= 0 -> status = completed
          |
          v
9. Loan Completed
   totalLoansCompleted++
   Level progression evaluated (auto-promote if eligible)
   Customer notified
          |
          v
10. NEW LOAN NOW ELIGIBLE (Guard 1 passes)

OVERDUE PATH:
   dueDate passed & balance > 0 -> status = overdue
   isOverdue = true, overdueDays incremented daily
   Collection Officers assigned (Collection > List)
   Payment received -> Review Payment -> completed
   No payment -> defaulted (manual admin decision)

EXTENSION PATH:
   Customer (/loan-extension) OR Admin (Orders > Extension Order)
   Selects extension days, agrees to fee
   extendedDueDate = max(dueDate, extendedDueDate) + extensionDays
   extensionFee += calculatedFee, extensionCount++
   Notify: "Due date extended to [date]. Fee: GH@ X"
```

### Build Tasks

- [ ] Implement `GET /api/loans/active-check` — returns `{ hasActiveLoan, loan }` for authenticated user
- [ ] Implement `POST /api/loans/apply` with both guards (active loan + KYC) before creating the loan record
- [ ] Add auto-approval logic: compare amount vs `AppConfig.auto_approval_limit`; if eligible, set `status=approved` immediately
- [ ] Implement daily cron (`backend/services/overdueTrackingService.js`) — set `status=overdue`, increment `overdueDays`, recalculate `totalOverdueFee`
- [ ] On loan `status = completed`: trigger level progression check (`backend/services/levelProgressionService.js`)
- [ ] On disbursement failure: set a flag so the loan surfaces in the Order Lending queue; do NOT delete the loan record

---

## 4. cedLoan PWA — Customer-Facing Features

---

### 4.1 Registration — Lightweight Account Creation

> **Key Design Decision:** Registration only collects the minimum needed to create an account and log in. Full KYC is collected at the point of first loan application. This reduces drop-off during sign-up.

**Step 1 — Phone Number Entry** (`/register`)

- User enters phone number (Ghana format, e.g. `0244123456`)
- Frontend formats to E.164 (`+233244123456`)
- Check: `GET /api/auth/check-phone` — if already registered: show "Already have an account? Log in"
- On proceed: `POST /api/auth/send-otp` -> Firebase sends 6-digit OTP
- Store `registrationPhone` in `localStorage`

**Step 2 — OTP Verification** (`/register/verify-otp`)

- User enters 6-digit OTP
- Firebase verifies via `phoneAuthService.verifyCode(otp)`
- On success: navigate to Step 3

**Step 3 — Personal Information** (`/register/personal-info`)

- First Name (required)
- Last Name (required)
- Date of Birth (required — validate 18+ on client AND server)
- Gender (required)
- Address: Street, City, Region (required), Country (locked to "Ghana")
- Profile photo upload (optional)

**Step 4 — Set PIN** (`/register/set-pin`)

- 4-digit numeric PIN (required)
- Confirm PIN
- PIN is bcrypt-hashed before storage — never stored plain text
- On success: `POST /api/auth/register/complete`
  - Creates User record with `registrationComplete = true`, `isPhoneVerified = true`, `kycComplete = false`
  - Returns JWT
  - Redirect to Home `/`

> **NOT collected at registration:** employment, education, emergency contacts, ID documents. These are collected at the KYC Gate when the user first applies for a loan.

### Build Tasks — Registration

- [ ] `cedLoan/src/pages/Register/Register.js` — Step 1: add `GET /api/auth/check-phone` call; prevent duplicate registration
- [ ] `cedLoan/src/pages/Register/VerifyOTP.js` — Step 2: on success navigate to `/register/personal-info`
- [ ] `cedLoan/src/pages/Register/PersonalInfo.js` — Step 3: firstName, lastName, DOB (18+ validation), gender, address; save to `localStorage` on each change
- [ ] `cedLoan/src/pages/Register/SetPin.js` — Step 4: PIN + confirm; on submit call `POST /api/auth/register/complete`; store returned JWT as `userToken`
- [ ] `backend/routes/auth.js` — `GET /api/auth/check-phone`: query User by `phoneNumber`; return `{ exists: true/false }`
- [ ] `backend/routes/auth.js` — `POST /api/auth/register/complete`: validate body, hash PIN with bcrypt, create User, return JWT
- [ ] Add `kycComplete: { type: DataTypes.BOOLEAN, defaultValue: false }` to User model (`backend/models/auth/User.js`)
- [ ] Remove ID verification, work info, education, emergency contacts from `/register/*` routes — they now live under `/loan-application/kyc/*`

---

### 4.2 Login

- Phone number + 4-digit PIN
- Backend: find User by `phoneNumber` -> compare bcrypt PIN -> return JWT
- Store JWT as `localStorage.userToken`
- Check `user.isActive` — if false: show "Your account has been deactivated. Contact support."
- Check `user.mustChangePinOnLogin` — if true: force redirect to Change PIN before any navigation
- On success: redirect to Home `/`

### Build Tasks — Login

- [ ] `cedLoan/src/pages/Login.js` — confirm error handling for inactive accounts and `mustChangePinOnLogin` redirect
- [ ] `backend/routes/auth.js` — `POST /api/auth/login`: find by phone, compare PIN hash, check `isActive`, return `{ token, user: { id, firstName, currentLoanLevel, kycComplete, mustChangePinOnLogin, ... } }`
- [ ] Ensure `kycComplete` and `mustChangePinOnLogin` are in the login response so the frontend can act on them immediately

---

### 4.3 Home / Dashboard (`/`)

- If active loan exists: show loan status card prominently with countdown to `dueDate` or `extendedDueDate`
- If no active loan: show "Apply for a Loan" CTA (enabled only if `isActive = true`)
- Quick actions: Pay Now (if active loan), View History, Calculator
- Promotional banners from `GET /api/config/public` (content type records)
- Notification bell with unread count badge

### Build Tasks — Home/Dashboard

- [ ] `cedLoan/src/pages/Home/` — on mount, call `GET /api/loans/active-check`; render loan status card or Apply CTA based on response
- [ ] Countdown timer component: `dueDate` or `extendedDueDate` -> days/hours remaining; show red if 3 days or fewer
- [ ] Promotional banners: `GET /api/config/public` -> filter `type = 'banner'` content records -> carousel
- [ ] Notification bell: `GET /api/notifications?unreadOnly=true` -> show count badge

---

### 4.4 Loan Application with KYC Gate (`/loan-application`)

> **This is where KYC is collected — not at registration.** When a user taps "Apply for a Loan" for the first time (or any time their KYC is incomplete), the app walks them through the KYC steps before showing the loan form. Once KYC is complete it is never asked again unless fields are missing.

#### KYC Gate Flow (triggered if `user.kycComplete === false`)

The KYC Gate intercepts the loan application route. It is a stepped flow with a progress indicator.

**KYC Step 1 — Work Information** (`/loan-application/kyc/work`)

| Field              | Required                        |
| ------------------ | ------------------------------- |
| Employment Status  | Yes (employed/self-employed/unemployed/student/retired) |
| Employer Name      | If employed or self-employed    |
| Job Title          | If employed                     |
| Monthly Income     | Yes (decimal > 0)               |
| Work Address       | Optional                        |
| Years of Employment| Optional                        |

**KYC Step 2 — Education Information** (`/loan-application/kyc/education`)

| Field           | Required |
| --------------- | -------- |
| Education Level | Yes (primary/secondary/diploma/bachelor/master/doctorate/vocational/other) |
| Institution Name | Optional |
| Field of Study  | Optional |
| Graduation Year | Optional |

**KYC Step 3 — Emergency Contacts** (`/loan-application/kyc/emergency-contacts`)

- Minimum 1, maximum 3 contacts
- Each contact: Name (required), Relationship (required), Phone Number (required), Email (optional)
- Dynamic add/remove rows

**KYC Step 4 — ID Verification** (`/loan-application/kyc/id-verification`)

| Field         | Required |
| ------------- | -------- |
| ID Type       | Yes (National ID / Passport / Driver's License / Voter's ID) |
| ID Number     | Yes      |
| Front of ID   | Yes (JPEG/PNG, max 5MB) |
| Back of ID    | Yes (same constraints) |

- `idVerified` defaults to `false`; admin manually verifies from User Details panel
- On upload success, returned URL stored in `user.idDocuments[]`

**On KYC Completion:**

- `PATCH /api/users/me/kyc` with all KYC fields
- Backend sets `user.kycComplete = true`
- Redirect to the Loan Application Form
- All KYC steps persist in `localStorage` keyed by `userToken` — user can resume if they close the app mid-KYC

#### Loan Application Form (shown after KYC passes)

**Guard check (frontend AND backend):**

```
GET /api/loans/active-check
  hasActiveLoan = true  -> show active loan card, disable apply
  hasActiveLoan = false -> show loan form
```

**Form Fields:**

1. Loan Level — Dropdown showing only levels <= `user.currentLoanLevel`; loaded from `GET /api/config/loan-levels`
2. Amount — Number input between `LoanLevel.minAmount` and `LoanLevel.maxAmount`; live validation
3. Term — Button group from `LoanLevel.availableTerms` (e.g. 7, 14, 30 days)
4. Purpose — Dropdown: business / education / medical / home-improvement / debt-consolidation / emergency / other
5. Fee Breakdown Preview (updates live):
   - Principal
   - Interest: `principal x interestRate%`
   - Service Fee: `principal x serviceFeePct%`
   - Admin Fee: `principal x administrationFeePct%`
   - Commitment Fee: `principal x commitmentFeePct%`
   - **Total Repayable**
   - Amount You Receive: `principal - (serviceFee + adminFee + commitmentFee)`
6. Confirm & Submit

**On Submit `POST /api/loans/apply`:**

- Backend re-checks active loan guard (HTTP 409 if active)
- Backend re-checks KYC (HTTP 422 if incomplete)
- Validates amount vs level limits
- Calculates and stores all fees
- Creates Loan record `status = pending` (or `approved` if auto-approval)
- Sends Notification: "Loan application received"

### Build Tasks — Loan Application & KYC Gate

- [ ] Create `cedLoan/src/pages/LoanApplication/KycGate.js` — multi-step wrapper with progress bar (Step 1 of 4)
- [ ] Create `cedLoan/src/pages/LoanApplication/kyc/WorkInfo.js` — employment fields; save to `localStorage` on each change
- [ ] Create `cedLoan/src/pages/LoanApplication/kyc/EducationInfo.js`
- [ ] Create `cedLoan/src/pages/LoanApplication/kyc/EmergencyContacts.js` — dynamic add/remove rows; min 1 required
- [ ] Create `cedLoan/src/pages/LoanApplication/kyc/IdVerification.js` — dual image upload (front + back); upload progress; store returned URLs
- [ ] `backend/routes/users.js` — `PATCH /api/users/me/kyc`: validate all KYC fields; update User; set `kycComplete = true`
- [ ] Implement `cedLoan/src/pages/LoanApplication/LoanApplication.tsx` — loan level selector, amount input, term picker, purpose dropdown, live fee calculator, submit
- [ ] Fee calculator: wire to `AppConfig` rates via `GET /api/config/public`; update totals on amount/term change in real time
- [ ] `backend/routes/loans.js` — `POST /api/loans/apply`: active loan guard -> KYC guard -> validate amount vs level -> calculate fees -> save loan
- [ ] In `cedLoan` routing: if user navigates to `/loan-application` and `kycComplete === false`, render `KycGate` before the loan form
- [ ] On HTTP 422 (`KYC_INCOMPLETE`): parse `missingFields` -> pre-navigate KycGate to the step containing the first missing field
- [ ] Move existing `cedLoan/src/pages/Register/WorkInfo.js`, `EducationInfo.js`, `EmergencyContacts.js`, `IdVerification.js` into `cedLoan/src/pages/LoanApplication/kyc/` and update all imports

---

### 4.5 Loan History (`/history`)

- All loans for authenticated user, newest first
- Each row: Loan ID, Amount, Status badge, Application Date, Due Date, Total Paid, Balance
- Tap to expand: payment breakdown, extension records, clearance records
- Status badge colours: pending=grey, active=blue, overdue=red, completed=green, rejected=orange

### Build Tasks — Loan History

- [ ] `cedLoan/src/pages/History/` — `GET /api/loans?userId=me`; paginated; newest first
- [ ] Expandable row: `GET /api/payments/:loanId` for payments; `GET /api/loans/:id` for full loan detail with extensions and clearances

---

### 4.6 Notifications (`/notifications`)

- List of all Notification records for authenticated user
- Unread items highlighted; tap to mark as read
- Badge count on bottom nav icon
- Mark-all-read button

### Build Tasks — Notifications

- [ ] `cedLoan/src/pages/Notifications/` — load list on mount; unread badge count on bottom nav
- [ ] Mark-all-read: `PATCH /api/notifications/read-all`
- [ ] `backend/routes/notifications.js` — add `PATCH /api/notifications/read-all` endpoint

---

### 4.7 Profile (`/profile`)

- View and edit all registration and KYC data
- Edit sections: Personal Info, Work Info, Education, Emergency Contacts
- Re-upload ID documents if expired or rejected
- Change PIN (requires current PIN for verification)
- View current loan level and level progression history

### Build Tasks — Profile

- [ ] `cedLoan/src/pages/Profile/` — load `GET /api/auth/me`; render all fields in editable sections; each section has its own Save button
- [ ] `PATCH /api/users/me` with only the changed fields
- [ ] Change PIN: current PIN -> new PIN -> confirm -> `PATCH /api/auth/change-pin`
- [ ] If `idVerified = false` and `idDocuments` exist: show "ID Pending Verification" notice; allow re-upload

---

### 4.8 Loan Extension (`/loan-extension`)

**Eligibility guards (frontend + backend):**

- Active loan with `status = active` or `overdue`
- `extensionCount < AppConfig.max_extension_count`

**Extension Form:**

1. Show current loan: amount, current due date, remaining balance
2. Select extension days from configured options (e.g. 3, 5, 7 days from AppConfig)
3. Calculate and display fee: `extensionDays x AppConfig.daily_extension_fee_rate`
4. Select fee payment method
5. Confirm -> `PUT /api/loans/:id/extend`

**On approval:**

- `loan.extendedDueDate = max(dueDate, extendedDueDate) + extensionDays`
- `loan.extensionDays += extensionDays`
- `loan.extensionFee += calculatedFee`
- `loan.extensionCount++`
- Notification: "Your due date has been extended to [new date]. Fee: GH@ X"

### Build Tasks — Loan Extension

- [ ] `cedLoan/src/pages/LoanExtension/` — eligibility check; extension days selector; live fee display; submit
- [ ] `backend/routes/loanExtension.js` (exists) — verify all field updates are applied; add max extension count guard
- [ ] Add `max_extension_count` and `daily_extension_fee_rate` to `AppConfig` keys

---

### 4.9 Loan Rate Calculator (`/loan-rate-calculation`)

- Public page — no authentication required
- Inputs: loan amount, term (days), level
- Live outputs: interest, fees breakdown, total repayable, amount received
- Rates from `GET /api/config/public` — always shows current live rates (never hardcoded)

### Build Tasks — Rate Calculator

- [ ] `cedLoan/src/pages/LoanRateCalculation/` — confirm it reads from live AppConfig rates, not hardcoded values

---

## 5. Admin Portal — User Menu

---

### 5.1 User List (`/users/list`)

**Table Columns:**

| Column     | Data Source                        |
| ---------- | ---------------------------------- |
| User ID    | `user.userId` (6-digit display ID) |
| Full Name  | `firstName + " " + lastName`       |
| Phone      | `phoneNumber`                      |
| Email      | `email`                            |
| Level      | `currentLoanLevel`                 |
| KYC Status | `kycComplete` badge                |
| Status     | `isActive` badge (green/red)       |
| Registered | `createdAt` formatted date         |
| Operations | Action button group                |

**Operations Column:**

- **Details** — Opens a 7-tab side panel or modal:
  - Tab 1: Personal Info — all personal fields, profile photo, DOB, gender, address
  - Tab 2: Work & Education — employment status, employer, income, job title, education level, institution
  - Tab 3: Emergency Contacts — contacts table: name, relationship, phone, email
  - Tab 4: ID Verification — ID type, number, uploaded images, verification status; "Mark Verified" / "Mark Rejected" buttons -> sets `idVerified`, `idVerificationDate`
  - Tab 5: Loan History — all loans with status, amounts, dates; click to open loan detail
  - Tab 6: Payment History — all payments and clearances; amount, method, status, dates
  - Tab 7: Account Info — `registrationComplete`, `kycComplete`, `isActive`, `lastLogin`, `totalLoansCompleted`, `currentLoanLevel`, level progression history table
- **Activate / Deactivate** — Toggle `user.isActive`; require confirmation dialog; send notification to user; create audit entry

**Filters above table:**

- Status: Active / Inactive / All
- KYC: Complete / Incomplete
- Level: Level 1 - N
- Date range: registration date
- Search: firstName, lastName, phoneNumber, email, userId

**Pagination:** Server-side; default 20 per page.

### Build Tasks — User List

- [ ] `admin/src/pages/UserList.js` — add KYC Status column and all filters above
- [ ] Create `admin/src/components/UserDetailModal.js` — 7-tab component as described above
- [ ] Tab 4: "Mark Verified" -> `PATCH /api/users/:id` with `{ idVerified: true, idVerificationDate: NOW }`
- [ ] Activate/Deactivate -> confirmation dialog -> `PATCH /api/users/:id/activate` or `/deactivate`
- [ ] `backend/routes/users.js` — `GET /api/users` supports filters: `isActive`, `kycComplete`, `currentLoanLevel`, date range, search

---

### 5.2 Find One (`/users/find`)

- Search bar with type-ahead (debounced 300ms)
- Searches: `email`, `phoneNumber`, `firstName + lastName`, `userId`
- Click result -> opens `UserDetailModal` (reuse same component as User List)
- Available to ALL roles

### Build Tasks — Find One

- [ ] `admin/src/pages/FindUser.js` (exists) — confirm search calls `GET /api/users/search?q=...` and opens `UserDetailModal` on result click
- [ ] `backend/routes/users.js` — `GET /api/users/search?q=`: `ILIKE` across email, phone_number, `CONCAT(first_name,' ',last_name)`, user_id

---

### 5.3 Manual Registration (`/users/manual-registration`)

- Single-page form with 6 collapsible sections (not multi-step)
- Section 1 — Account (Required): firstName, lastName, phoneNumber, email, temporary PIN
- Section 2 — Personal: DOB, gender, address
- Section 3 — Work: employment status, employer, income
- Section 4 — Education: level, institution
- Section 5 — Emergency Contacts: at least 1
- Section 6 — ID Verification: ID type, number (document upload optional)
- On submit: `POST /api/users/manual-register`
  - Backend hashes PIN; sets `registrationComplete = true`, `kycComplete = true`, `mustChangePinOnLogin = true`
  - Sends welcome SMS with temporary PIN to user's phone

### Build Tasks — Manual Registration

- [ ] `admin/src/pages/ManualRegistration.js` (exists) — verify all 6 sections are present with KYC fields
- [ ] Add `mustChangePinOnLogin: { type: DataTypes.BOOLEAN, defaultValue: false }` to User model
- [ ] `backend/routes/users.js` — `POST /api/users/manual-register`: validate, hash PIN, create user with `kycComplete = true`, `mustChangePinOnLogin = true`

---

### 5.4 User Management (`/users/management`)

- Search and select user
- Edit any user field (except `pin` and `password` — dedicated flows for those)
- Field-level change history: who changed what, when
- Bulk deactivation: multi-select -> Deactivate (with confirmation)
- Export filtered list to CSV

### Build Tasks — User Management

- [ ] `admin/src/pages/UserManagement.js` (exists) — verify edit form covers all User model fields; add change history display
- [ ] `backend/routes/users.js` — `PATCH /api/users/:id`: on each update, append `{ field, oldValue, newValue, changedBy, changedAt }` to `user.changeLog` JSONB field
- [ ] Add `changeLog: { type: DataTypes.JSONB, defaultValue: [] }` to User model
- [ ] `POST /api/users/bulk-deactivate` with `{ userIds: [] }`
- [ ] `GET /api/users?format=csv` — stream CSV response

---

### 5.5 Level Assignment (`/users/level-assignment`)

- Table: users with current level, total loans completed, total repaid
- Click user -> level assignment modal with dropdown of all active LoanLevel records
- Notes field (reason for manual override)
- On assign: `PATCH /api/users/:id/level`
  - Appends to `user.levelProgressionHistory`: `{ fromLevel, toLevel, progressionDate, reason, triggeredBy: 'admin', adminId, notes }`
  - Sends notification: "Congratulations! You've been upgraded to Level X"

**Automatic level promotion (triggered after loan completion):**

```
IF user.totalLoansCompleted >= nextLevel.minimumLoansCompleted
AND (nextLevel.requiresFullRepayment === false OR no partial clearances on record)
  -> assign user to nextLevel
  -> log in levelProgressionHistory with triggeredBy: 'system'
```

### Build Tasks — Level Assignment

- [ ] `admin/src/pages/UserManagement.js` or new `admin/src/pages/LevelAssignment.js` — table + assignment modal
- [ ] `backend/routes/users.js` — `PATCH /api/users/:id/level`: validate level exists; update `currentLoanLevel`; append to `levelProgressionHistory`; send notification
- [ ] `backend/services/levelProgressionService.js` — auto-promotion function; call from the loan completion handler
- [ ] Run `backend/scripts/seedLoanLevels.js` — verify levels are seeded and data is correct

---

## 6. Admin Portal — Order Menu

---

### 6.1 Order Lending (`/orders/lending`)

> Disbursements that failed or did not complete automatically appear here.

| Column               | Notes                               |
| -------------------- | ----------------------------------- |
| Loan ID              | `loan.loanId`                       |
| Customer             | Name + phone                        |
| Amount               | `loan.amount`                       |
| Disbursement Attempt | Timestamp of failed attempt         |
| Failure Reason       | From payment gateway response       |
| Retry Count          | How many retries attempted so far   |
| Actions              | Retry / Mark Manual Send / Details  |

**Retry:** `POST /api/loans/:id/disburse/retry` -> on success: `status = disbursed -> active`; `dueDate = NOW + termInDays`

**Manual Send:** Fill disbursement reference, amount, date, channel -> `PATCH /api/loans/:id/disburse/manual`

### Build Tasks — Order Lending

- [ ] Create `admin/src/pages/OrderLending.js` — failed disbursements table
- [ ] `GET /api/loans/failed-disbursements`: return loans where disbursement failed
- [ ] `POST /api/loans/:id/disburse/retry`: re-attempt; on success update status and dates
- [ ] `PATCH /api/loans/:id/disburse/manual`: validate body; set status to disbursed; record reference
- [ ] Add "Order Lending" to admin nav under Orders

---

### 6.2 Order Repayment (`/orders/repayment`)

> Admin submits Proof of Payment (POP) for customers who paid manually.

| Field                 | Rules                                              |
| --------------------- | -------------------------------------------------- |
| Customer              | Search by name, phone, loanId                      |
| Loan ID               | Auto-filled from selected customer's active loan   |
| Payment Type          | full / partial                                     |
| Amount Cleared        | > 0 AND <= `loan.remainingBalance`                 |
| Payment Method        | Bank Transfer / MoMo / Cash                        |
| Channel / Provider    | MTN, Hubtel, AirtelTigo, Bank name                 |
| Transaction Reference | Bank ref or MoMo transaction ID                    |
| Payment Date          | When customer actually paid                        |
| POP Image             | JPEG/PNG, max 5MB — required                       |
| Notes                 | Optional                                           |

**On Submit:** Creates `LoanClearance` with `status = pending`; notifies review team.

### Build Tasks — Order Repayment

- [ ] `admin/src/pages/OrderRepayment.js` (exists) — verify all form fields; validate Amount Cleared <= remaining balance (fetch remaining balance when loan is selected)
- [ ] `POST /api/payments/clearance`: validate; upload POP to file storage; create LoanClearance; notify review team

---

### 6.3 Review Payment (`/orders/review-payment`)

> Confirms the payment has hit the company account and updates the loan.

**Queue:** All `LoanClearance` records with `status = pending`.

**Approve (use a DB transaction):**

- Upload company-side evidence as `verificationPopUrl`
- `LoanClearance.status = completed`
- `loan.totalPaid += amountCleared`
- `loan.remainingBalance -= amountCleared`
- `loan.lastPaymentDate = NOW`
- If `remainingBalance <= 0`: `loan.status = completed`; trigger level progression
- `user.totalAmountRepaid += amountCleared`
- Notify customer: "Your payment of GH@ X has been confirmed."

**Reject:** Set `rejectionReason`; `LoanClearance.status = rejected`; notify submitter and customer.

**Request More Info:** Add review note; keep `status = pending`.

### Build Tasks — Review Payment

- [ ] `admin/src/pages/OrderRepaymentReview.js` (exists) — verify all 3 actions (Approve/Reject/Request Info) are fully wired
- [ ] `PATCH /api/payments/clearances/:id/approve`: execute all field updates in a Sequelize transaction
- [ ] `PATCH /api/payments/clearances/:id/reject`: update status, store reason, send notifications
- [ ] Use Sequelize `transaction` to ensure LoanClearance + Payment + Loan + User updates are atomic

---

### 6.4 Extension Order (`/orders/extension`)

> Admin extends a loan's due date on behalf of a customer, or approves a customer-initiated request.

| Field                  | Notes                                              |
| ---------------------- | -------------------------------------------------- |
| Customer / Loan        | Search active loan                                 |
| Current Due Date       | Auto-filled                                        |
| Extension Days         | Numeric OR preset dropdown                         |
| Daily Extension Rate   | From `AppConfig.daily_extension_fee_rate`          |
| Calculated Fee         | `extensionDays x dailyRate` — live                 |
| Payment Method         | How extension fee is collected                     |
| Notes                  | Free text                                          |

**Rules:** Max per request from `AppConfig.max_extension_days_per_request`; cumulative max from `AppConfig.max_extension_count`.

### Build Tasks — Extension Order

- [ ] `admin/src/pages/LoanExtension.js` (exists) — verify live fee calculation; add max extension guard message
- [ ] `backend/routes/loanExtension.js` (exists) — verify all field updates are applied; add AppConfig-driven guards

---

## 7. Admin Portal — Credit Review Menu

> Review officers call users about upcoming or overdue repayments. Review Lead manages assignments and monitors performance.

---

### 7.1 Assign (`/credit-review/assign`)

**Cases eligible for assignment:**

- `loan.status = active` AND `dueDate` within configured advance-call window (default 7 days), OR
- `loan.status = overdue`
- `loan.assignmentStatus = unassigned`

**Single Assignment:** Select case -> pick officer -> Save

**Bulk Assignment:**

1. Select multiple unassigned cases
2. Click "Bulk Assign" -> choose distribution mode:
   - Equal Split: cases divided evenly
   - Load-Weighted: officers with fewer cases get more
3. System writes `assignedOfficerId` for each loan; sets `assignmentStatus = assigned`

**Reassignment:** Filter by officer -> select their cases -> Reassign -> pick replacement.

### Build Tasks — Assign

- [ ] Create `admin/src/pages/CreditReviewAssign.js` — unassigned cases table + single + bulk assignment UI
- [ ] `PATCH /api/loans/:id/assign`: set `assignedOfficerId`, `assignmentStatus = assigned`
- [ ] `POST /api/loans/bulk-assign`: accept `{ loanIds, officerIds, mode: 'equal' | 'weighted' }`; distribute and update all
- [ ] Equal split: `loanIds.forEach((id, i) => assign(id, officerIds[i % officerIds.length]))`
- [ ] Load-weighted: sort officers by current active case count ascending; assign proportionally
- [ ] Add "Credit Review > Assign" to admin nav

---

### 7.2 List (`/credit-review/list`)

**Columns:** Loan ID, Customer Name, Phone, Amount Due, Due Date, Days Remaining/Overdue, Assigned Officer, Last Contact Date, Status

**Filter Tabs:** All | Unassigned | Assigned | Overdue | Completed

**Row expansion:** Customer contact details, loan history, all contact notes with timestamps

**Officer actions from row:** Add call note, update case status (Contacted / Promised to Pay / Refused / Unreachable)

### Build Tasks — Credit Review List

- [ ] `admin/src/pages/CreditReviewList.js` (exists) — add filter tabs; expandable row with contact notes input
- [ ] `GET /api/loans?view=credit-review&status=...`: return loans with officer and contact note details
- [ ] `POST /api/loans/:id/note`: append `{ note, addedBy, addedAt, outcome }` to `loan.contactNotes` JSONB
- [ ] Add `contactNotes: { type: DataTypes.JSONB, defaultValue: [] }` to Loan model

---

### 7.3 Count (`/credit-review/count`)

> Performance dashboard per officer.

**Filters:** Date range, Officer, Status

| Metric            | Calculation                                       |
| ----------------- | ------------------------------------------------- |
| Cases Assigned    | COUNT(loans where assignedOfficerId = X)          |
| Total Contacted   | COUNT(contactNotes where addedBy = X) in period   |
| Total Collected   | SUM(payments where officer worked case)           |
| Full Payments     | COUNT(completed loans for officer)                |
| Partial Payments  | Clearances with paymentType=partial for officer   |
| Pending           | Cases still outstanding                           |
| Completion Rate % | (fullPayments / casesAssigned) x 100              |

### Build Tasks — Credit Review Count

- [ ] Create `admin/src/pages/CreditReviewCount.js` — metrics table with date/officer filters
- [ ] `GET /api/collection/credit-review/count?startDate=&endDate=&officerId=`: aggregate query returning metrics above
- [ ] Add CSV export to this page

---

## 8. Admin Portal — Pre-Collection Menu

> Covers loans from activation through the day before the due date. Officers proactively call customers.

---

### 8.1 Pre-Assignment (`/pre-collection/assignment`)

| Tab                  | Condition                                                                         |
| -------------------- | --------------------------------------------------------------------------------- |
| Pending              | `precollectionStatus = pending-assignment`                                        |
| Assigned             | `precollectionStatus = assigned`                                                  |
| Processed            | Officer logged contact outcome                                                    |
| Reserved / Hung Up   | `precollectionStatus = hung-up`; customer promised to pay; auto-releases in 10 days |
| Completed            | Loan repaid before due date                                                       |

**10-Day Reserve Auto-Release Rule:**

```
Officer reserves case:
  loan.precollectionStatus = 'hung-up'
  loan.reservedAt = NOW
  loan.reservedByOfficerId = officerId

Daily cron job (midnight):
  FOR each loan WHERE precollectionStatus = 'hung-up':
    IF (NOW - reservedAt) > 10 days:
      loan.precollectionStatus = 'pending-assignment'
      loan.precollectionOfficerId = NULL
      loan.reservedAt = NULL
      NOTIFY precollection lead: "Case [loanId] auto-released from 10-day reserve"
```

**Assign / Unassign / Redistribute:**

- Single: select case -> assign officer
- Unassign: remove officer -> case returns to Pending
- Redistribute indisposed officer's cases: filter by officer -> select all -> bulk reassign (equal split)

### Build Tasks — Pre-Assignment

- [ ] `admin/src/pages/PreCollection/PreCollectionList.js` (exists) — add all 5 filter tabs; Reserve action per row
- [ ] Add `reservedAt (DATE)` and `reservedByOfficerId (UUID)` fields to Loan model
- [ ] `PATCH /api/precollection/cases/:id/reserve`: set `precollectionStatus = hung-up`, `reservedAt = NOW`
- [ ] Create `backend/services/reserveReleaseService.js` — daily cron that auto-releases hung-up cases older than 10 days (handles both pre-collection and collection)
- [ ] `POST /api/precollection/bulk-assign` — same distribution algorithm as Credit Review
- [ ] `PATCH /api/precollection/cases/:id/unassign` — clear officer, set status to pending-assignment

---

### 8.2 Pre-Repayment (`/pre-collection/repayment`)

> Payments received before the official due date — proves pre-collection team effectiveness.

**Table:** Customer, Loan ID, Expected Amount, Amount Paid, Payment Date, Method, Days Before Due, Officer Who Worked Case

**Filter:** Date range, officer, full/partial. **Export:** CSV.

### Build Tasks — Pre-Repayment

- [ ] `admin/src/pages/PreCollection/PaymentRecord.js` (exists) — confirm it queries payments where `payment.completedAt < loan.dueDate`; add officer column
- [ ] `GET /api/precollection/repayments?startDate=&endDate=`: join Payment, Loan, User, and Admin (precollectionOfficerId)

---

### 8.3 Rank 1 (`/pre-collection/rank1`)

> Officers ranked by total amount recouped.

| Rank | Officer Name | Cases Assigned | Amount Collected | Full Payments | Partial Payments | Period |
|------|--------------|---------------|-----------------|---------------|------------------|--------|

**Filters:** Date range, team, officer. **Sort:** Amount collected (default). **Export:** CSV/PDF.

### Build Tasks — Pre-Collection Rank 1

- [ ] `admin/src/pages/PreCollection/Rank1.js` (exists) — verify it calls the correct backend route
- [ ] `GET /api/precollection/rank1?startDate=&endDate=`: aggregate amount collected per officer; return ranked array

---

### 8.4 Shiftiest (`/pre-collection/shiftiest`)

> Full shift-level case list.

- All cases: customer, amount, due date, days remaining, officer, status, last contact, latest note
- Officers see only their own cases; leads see all
- Row quick-actions: Mark Contacted, Add Note, Reserve, Release Reserve
- Filters: officer, status, due date window (today / this week / all)

### Build Tasks — Shiftiest

- [ ] `admin/src/pages/PreCollection/PreCollectionAllList.js` (exists) — enforce role-scoped data: officers see only `precollectionOfficerId = admin.id`; leads see all
- [ ] Row action buttons: Reserve (10-day hold), Release Reserve, Add Note (inline text)
- [ ] Scope `GET /api/precollection/cases` by `precollectionOfficerId` if caller is an officer role

---

## 9. Admin Portal — Collection Menu

> Covers overdue loans. Collection officers recover outstanding funds.

---

### 9.1 List (`/collection/list`)

| Tab                   | Condition                               |
| --------------------- | --------------------------------------- |
| Pending Assignment    | `collectionStatus = pending-assignment` |
| Assigned              | `collectionStatus = assigned`           |
| Processed             | Contact logged                          |
| Hung Up / Reserved    | `collectionStatus = hung-up` (max 10 days) |
| Completed             | Loan fully repaid                       |

**Columns:** Loan ID, Customer Name, Phone, Amount Outstanding, Days Overdue, Assigned Officer, Last Contact, Status

**Same 10-day reserve rule applies as Pre-Collection.**

### Build Tasks — Collection List

- [ ] `admin/src/pages/Collection/CollectionList.js` (exists) — verify all 5 tabs; add Reserve action
- [ ] The same `reserveReleaseService.js` cron handles both `precollectionStatus` and `collectionStatus`
- [ ] `GET /api/collection/cases?status=...`: filter loans with `status = overdue` or by `collectionStatus`

---

### 9.2 Rank 1 (`/collection/rank1`)

> Amount collected by officers, broken down by date.

| Officer | Date | Amount Collected | Cases Resolved | Partial | Full |
|---------|------|-----------------|----------------|---------|------|

- Filter: date range, groupBy day/week/month
- Default: current week daily breakdown
- Drill-down: click officer -> case-by-case breakdown

### Build Tasks — Collection Rank 1

- [ ] `admin/src/pages/Collection/Rank1.js` (exists) — verify date-dimension query and drill-down
- [ ] `GET /api/collection/rank1?startDate=&endDate=&groupBy=day|week|month`: aggregate per officer per time period

---

### 9.3 Rank 2 (`/collection/rank2`)

> Officers ranked by performance percentage.

```
collectionPercentage = (totalAmountCollected / totalAmountAssigned) x 100
fullPaymentRate      = (fullPaymentCount / totalCasesAssigned) x 100
```

| Rank | Officer | Total Assigned | Total Collected | Collection % | Full Payment % | Cases |
|------|---------|----------------|-----------------|--------------|----------------|-------|

- Top 3 visual badges (Gold / Silver / Bronze)
- Filters: date range, collection type (pre-collection / collection / both), team
- Metric toggle: Amount Collected | Collection % | Full Payment %
- Export CSV

**Required backend response:**

```json
{
  "officers": [
    {
      "officerId": "uuid",
      "name": "John Doe",
      "team": "Team A",
      "totalAssigned": 15000.00,
      "totalCollected": 12000.00,
      "collectionPercentage": 80.0,
      "fullPaymentCount": 5,
      "partialPaymentCount": 3,
      "casesAssigned": 10
    }
  ]
}
```

### Build Tasks — Collection Rank 2

- [ ] `admin/src/pages/Collection/Rank2.js` (exists, partially built) — finish implementation; add Gold/Silver/Bronze badges for top 3; metric toggle; CSV export
- [ ] `GET /api/admin/collection/officer-performance?startDate=&endDate=&type=`: implement aggregation query
- [ ] Metric toggle re-sorts data client-side (no new API call needed)

---

### 9.4 App Usage (`/collection/app-usage`)

> Tracks whether officers are actively using the admin portal during work hours.

**How it works:** Browser tab's `visibilitychange` events track active vs. background time. Data flushed every 5 minutes and on logout.

**Data Model — `AppUsageLog` table (`cedi_auth` schema):**

```
id: UUID PK
adminId: UUID FK -> Admin
sessionDate: DATEONLY
loginTime: TIMESTAMP
logoutTime: TIMESTAMP (nullable, updated on flush)
totalActiveMinutes: INTEGER
totalBackgroundMinutes: INTEGER
backgroundEvents: JSONB  [{startTime, endTime, durationMinutes}]
```

| Officer | Date | Login Time | Logout Time | Active Time | Background Time | Productivity % |
|---------|------|------------|-------------|-------------|-----------------|----------------|

`Productivity % = (activeMinutes / (activeMinutes + backgroundMinutes)) x 100`

### Build Tasks — App Usage

- [ ] `admin/src/App.js` — call `initAppUsageTracking(adminId)` after login; flush on logout
- [ ] Create `admin/src/utils/appUsageTracker.js` (full code in Section 15)
- [ ] Create `backend/models/AppUsageLog.js` with the schema above
- [ ] `POST /api/collection/app-usage/log`: upsert AppUsageLog for today
- [ ] `GET /api/collection/app-usage?startDate=&endDate=&officerId=`: return summary for table
- [ ] Create `admin/src/pages/Collection/AppUsage.js` — table with filters; productivity % calculated from log data

---

## 10. Admin Portal — Config Menu

---

### 10.1 App Configuration (`/config/app-config`)

> All application settings stored in `cedi_config.app_configs`. Changes take effect immediately. UI: 6-tab layout. Each field auto-saves via debounced PATCH. Show "Last updated by [name] at [datetime]" per field.

**Tab 1 — Loan Settings:**

| Key | Description | Type |
|---|---|---|
| `max_loan_amount` | Platform-wide max loan | Decimal |
| `min_loan_amount` | Platform-wide min loan | Decimal |
| `auto_approval_limit` | Loans <= this auto-approve | Decimal |
| `max_loan_term` | Max term in days | Integer |
| `require_collateral` | Collateral required flag | Boolean |
| `default_credit_limit` | Starting credit for new users | Decimal |
| `max_extension_count` | Max times a loan can be extended | Integer |
| `max_extension_days_per_request` | Max days per single extension | Integer |
| `daily_extension_fee_rate` | Fee per extension day (GH@) | Decimal |

**Tab 2 — Fee Rates:**

| Key | Description |
|---|---|
| `interest_rate_7_days` | Interest % for 7-day loans |
| `service_fee_7_days` | Service fee % for 7-day loans |
| `admin_fee_7_days` | Admin fee % for 7-day loans |
| `commitment_fee_7_days` | Commitment fee % for 7-day loans |
| (same keys for `_14_days` and `_30_days`) | |
| `overdue_fee_daily_pct` | Daily overdue penalty % |

**Tab 3 — App Branding:**

| Key | Description |
|---|---|
| `app_name` | Application name shown in cedLoan |
| `app_tagline` | Tagline |
| `company_name` | Legal company name |
| `company_logo_url` | Logo URL |
| `app_version` | Version string |

**Tab 4 — Contact Information:**

| Key | Description |
|---|---|
| `support_phone` | Customer support number |
| `support_email` | Support email |
| `support_whatsapp` | WhatsApp number |
| `office_address` | Physical address |
| `business_hours` | Operating hours text |
| `emergency_contact` | 24/7 emergency contact |

**Tab 5 — System Settings:**

| Key | Description |
|---|---|
| `maintenance_mode` | Boolean — lock cedLoan from new requests |
| `session_timeout` | JWT timeout in minutes |
| `max_login_attempts` | Before account lockout |
| `lockout_duration` | Lock duration in minutes |
| `enable_notifications` | Master SMS/email toggle |
| `enable_realtime_updates` | Socket.IO toggle |

**Tab 6 — Content Pages (rich text editor):**

- `terms_and_conditions`, `privacy_policy`, `about_us`, `faq_content`, `process_guide`, `loan_guide`, `repayment_guide`

### Build Tasks — App Configuration

- [ ] `admin/src/pages/AppConfiguration.js` (exists) — convert to 6-tab layout; each field auto-saves via debounced `PATCH /api/config/:key`
- [ ] Display "Last updated by [name] on [date]" below each field
- [ ] Add missing keys (`max_extension_count`, `max_extension_days_per_request`, `daily_extension_fee_rate`, `overdue_fee_daily_pct`, 11 notification toggles) to AppConfig model's allowed key list and seed file
- [ ] `PATCH /api/config/:key`: validate key in allowed list; update value; record `updatedById`
- [ ] `GET /api/config/public`: return branding, contact, fee rates, content (no auth required) for cedLoan

---

### 10.2 Loan Levels (`/config/loan-levels`)

- CRUD for LoanLevel records
- Fields: level number, name, description, minAmount, maxAmount, interestRate, fee percentages, availableTerms (multi-select), requiresFullRepayment, minimumLoansCompleted
- Reorder levels (drag or up/down arrows)
- Activate / Deactivate (inactive levels not shown to customers)
- Warning on edit: "Changing rates does not affect existing active loans"

### Build Tasks — Loan Levels

- [ ] `admin/src/pages/LoanConfiguration.js` (exists) — verify CRUD; add reorder UI; add activate/deactivate toggle
- [ ] DELETE route should soft-deactivate (`isActive = false`), not hard delete

---

### 10.3 Role Management (`/config/roles`) — Super Admin Only

- List roles with their permission JSONB trees rendered as toggle switches
- Edit permissions; save calls `PATCH /api/admin/roles/:id`

### Build Tasks — Role Management

- [ ] `admin/src/pages/RoleManagement.js` (exists) — verify permissions tree renders as toggles; saving calls backend
- [ ] `PATCH /api/admin/roles/:id`: validate and update permissions JSONB; super-admin only guard

---

### 10.4 Server Logs (`/config/server-logs`) — Super Admin Only

- View logs: error, warn, info levels
- Filter by severity, date, endpoint
- Download logs as file

### Build Tasks — Server Logs

- [ ] Create `admin/src/pages/ServerLogs.js` — log table with filters and download button
- [ ] `GET /api/admin/logs?level=&startDate=&endDate=`: read structured logs (use `winston` to write JSON logs to file or DB table); super-admin only
- [ ] Choose one logging strategy and implement it consistently across all backend routes

---

### 10.5 Bin / Deleted Records (`/config/bin`) — Super Admin Only

- All soft-deleted records from all tables
- Filter by entity type: User / Loan / Admin / Config
- Restore: re-activates record (`deletedAt = null`)
- Permanent Delete: hard delete; user must type record ID to confirm

### Build Tasks — Bin

- [ ] Enable Sequelize `paranoid: true` on User, Admin, Loan, LoanClearance, Payment, Notification models
- [ ] Create `admin/src/pages/Bin.js` — table by entity type; Restore and Permanent Delete actions
- [ ] `GET /api/admin/bin?type=`: query paranoid tables with `{ paranoid: false, where: { deletedAt: { [Op.ne]: null } } }`
- [ ] `PATCH /api/admin/bin/:type/:id/restore`: `Model.restore({ where: { id } })`
- [ ] `DELETE /api/admin/bin/:type/:id`: hard delete; require `confirmId` in request body to match record ID

---

## 11. Admin Portal — Marketing & Notifications

---

### 11.1 Marketing (`/marketing`)

> Broadcast bulk SMS or email messages to user segments.

| Field              | Type           | Notes                                                            |
| ------------------ | -------------- | ---------------------------------------------------------------- |
| Campaign Name      | String         | Internal label                                                   |
| Channel            | Enum           | SMS / Email / Both                                               |
| Target Audience    | Multi-select   | All Users / Active Borrowers / Overdue / By Level / Custom       |
| Custom Segment     | Filter builder | Level, status, region, date joined, loan history                 |
| Subject (Email)    | String         | Required for email                                               |
| SMS Body           | Textarea       | Max 160 chars; live character count                              |
| Email Content      | Rich text      | Template variables: {{firstName}}, {{loanBalance}}, etc.         |
| Schedule           | DateTime       | Send now or future date/time                                     |
| Test Send          | Input          | Send test to admin's own email/phone                             |

**Delivery Tracking:** Total recipients / Sent / Delivered / Failed / Open rate / Click rate.

### Build Tasks — Marketing

- [ ] Create `admin/src/pages/MarketingBroadcast.js` — campaign form with audience builder and message editor
- [ ] `POST /api/notifications/broadcast`: build recipient list from segment filters; queue SMS/email sends; return campaign ID
- [ ] Track delivery: `deliveryStatus`, `deliveredAt`, `openedAt` fields on Notification records
- [ ] Schedule: if `scheduledAt` is in the future, store and process via a cron job

---

### 11.2 Notification Manager (`/notifications`)

> Manage automated triggers and delivery logs.

**Automated Triggers (all toggleable via AppConfig):**

| Trigger                | Event                      | Channel    |
| ---------------------- | -------------------------- | ---------- |
| Application Received   | User submits loan          | Push+Email |
| Loan Approved          | Admin approves             | SMS+Push   |
| Loan Rejected          | Admin rejects              | SMS+Push   |
| Loan Disbursed         | Disbursement success       | SMS+Push   |
| Due Reminder (7 days)  | 7 days before due          | SMS+Push   |
| Due Reminder (3 days)  | 3 days before due          | SMS+Push   |
| Due Reminder (1 day)   | 1 day before due           | SMS+Push   |
| Payment Confirmed      | Clearance approved         | SMS+Push   |
| Loan Overdue           | Past due date              | SMS+Push   |
| Level Upgraded         | Level promotion            | Push+Email |
| Extension Granted      | Extension approved         | SMS+Push   |

**Admin Controls:** Toggle each trigger on/off; edit SMS template text; edit email HTML template; view delivery log.

### Build Tasks — Notification Manager

- [ ] `admin/src/pages/NotificationManagement.js` (exists) — ensure all 11 triggers have on/off toggles and editable templates
- [ ] `PATCH /api/notifications/templates/:type`: update SMS/email template text
- [ ] Add 11 AppConfig keys for notification toggles (e.g. `notify_loan_approved: true`)
- [ ] `GET /api/notifications/logs?limit=100&type=&status=`: return recent delivery records
- [ ] Implement `backend/services/notificationService.js` — central dispatcher; check AppConfig toggle before sending; called by all backend events

---

## 12. Loan Status State Machine

```
                    +---------+
                    | pending |  <- User submits application
                    +----+----+
                         | (review assigned OR auto-approve)
                  +------+------+
                  | under-review|  <- Review officer evaluating
                  +------+------+
        +-----------+    |    +-----------+
        |            |   |    |           |
   +----+----+  +----+---++  ++----------+
   |approved |  |rejected |  | cancelled |
   +----+----+  +---------+  +-----------+
        | (disbursement triggered)
  +-----+---------+
  |               |
+-+--------+  +---+------------------+
|disbursed |  | disbursement-failed  | -> Order Lending queue
+----+-----+  +---------------------+
     | (dueDate set)
+----+---+
| active |  <- Pre-collection officers (D-7 to D-1)
+----+---+
     |
     +-- full payment confirmed ---------------------> completed
     |
     +-- extension approved -------------------------> active (new dueDate)
     |
     +-- due date passed, balance > 0 --------------> overdue
                                                          |
                                    Collection officers assigned
                                                          |
                                    payment confirmed --> completed
                                                          |
                                    no payment, write-off-> defaulted
```

**Allowed transitions — enforce in `backend/middleware/loanStateMachine.js`:**

```javascript
const TRANSITIONS = {
  'pending':       ['under-review', 'approved', 'cancelled', 'rejected'],
  'under-review':  ['approved', 'rejected', 'cancelled', 'hanged-up'],
  'approved':      ['disbursed', 'cancelled'],
  'disbursed':     ['active'],
  'active':        ['completed', 'overdue', 'cancelled'],
  'overdue':       ['completed', 'defaulted'],
};
```

### Build Tasks — State Machine

- [ ] Create `backend/middleware/loanStateMachine.js` — validate transition is in TRANSITIONS map; return HTTP 422 if invalid
- [ ] Apply this middleware to all routes that modify `loan.status`

---

## 13. KYC Data Requirements

> **When collected:** KYC Gate — triggered the first time a user taps "Apply for a Loan" in cedLoan. NOT required at registration.

### KYC Field Checklist

| Field               | Collected At     | Validation                                            |
| ------------------- | ---------------- | ----------------------------------------------------- |
| `firstName`         | Registration     | Min 2 chars                                           |
| `lastName`          | Registration     | Min 2 chars                                           |
| `phoneNumber`       | Registration     | E.164 format; verified via Firebase OTP               |
| `pin`               | Registration     | 4 digits; bcrypt hashed; never stored plain           |
| `dateOfBirth`       | Registration     | Must be 18+ years from today                          |
| `gender`            | Registration     | male / female / other                                 |
| `address`           | Registration     | city and region required at minimum                   |
| `employmentStatus`  | KYC Gate         | Enum                                                  |
| `employer`          | KYC Gate         | Required if employed or self-employed                 |
| `monthlyIncome`     | KYC Gate         | Decimal > 0                                           |
| `educationLevel`    | KYC Gate         | Enum                                                  |
| `emergencyContacts` | KYC Gate         | Min 1; each needs name, relationship, phone           |
| `idType`            | KYC Gate         | national-id / passport / drivers-license / voters-id  |
| `idNumber`          | KYC Gate         | Non-empty string                                      |
| `idDocuments`       | KYC Gate         | At least 1 uploaded URL                               |

### Backend KYC Completeness Function

```javascript
// backend/middleware/kycCheck.js
function kycIsComplete(user) {
  return (
    user.isPhoneVerified === true &&
    user.dateOfBirth !== null &&
    user.gender !== null &&
    user.address && user.address.city && user.address.region &&
    user.employmentStatus !== null &&
    Number(user.monthlyIncome) > 0 &&
    user.educationLevel !== null &&
    Array.isArray(user.emergencyContacts) &&
    user.emergencyContacts.length >= 1 &&
    user.idType !== null &&
    user.idNumber !== null &&
    Array.isArray(user.idDocuments) &&
    user.idDocuments.length >= 1
  );
}

module.exports = (req, res, next) => {
  if (!kycIsComplete(req.user)) {
    const missing = getMissingKycFields(req.user);
    return res.status(422).json({
      error: 'KYC_INCOMPLETE',
      message: 'Please complete your profile before applying for a loan.',
      missingFields: missing,
    });
  }
  next();
};
```

### Build Tasks — KYC

- [ ] `backend/middleware/kycCheck.js` — implement `kycIsComplete` and `getMissingKycFields`; export as Express middleware
- [ ] Apply `kycCheck` middleware to `POST /api/loans/apply`
- [ ] In cedLoan: when `POST /api/loans/apply` returns 422 with `KYC_INCOMPLETE`, parse `missingFields` and navigate KycGate to the step containing the first missing field
- [ ] `PATCH /api/users/me/kyc`: patch all KYC fields and set `kycComplete = true`
- [ ] Include `kycComplete` in `GET /api/auth/me` and login response

---

## 14. Backend API Route Map

### Authentication (`/api/auth`)

| Method | Route                     | Auth     | Description                              |
| ------ | ------------------------- | -------- | ---------------------------------------- |
| GET    | `/auth/check-phone`       | Public   | Check if phone number already registered |
| POST   | `/auth/send-otp`          | Public   | Send Firebase OTP                        |
| POST   | `/auth/verify-otp`        | Public   | Verify OTP                               |
| POST   | `/auth/register/complete` | Public   | Create user account                      |
| POST   | `/auth/login`             | Public   | Phone + PIN -> JWT                       |
| PATCH  | `/auth/change-pin`        | User JWT | Change PIN (requires current PIN)        |
| POST   | `/auth/refresh-token`     | User JWT | Refresh JWT                              |
| GET    | `/auth/me`                | User JWT | Current user profile + KYC status        |

### Users (`/api/users`)

| Method | Route                        | Auth      | Description                       |
| ------ | ---------------------------- | --------- | --------------------------------- |
| GET    | `/users`                     | Admin JWT | List (paginated, filtered)        |
| GET    | `/users/search`              | Admin JWT | Search by name/phone/email/userId |
| GET    | `/users/:id`                 | Admin JWT | Full user detail                  |
| POST   | `/users/manual-register`     | Admin JWT | Admin-created account             |
| PATCH  | `/users/me/kyc`              | User JWT  | Submit KYC data from KYC Gate     |
| PATCH  | `/users/me`                  | User JWT  | Update own profile                |
| PATCH  | `/users/:id`                 | Admin JWT | Admin edits user fields           |
| PATCH  | `/users/:id/activate`        | Admin JWT | Activate user                     |
| PATCH  | `/users/:id/deactivate`      | Admin JWT | Deactivate user                   |
| PATCH  | `/users/:id/level`           | Admin JWT | Assign loan level                 |
| POST   | `/users/bulk-deactivate`     | Admin JWT | Bulk deactivate                   |
| GET    | `/users/:id/loans`           | Admin JWT | All loans for user                |
| GET    | `/users/:id/payments`        | Admin JWT | All payments for user             |

### Loans (`/api/loans`)

| Method | Route                         | Auth           | Description               |
| ------ | ----------------------------- | -------------- | ------------------------- |
| GET    | `/loans/active-check`         | User JWT       | Active loan guard         |
| POST   | `/loans/apply`                | User JWT       | Submit application        |
| GET    | `/loans`                      | Admin JWT      | All loans (filtered)      |
| GET    | `/loans/:id`                  | Admin/User JWT | Single loan detail        |
| PATCH  | `/loans/:id/assign`           | Admin JWT      | Assign review officer     |
| PATCH  | `/loans/:id/review`           | Admin JWT      | Approve or reject         |
| PATCH  | `/loans/:id/disburse`         | Admin JWT      | Trigger disbursement      |
| POST   | `/loans/:id/disburse/retry`   | Admin JWT      | Retry failed disbursement |
| PATCH  | `/loans/:id/disburse/manual`  | Admin JWT      | Mark manually disbursed   |
| PUT    | `/loans/:id/extend`           | User/Admin JWT | Apply extension           |
| GET    | `/loans/failed-disbursements` | Admin JWT      | Order Lending queue       |
| POST   | `/loans/bulk-assign`          | Admin JWT      | Bulk assign to officers   |
| POST   | `/loans/:id/note`             | Admin JWT      | Add contact note          |

### Payments (`/api/payments`)

| Method | Route                              | Auth           | Description                  |
| ------ | ---------------------------------- | -------------- | ---------------------------- |
| POST   | `/payments/initiate`               | User JWT       | User initiates MoMo payment  |
| GET    | `/payments/:loanId`                | Admin/User JWT | Payment history for loan     |
| POST   | `/payments/clearance`              | Admin JWT      | Submit POP                   |
| GET    | `/payments/clearances`             | Admin JWT      | All pending clearances       |
| PATCH  | `/payments/clearances/:id/approve` | Admin JWT      | Approve clearance (DB txn)   |
| PATCH  | `/payments/clearances/:id/reject`  | Admin JWT      | Reject clearance             |

### Collections (`/api/collection` and `/api/precollection`)

| Method | Route                               | Description                   |
| ------ | ----------------------------------- | ----------------------------- |
| GET    | `/collection/cases`                 | Overdue cases (by status)     |
| PATCH  | `/collection/cases/:id/assign`      | Assign collection officer     |
| PATCH  | `/collection/cases/:id/status`      | Update case status            |
| PATCH  | `/collection/cases/:id/reserve`     | Reserve case (hung-up)        |
| POST   | `/collection/app-usage/log`         | Flush app usage data          |
| GET    | `/collection/app-usage`             | App usage table               |
| GET    | `/collection/rank1`                 | Amount by officer + date      |
| GET    | `/collection/rank2`                 | Officer performance %         |
| GET    | `/precollection/cases`              | Pre-collection cases          |
| PATCH  | `/precollection/cases/:id/assign`   | Assign pre-collection officer |
| PATCH  | `/precollection/cases/:id/reserve`  | Reserve case (10-day hold)    |
| PATCH  | `/precollection/cases/:id/unassign` | Remove officer from case      |
| POST   | `/precollection/bulk-assign`        | Bulk assign cases             |
| GET    | `/precollection/rank1`              | Pre-coll officer performance  |
| GET    | `/precollection/repayments`         | Early repayments table        |
| GET    | `/admin/collection/officer-performance` | Rank 2 performance %     |
| GET    | `/collection/credit-review/count`   | Credit Review Count metrics   |

### Config (`/api/config`)

| Method | Route                     | Auth      | Description                       |
| ------ | ------------------------- | --------- | --------------------------------- |
| GET    | `/config/public`          | Public    | Branding, rates, contact, content |
| GET    | `/config`                 | Admin JWT | All config key-value pairs        |
| PATCH  | `/config/:key`            | Admin JWT | Update one key                    |
| GET    | `/config/loan-levels`     | Public    | All active loan levels            |
| POST   | `/config/loan-levels`     | Admin JWT | Create level                      |
| PATCH  | `/config/loan-levels/:id` | Admin JWT | Update level                      |
| DELETE | `/config/loan-levels/:id` | Admin JWT | Deactivate level (soft delete)    |

### Notifications (`/api/notifications`)

| Method | Route                            | Auth           | Description                 |
| ------ | -------------------------------- | -------------- | --------------------------- |
| GET    | `/notifications`                 | User/Admin JWT | List notifications          |
| PATCH  | `/notifications/:id/read`        | User/Admin JWT | Mark one as read            |
| PATCH  | `/notifications/read-all`        | User/Admin JWT | Mark all as read            |
| POST   | `/notifications/broadcast`       | Admin JWT      | Marketing broadcast         |
| GET    | `/notifications/logs`            | Admin JWT      | Delivery log                |
| PATCH  | `/notifications/templates/:type` | Admin JWT      | Update notification template|

### Build Tasks — Backend Routes

- [ ] Audit all `backend/routes/*.js` files against this table; create any missing routes
- [ ] Every admin route: `authenticateToken -> requireAdminRole -> checkPermission(menuKey)` middleware chain
- [ ] Every user route: `authenticateToken -> requireUserRole` middleware
- [ ] Add missing `GET /auth/check-phone` and `PATCH /users/me/kyc` routes
- [ ] Add `PATCH /notifications/read-all`, `GET /notifications/logs`, `PATCH /notifications/templates/:type`
- [ ] All routes that modify `loan.status` must use `loanStateMachine` middleware

---

## 15. Worker App Usage Tracking

> Officers grant browser permission at login. The portal tracks active/background time transparently.

### Frontend — `admin/src/utils/appUsageTracker.js`

```javascript
export function initAppUsageTracking(adminId) {
  let activeStart = Date.now();
  let totalActiveMs = 0;
  const backgroundEvents = [];

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      totalActiveMs += Date.now() - activeStart;
      backgroundEvents.push({ startTime: new Date().toISOString() });
    } else {
      activeStart = Date.now();
      const last = backgroundEvents[backgroundEvents.length - 1];
      if (last && !last.endTime) {
        last.endTime = new Date().toISOString();
        last.durationMinutes = Math.round(
          (Date.now() - new Date(last.startTime)) / 60000
        );
      }
    }
  });

  const flush = () => {
    navigator.sendBeacon(
      '/api/collection/app-usage/log',
      JSON.stringify({
        adminId,
        totalActiveMinutes: Math.round(totalActiveMs / 60000),
        backgroundEvents,
        lastFlushedAt: new Date().toISOString(),
      })
    );
  };

  setInterval(flush, 5 * 60 * 1000); // flush every 5 minutes
  window.addEventListener('beforeunload', flush);

  return flush; // caller can invoke on logout
}
```

### Backend Handler

```
POST /api/collection/app-usage/log
Auth: Admin JWT
Body: { adminId, totalActiveMinutes, backgroundEvents, lastFlushedAt }
Action: UPSERT AppUsageLog WHERE adminId = :adminId AND sessionDate = TODAY
  SET totalActiveMinutes = MAX(existing, incoming)
  APPEND new backgroundEvents
  SET logoutTime = lastFlushedAt
```

### Build Tasks — App Usage Tracking

- [ ] Create `admin/src/utils/appUsageTracker.js` with the code above
- [ ] `admin/src/contexts/AuthContext.js`: call `initAppUsageTracking(admin.id)` after login; call returned `flush()` before logout
- [ ] Create `backend/models/AppUsageLog.js` (Sequelize model, `cedi_auth` schema)
- [ ] Add `POST /api/collection/app-usage/log` route with upsert logic
- [ ] Add `GET /api/collection/app-usage` route for admin table

---

## 16. Master Implementation Checklist

> Sprint board. Items are ordered: Backend foundations first, then Admin Portal, then cedLoan PWA. Check off items as you complete them.

### Phase 1 — Database & Backend Foundations

- [ ] P1-1  Verify all Sequelize models connect and sync cleanly
- [ ] P1-2  Add missing User model fields: `kycComplete (BOOLEAN)`, `changeLog (JSONB)`, `mustChangePinOnLogin (BOOLEAN)`, `reservedAt (DATE)`, `reservedByOfficerId (UUID)`
- [ ] P1-3  Add `contactNotes (JSONB)` to Loan model
- [ ] P1-4  Enable `paranoid: true` on User, Admin, Loan, LoanClearance, Payment, Notification models
- [ ] P1-5  Create `AppUsageLog` model (`cedi_auth` schema)
- [ ] P1-6  Run all seed scripts: `seedRoles.js`, `seedLoanLevels.js`, `seedAllConfigs.js`, `seedSuperAdmin.js`
- [ ] P1-7  Add missing AppConfig keys: extension config, overdue fee, 11 notification toggles
- [ ] P1-8  Create `backend/middleware/loanStateMachine.js`
- [ ] P1-9  Create `backend/middleware/kycCheck.js`
- [ ] P1-10 Create `backend/services/reserveReleaseService.js` — daily cron; 10-day auto-release
- [ ] P1-11 Create `backend/services/levelProgressionService.js` — auto-promote after loan completion
- [ ] P1-12 Create `backend/services/notificationService.js` — central dispatcher with AppConfig toggle checks
- [ ] P1-13 Add `GET /auth/check-phone` route
- [ ] P1-14 Update `POST /auth/register/complete` — accept personal info + PIN only; set `kycComplete = false`
- [ ] P1-15 Add `PATCH /users/me/kyc` route — receive KYC data; set `kycComplete = true`
- [ ] P1-16 Add `PATCH /users/me` route for profile self-edit
- [ ] P1-17 Add `POST /users/bulk-deactivate` route
- [ ] P1-18 Implement `POST /api/loans/apply` with active-loan guard + KYC guard + fee calculation + auto-approval
- [ ] P1-19 Implement Order Lending routes: `GET /failed-disbursements`, `POST /retry`, `PATCH /manual`
- [ ] P1-20 Implement `POST /api/loans/bulk-assign` with equal-split and load-weighted modes
- [ ] P1-21 Add `PATCH /payments/clearances/:id/approve` with full DB transaction
- [ ] P1-22 Add `GET /api/precollection/rank1` and `GET /api/precollection/repayments`
- [ ] P1-23 Add `GET /api/collection/credit-review/count` performance aggregate
- [ ] P1-24 Add `POST /api/collection/app-usage/log` and `GET /api/collection/app-usage`
- [ ] P1-25 Add `PATCH /notifications/read-all`, `GET /notifications/logs`, `PATCH /notifications/templates/:type`

### Phase 2 — Admin Portal

- [ ] A2-1  Create `admin/src/components/UserDetailModal.js` — 7-tab user detail panel
- [ ] A2-2  `admin/src/pages/UserList.js` — KYC Status column, all filters, link to UserDetailModal
- [ ] A2-3  `admin/src/pages/ManualRegistration.js` — add all KYC fields as collapsible sections
- [ ] A2-4  `admin/src/pages/UserManagement.js` — field-level change history; bulk deactivate; CSV export
- [ ] A2-5  Create `admin/src/pages/LevelAssignment.js` — table + level assignment modal
- [ ] A2-6  Create `admin/src/pages/OrderLending.js` — failed disbursements; Retry and Manual Send
- [ ] A2-7  `admin/src/pages/OrderRepayment.js` — verify all POP form fields; add remaining-balance display
- [ ] A2-8  `admin/src/pages/OrderRepaymentReview.js` — verify Approve/Reject/Request More Info wired with notifications
- [ ] A2-9  `admin/src/pages/LoanExtension.js` — live fee calc; max extension guard message
- [ ] A2-10 Create `admin/src/pages/CreditReviewAssign.js` — single + bulk assignment with both distribution modes
- [ ] A2-11 `admin/src/pages/CreditReviewList.js` — filter tabs; expandable row with contact notes
- [ ] A2-12 Create `admin/src/pages/CreditReviewCount.js` — metrics table with filters and CSV export
- [ ] A2-13 `admin/src/pages/PreCollection/PreCollectionList.js` — all 5 filter tabs; Reserve action
- [ ] A2-14 `admin/src/pages/PreCollection/PaymentRecord.js` — confirm early-repayment query; officer column
- [ ] A2-15 `admin/src/pages/PreCollection/Rank1.js` — verify wired to correct API
- [ ] A2-16 `admin/src/pages/PreCollection/PreCollectionAllList.js` — role-scoped view; inline actions
- [ ] A2-17 `admin/src/pages/Collection/CollectionList.js` — verify all 5 tabs; reserve action
- [ ] A2-18 `admin/src/pages/Collection/Rank1.js` — date dimension; drill-down
- [ ] A2-19 `admin/src/pages/Collection/Rank2.js` — finish; Gold/Silver/Bronze badges; metric toggle; export
- [ ] A2-20 Create `admin/src/pages/Collection/AppUsage.js` — table with filters and productivity %
- [ ] A2-21 `admin/src/pages/AppConfiguration.js` — 6-tab layout; all keys; auto-save; last-updated display
- [ ] A2-22 `admin/src/pages/LoanConfiguration.js` — verify CRUD; reorder; activate/deactivate
- [ ] A2-23 `admin/src/pages/RoleManagement.js` — permissions toggle tree; save to backend
- [ ] A2-24 Create `admin/src/pages/ServerLogs.js` — log viewer with filters and download
- [ ] A2-25 Create `admin/src/pages/Bin.js` — soft-deleted records; Restore and Permanent Delete
- [ ] A2-26 Create `admin/src/pages/MarketingBroadcast.js` — campaign form; audience builder; scheduling
- [ ] A2-27 `admin/src/pages/NotificationManagement.js` — all 11 triggers; on/off toggles; editable templates
- [ ] A2-28 Create `admin/src/utils/appUsageTracker.js`; wire into AuthContext login/logout
- [ ] A2-29 Add missing nav items: Order Lending, Credit Review > Assign, Credit Review > Count, Collection > App Usage, Bin, Server Logs

### Phase 3 — cedLoan PWA

- [ ] C3-1  `cedLoan/src/pages/Register/Register.js` — add `check-phone` duplicate check
- [ ] C3-2  `cedLoan/src/pages/Register/PersonalInfo.js` — firstName, lastName, DOB (18+ validation), gender, address; persist to localStorage
- [ ] C3-3  `cedLoan/src/pages/Register/SetPin.js` — PIN + confirm; submit `POST /auth/register/complete`; store JWT
- [ ] C3-4  Remove ID verification, work info, education, emergency contacts from `/register/*` routes
- [ ] C3-5  Create `cedLoan/src/pages/LoanApplication/KycGate.js` — multi-step wrapper with progress bar and localStorage persistence
- [ ] C3-6  Create `cedLoan/src/pages/LoanApplication/kyc/WorkInfo.js`
- [ ] C3-7  Create `cedLoan/src/pages/LoanApplication/kyc/EducationInfo.js`
- [ ] C3-8  Create `cedLoan/src/pages/LoanApplication/kyc/EmergencyContacts.js` — dynamic add/remove; min 1
- [ ] C3-9  Create `cedLoan/src/pages/LoanApplication/kyc/IdVerification.js` — dual image upload; progress
- [ ] C3-10 Implement `cedLoan/src/pages/LoanApplication/LoanApplication.tsx` — full loan form with live fee calculator
- [ ] C3-11 Routing: intercept `/loan-application` -> if `kycComplete === false` render KycGate; else loan form
- [ ] C3-12 On 422 `KYC_INCOMPLETE`: parse `missingFields` -> pre-navigate KycGate to correct step
- [ ] C3-13 `cedLoan/src/pages/Home/` — active loan card with countdown; conditional Apply CTA; notification badge
- [ ] C3-14 `cedLoan/src/pages/History/` — loan list with expandable rows
- [ ] C3-15 `cedLoan/src/pages/Notifications/` — mark-as-read; mark-all-read; unread badge in bottom nav
- [ ] C3-16 `cedLoan/src/pages/Profile/` — view + edit all data; re-upload ID; change PIN; level history
- [ ] C3-17 After login: if `mustChangePinOnLogin = true` -> force Change PIN before any navigation
- [ ] C3-18 `cedLoan/src/pages/LoanExtension/` — eligibility check; extension days; live fee; submit
- [ ] C3-19 `cedLoan/src/pages/LoanRateCalculation/` — confirm reads from live AppConfig rates
- [ ] C3-20 Service Worker: cache `GET /api/loans/active-check` and `GET /api/auth/me` for offline display

---

## Appendix A — Loan Fee Calculation

```
Principal = loan.amount

interestAmount    = Principal x (interestRate / 100)
serviceFee        = Principal x (serviceFeePct / 100)
administrationFee = Principal x (administrationFeePct / 100)
commitmentFee     = Principal x (commitmentFeePct / 100)

totalRepayable    = Principal + interestAmount + serviceFee + administrationFee + commitmentFee

amountReceived    = Principal - (serviceFee + administrationFee + commitmentFee)
-- Fees deducted upfront from disbursement; interest repaid at end of term

-- Overdue (applied daily after dueDate)
dailyOverdueFee  = remainingBalance x (overdueFeePct / 100)
totalOverdueFee  = dailyOverdueFee x overdueDays

-- Extension
extensionFeeTotal = extensionDays x dailyExtensionFeeRate
```

---

## Appendix B — Route Maps

### cedLoan Registration Routes (lightweight — 4 steps only)

```
/register                  -> Step 1: Phone entry + OTP send
/register/verify-otp       -> Step 2: OTP verification
/register/personal-info    -> Step 3: Name, DOB, gender, address
/register/set-pin          -> Step 4: PIN creation -> account created
```

### cedLoan KYC Gate Routes (triggered on first loan application)

```
/loan-application                        -> Entry point
  if kycComplete === false:
/loan-application/kyc/work               -> KYC Step 1: Work info
/loan-application/kyc/education          -> KYC Step 2: Education
/loan-application/kyc/emergency-contacts -> KYC Step 3: Emergency contacts
/loan-application/kyc/id-verification    -> KYC Step 4: ID upload
  on PATCH /users/me/kyc completion:
/loan-application                        -> Loan form (now unlocked)
```

### cedLoan App Routes

```
/                          -> Home / Dashboard
/login                     -> Login
/register/*                -> Registration (4 steps)
/loan-application/*        -> Loan application + KYC gate
/history                   -> Loan history
/loan-extension            -> Extension request
/loan-rate-calculation     -> Public fee calculator
/notifications             -> Notification inbox
/profile                   -> User profile + settings
/forgot-pin                -> PIN recovery
```

---

## Appendix C — Admin Navigation Structure

```
Dashboard
Users
+-- User List
+-- Find One
+-- Manual Registration
+-- User Management
+-- Level Assignment
Orders
+-- Order Lending          (failed disbursements + retry)
+-- Order Repayment        (POP submission)
+-- Review Payment         (POP confirmation)
+-- Extension Order        (loan extensions)
Credit Review
+-- Assign
+-- List
+-- Count
Pre-Collection
+-- Pre-Assignment
+-- Pre-Repayment
+-- Rank 1
+-- Shiftiest
Collection
+-- List
+-- Rank 1
+-- Rank 2
+-- App Usage
Marketing
Notification Manager
Config
+-- App Configuration      (loan settings, fees, branding, contact, content)
+-- Loan Levels            (CRUD for LoanLevel records)
+-- Role Management        (super-admin only)
+-- Server Logs            (super-admin only)
+-- Bin / Deleted Records  (super-admin only)
```

---

*End of Master Build Blueprint — CEDI Loan Platform*
*Pick up any section at any time. Every Build Tasks checklist is self-contained.*
