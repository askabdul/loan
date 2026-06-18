# Role & Permission Compliance Report (Second Pass)

Date: 2026-05-23
Scope: Admin RBAC (backend middleware + Admin UI gating)
Reference: MASTER_BUILD_BLUEPRINT.md Section 2 (Role hierarchy and matrix)

## What was checked

- Backend route middleware keys (`requireMenuAccess`, `requireSubMenuAccess`, `requireActionPermission`)
- Admin UI gates (`hasMenuAccess`, `hasSubMenuAccess`, `hasActionPermission`)
- Role seed defaults (`apps/backend/scripts/seedRoles.js`)
- Domain behavior for: Credit Review, Pre-Collection, Collection

## Implemented in this pass

1. Review officer decision authority (domain-safe)
- `review-officer` can review/decide only loans assigned to them.
- Enforced on `PATCH /api/admin/loans/:id/status` ownership guard.

2. Review lead assignment authority
- `review-lead` can access officers list and assign review work.
- Officer list endpoint now requires one of authorized module permissions.

3. Pre-Collection domain segregation
- Lead roles assign/bulk assign.
- Officers reserve/release only their own assigned/reserved cases.
- Shiftiest path (`/pre-collection/all-list`) is no longer hard-wired to super-admin.
- API allows `allList` access for officer workflows without granting pre-assignment powers.

4. Collection domain segregation
- Lead roles assign/unassign/bulk assign/redistribute.
- Officers can update status/reserve only their own assigned cases.

5. Permission-key alignment
- Credit Review decision UI now uses `updateLoanStatus` gate (same as backend policy).

6. Role seed normalization
- Rewrote role defaults to align with blueprint menu/submenu intent and current app keys.
- Added explicit action keys needed by enforced routes and domain UI.

## Role-by-role status (current)

### super-admin
- Status: Compliant
- Notes: Full menu/submenu/action coverage.

### admin
- Status: Compliant (Operational)
- Notes: Full operational menus; role-management action remains restricted.

### local-manager
- Status: Mostly compliant
- Notes: Broad operational coverage; no system/config management.

### review-lead
- Status: Compliant for requested behavior
- Can:
  - View review pipeline (`creditReview.list`)
  - View review officers and assign cases (`creditReview.assign` + officer endpoint authorization)
  - Make review decisions (`updateLoanStatus`)

### review-officer
- Status: Compliant for requested behavior
- Can:
  - View assigned review cases
  - Approve/reject/hang-up decisions
- Guardrail:
  - Cannot decide cases not assigned to them (enforced backend ownership check)

### precollection-lead
- Status: Compliant in domain
- Can:
  - Assign/unassign/bulk-assign pre-collection cases
  - Access list/rank/payment/shiftiest workflows

### precollection-officer
- Status: Compliant in domain
- Can:
  - Work shiftiest/all-list and payment-record domain views
  - Reserve/release only own assigned/reserved cases
- Cannot:
  - Assign/bulk-assign cases

### collection-lead
- Status: Compliant in domain
- Can:
  - Assign/unassign/bulk-assign/redistribute collection cases
  - Access collection performance views

### collection-officer
- Status: Compliant in domain
- Can:
  - Work assigned collection cases
  - Update status/reserve only own cases
- Cannot:
  - Assignment management

### customer-service
- Status: Partially compliant
- Notes: Find-one lookup access is aligned; advanced operational domains remain blocked.

## Known partials vs blueprint nuance

1. Read-only nuance (`R`) is not first-class
- Matrix includes `R` (e.g., Review Lead on User List), while current implementation models permissions as boolean access + action gates.
- Effect: Practical read-only is approximated by not granting edit actions, but there is no dedicated `readOnly` policy type.

2. Legacy/parallel action keys still exist in some pages
- Some pages still use legacy action names (e.g., `approveLoans`) while backend canonical policy uses `updateLoanStatus`.
- This pass fixed core review decision surfaces; a full cleanup should standardize all pages to canonical action keys.

## Files updated for this pass

- `apps/backend/routes/admin.js`
- `apps/backend/routes/adminManagement.js`
- `apps/backend/routes/precollection.js`
- `apps/backend/routes/collection.js`
- `apps/backend/scripts/seedRoles.js`
- `apps/admin/src/pages/CreditReviewList.js`
- `apps/admin/src/pages/CreditReviewAssign.js`
- `apps/admin/src/components/DetailModal/DetailModal.js`
- `apps/admin/src/pages/PreCollection/PreCollectionList.js`
- `apps/admin/src/components/Sidebar/Sidebar.js`

## Recommended next cleanup (optional)

- Introduce explicit permission mode: `none | read | write` for submenu policies.
- Standardize all UI action checks to canonical keys:
  - `assignLoan`, `updateLoanStatus`, `editUsers`, `viewUsers`, `manageRoles`, etc.
- Add an automated RBAC regression test suite for key routes and role fixtures.
