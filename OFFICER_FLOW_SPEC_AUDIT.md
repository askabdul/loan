# Officer Flow Spec Audit (Blueprint vs Current Implementation)

Date: 2026-05-16
Scope: Credit Review, Pre-Collection, Collection officer assignment and execution flow
Reference: MASTER_BUILD_BLUEPRINT.md

## 1) Credit Review Officer Flow

### Blueprint intent
- Queue of assignable review cases
- Single assignment and bulk assignment (equal + load-weighted)
- Review list with officer actions and contact notes
- Count dashboard per officer (assigned, contacted, full/partial, pending, completion rate)

### Current implementation
- UI assignment page exists: apps/admin/src/pages/CreditReviewAssign.js
- Backend assignment route exists: POST /api/admin/loans/assign in apps/backend/routes/admin.js
- Distribution currently supports assignmentType = manual | even (no weighted mode in this route)
- Review list exists: apps/admin/src/pages/CreditReviewList.js
- Count page route exists: /credit-review/count in apps/admin/src/App.js
- Count API exists: GET /api/collection/credit-review/count in apps/backend/routes/collection.js

### Gap to match blueprint exactly
1. Add weighted distribution mode to credit-review bulk assignment route used by admin (/api/admin/loans/assign).
2. Ensure contact-note persistence endpoint in blueprint is implemented and wired from CreditReviewList row actions.
3. Align metric definitions in count API with blueprint formulas (explicit partial/full/contacted sources by date range).

## 2) Pre-Collection Officer Flow

### Blueprint intent
- Status lifecycle tabs: pending-assignment, assigned, processed, hung-up, completed
- Single assign, unassign, bulk assign, reserve
- 10-day reserve auto-release
- Officer-scoped views for precollection-officer, full visibility for leads/admin
- Rank 1 + repayment performance views

### Current implementation
- API supports: /cases, /cases/:id/assign, /cases/:id/unassign, /cases/:id/reserve, /bulk-assign, /repayments, /rank1, /officer-performance, /officers in apps/backend/routes/precollection.js
- 10-day reserve release service exists and runs daily: apps/backend/services/reserveReleaseService.js
- UI list + actions exist: apps/admin/src/pages/PreCollection/PreCollectionList.js
- Role-scoped all-list page exists: apps/admin/src/pages/PreCollection/PreCollectionAllList.js

### Gap to match blueprint exactly
1. Role scoping in API uses req.admin.role?.name in /precollection/cases; verify admin token role payload shape is always available server-side and enforced consistently.
2. Pre-assignment dedicated route/menu is still a placeholder in admin router (App.js).
3. Ensure due-window eligibility (D-7 to D-1 active loans) is enforced where blueprint expects queue qualification.

## 3) Collection Officer Flow

### Blueprint intent
- Overdue queue management with the same 5 status tabs
- Assign/unassign/reserve/bulk assign/redistribute
- Rank 1 and Rank 2 performance
- Payment record and app-usage tracking views

### Current implementation
- API supports: /cases, /cases/:id/assign, /cases/:id/unassign, /cases/:id/status, /cases/:id/reserve, /bulk-assign, /redistribute, /officers, /officer-performance, /rank1, /rank2, /repayments, /app-usage in apps/backend/routes/collection.js
- UI list + assignment + bulk + redistribute exists: apps/admin/src/pages/Collection/CollectionList.js
- 10-day reserve auto-release handled by shared service: apps/backend/services/reserveReleaseService.js

### Gap to match blueprint exactly
1. Several collection submenu routes in admin are still placeholders (monitor, app usage, manual cases) in apps/admin/src/App.js.
2. Validate all tab labels and status values exactly match blueprint wording and lifecycle transitions.
3. Confirm officer action audit trail requirements are captured for every state-changing action.

## 4) Recommended “Spec-Exact” Actions

Priority A (contract and behavior)
- Add weighted mode to /api/admin/loans/assign and use from CreditReviewAssign.
- Implement/verify contact-note endpoint and wire from CreditReviewList action row.
- Add explicit D-7..D-1 precollection qualification filter where cases are sourced.

Priority B (admin UX coverage)
- Replace placeholder routes in App.js for pre-collection/collection operational pages already described in blueprint.
- Standardize assignment modals and role-scoped data handling across credit, precollection, collection.

Priority C (governance)
- Add endpoint-level contract tests for assignment and status transitions.
- Add periodic report checks for count/rank metrics against blueprint formulas.
