# Cedi Platform -- System Blueprint & Execution Plan

## 🧠 1. System Overview

### 🏗️ Architecture

\[ Customer Loan App \] \<---\> \[ Backend API \] \<---\> \[ Admin App
\]

### 🔹 Components

-   Customer App: Users apply for loans, track repayment\
-   Admin App: Internal management of loans, users, approvals\
-   Backend API: Business logic, authentication, data persistence

------------------------------------------------------------------------

## 🔁 2. Core System Flows

### 💰 Loan Lifecycle

1.  User registers\
2.  User applies for loan\
3.  Admin reviews application\
4.  Loan approved or rejected\
5.  If approved → disbursement + repayment schedule\
6.  User makes repayments\
7.  System tracks dues, penalties, completion

### 👤 User Lifecycle

1.  Registration\
2.  Profile completion\
3.  Verification\
4.  Eligibility determination\
5.  Activity tracking

------------------------------------------------------------------------

## 🧩 3. Feature Breakdown

### 📱 Customer Loan App

-   Authentication (register, login, reset)
-   Profile management
-   Loan application & tracking
-   Repayments & history
-   Notifications

### 🖥️ Admin App

-   User management
-   Loan approvals
-   Repayment monitoring
-   Dashboard analytics

### ⚙️ Backend API

-   Auth service
-   User service
-   Loan service
-   Payment service
-   Reporting service

------------------------------------------------------------------------

## 🗂️ 4. Module-Level Breakdown

### Loan Module

-   Purpose: Manage lifecycle\
-   Inputs: user data, amount, duration\
-   Outputs: status, repayment plan\
-   Dependencies: user + payment services\
-   Edge cases: missed payments, multiple loans

------------------------------------------------------------------------

## 🛠️ 5. Development Plan

### Phase 1: Foundation

-   Setup project
-   Auth system
-   DB schema

### Phase 2: Core

-   User + Loan services
-   Basic UI flows

### Phase 3: Advanced

-   Repayments
-   Notifications
-   Analytics

### Phase 4: Hardening

-   Security
-   Performance
-   Logging

------------------------------------------------------------------------

## 🧪 6. Testing Strategy

-   Unit: calculations, auth\
-   Integration: loan → payment\
-   Critical flows: approvals, penalties

------------------------------------------------------------------------

## 🚀 7. Deployment Plan

-   Dev / Staging / Production\
-   Checklist: migrations, env, tests\
-   Rollback: backups, versioning

------------------------------------------------------------------------

## ⏱️ 8. Task Breakdown

-   Feature → tasks → subtasks\
-   Parallel frontend/backend work

------------------------------------------------------------------------

## ⚠️ 9. Risk Areas

-   Financial logic errors\
-   Security vulnerabilities\
-   State inconsistencies

------------------------------------------------------------------------

## 🧱 10. Suggested Tech

-   Backend: NestJS, PostgreSQL\
-   Frontend: React\
-   Infra: Docker, CI/CD

------------------------------------------------------------------------

## 📌 11. Usage

-   Solo: backend first, then UI\
-   Team: split backend/admin/client
