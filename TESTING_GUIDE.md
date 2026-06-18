# CEDI Loan Platform — Production Testing & Stakeholder Guide

> **Audience:** Stakeholders, product owners, QA testers, end users, and deployment engineers
> **Last updated:** 2026-06-13
> **Apps under test:** Backend API (Node.js/Express) · Admin Portal (React/MUI) · cedLoan Customer PWA (React/Tailwind)
> **Payment gateway:** Bridge AGW (Mobile Money — MTN, Telecel, AirtelTigo)
> **Database:** PostgreSQL 14+ (Sequelize ORM, multi-schema)

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Quick Start — Running All Three Apps Locally](#2-quick-start)
3. [Database Setup & Seeding](#3-database-setup--seeding)
4. [Test Accounts & Roles](#4-test-accounts--roles)
5. [Smoke Tests — Is Everything Alive?](#5-smoke-tests)
6. [Customer App (cedLoan) — Complete End-to-End Flow](#6-customer-app-end-to-end-flow)
7. [Admin Portal — Role-by-Role Walkthrough](#7-admin-portal-role-by-role-walkthrough)
8. [Role UI Gates — What Each Person Sees](#8-role-ui-gates)
9. [Mobile Money Payment Testing](#9-mobile-money-payment-testing)
10. [App Configuration — Live Customization Tests](#10-app-configuration--live-customization)
11. [Loan Business Logic Verification](#11-loan-business-logic-verification)
12. [UI/UX Quality Checklist](#12-uiux-quality-checklist)
13. [Production Hardening Checklist](#13-production-hardening-checklist)
14. [Common Issues & Fixes](#14-common-issues--fixes)
15. [Free Hosting for Stakeholder Testing](#15-free-hosting-for-stakeholder-testing)

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CEDI Loan Platform                       │
│                                                             │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │  cedLoan PWA  │   │  Admin Portal │   │  Backend API   │  │
│  │  (port 3000)  │   │  (port 3001)  │   │  (port 5000)   │  │
│  │  Customer     │   │  Staff Only   │   │  Node/Express  │  │
│  └──────┬───────┘   └──────┬────────┘   └───────┬────────┘  │
│         └──────────────────┴────────────────────┘           │
│                        REST + WebSocket                      │
│                        ↕                                     │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  PostgreSQL  (schemas: cedi_auth · cedi_loans ·          │ │
│  │               cedi_payments · cedi_notifications ·       │ │
│  │               cedi_config)                              │ │
│  └─────────────────────────────────────────────────────────┘ │
│                        ↕                                     │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Bridge AGW (Mobile Money Gateway)                      │ │
│  │  CTM: customer → us (repayment)                         │ │
│  │  DTM: us → customer (disbursement)                      │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**The loan lifecycle:**
```
Customer Applies → Pending → Credit Review (Assigned) → Approved
→ Disbursed (money sent to customer) → Active → Repaid → Completed
                                                        ↓ Level +1
                                          or → Overdue → Collection
```

---

## 2. Quick Start

### Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Node.js | 18+ | `node -v` |
| npm | 9+ | `npm -v` |
| PostgreSQL | 14+ | `psql --version` |
| Git | Any | `git --version` |

### Environment Files

Each app needs its own `.env`. Copy the examples below.

**`apps/backend/.env`** (already present — verify these keys are set):
```env
NODE_ENV=development
PORT=5000
JWT_SECRET=replace-with-a-long-random-secret-min-32-chars
JWT_EXPIRE=7d
DATABASE_URL=           # or use individual DB_* keys below
DB_NAME=cedi_loan
DB_USER=postgres
DB_PASS=your_db_password
DB_HOST=localhost
DB_PORT=5432
ADMIN_FRONTEND_URL=http://localhost:3001
FIREBASE_PROJECT_ID=    # required for customer OTP login
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
BRIDGE_BASE_URL=https://api.bridgeagw.com
BRIDGE_SERVICE_ID=92
BRIDGE_API_USERNAME=    # provided by Bridge AGW
BRIDGE_API_PASSWORD=    # provided by Bridge AGW
BRIDGE_CALLBACK_URL=https://cedi-loan-test.loca.lt  # use localtunnel for local payment testing (see §9)
```

**`apps/admin/.env`**:
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
```

**`apps/cedLoan/.env`**:
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_SOCKET_URL=http://localhost:5000
REACT_APP_FIREBASE_API_KEY=
REACT_APP_FIREBASE_AUTH_DOMAIN=
REACT_APP_FIREBASE_PROJECT_ID=
```

### Start All Three Services

Open three separate terminal tabs:

```bash
# Terminal 1 — Backend API
cd apps/backend && npm install && npm run dev
# Should print: "Server running on port 5000" + WebSocket and DB connection messages

# Terminal 2 — Admin Portal
cd apps/admin && npm install && npm start
# Opens http://localhost:3001

# Terminal 3 — Customer App
cd apps/cedLoan && npm install && npm start
# Opens http://localhost:3000
```

---

## 3. Database Setup & Seeding

Run these **once** after the first `npm run dev` starts (Sequelize auto-creates tables):

```bash
cd apps/backend

# 1. Seed the 10 default admin roles with their permission sets
node scripts/seedRoles.js

# 2. Create the 7 loan levels (GHS 100 → GHS 500 range)
node scripts/seedLoanLevels.js

# 3. Seed all app configuration keys (interest rates, fees, branding, etc.)
node scripts/seedAllConfigs.js

# 4. Create the super-admin account
node scripts/seedSuperAdmin.js
# Note the credentials printed to console — save them immediately
```

**Verify the database is seeded:**
```bash
# Check roles (should return 10 rows)
psql -U postgres -d cedi_loan -c "SELECT name, hierarchy FROM cedi_auth.roles ORDER BY hierarchy;"

# Check loan levels (should return 7 rows)
psql -U postgres -d cedi_loan -c "SELECT level_number, min_amount, max_amount FROM cedi_loans.loan_levels ORDER BY level_number;"
```

---

## 4. Test Accounts & Roles

### Admin Portal — All 10 Roles

| Role | Hierarchy | What They Can Do | Menus Visible |
|---|---|---|---|
| **Super Admin** | 1 | Everything — God mode | All menus, all sub-menus |
| **Admin** | 2 | All operational menus, cannot delete admins or manage roles | All menus (no role deletion) |
| **Local Manager** | 3 | Regional oversight — users, orders, reviews, collection | User, Order, Credit Review, Pre-collection, Collection, Dashboard |
| **Review Lead** | 4 | Assigns loans to review officers, sees all applications | User (find), Order (partial), Credit Review (assign+list+stats) |
| **Review Officer** | 5 | Reviews and decides on assigned loans | User (find), Order (partial), Credit Review (list only) |
| **Collection Lead** | 6 | Assigns overdue cases to collectors | User (find), Collection (list+ranks+officers) |
| **Collection Officer** | 7 | Works their assigned overdue cases | User (find), Collection (list only) |
| **Pre-Collection Lead** | 8 | Assigns active-loan reminders before due date | User (find), Pre-Collection (all views) |
| **Pre-Collection Officer** | 9 | Calls customers before due date | User (find), Pre-Collection (list+payment record) |
| **Customer Service** | 10 | Customer lookup only | User (find only) |

**Create test admin accounts** (Super Admin only):
1. Log in to Admin Portal as Super Admin
2. Go to **System → Admin & Workers → Create Admin**
3. Create one account per role to test with

### Customer App Accounts

Register fresh accounts directly in the cedLoan app. You need at least 2–3:
- **Test User A:** Goes through the full loan cycle (apply → approved → repay → level up)
- **Test User B:** Used to test overdue/collection scenarios
- **Test User C:** Used to test rejection flow

---

## 5. Smoke Tests

Run these before any detailed testing to confirm all three services are alive.

### 5.1 Backend API Health

```bash
curl http://localhost:5000/api/health
# Expected: { "status": "OK", "message": "CEDI Loan API is running" }

curl http://localhost:5000/api/config/public
# Expected: JSON with app_name, support_phone, fee rates
```

### 5.2 Admin Portal — Login Smoke Test

1. Open http://localhost:3001
2. Enter super-admin credentials → click **Login**
3. **Expected:** Redirected to dashboard with all 8 sidebar menu items visible
4. **Fail indicator:** "Login failed", blank screen, or network error

### 5.3 Customer App — Login Screen Smoke Test

1. Open http://localhost:3000
2. **Expected:** Login screen loads with app branding, phone input field, and a "Register" link
3. Tap **Register** → **Expected:** Registration form appears (phone number field)

### 5.4 WebSocket Connection Smoke Test

1. Log into the Admin Portal as Super Admin
2. Open browser DevTools → **Network** tab → filter by **WS**
3. **Expected:** One persistent WebSocket connection to `ws://localhost:5000`
4. Open cedLoan app in another tab
5. **Expected:** Another WebSocket connection appears

### 5.5 Configuration Loading Smoke Test

1. In Admin Portal, go to **App Configuration → General Settings**
2. **Expected:** The page loads with values under all 6 category tabs (Loan, Fee Rates, Contact Info, Branding, System, Security)
3. In cedLoan app, go to **Apply**
4. **Expected:** Fee breakdown panel shows interest rate, service fee, admin fee, commitment fee

---

## 6. Customer App — Complete End-to-End Flow

Open **http://localhost:3000** in a browser or mobile device. The app is a PWA and works on both desktop and mobile.

---

### 6.1 Registration Flow

**Path:** Home → Register

**Step 1 — Phone Verification (Steps 1–2 of 4):**
1. Enter a valid Ghana phone number (`0244123456` format or `+233244123456`)
2. Tap **Send OTP**
3. Enter the 6-digit OTP (in dev mode the OTP is shown on-screen and logged to backend console)

**Step 2 — Personal Information (Step 3 of 4):**
4. Fill in: First Name, Last Name
5. **Email Address** *(optional)* — used for loan notifications and account recovery
6. Date of Birth (must be 18+ — date picker enforces this)
7. Gender, Street Address, City, Region

**Step 3 — Set PIN (Step 4 of 4):**
8. Set a **4-digit PIN** (weak PINs like `1234`, `0000` are blocked)
9. Confirm the PIN
10. **Expected:** Automatically logged in and redirected to the Home screen

**Bottom navigation should now show:**
```
🏠 Home  |  📋 Apply  |  📜 History  |  🔔 Alerts  |  👤 Profile
```

**UX checks:**
- [ ] Phone field validates Ghana format before sending OTP
- [ ] OTP input has 6 individual boxes, auto-advances on each digit
- [ ] Email field is optional — skipping it still allows registration
- [ ] Email format is validated if provided (must be `x@x.x`)
- [ ] PIN input is masked (shows dots)
- [ ] Common/weak PINs are rejected with an informative message
- [ ] Error message is friendly if wrong OTP entered (not a raw error code)
- [ ] Back button works on each registration step

---

### 6.2 KYC Profile Completion

Before applying for any loan, the user must complete their profile. This appears automatically as a **KYC Gate** when they tap Apply.

**KYC steps (in order):**
1. **Personal Information** — full name, DOB, gender, residential address
2. **Work Information** — employer name, job title, monthly income, employment type
3. **Education** — highest education level
4. **Emergency Contacts** — at least one contact with name and phone
5. **ID Verification** — upload front and back of Ghana Card / passport

**UX checks:**
- [ ] Progress indicator shows which step you're on (e.g. "Step 2 of 5")
- [ ] Each step validates required fields before allowing "Next"
- [ ] You can go **back** to a previous step without losing data
- [ ] ID upload accepts JPG, PNG (shows preview after selection)
- [ ] On the last step, a **"Submit KYC"** button appears — success toast shows
- [ ] After completion, navigating to Apply shows the loan form (not the KYC gate again)

---

### 6.3 Loan Application

**Path:** Apply → (KYC complete) → Loan Form

1. Loan amount slider (Level 1: GHS 100 — fixed; higher levels unlock larger amounts)
2. **Select term:** 7 days (default for Level 1 — driven by loan levels config)
3. **Fee breakdown panel** shows automatically:

   | Component | Rate | On GHS 100 |
   |---|---|---|
   | Interest | 9% | GHS 9 |
   | Service Fee | 12% | GHS 12 |
   | Admin Fee | 12% | GHS 12 |
   | Commitment Fee | 12% | GHS 12 |
   | **Total Fees** | **45%** | **GHS 45** |
   | **You receive** | | **GHS 55** |
   | **You repay Day 7** | | **GHS 100** |

4. Check **"I accept the Terms and Conditions"** — link opens the full T&C text
5. Tap **Submit Application**
6. **Expected:** Status card appears — **"Under Review"** with a clock icon

**UX checks:**
- [ ] Fee breakdown updates instantly when you move the amount slider
- [ ] The "You receive" number is prominently displayed (user needs to see actual cash received)
- [ ] Terms link opens a readable full-screen view, not a raw URL
- [ ] Submit button shows a spinner while the request is in-flight
- [ ] Cannot submit twice (button disabled after first tap)
- [ ] If no internet: shows a friendly offline error, not a blank screen

---

### 6.4 Real-Time Status Updates

While the loan is under review, switch to the admin portal and approve it. Watch the cedLoan app.

**Expected (without refreshing the page):**
- The status badge on the loan card changes from **"Under Review"** → **"Approved"** → **"Active"** (after disbursement)
- A toast notification appears at the top of the screen with the status change message
- The bell icon in the bottom nav shows a badge count

---

### 6.5 Repayment Flow

Once the loan status is **Active** (money has been disbursed to the customer's mobile money account):

1. Go to **Apply** or **Home** → tap **Make Payment**
2. Payment modal opens with:
   - Outstanding balance amount
   - Due date and days remaining
   - Payment type selector: **Full** / **Partial**
   - Mobile Money Provider: **MTN** / **Telecel** / **AirtelTigo**
   - Phone number field (pre-filled from KYC profile — intentionally read-only for security)
3. Select **Full Payment** → confirm amount
4. Tap **Submit Payment**
5. **Expected:** STK push notification arrives on the customer's phone from mobile money provider
6. Customer approves on their phone
7. Bridge AGW calls the payment webhook → balance decreases in real-time
8. Toast: **"Payment confirmed by your mobile network!"**
9. If loan is fully paid: status updates to **"Completed"**, level progression check fires

**UX checks:**
- [ ] Outstanding balance is clearly shown in large text
- [ ] Due date has color coding: green (plenty of time), amber (< 3 days), red (overdue)
- [ ] Provider logos are visible (MTN yellow, Telecel red, AirtelTigo blue)
- [ ] The phone number field shows the KYC-verified number — user cannot change it here
- [ ] A small lock icon or note explains why the phone is read-only
- [ ] Partial payment option shows remaining balance after payment
- [ ] Loading spinner during STK push wait
- [ ] If payment fails (e.g., insufficient funds): clear error message with retry option
- [ ] Payment confirmation shows a receipt-style breakdown

---

### 6.6 Loan History

**Path:** History (bottom nav)

- See all past and current loans in a card list
- Each card shows: amount, term, status badge, disbursement date, due date
- Tap a loan → expanded view shows all payment records for that loan
- Overdue fee accumulation is visible on overdue loans

**UX checks:**
- [ ] Empty state: friendly message if no loans yet (not a blank page)
- [ ] Most recent loan appears first
- [ ] Status badges use consistent colors as in the Apply screen

---

### 6.7 Notifications

**Path:** Alerts (bell icon)

- Loan status changes (submitted, approved, rejected, disbursed, overdue)
- Payment confirmations
- Level upgrade notifications

**UX checks:**
- [ ] Unread count badge on bell icon (disappears after viewing)
- [ ] Tapping a notification marks it as read
- [ ] Clear all button works
- [ ] Empty state is friendly

---

### 6.8 Profile

**Path:** Profile (person icon)

- View current loan level and what unlocks the next level
- Edit personal information
- Change PIN (requires current PIN for security)
- Logout button

---

## 7. Admin Portal — Role-by-Role Walkthrough

Open **http://localhost:3001** and log in with each role account to verify the workflow.

---

### 7.1 Super Admin / Admin

**All menus visible. Full access to all features.**

**Initial setup checklist:**
- [ ] **System → Admin & Workers:** Create one account for each of the 9 other roles
- [ ] **System → Role Management:** View all 10 roles and their permission trees
- [ ] **App Configuration → General Settings:** All 9 tabs load with values
- [ ] **App Configuration → Loan Configuration:** Create/edit loan levels and term structures
- [ ] **Data Statistics → Dashboard:** Live dashboard with loan stats, payments, user counts

**Operational checklist:**
- [ ] **User → List of Users:** Search for a user by phone/name; open the 7-tab detail modal
- [ ] **User → Find One:** Look up a single user and view their full profile
- [ ] **User → Manual Registration:** Create a user account on behalf of a customer
- [ ] **User → Level Assignment:** Manually upgrade a user's loan level
- [ ] **Order → Order List:** See all loans in all statuses
- [ ] **Order → Loan Details:** Full financial breakdown per loan
- [ ] **Order → Order Lending:** Manage manual disbursements and retry failed disbursements
- [ ] **Order → Order Repayment:** Submit proof of payment for customers who paid outside the app
- [ ] **Order → Review Repayment:** Approve or reject a submitted proof of payment
- [ ] **Fund Management → Payment Management:** See all Bridge AGW transactions

---

### 7.2 Review Lead

**Objective:** Assign incoming loan applications to review officers.

**Menus visible:** User (Find One), Order (Order Lending/Repayment/Review Repayment), Credit Review (Assign, Review List, Statistics)

**Step-by-step:**
1. Log in as Review Lead
2. **Credit Review → Assign**
   - Unassigned (pending) loan applications appear in the table
   - Select one or multiple loans using the checkboxes
   - Click **Assign** → Officer Assignment modal opens
   - Select one or more Review Officers
   - Choose distribution: **Even Split** or **Load Weighted**
   - Confirm → loans move to "Assigned" status
3. **Credit Review → Review List**
   - See all applications across status tabs: Pending / Assigned / Approved / Rejected / Hanged Up
   - Click any row to open the Detail Modal (read-only for the lead)
4. **Credit Review → Statistics**
   - See officer workload counts and approval/rejection rates

**What the Review Lead CANNOT do:**
- Approve or reject a loan (no Approve/Reject buttons — those are greyed out or hidden)
- Access Pre-Collection or Collection menus
- Edit user data or loan configuration

---

### 7.3 Review Officer

**Objective:** Review assigned loans and make approve/reject/hang-up decisions.

**Menus visible:** User (Find One), Order (partial), Credit Review (List only — Assign tab is hidden)

**Step-by-step:**
1. Log in as Review Officer
2. **Credit Review → Review List → "Assigned" tab**
   - You see ONLY loans assigned to YOU (not all pending loans)
   - Other officers' assigned loans are not visible
3. Click a loan row → **Loan Detail Modal**
   - **Application tab:** Customer personal info, KYC details, employment data, emergency contacts
   - **Financial & Fees tab:** Loan amount, term, fee breakdown, repayment schedule
4. Make a decision:
   - **Approve** — loan moves to Approved, disbursement fires automatically if `auto_disburse_on_approval = true`
   - **Reject** — enter a reason; customer is notified
   - **Hang Up** — reserves the case for 10 days (configurable), returns to queue after
5. Enter a remark in the Remarks field before confirming

**What the Review Officer CANNOT do:**
- Assign loans to other officers (no Assign sub-menu)
- See loans not assigned to them
- Access User List, Pre-Collection, Collection, or App Configuration

---

### 7.4 Pre-Collection Lead

**Objective:** Assign active loans approaching due date to pre-collection officers for reminders.

**Menus visible:** User (Find One), Pre-Collection (Full Case List, Pre-Assignment, Rank1, Rank2, Payment Record)

**Step-by-step:**
1. **Pre-Collection → Pre-Assignment → "Pending Assignment" tab**
   - Active loans within the reminder window (typically 3–7 days before due date)
   - Bulk-select and assign to Pre-Collection Officers
2. **Pre-Collection → Full Case List**
   - See all assigned cases across all officers; filter by officer name or status
3. **Pre-Collection → Rank1 / Rank2**
   - Officer performance ranked by collection rate and contacts made

---

### 7.5 Pre-Collection Officer

**Objective:** Contact assigned customers before their loan due date.

**Menus visible:** User (Find One), Pre-Collection (Full Case List, Pre-Assignment, Payment Record)

**Step-by-step:**
1. **Pre-Collection → Pre-Assignment → "Assigned" tab**
   - See ONLY cases assigned to YOU
2. For each case: call the customer to remind them
3. Log outcome: **Processed** (customer confirmed) or **Hung Up** (reserve for follow-up)
4. **Pre-Collection → Payment Record**
   - Track early payments customers make after your reminders

---

### 7.6 Collection Lead

**Objective:** Assign overdue loans to collection officers for follow-up.

**Menus visible:** User (Find One), Collection (List, Rank1, Rank2, Payment Record, Officers)

**Step-by-step:**
1. **Collection → List → "Pending Assignment" tab**
   - Overdue loans not yet assigned to any officer
   - Select and assign to Collection Officers
2. **Collection → Officers**
   - See officer caseloads, performance metrics, assignment history
3. **Collection → Rank1 / Rank2**
   - Officer rankings by collected amounts and resolution rates

---

### 7.7 Collection Officer

**Objective:** Work your assigned overdue cases.

**Menus visible:** User (Find One), Collection (List only)

**Step-by-step:**
1. **Collection → List → "Assigned" tab**
   - See ONLY your assigned overdue loans
2. Contact customers via the phone number shown in the case
3. Log outcomes per case
4. Cannot see other officers' cases or any other module

---

### 7.8 Customer Service

**Objective:** Answer customer queries by looking up their account.

**Menus visible:** User (Find One only) — literally one menu item visible

**Step-by-step:**
1. **User → Find One**
   - Search by phone number or name
   - View customer profile: personal info, loan history, current status
2. Cannot modify anything — read-only lookup
3. No other menus are visible in the sidebar (sidebar shows only "User" section)

---

### 7.9 Order Management (Cross-Role Feature)

The **Order** menu is accessible to Admin, Local Manager, Review Lead, and Review Officer (with different sub-menu access per role).

**Manual Proof-of-Payment Flow (for customers who pay outside the app):**

1. **Order → Order Repayment**
   - Search for the customer's loan by ID or phone number
   - Fill: payment amount, payment method (bank transfer, cash, MoMo), payment date
   - Upload proof of payment (bank receipt photo)
   - Submit → creates a clearance record in "pending review" state

2. **Order → Review Repayment**
   - Finance team sees all submitted proofs of payment
   - Click to review → see uploaded receipt
   - **Approve:** loan balance is updated, customer is notified
   - **Reject:** submitter notified with reason, no balance change

---

## 8. Role UI Gates

This section verifies that each role sees ONLY their relevant sections — no sidebar item or page should be accessible to a role that has no permission for it.

### Permission Matrix

| Menu / Feature | Super Admin | Admin | Local Mgr | Review Lead | Review Officer | Coll Lead | Coll Officer | Pre-Coll Lead | Pre-Coll Officer | Cust. Svc |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| User → List | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| User → Find One | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| User → Manual Reg | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| User → Level Assignment | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Order (full) | ✅ | ✅ | ✅ | partial | partial | ❌ | ❌ | ❌ | ❌ | ❌ |
| Credit Review → Assign | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Credit Review → List | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Credit Review → Statistics | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Approve / Reject loans** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Pre-Collection (all) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | partial | ❌ |
| Collection (all) | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | partial | ❌ | ❌ | ❌ |
| Fund Management | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| App Configuration | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Data Statistics | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| System → Admin Mgmt | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| System → Role Mgmt | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

### How to Verify UI Gates

For each test account, do the following:

**Step 1 — Sidebar check:**
Log in and visually verify the sidebar shows ONLY the items listed in the matrix above for that role.

**Step 2 — Direct URL bypass test:**
Try navigating directly to a restricted URL. The app should block access:
```
As Review Officer, visit: http://localhost:3001/app-config
→ Expected: Toast "Access denied" and redirect to the officer's home page

As Collection Officer, visit: http://localhost:3001/roles
→ Expected: Blocked — no roles page visible

As Customer Service, visit: http://localhost:3001/user/list
→ Expected: Only "Find One" is accessible; the list page blocks or redirects
```

**Step 3 — Home page redirect:**
When a user with limited access logs in, they should land on the FIRST accessible page for their role (not a blank 404):
- Review Officer → lands on **Credit Review → Review List**
- Collection Officer → lands on **Collection → List**
- Customer Service → lands on **User → Find One**
- Pre-Collection Officer → lands on **Pre-Collection → Pre-Assignment**

**Step 4 — Data isolation (review officers):**
Log in as Review Officer A. Note the loan IDs in their list.
Log in as Review Officer B. Their list should show different loan IDs — NOT the ones assigned to A.

**Step 5 — Action button visibility:**
On the Credit Review → List page:
- Logged in as Review Lead: The **Approve** and **Reject** buttons in the loan detail modal should be hidden or disabled (leads assign, they don't approve)
- Logged in as Review Officer: **Approve**, **Reject**, **Hang Up** buttons are visible and functional

**Step 6 — Cross-user session tab isolation (critical):**
This verifies that when a different user logs in on the same browser, they don't see the previous user's open tabs.

1. Log in as **Super Admin** → open tabs for Dashboard, User List, App Configuration
2. Click **Logout**
3. Log in as **Review Officer** on the same browser tab
4. **Expected:** Tab bar is completely empty (starts fresh). The officer should NOT see Dashboard or App Configuration tabs from the super admin's session.
5. Navigate within the officer's allowed pages — their own tabs accumulate normally.

---

## 9. Mobile Money Payment Testing

### ⚠️ Why payments don't work on bare localhost

Bridge AGW needs to POST a webhook callback to confirm that the customer approved the STK push. If your backend is on `localhost:5000`, Bridge cannot reach it from the internet — so the payment will be initiated, the STK push will fire, the user will approve it on their phone, but **the balance will never update** because the callback is blocked.

### 9.0 Expose your local backend with localtunnel (required for payment testing)

**localtunnel** creates a public HTTPS URL that tunnels to your local port — no account required.

```bash
# From any terminal (backend must be running on port 5000 first)
npx localtunnel --port 5000 --subdomain cedi-loan-test

# Output:
# your url is: https://cedi-loan-test.loca.lt

# Update apps/backend/.env:
BRIDGE_CALLBACK_URL=https://cedi-loan-test.loca.lt

# Restart the backend (nodemon will auto-reload if already running)
# Touch server.js to trigger nodemon:
touch apps/backend/server.js
```

> **Important:** localtunnel shows a "click to continue" browser challenge on the first browser visit. The Bridge webhook bypasses this automatically (it's only for browsers). You do NOT need to do anything extra.

> **Session persistence:** The `--subdomain cedi-loan-test` flag keeps the URL stable across restarts. If the subdomain is taken, omit it — you'll get a random URL (update `.env` each time).

**Current status:** localtunnel is active at **`https://cedi-loan-test.loca.lt`** — the backend `.env` is already updated.

---

### 9.1 Live Payment Test (real mobile money)

> Requires Bridge AGW credentials in `.env`, localtunnel running, and a phone with mobile money wallet.

**Prerequisites:** Loan must be in **Active** status (disbursed), and `BRIDGE_CALLBACK_URL` must point to a public URL (see §9.0).

1. In cedLoan app → tap **Make Payment**
2. Enter amount, select provider matching your SIM card
3. Phone number should be your KYC-verified MoMo number (read-only)
4. Tap **Submit** → loading state appears
5. **STK push appears on the phone** from MTN/Telecel/AirtelTigo
6. Enter mobile money PIN on the phone to approve
7. Bridge AGW calls `POST https://cedi-loan-test.loca.lt/api/payments/webhook` → payment recorded
8. Balance decreases in real-time in the app
9. If loan is fully paid: status → **Completed**, level check fires

**UX checks during payment:**
- [ ] The provider logo is visible and correctly colored
- [ ] Loading spinner is visible while waiting for STK push confirmation
- [ ] A countdown or wait message shows (Bridge can take 10–30 seconds)
- [ ] If the user closes the modal, a notification arrives when the webhook is processed
- [ ] Amount formatting uses GHS currency symbol consistently

---

### 9.2 Webhook Test (no real money — verify handler logic)

```bash
# Step 1: Find a payment in "processing" state
# (after submitting a payment in the app but before the STK push is approved)

# Step 2: Get the transaction_id from the database
psql -U postgres -d cedi_loan -c \
  "SELECT transaction_id, status, amount FROM cedi_payments.payments WHERE status='processing' ORDER BY created_at DESC LIMIT 5;"

# Step 3: Simulate a successful payment callback
curl -X POST http://localhost:5000/api/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "PASTE_YOUR_TXN_ID_HERE",
    "status": "000",
    "status_desc": "Transaction Successful",
    "network_transaction_id": "TEST-NET-MANUAL-001"
  }'

# Expected response: { "success": true, "message": "Payment processed" }
# Expected side effects:
#   - Payment status → "completed"
#   - Loan remaining balance decreases
#   - If balance = 0: loan status → "completed", level progression fires
#   - WebSocket pushes update to cedLoan app in real-time

# Step 4: Simulate a failed payment
curl -X POST http://localhost:5000/api/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "PASTE_YOUR_TXN_ID_HERE",
    "status": "101",
    "status_desc": "Insufficient funds"
  }'
# Expected: payment status → "failed", user notified
```

### 9.3 Disbursement Webhook Test

```bash
# Simulate Bridge confirming they sent money to the customer
curl -X POST http://localhost:5000/api/loans/bridge-disbursement-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_id": "DISB-<LOAN_REF>-<TIMESTAMP>",
    "status": "000",
    "status_desc": "Transaction Successful"
  }'
# Expected:
#   - Loan status → "active"
#   - Repayment clock starts
#   - Customer receives "Your loan has been disbursed" notification
```

### 9.4 Payment Status Sync Test

If the webhook was missed (e.g., server was down), the system can check payment status manually:

1. In Admin Portal → **Fund Management → Payment Management**
2. Find the payment in "processing" state
3. Click the **Sync** or **Check Status** button
4. System queries Bridge AGW for the current status and updates accordingly

---

## 10. App Configuration — Live Customization

The App Configuration section is the admin's control center for the entire platform. Changes here reflect in the cedLoan app in near-real-time via WebSocket broadcast.

### 10.1 Configuration Tabs and What They Control

| Tab | What You Can Configure |
|---|---|
| **Loan Settings** | Min/max loan amounts, interest rate, auto-disburse toggle, overdue penalty, extension settings |
| **Fee Rates** | Individual interest, service, admin, and commitment fee rates per loan term (7/14/30 days) |
| **Contact Info** | Support phone, email, WhatsApp, office address, business hours |
| **Branding** | App name, tagline, company name, logo URL |
| **System** | Maintenance mode, session timeout, notification toggle, dashboard refresh interval |
| **Security** | Password policy, login attempt limits, lockout duration, 2FA toggle |
| **Email** | SMTP settings for system emails |
| **API** | Rate limiting, CORS settings |
| **Database** | Connection pool size, query timeout, backup retention |

### 10.2 Real-Time Config Change Test

**Open two browser windows side by side:**
- Window A: Admin Portal (logged in as Super Admin) → **App Configuration → Fee Rates**
- Window B: cedLoan app → **Apply** (loan application form with fee breakdown)

**Test procedure:**
1. In Window A, click the **edit icon** next to "7 Days - Interest Rate"
2. Change it from `9` to `12`
3. Click the **save icon**
4. **Watch Window B** — within 1–2 seconds the fee breakdown updates without a page refresh

**More config changes to test:**

| Action | Where to Change | Where to Verify |
|---|---|---|
| Change `app_name` | Branding tab → Application Name | cedLoan header/title bar |
| Change `support_phone` | Contact Info → Support Phone | cedLoan Profile page or Contact section |
| Change `max_loan_amount` | Loan Settings → Maximum Loan Amount | cedLoan Apply → amount slider max value |
| Enable `maintenance_mode` | System → Maintenance Mode → Enabled | cedLoan shows maintenance banner |
| Change `overdue_fee_daily_pct` | Fee Rates → Overdue Daily Penalty | Overdue loan balance in History tab |

### 10.3 Loan Configuration

**Path:** App Configuration → Loan Configuration

Manage loan levels and their term structures:
- Each level has a minimum and maximum borrowable amount
- Each level can have different available terms (7/14/30 days)
- Changes to levels affect what customers can borrow based on their level

**Test:** Create a new Level 8 with GHS 1000 max and 30-day term → assign a test user to Level 8 → verify they can select GHS 1000 in the loan application form.

### 10.4 Permission Gates on Config

- **Super Admin:** Full read/write on all config tabs
- **Admin:** Full read/write (same as super admin for config)
- **All other roles:** See the config page but all edit buttons are hidden — a banner says "read-only access, contact super admin"
- **Attempt direct API:** Other roles calling `PUT /api/config/:key` will receive `403 Forbidden`

---

## 11. Loan Business Logic Verification

### 11.1 Fee Calculation — Level 1, 7-Day Loan

| Component | Rate | On GHS 100 |
|---|---|---|
| Interest | 9% | GHS 9 |
| Service Fee | 12% | GHS 12 |
| Admin Fee | 12% | GHS 12 |
| Commitment Fee | 12% | GHS 12 |
| **Total Fees** | **45%** | **GHS 45** |
| **Customer Receives** | | **GHS 55** |
| **Customer Repays** | | **GHS 100** |

Verify: Apply → review fee breakdown panel. Numbers must match exactly.

### 11.2 Overdue Penalty Calculation

The daily penalty rate is configured via **App Configuration → Fee Rates → Overdue Daily Penalty** (`overdue_fee_daily_pct`).

**Current default: 2% per day** (changed from 5% — configurable without code changes).

The rate is baked into each loan at creation time so changing the config only affects future loans, not existing ones.

**Scenario:** Customer owes GHS 100, doesn't pay, loan goes overdue (with rate = 2%):

| Days Overdue | Daily Penalty | Accumulated Fee | Total Owed |
|---|---|---|---|
| 1 | GHS 2 | GHS 2 | GHS 102 |
| 3 | GHS 2 | GHS 6 | GHS 106 |
| 7 | GHS 2 | GHS 14 | GHS 114 |
| 14 | GHS 2 | GHS 28 | GHS 128 |

**How to change the rate:**
1. Admin Portal → App Configuration → Fee Rates tab
2. Edit **"Overdue Daily Penalty"** field → enter new % (e.g. `3`)
3. Save — new loans created after this will use the new rate

**How to test overdue calculations:**
```sql
-- Manually push a loan's due date to the past to trigger overdue status
UPDATE cedi_loans.loans
SET due_date = NOW() - INTERVAL '3 days'
WHERE loan_id = 'XXXXXX';
-- The hourly job picks it up, or use the admin manual trigger
```

Verify: In Admin Portal → Collection → List → open an overdue loan → see `overdueAmount` increasing each day. In cedLoan app, the payment modal shows a fee breakdown (principal + late fee + total to clear).

### 11.3 Loan Level Progression

Completing a loan successfully unlocks the next level with higher borrowing limits:

| Level | Min Borrow | Max Borrow | Unlocked After |
|---|---|---|---|
| 1 | GHS 100 | GHS 100 | Registration |
| 2 | GHS 100 | GHS 200 | 1 completed loan |
| 3 | GHS 150 | GHS 250 | 2 completed loans |
| 4 | GHS 200 | GHS 300 | 3 completed loans |
| 5 | GHS 200 | GHS 400 | 4 completed loans |
| 6 | GHS 300 | GHS 450 | 5 completed loans |
| 7 | GHS 400 | GHS 500 | 6 completed loans |

**Test:** Complete a Level 1 loan → Admin Portal → User → Find One → check user's level shows 2 → In cedLoan, go to Apply → slider now goes up to GHS 200.

### 11.4 Auto-Disburse Toggle

In App Configuration → Loan Settings:
- **`auto_disburse_on_approval = true`** (default): Approving a loan immediately initiates the Bridge disbursement
- **`auto_disburse_on_approval = false`**: Approving moves loan to "Approved" but requires manual disbursement via Order → Order Lending

**Test both modes** by toggling the config and observing what happens after a Review Officer approves a loan.

### 11.5 Loan Extension

> Extension feature is currently disabled in the sidebar but the backend handles it.

Admin can enable it in App Configuration:
- `max_extension_days_per_request`: max days a customer can extend at once
- `max_extension_count`: how many times they can extend per loan
- `loan_extension_daily_fee_rate`: daily fee for the extension period
- `max_overdue_days_for_extension`: overdue loans past this threshold cannot be extended

---

## 12. UI/UX Quality Checklist

Run through this checklist on both desktop (1280px) and mobile (390px viewport).

### Navigation

- [ ] All sidebar links navigate to the correct page without console errors
- [ ] The active page is highlighted in the sidebar
- [ ] Expanding one sidebar group auto-collapses the previously expanded group
- [ ] Browser back/forward buttons work correctly across all pages
- [ ] Refreshing any admin page keeps you on the same page (route preserved)
- [ ] cedLoan bottom navigation is always visible on mobile
- [ ] The active tab in cedLoan bottom nav is visually distinct (filled icon)

### Forms & Inputs

- [ ] All required fields show validation messages when left empty
- [ ] Error messages are below the relevant field (not just a toast at the top)
- [ ] Number inputs have `min`/`max` enforced (no negative amounts)
- [ ] Long form submissions show a loading state; the button is disabled to prevent double-submit
- [ ] Date pickers are mobile-friendly
- [ ] Phone number fields format correctly (0244-xxx-xxx or +233 format)

### Tables & Lists

- [ ] Tables show a loading skeleton while data fetches (not blank white)
- [ ] Empty state shows a friendly message, not a blank table body
- [ ] Search/filter clears correctly when the X button is tapped
- [ ] Pagination or infinite scroll works on large lists
- [ ] Clicking outside a modal closes it (or a visible X button)

### Payment UX (Most Critical)

- [ ] The amount the customer actually **receives** (after fee deductions) is shown in large, prominent text — NOT buried in a table
- [ ] Fee breakdown is visually separated from the repayment amount
- [ ] The repayment due date is shown in human-readable format ("Monday, June 17" not "2026-06-17T00:00:00Z")
- [ ] Overdue loans have a clear visual indicator (red badge or warning icon)
- [ ] The STK push confirmation screen has a "waiting..." indicator and clear instructions
- [ ] Payment success screen shows a receipt summary

### Mobile Responsiveness

- [ ] Admin Portal: sidebar collapses to a hamburger menu on screens below 768px
- [ ] All admin tables are horizontally scrollable on mobile
- [ ] cedLoan input fields don't zoom the page on focus (requires `font-size: 16px` on inputs)
- [ ] Modal dialogs don't overflow the screen on mobile
- [ ] Tap targets are at least 44×44px

### Real-Time Updates

- [ ] WebSocket reconnects automatically if the connection drops (check by briefly stopping the backend and restarting)
- [ ] Toast notifications don't stack infinitely (max 3 visible at once, older ones dismiss)
- [ ] Status badges update without page refresh when admin changes loan status

---

## 13. Production Hardening Checklist

Before sharing with stakeholders on a live server:

### Security

- [ ] Replace `JWT_SECRET` with a random 64-character string:
  ```bash
  openssl rand -base64 64
  ```
- [ ] Set `NODE_ENV=production` in backend `.env`
- [ ] Ensure `BCRYPT_ROUNDS=12` (already set — don't lower it)
- [ ] Review `corsOrigins` in App Configuration to whitelist only your deployed frontend URLs
- [ ] Remove any hardcoded test credentials from the codebase

### Database

- [ ] Run all seed scripts on the production database before sharing
- [ ] Set `DB_SYNC=false` in production (never auto-alter tables in prod)
- [ ] Use `DATABASE_URL` with SSL for hosted databases (Supabase, Render Postgres)

### Firebase

- [ ] Add your deployed cedLoan URL to Firebase Authorized Domains (console.firebase.google.com → Authentication → Settings)

### Bridge AGW

- [ ] Update `BRIDGE_CALLBACK_URL` to point to the deployed backend URL
- [ ] Test the webhook path is publicly accessible: `https://your-backend.onrender.com/api/payments/webhook`

### Performance

- [ ] Run `npm run build` for both admin and cedLoan before deploying (minified production builds)
- [ ] Enable gzip compression on your hosting platform for the static sites

### Monitoring

- [ ] Check backend logs on first deploy: `apps/backend` logs startup errors
- [ ] Health endpoint responds: `https://your-backend.onrender.com/api/health`
- [ ] Test a full loan cycle (register → apply → approve → pay) on the live URL before sharing with stakeholders

---

## 14. Common Issues & Fixes

| Issue | Likely Cause | Fix |
|---|---|---|
| Cannot connect to API | Backend not running or wrong port | Run `npm run dev` in `apps/backend/`, check PORT in .env |
| "Invalid token" / 401 errors | Token expired or wrong localStorage key | Log out and log back in; clear localStorage if stuck |
| Admin portal blank after login | Permissions fetch failed | Check backend is running; open DevTools → Network for 500 errors |
| Empty Pre-Collection / Collection tables | `precollectionStatus` or `collectionStatus` null on old rows | Restart backend — `backfillLoanQueueStatuses()` runs automatically on boot |
| "Bridge credentials missing" error | `BRIDGE_SERVICE_ID` not set in .env | Add full Bridge credentials to `apps/backend/.env` |
| Fee rates not updating in cedLoan | WebSocket not connected | Verify backend running; refresh cedLoan; check WS in DevTools |
| Review Officer sees no loans | Loans not assigned to them | Use a Review Lead account to assign loans to that officer |
| Admin cannot approve loans | Approval is intentionally restricted to Review Officers | Log in as a Review Officer account |
| Payment stays "processing" forever | Bridge webhook not received (test env) | Use the curl webhook test from Section 9.2 |
| Level not upgrading after loan completion | `levelProgressionService` didn't run | Check backend logs; manually assign via Admin → User → Level Assignment |
| OTP not arriving | Firebase not configured | Add Firebase credentials to both `.env` files; check Authorized Domains |
| Sidebar collapses immediately | localStorage `sidebar_expanded` corrupted | Clear localStorage: `localStorage.removeItem('sidebar_expanded')` in browser console |
| "Access denied" on a route the role should have | Stale `adminPermissions` in localStorage | Log out and log back in to refresh permissions |

---

## 15. Free Hosting for Stakeholder Testing

Below are the best zero-cost platforms to deploy all three services for stakeholder review. No credit card required for any of these.

---

### Option A — Render + Supabase (Recommended)

> Your backend is already configured with `BRIDGE_CALLBACK_URL=https://loan-htqt.onrender.com` — Render is the natural choice.

| Component | Platform | Free Tier |
|---|---|---|
| Backend API (Node.js) | [render.com](https://render.com) | Free Web Service — spins down after 15 min inactivity (~30s cold start) |
| PostgreSQL | [supabase.com](https://supabase.com) | 500MB free, permanent (no 90-day expiry) |
| Admin Portal (React SPA) | Render Static Site | Instant deploy, no sleep |
| cedLoan PWA (React) | Render Static Site | Instant deploy, no sleep |

**Deploy steps:**

```
1. Push your code to a GitHub repository (if not already)

2. Backend:
   - render.com → New → Web Service → connect repo → root dir: apps/backend
   - Build command: npm install
   - Start command: node server.js
   - Add all .env variables under "Environment"
   - Note the URL: https://YOUR-NAME.onrender.com

3. Database:
   - supabase.com → New Project → copy the connection string
   - In Render backend env: DATABASE_URL = postgresql://postgres:[pass]@db.[project].supabase.co:5432/postgres
   - Add ?sslmode=require at the end of the connection string

4. Run seeds (use Render's Shell tab or a one-off job):
   node scripts/seedRoles.js
   node scripts/seedLoanLevels.js
   node scripts/seedAllConfigs.js
   node scripts/seedSuperAdmin.js

5. Admin Portal:
   - render.com → New → Static Site → root dir: apps/admin
   - Build command: npm install && npm run build
   - Publish dir: build
   - Environment variable: REACT_APP_API_URL = https://YOUR-NAME.onrender.com/api

6. cedLoan PWA:
   - render.com → New → Static Site → root dir: apps/cedLoan
   - Same process as admin
   - Environment variable: REACT_APP_API_URL = https://YOUR-NAME.onrender.com/api
```

---

### Option B — Railway (Backend + DB) + Netlify (Frontends)

| Component | Platform | Free Tier |
|---|---|---|
| Backend + PostgreSQL | [railway.app](https://railway.app) | $5 free credit/month (~200hrs runtime) |
| Admin Portal | [netlify.com](https://netlify.com) | Unlimited static deploys |
| cedLoan PWA | [netlify.com](https://netlify.com) | Unlimited static deploys |

Railway has the simplest one-click Postgres provisioning. Netlify has the best build DX for React.

---

### Option C — Vercel (Frontends) + Render (Backend) + Supabase (DB)

```
Admin Portal  → vercel.com → New Project → import apps/admin
cedLoan PWA   → vercel.com → New Project → import apps/cedLoan
Backend API   → render.com → Web Service
PostgreSQL    → supabase.com → Free tier (permanent)
```

Vercel has excellent edge caching for React builds and zero config needed.

---

### Environment Variables for Deployed Setup

**Backend (Render / Railway environment):**
```env
NODE_ENV=production
DATABASE_URL=<supabase_or_railway_postgres_url>
JWT_SECRET=<your-64-char-random-secret>
BRIDGE_CALLBACK_URL=https://your-backend.onrender.com
ADMIN_FRONTEND_URL=https://your-admin.netlify.app
```

**Admin Portal (`apps/admin/.env` or Netlify/Vercel environment):**
```env
REACT_APP_API_URL=https://your-backend.onrender.com/api
REACT_APP_SOCKET_URL=https://your-backend.onrender.com
```

**cedLoan PWA (`apps/cedLoan/.env` or Netlify/Vercel environment):**
```env
REACT_APP_API_URL=https://your-backend.onrender.com/api
REACT_APP_SOCKET_URL=https://your-backend.onrender.com
REACT_APP_FIREBASE_API_KEY=<your-firebase-key>
REACT_APP_FIREBASE_AUTH_DOMAIN=<your-project>.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=<your-project-id>
```

---

### Pre-Launch Checklist for Stakeholders

```
[ ] Health check passes: https://your-backend.onrender.com/api/health
[ ] All 4 seed scripts have been run on the production database
[ ] Super admin can log in and see all menus
[ ] A Review Officer can log in and ONLY sees Credit Review
[ ] Test loan cycle completes: register → apply → approve → disburse → repay
[ ] Bridge webhook URL is updated to the deployed backend URL
[ ] Firebase Authorized Domains includes the deployed cedLoan URL
[ ] CORS origins in App Configuration whitelist the deployed frontend URLs
```

---

### Sharing With Stakeholders

When you share the URLs, include this quick-reference card:

```
CEDI Loan Platform — Stakeholder Access

Customer App: https://cedloan.netlify.app
Admin Portal: https://cedloan-admin.netlify.app

Test Customer Account: Register at https://cedloan.netlify.app/register

Admin Test Accounts:
  Super Admin:    superadmin@cediloan.com  / [password]
  Review Officer: officer1@cediloan.com    / [password]
  Collection:     col1@cediloan.com        / [password]
  Customer Svc:   cs@cediloan.com          / [password]

Note: The backend API spins down after 15 minutes of inactivity.
The first request after idle will take ~30 seconds — this is normal
for free hosting. In production this won't happen.
```

---

*CEDI Loan Platform — Testing & Deployment Guide · Last updated 2026-06-10*
