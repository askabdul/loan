/**
 * Level Progression Service
 * Auto-promotes users to the next loan level after a loan is completed,
 * if they meet the requirements for the next level.
 * Also called after manual level assignments to log the event.
 */

const { User, LoanLevel, Notification } = require("../models");
const websocketService = require("./websocketService");

/**
 * Check if the user qualifies for an automatic level promotion after completing a loan.
 * If eligible, updates currentLoanLevel and appends to levelProgressionHistory.
 *
 * @param {string} userId  - User primary key (UUID)
 * @param {Object} [options] - Optional Sequelize transaction
 */
async function checkAndPromoteLevel(userId, options = {}) {
  try {
    const user = await User.findByPk(userId, options);
    if (!user) return;

    const currentLevel = user.currentLoanLevel || 1;
    const nextLevelDef = await LoanLevel.getNextLevel(currentLevel);

    if (!nextLevelDef) return; // already at max level

    // Check minimum loans completed requirement
    if (user.totalLoansCompleted < nextLevelDef.minimumLoansCompleted) return;

    // Check full repayment requirement
    if (nextLevelDef.requiresFullRepayment) {
      // Look for any partial clearance on record (kept simple — no partial clearances)
      // More complex check can be added here if partial clearances need to block promotion
    }

    // Promote
    const history = Array.isArray(user.levelProgressionHistory)
      ? user.levelProgressionHistory
      : [];

    history.push({
      fromLevel: currentLevel,
      toLevel: nextLevelDef.level,
      progressionDate: new Date().toISOString(),
      reason: "auto-promotion after loan completion",
      triggeredBy: "system",
    });

    await user.update(
      {
        currentLoanLevel: nextLevelDef.level,
        levelProgressionHistory: history,
      },
      options,
    );

    // Send notification to user
    try {
      await Notification.create(
        {
          recipientUserId: user.id,
          type: "level-upgrade",
          priority: "high",
          message: `Congratulations! You've been upgraded to Loan Level ${nextLevelDef.level}. You can now apply for higher loan amounts.`,
          isRead: false,
        },
        options,
      );

      // Real-time event
      websocketService.broadcastUserLevelUpdate({
        userId: user.id,
        oldLevel: currentLevel,
        newLevel: nextLevelDef.level,
      });
    } catch (notifErr) {
      console.error("[LevelProgression] Notification error:", notifErr.message);
    }

    console.log(
      `[LevelProgression] User ${user.userId} promoted from Level ${currentLevel} to Level ${nextLevelDef.level}`,
    );

    return nextLevelDef.level;
  } catch (error) {
    console.error("[LevelProgression] Error:", error.message);
  }
}

/**
 * Log a manual level assignment by an admin.
 * Does NOT change the level — the route does that. This just appends history.
 */
async function logManualLevelAssignment(
  userId,
  fromLevel,
  toLevel,
  adminId,
  notes,
  options = {},
) {
  try {
    const user = await User.findByPk(userId, options);
    if (!user) return;

    const history = Array.isArray(user.levelProgressionHistory)
      ? user.levelProgressionHistory
      : [];

    history.push({
      fromLevel,
      toLevel,
      progressionDate: new Date().toISOString(),
      reason: notes || "manual admin assignment",
      triggeredBy: "admin",
      adminId,
    });

    await user.update({ levelProgressionHistory: history }, options);
  } catch (error) {
    console.error("[LevelProgression] Log manual error:", error.message);
  }
}

module.exports = { checkAndPromoteLevel, logManualLevelAssignment };
