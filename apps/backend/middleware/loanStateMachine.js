/**
 * Loan Status State Machine middleware.
 * Validates that a status transition is allowed before writing to the DB.
 * Apply to any route that modifies loan.status.
 *
 * Usage:
 *   const { loanStateMachine } = require('../middleware/loanStateMachine');
 *   router.patch('/:id/review', loanStateMachine, async (req, res) => { ... });
 */

const TRANSITIONS = {
  pending: ["under-review", "approved", "cancelled", "rejected"],
  "under-review": ["approved", "rejected", "pending"],
  approved: ["disbursed", "disbursement-failed", "cancelled"],
  disbursed: ["active"],
  "disbursement-failed": ["approved", "cancelled"],
  active: ["completed", "overdue", "extended"],
  extended: ["active", "overdue", "completed"],
  overdue: ["completed", "defaulted"],
  completed: [],
  defaulted: [],
  cancelled: [],
  rejected: [],
};

/**
 * Validates that `newStatus` is a permitted transition from `currentStatus`.
 * Returns null if valid, or an error message string if not.
 */
function validateTransition(currentStatus, newStatus) {
  if (!newStatus) return null; // no status change requested — skip check

  const allowed = TRANSITIONS[currentStatus];
  if (!allowed) {
    return `Unknown current status: '${currentStatus}'.`;
  }
  if (!allowed.includes(newStatus)) {
    return `Cannot transition loan from '${currentStatus}' to '${newStatus}'. Allowed: [${allowed.join(", ") || "none"}].`;
  }
  return null;
}

/**
 * Express middleware.
 * Expects:
 *   - req.loan  — the Loan instance (set by a previous lookup middleware), OR
 *   - body field currentStatus + newStatus
 * The route must provide req.loan or pass currentStatus in the body.
 */
const loanStateMachine = async (req, res, next) => {
  const newStatus = req.body && req.body.status;
  if (!newStatus) return next(); // no status change — nothing to validate

  // currentStatus comes from req.loan (if already loaded) or body
  const currentStatus = req.loan ? req.loan.status : req.body.currentStatus;

  if (!currentStatus) {
    // Cannot validate without currentStatus — skip (route should load loan first)
    return next();
  }

  const error = validateTransition(currentStatus, newStatus);
  if (error) {
    return res
      .status(422)
      .json({ success: false, message: error, code: "INVALID_TRANSITION" });
  }

  next();
};

module.exports = loanStateMachine;
module.exports.validateTransition = validateTransition;
module.exports.TRANSITIONS = TRANSITIONS;
