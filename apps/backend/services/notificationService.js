/**
 * Notification Service
 * Central dispatcher for all user and admin notifications.
 * Checks AppConfig toggles before sending — every trigger can be disabled.
 * Currently sends via Notification model (in-app) + WebSocket.
 * SMS/Email integration points are marked with TODO.
 */

const { Notification, AppConfig } = require("../models");
const websocketService = require("./websocketService");

// Map of trigger keys to AppConfig keys
const TOGGLE_KEYS = {
  application_received: "notify_application_received",
  loan_approved: "notify_loan_approved",
  loan_rejected: "notify_loan_rejected",
  loan_disbursed: "notify_loan_disbursed",
  due_reminder_7: "notify_due_reminder_7",
  due_reminder_3: "notify_due_reminder_3",
  due_reminder_1: "notify_due_reminder_1",
  payment_confirmed: "notify_payment_confirmed",
  loan_overdue: "notify_loan_overdue",
  level_upgraded: "notify_level_upgraded",
  extension_granted: "notify_extension_granted",
};

async function isEnabled(triggerKey) {
  const configKey = TOGGLE_KEYS[triggerKey];
  if (!configKey) return true; // unknown key — allow by default

  try {
    const val = await AppConfig.getConfig(configKey);
    // Default to true if the key doesn't exist yet
    return val === undefined || val === null || val === true || val === "true";
  } catch {
    return true;
  }
}

/**
 * Send an in-app notification to a user.
 * @param {string} recipientUserId  - User UUID
 * @param {string} type             - Notification type (matches TOGGLE_KEYS keys)
 * @param {string} message          - Message text
 * @param {Object} [extra]          - Extra fields (priority, expiresAt, etc.)
 */
async function notifyUser(recipientUserId, type, message, extra = {}) {
  if (!(await isEnabled(type))) return;

  try {
    const notif = await Notification.create({
      recipientUserId,
      type,
      message,
      priority: extra.priority || "normal",
      expiresAt: extra.expiresAt || null,
      isRead: false,
    });

    // Push via WebSocket if user is connected
    websocketService.broadcastNotification({
      userId: recipientUserId,
      notification: {
        id: notif.id,
        type,
        message,
        createdAt: notif.createdAt,
      },
    });

    // TODO: send SMS if user has phone — integrate Arkesel/Twilio here
    // TODO: send Email if user has email — integrate SendGrid/Postmark here
  } catch (error) {
    console.error(
      `[NotificationService] Failed to notify user: ${error.message}`,
    );
  }
}

/**
 * Send a notification to one or more admin roles.
 */
async function notifyAdmins(recipientRole, type, message, extra = {}) {
  try {
    await Notification.create({
      recipientRole,
      type,
      message,
      priority: extra.priority || "normal",
      isRead: false,
    });

    websocketService.broadcastToAdmins({ type, message, recipientRole });
  } catch (error) {
    console.error(
      `[NotificationService] Failed to notify admins: ${error.message}`,
    );
  }
}

// ── Typed helpers for common events ──────────────────────────────────────────

async function loanApplicationReceived(userId) {
  await notifyUser(
    userId,
    "application_received",
    "Your loan application has been received and is under review.",
  );
  await notifyAdmins(
    "review-lead",
    "application_received",
    "A new loan application requires review.",
  );
}

async function loanApproved(userId, amount) {
  await notifyUser(
    userId,
    "loan_approved",
    `Your loan of GH₵ ${Number(amount).toFixed(2)} has been approved and will be disbursed shortly.`,
  );
}

async function loanRejected(userId, reason) {
  await notifyUser(
    userId,
    "loan_rejected",
    `Your loan application has been rejected. Reason: ${reason || "See admin for details."}`,
  );
}

async function loanDisbursed(userId, amount) {
  await notifyUser(
    userId,
    "loan_disbursed",
    `Your loan of GH₵ ${Number(amount).toFixed(2)} has been disbursed to your account.`,
  );
}

async function paymentConfirmed(userId, amount) {
  await notifyUser(
    userId,
    "payment_confirmed",
    `Your payment of GH₵ ${Number(amount).toFixed(2)} has been confirmed. Thank you!`,
  );
}

async function loanOverdue(userId, daysOverdue) {
  await notifyUser(
    userId,
    "loan_overdue",
    `Your loan is ${daysOverdue} day(s) overdue. Please make a payment as soon as possible to avoid further penalties.`,
    { priority: "high" },
  );
}

async function levelUpgraded(userId, newLevel) {
  await notifyUser(
    userId,
    "level_upgraded",
    `Congratulations! You've been upgraded to Loan Level ${newLevel}. You can now apply for higher loan amounts.`,
    { priority: "high" },
  );
}

async function extensionGranted(userId, newDueDate, fee) {
  await notifyUser(
    userId,
    "extension_granted",
    `Your loan due date has been extended to ${new Date(newDueDate).toLocaleDateString("en-GH")}. Extension fee: GH₵ ${Number(fee).toFixed(2)}.`,
  );
}

async function dueReminder(userId, daysUntilDue, dueDate) {
  const key =
    daysUntilDue === 7
      ? "due_reminder_7"
      : daysUntilDue === 3
        ? "due_reminder_3"
        : "due_reminder_1";
  await notifyUser(
    userId,
    key,
    `Reminder: Your loan is due in ${daysUntilDue} day(s) on ${new Date(dueDate).toLocaleDateString("en-GH")}. Please ensure your account is funded.`,
  );
}

module.exports = {
  notifyUser,
  notifyAdmins,
  loanApplicationReceived,
  loanApproved,
  loanRejected,
  loanDisbursed,
  paymentConfirmed,
  loanOverdue,
  levelUpgraded,
  extensionGranted,
  dueReminder,
};
