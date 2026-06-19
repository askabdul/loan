const express = require("express");
const { body, validationResult } = require("express-validator");
const { Op, fn, col, literal } = require("sequelize");
const { sequelize } = require("../config/database");
const { Loan, User, LoanLevel, Payment, Notification, AppConfig } = require("../models");
const { auth, adminAuth } = require("../middleware/auth");
const kycCheck = require("../middleware/kycCheck");
const performanceTrackingService = require("../services/performanceTrackingService");
const { checkAndPromoteLevel } = require("../services/levelProgressionService");
const { getLoanLifecycleSettings, calculateOverdueDays } = require("../services/loanLifecycleSettings");

const router = express.Router();

// ── Notification helper ───────────────────────────────────────────────────────
const LOAN_STATUS_NOTIFICATIONS = {
  approved: {
    title: "🎉 Loan Approved!",
    type: "loan_status",
    priority: "high",
  },
  rejected: {
    title: "📋 Loan Application Update",
    type: "loan_status",
    priority: "medium",
  },
  "under-review": {
    title: "🔍 Application Under Review",
    type: "loan_status",
    priority: "low",
  },
  disbursed: {
    title: "💰 Loan Disbursed!",
    type: "loan_status",
    priority: "high",
  },
  active: {
    title: "✅ Loan Now Active",
    type: "loan_status",
    priority: "medium",
  },
  completed: {
    title: "🏁 Loan Fully Repaid!",
    type: "loan_status",
    priority: "high",
  },
  cancelled: {
    title: "❌ Loan Application Cancelled",
    type: "loan_status",
    priority: "low",
  },
};

const LOAN_STATUS_MESSAGES = {
  approved: (loan) =>
    `Your loan application of GHS ${parseFloat(loan.amount).toLocaleString()} has been approved! Disbursement will be processed shortly.`,
  rejected: (loan, reason) =>
    `Your loan application of GHS ${parseFloat(loan.amount).toLocaleString()} was not approved${reason ? ": " + reason : ". Please contact support for assistance."}`,
  "under-review": (loan) =>
    `Your loan application of GHS ${parseFloat(loan.amount).toLocaleString()} is now being reviewed by our credit team.`,
  disbursed: (loan) =>
    `GHS ${parseFloat(loan.amount).toLocaleString()} has been disbursed to your account. Your repayment starts soon.`,
  active: (loan) =>
    `Your loan of GHS ${parseFloat(loan.amount).toLocaleString()} is now active. Keep track of your repayment schedule.`,
  completed: (loan) =>
    `Congratulations! You have fully repaid your loan of GHS ${parseFloat(loan.amount).toLocaleString()}. Your credit score has improved!`,
  cancelled: (loan) =>
    `Your loan application of GHS ${parseFloat(loan.amount).toLocaleString()} has been cancelled.`,
};

async function createLoanNotification(
  userId,
  loan,
  status,
  rejectionReason = null,
) {
  const meta = LOAN_STATUS_NOTIFICATIONS[status];
  if (!meta || !userId) return;
  try {
    await Notification.create({
      recipientUserId: userId,
      title: meta.title,
      message:
        LOAN_STATUS_MESSAGES[status]?.(loan, rejectionReason) ||
        `Your loan status has been updated to: ${status}`,
      type: meta.type,
      priority: meta.priority,
      data: {
        loanId: loan.id,
        loanRef: loan.loanId,
        amount: loan.amount,
        status,
      },
    });
  } catch (e) {
    console.error("Failed to create loan notification:", e.message);
  }
}

const loanUserInclude = {
  model: User,
  as: "User",
  attributes: [
    "id",
    "firstName",
    "lastName",
    "email",
    "phoneNumber",
    "currentLoanLevel",
  ],
  required: false,
};

const calculateCalendarDueDate = (activationDate, termInDays) => {
  const due = new Date(activationDate);
  due.setHours(0, 0, 0, 0);
  due.setDate(due.getDate() + Number(termInDays || 0));
  return due;
};

const buildDisbursementActivationUpdates = ({ loan, now, activateLoan }) => {
  const updates = {
    disbursementDate: now,
    disbursementStatus: "sent",
    disbursementFailedAt: null,
    disbursementFailureReason: null,
    disbursementLastAttemptAt: now,
    disbursementAttempts: (loan.disbursementAttempts || 0) + 1,
    dueDate: calculateCalendarDueDate(now, loan.termInDays || 7),
    // remainingBalance = totalAmount - upfrontFee  (e.g. 145 - 20 = 125 for GHS 100 loan)
    remainingBalance: parseFloat(loan.totalAmount || 0) - parseFloat(loan.upfrontFee || 0),
  };

  if (activateLoan) {
    updates.status = "active";
    updates.activationConfirmedAt = now;
  } else {
    updates.status = "disbursed";
  }

  return updates;
};

// GET /api/loans/active-check
// Returns whether the authenticated user has an active loan and its details.
// Used by cedLoan to guard the Apply button and loan application route.
router.get("/active-check", auth, async (req, res) => {
  try {
    const activeLoan = await Loan.findOne({
      where: {
        userId: req.user.id,
        status: {
          [Op.in]: [
            "pending",
            "under-review",
            "approved",
            "disbursed",
            "active",
            "overdue",
          ],
        },
      },
      attributes: [
        "id",
        "loanId",
        "amount",
        "status",
        "dueDate",
        "extendedDueDate",
        "remainingBalance",
        "totalAmount",
      ],
    });
    res.json({
      success: true,
      hasActiveLoan: !!activeLoan,
      loan: activeLoan || null,
    });
  } catch (err) {
    console.error("Active check error:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error checking active loan." });
  }
});

// POST /api/loans/apply
router.post(
  "/apply",
  auth,
  kycCheck,
  [
    body("amount").isNumeric().isFloat({ min: 1, max: 50000 }),
    body("purpose").isIn([
      "business",
      "education",
      "medical",
      "home-improvement",
      "debt-consolidation",
      "emergency",
      "other",
    ]),
    body("duration").isInt({ min: 1, max: 24 }),
    body("termInDays").isInt({ min: 1, max: 730 }),
    body("loanLevel").optional().isInt({ min: 1 }),
    body("termsAccepted").isBoolean().equals("true"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const user = await User.findByPk(req.user.id);
      // Allow users who registered via register-phone (isPhoneVerified) even if registrationComplete
      // wasn't explicitly set (e.g. test/seed users)
      if (!user.registrationComplete && !user.isPhoneVerified) {
        return res.status(400).json({
          success: false,
          message:
            "Please complete your registration before applying for a loan",
        });
      }

      const activeLoan = await Loan.findOne({
        where: {
          userId: req.user.id,
          status: {
            [Op.in]: [
              "pending",
              "under-review",
              "approved",
              "disbursed",
              "active",
            ],
          },
        },
      });
      if (activeLoan)
        return res.status(409).json({
          success: false,
          message: "You already have an active loan application or loan",
          activeLoan: {
            id: activeLoan.id,
            amount: activeLoan.amount,
            status: activeLoan.status,
          },
        });

      const {
        amount,
        purpose,
        duration,
        termInDays,
        loanLevel,
        termsAccepted,
      } = req.body;
      const userLoanLevel = loanLevel || user.currentLoanLevel || 1;
      const currentLevel = await LoanLevel.getLevelByNumber(userLoanLevel);
      if (!currentLevel)
        return res
          .status(400)
          .json({ success: false, message: "Invalid loan level" });

      if (!currentLevel.availableTerms.includes(termInDays))
        return res.status(400).json({
          success: false,
          message: `Term of ${termInDays} days is not available for your current level. Available terms: ${currentLevel.availableTerms.join(", ")} days`,
        });

      let isAutoApproved = false,
        initialStatus = "pending";
      if (
        currentLevel.autoApproval?.enabled &&
        amount <= currentLevel.autoApproval.maxAmount
      ) {
        const completedLoans = user.totalLoansCompleted || 0;
        const repaymentRate =
          completedLoans > 0
            ? ((user.totalAmountRepaid || 0) /
                (user.totalAmountBorrowed || 1)) *
              100
            : 100;
        if (
          completedLoans >=
            currentLevel.autoApproval.conditions?.minCompletedLoans &&
          repaymentRate >=
            currentLevel.autoApproval.conditions?.minRepaymentRate
        ) {
          isAutoApproved = true;
          initialStatus = "approved";
        }
      }

      // Copy fee rates from the level so _calculateAmounts uses the right values
      const loan = await Loan.create({
        userId: req.user.id,
        amount,
        purpose,
        duration,
        termInDays,
        loanLevel: userLoanLevel,
        termsAccepted,
        isAutoApproved,
        status: initialStatus,
        approvalDate: isAutoApproved ? new Date() : null,
        // Fee rates from the loan level (flat % of principal)
        interestRate:         parseFloat(currentLevel.interestRate)         || 9,
        serviceFeePct:        parseFloat(currentLevel.serviceFeePct)        || 12,
        administrationFeePct: parseFloat(currentLevel.administrationFeePct) || 12,
        commitmentFeePct:     parseFloat(currentLevel.commitmentFeePct)     || 12,
        // upfrontDeductionPct: % of principal withheld at disbursement (e.g. 20%)
        upfrontDeductionPct: await AppConfig.getConfig('upfront_deduction_pct').then(r => r ? Number(r.value) : 20).catch(() => 20),
        overdueFeePct: await AppConfig.getConfig('overdue_fee_daily_pct').then(r => r ? Number(r.value) : 2).catch(() => 2),
      });

      const io = req.app.get("io");
      if (io) {
        // Notify the customer
        io.to(`user-${req.user.id}`).emit("loan-status-changed", {
          loanId: loan.id,
          status: loan.status,
          amount: loan.amount,
          message: "Your loan application has been submitted successfully!",
        });
        // Notify all admin sessions so the pending-applications badge updates
        io.to("loan_updates").emit("new-loan-application", {
          loanId: loan.id,
          loanRef: loan.loanId,
          userId: loan.userId,
          amount: loan.amount,
          status: loan.status,
          submittedAt: new Date(),
        });
      }

      res.status(201).json({
        success: true,
        message: "Loan application submitted successfully",
        loan,
      });
    } catch (err) {
      console.error("Loan application error:", err);
      res.status(500).json({
        success: false,
        message: "Server error processing loan application",
      });
    }
  },
);

// GET /api/loans/my-loans
router.get("/my-loans", auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page)),
      limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const where = { userId: req.user.id };
    if (status) where.status = status;

    const { count, rows: loans } = await Loan.findAndCountAll({
      where,
      order: [["created_at", "DESC"]],
      limit: limitNum,
      offset: (pageNum - 1) * limitNum,
    });

    // Enrich overdue loans with fresh calculations so the frontend never shows
    // stale overdueDays/totalOverdueFee regardless of when the hourly job ran.
    const hasOverdue = loans.some((l) => l.status === "overdue");
    let settings = null;
    if (hasOverdue) {
      settings = await getLoanLifecycleSettings();
    }
    const now = new Date();

    const enrichedLoans = loans.map((loan) => {
      const obj = loan.toJSON();
      if (obj.status === "overdue" && settings) {
        const freshDays = calculateOverdueDays({
          dueDate: obj.dueDate,
          now,
          mode: settings.overdueDayCountMode,
        });
        const dailyRate = (parseFloat(obj.overdueFeePct) || 2) / 100;
        const freshFee =
          Math.round(
            parseFloat(obj.remainingBalance || 0) * dailyRate * freshDays * 100,
          ) / 100;
        obj.overdueDays = freshDays;
        obj.overdueAmount = freshFee;
        obj.totalOverdueFee = freshFee;
      }
      return obj;
    });

    res.json({
      success: true,
      loans: enrichedLoans,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count,
        pages: Math.ceil(count / limitNum),
      },
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error getting loans" });
  }
});

// GET /api/loans/stats/summary
router.get("/stats/summary", auth, async (req, res) => {
  try {
    const stats = await Loan.findAll({
      where: { userId: req.user.id },
      attributes: [
        "status",
        [fn("COUNT", col("id")), "count"],
        [fn("SUM", col("amount")), "totalAmount"],
        [fn("SUM", col("total_amount")), "totalRepayment"],
      ],
      group: ["status"],
      raw: true,
    });

    const summary = {
      totalLoans: 0,
      totalBorrowed: 0,
      totalRepayment: 0,
      activeLoans: 0,
      completedLoans: 0,
      pendingLoans: 0,
    };
    stats.forEach((s) => {
      summary.totalLoans += parseInt(s.count) || 0;
      summary.totalBorrowed += parseFloat(s.totalAmount) || 0;
      summary.totalRepayment += parseFloat(s.totalRepayment) || 0;
      if (["approved", "disbursed", "active"].includes(s.status))
        summary.activeLoans += parseInt(s.count) || 0;
      else if (s.status === "completed")
        summary.completedLoans += parseInt(s.count) || 0;
      else if (["pending", "under-review"].includes(s.status))
        summary.pendingLoans += parseInt(s.count) || 0;
    });
    res.json({ success: true, stats: summary });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error getting loan statistics",
    });
  }
});

// GET /api/loans/calculate/:amount/:duration
router.get("/calculate/:amount/:duration", auth, async (req, res) => {
  try {
    const { amount, duration } = req.params;
    if (
      !amount ||
      !duration ||
      amount < 1 ||
      amount > 50000 ||
      duration < 1 ||
      duration > 24
    )
      return res
        .status(400)
        .json({ success: false, message: "Invalid loan amount or duration" });
    // Use the Loan model's _calculateAmounts helper by building a temp object
    const a = parseFloat(amount),
      dur = parseInt(duration),
      interestRate = 0.15;
    const totalInterest = Math.round(a * interestRate * 100) / 100;
    const serviceFee = Math.round(a * 0.01 * 100) / 100;
    const totalAmount =
      Math.round((a + totalInterest + serviceFee) * 100) / 100;
    const monthlyPayment =
      dur > 0 ? Math.round((totalAmount / dur) * 100) / 100 : 0;
    res.json({
      success: true,
      calculation: {
        loanAmount: a,
        duration: dur,
        interestRate,
        totalInterest,
        serviceFee,
        totalAmount,
        monthlyPayment,
      },
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error calculating loan" });
  }
});

// GET /api/loans/:id
router.get("/:id", auth, async (req, res) => {
  try {
    const loan = await Loan.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [loanUserInclude],
    });
    if (!loan)
      return res
        .status(404)
        .json({ success: false, message: "Loan not found" });
    await loan.updateOverdueStatus();
    if (loan.changed()) await loan.save();
    res.json({ success: true, loan });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error getting loan details" });
  }
});

// PUT /api/loans/:id/cancel
router.put("/:id/cancel", auth, async (req, res) => {
  try {
    const loan = await Loan.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
        status: { [Op.in]: ["pending", "under-review"] },
      },
    });
    if (!loan)
      return res.status(404).json({
        success: false,
        message: "Loan not found or cannot be cancelled",
      });
    await loan.update({ status: "cancelled" });
    res.json({
      success: true,
      message: "Loan application cancelled successfully",
      loan,
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error cancelling loan" });
  }
});

// GET /api/loans/admin/filter (admin)
router.get("/admin/filter", adminAuth, async (req, res) => {
  try {
    const {
      status,
      precollectionStatus,
      collectionStatus,
      page = 1,
      limit = 50,
      sortBy = "created_at",
      sortOrder = "desc",
    } = req.query;
    const where = {};
    if (status) where.status = status;
    if (precollectionStatus) where.precollectionStatus = precollectionStatus;
    if (collectionStatus) where.collectionStatus = collectionStatus;

    const { count, rows: loans } = await Loan.findAndCountAll({
      where,
      include: [loanUserInclude],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });
    res.json({
      success: true,
      loans,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error getting loans data" });
  }
});

// GET /api/loans/admin/all (admin)
router.get("/admin/all", adminAuth, async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 50,
      sortBy = "created_at",
      sortOrder = "desc",
    } = req.query;
    const where = {};
    if (status) where.status = status;

    const [{ count, rows: loans }, totalUsers, statsRows] = await Promise.all([
      Loan.findAndCountAll({
        where,
        include: [loanUserInclude],
        order: [[sortBy, sortOrder.toUpperCase()]],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
      }),
      User.count({ where: { registrationComplete: true } }),
      Loan.findAll({
        attributes: [
          "status",
          [fn("COUNT", col("id")), "count"],
          [fn("SUM", col("total_amount")), "totalDisbursed"],
        ],
        group: ["status"],
        raw: true,
      }),
    ]);

    const dashboardStats = {
      totalLoans: count,
      totalUsers,
      totalDisbursed: 0,
      activeLoans: 0,
      pendingLoans: 0,
      completedLoans: 0,
      rejectedLoans: 0,
    };
    statsRows.forEach((s) => {
      dashboardStats.totalDisbursed += parseFloat(s.totalDisbursed) || 0;
      if (["approved", "disbursed", "active"].includes(s.status))
        dashboardStats.activeLoans += parseInt(s.count) || 0;
      else if (["pending", "under-review"].includes(s.status))
        dashboardStats.pendingLoans += parseInt(s.count) || 0;
      else if (s.status === "completed")
        dashboardStats.completedLoans += parseInt(s.count) || 0;
      else if (s.status === "rejected")
        dashboardStats.rejectedLoans += parseInt(s.count) || 0;
    });

    res.json({
      success: true,
      data: {
        loans,
        stats: dashboardStats,
        totalUsers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error getting loans data" });
  }
});

// GET /api/loans/admin/dashboard-stats (admin)
router.get("/admin/dashboard-stats", adminAuth, async (req, res) => {
  try {
    const [loanStats, userStats, recentLoans] = await Promise.all([
      Loan.findAll({
        attributes: [
          "status",
          [fn("COUNT", col("id")), "count"],
          [fn("SUM", col("total_amount")), "totalDisbursed"],
        ],
        group: ["status"],
        raw: true,
      }),
      User.findAll({
        attributes: [
          [fn("COUNT", col("id")), "totalUsers"],
          [
            fn("SUM", literal("CASE WHEN is_active = true THEN 1 ELSE 0 END")),
            "activeUsers",
          ],
          [
            fn(
              "SUM",
              literal(
                "CASE WHEN registration_complete = true THEN 1 ELSE 0 END",
              ),
            ),
            "completedRegistrations",
          ],
        ],
        raw: true,
      }),
      Loan.findAll({
        include: [loanUserInclude],
        order: [["created_at", "DESC"]],
        limit: 10,
      }),
    ]);

    const dashboardStats = {
      totalLoans: 0,
      totalUsers: parseInt(userStats[0]?.totalUsers) || 0,
      activeUsers: parseInt(userStats[0]?.activeUsers) || 0,
      completedRegistrations:
        parseInt(userStats[0]?.completedRegistrations) || 0,
      totalDisbursed: 0,
      activeLoans: 0,
      pendingLoans: 0,
      completedLoans: 0,
      rejectedLoans: 0,
      repaymentRate: 0,
    };
    loanStats.forEach((s) => {
      dashboardStats.totalLoans += parseInt(s.count) || 0;
      dashboardStats.totalDisbursed += parseFloat(s.totalDisbursed) || 0;
      if (["approved", "disbursed", "active"].includes(s.status))
        dashboardStats.activeLoans += parseInt(s.count) || 0;
      else if (["pending", "under-review"].includes(s.status))
        dashboardStats.pendingLoans += parseInt(s.count) || 0;
      else if (s.status === "completed")
        dashboardStats.completedLoans += parseInt(s.count) || 0;
      else if (s.status === "rejected")
        dashboardStats.rejectedLoans += parseInt(s.count) || 0;
    });
    if (dashboardStats.totalLoans > 0)
      dashboardStats.repaymentRate =
        (dashboardStats.completedLoans / dashboardStats.totalLoans) * 100;
    res.json({ success: true, data: { stats: dashboardStats, recentLoans } });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error getting dashboard statistics",
    });
  }
});

// PUT /api/loans/admin/:id/status (admin)
router.put(
  "/admin/:id/status",
  adminAuth,
  [
    body("status").isIn([
      "pending",
      "under-review",
      "approved",
      "rejected",
      "hanged-up",
      "disbursed",
      "active",
      "completed",
      "cancelled",
    ]),
    body("rejectionReason").optional().isString(),
    body("adminNotes").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { status: requestedStatus, rejectionReason, adminNotes } = req.body;
      const loan = await Loan.findByPk(req.params.id, {
        include: [loanUserInclude],
      });
      if (!loan)
        return res
          .status(404)
          .json({ success: false, message: "Loan not found" });

      const loanLifecycleSettings = await getLoanLifecycleSettings();
      const shouldAutoDisburse =
        requestedStatus === "approved" &&
        loanLifecycleSettings.autoDisburseOnApproval;
      const finalStatus = shouldAutoDisburse
        ? loanLifecycleSettings.activateLoanOnDisbursement
          ? "active"
          : "disbursed"
        : requestedStatus;

      const updates = { status: finalStatus };
      if (requestedStatus === "rejected" && rejectionReason)
        updates.rejectionReason = rejectionReason;
      if (adminNotes) {
        const notes = [...(loan.adminNotes || [])];
        notes.push({
          note: adminNotes,
          addedBy: req.admin.id,
          addedAt: new Date(),
        });
        updates.adminNotes = notes;
      }

      if (requestedStatus === "approved") {
        updates.approvalDate = new Date();
        updates.reviewedById = req.admin.id;
        updates.reviewDate = new Date();

        if (shouldAutoDisburse) {
          const autoDisbursementUpdates = buildDisbursementActivationUpdates({
            loan,
            now: new Date(),
            activateLoan: loanLifecycleSettings.activateLoanOnDisbursement,
          });
          Object.assign(updates, autoDisbursementUpdates);

          const notes = [...(updates.adminNotes || loan.adminNotes || [])];
          notes.push({
            note: loanLifecycleSettings.activateLoanOnDisbursement
              ? "Loan approved and auto-disbursed. Repayment clock started immediately."
              : "Loan approved and auto-disbursed.",
            addedBy: req.admin.id,
            addedAt: new Date(),
            type: "auto_disbursement_on_approval",
          });
          updates.adminNotes = notes;
        } else if (!parseFloat(loan.remainingBalance)) {
          updates.remainingBalance = parseFloat(loan.totalAmount || 0) - parseFloat(loan.upfrontFee || 0);
        }
      } else if (requestedStatus === "disbursed") {
        const disbursementUpdates = buildDisbursementActivationUpdates({
          loan,
          now: new Date(),
          activateLoan: false,
        });
        Object.assign(updates, disbursementUpdates);
      } else if (requestedStatus === "active") {
        const activationUpdates = buildDisbursementActivationUpdates({
          loan,
          now: new Date(),
          activateLoan: true,
        });
        Object.assign(updates, activationUpdates);
      } else if (!parseFloat(loan.remainingBalance) && finalStatus === "approved") {
        updates.remainingBalance = parseFloat(loan.totalAmount || loan.amount || 0);
        }

      await loan.update(updates);
      const io = req.app.get("io");
      if (io && loan.userId)
        io.to(`user-${loan.userId}`).emit("loan-status-changed", {
          loanId: loan.id,
          status: finalStatus,
          message: `Your loan application status has been updated to: ${finalStatus}`,
        });

      // Persist notification so user sees it in notification bell even when offline
      await createLoanNotification(
        loan.userId,
        loan,
        finalStatus,
        rejectionReason || adminNotes,
      );

      res.json({
        success: true,
        message: `Loan status updated to ${finalStatus}`,
        loan,
      });
    } catch (err) {
      res
        .status(500)
        .json({ success: false, message: "Server error updating loan status" });
    }
  },
);

// PUT /api/loans/:id/status (admin)
router.put(
  "/:id/status",
  adminAuth,
  [
    body("status").isIn([
      "pending",
      "under-review",
      "approved",
      "rejected",
      "active",
      "completed",
      "overdue",
      "cancelled",
    ]),
    body("assignmentStatus")
      .optional()
      .isIn(["unassigned", "assigned", "hung-up", "hung-down"]),
    body("remarks").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { status: requestedStatus, assignmentStatus, remarks } = req.body;
      const loan = await Loan.findByPk(req.params.id);
      if (!loan)
        return res
          .status(404)
          .json({ success: false, message: "Loan not found" });

      const loanLifecycleSettings = await getLoanLifecycleSettings();
      const shouldAutoDisburse =
        requestedStatus === "approved" &&
        loanLifecycleSettings.autoDisburseOnApproval;
      const finalStatus = shouldAutoDisburse
        ? loanLifecycleSettings.activateLoanOnDisbursement
          ? "active"
          : "disbursed"
        : requestedStatus;

      const validTransitions = {
        pending: ["under-review", "approved", "rejected", "cancelled"],
        "under-review": ["approved", "rejected", "cancelled"],
        approved: ["active", "disbursed", "cancelled"],
        active: ["completed", "overdue", "cancelled"],
        overdue: ["completed", "active", "cancelled"],
        rejected: ["under-review"],
        completed: [],
        cancelled: [],
      };
      if (!validTransitions[loan.status]?.includes(requestedStatus))
        return res.status(400).json({
          success: false,
          message: `Invalid status transition from ${loan.status} to ${requestedStatus}`,
        });

      const updates = { status: finalStatus };
      if (assignmentStatus) updates.assignmentStatus = assignmentStatus;

      if (requestedStatus === "approved") {
        updates.approvalDate = new Date();
        updates.reviewedById = req.admin.id;
        updates.reviewDate = new Date();

        if (shouldAutoDisburse) {
          Object.assign(
            updates,
            buildDisbursementActivationUpdates({
              loan,
              now: new Date(),
              activateLoan: loanLifecycleSettings.activateLoanOnDisbursement,
            }),
          );
        }
      }
      if (requestedStatus === "disbursed") {
        Object.assign(
          updates,
          buildDisbursementActivationUpdates({
            loan,
            now: new Date(),
            activateLoan: false,
          }),
        );
      }
      if (requestedStatus === "active") {
        Object.assign(
          updates,
          buildDisbursementActivationUpdates({
            loan,
            now: new Date(),
            activateLoan: true,
          }),
        );
      }
      if (requestedStatus === "completed") updates.completionDate = new Date();
      if (remarks) {
        const notes = [...(loan.adminNotes || [])];
        notes.push({
          note: remarks,
          addedBy: req.admin.id,
          addedAt: new Date(),
        });
        updates.adminNotes = notes;
      }

      await loan.update(updates);
      const io = req.app.get("io");
      if (io && loan.userId)
        io.to(`user-${loan.userId}`).emit("loan-status-changed", {
          loanId: loan.id,
          status: finalStatus,
          message: `Your loan status has been updated to: ${finalStatus}`,
        });

      await createLoanNotification(loan.userId, loan, finalStatus, remarks);

      res.json({
        success: true,
        message: "Loan status updated successfully",
        loan,
      });
    } catch (err) {
      res
        .status(500)
        .json({ success: false, message: "Server error updating loan status" });
    }
  },
);

// PUT /api/loans/:id/assign-officer (admin)
router.put(
  "/:id/assign-officer",
  adminAuth,
  [
    body("officerType").isIn(["review", "precollection", "collection"]),
    body("officerId").isUUID(),
    body("remarks").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { officerType, officerId, remarks } = req.body;
      const loan = await Loan.findByPk(req.params.id);
      if (!loan)
        return res
          .status(404)
          .json({ success: false, message: "Loan not found" });

      const updates = {};
      if (officerType === "review") {
        updates.assignedOfficerId = officerId;
        updates.assignmentDate = new Date();
        updates.assignmentStatus = "assigned";
      } else if (officerType === "precollection") {
        updates.precollectionOfficerId = officerId;
        updates.precollectionAssignmentDate = new Date();
        updates.precollectionStatus = "assigned";
      } else if (officerType === "collection") {
        updates.collectionOfficerId = officerId;
        updates.collectionAssignmentDate = new Date();
        updates.collectionStatus = "assigned";
      }

      if (remarks) {
        const notes = [...(loan.adminNotes || [])];
        notes.push({
          note: `${officerType} assignment: ${remarks}`,
          addedBy: req.admin.id,
          addedAt: new Date(),
        });
        updates.adminNotes = notes;
      }
      await loan.update(updates);

      if (officerType === "precollection" || officerType === "collection")
        await performanceTrackingService.trackCaseAssignment(
          officerId,
          officerType,
        );
      res.json({
        success: true,
        message: `Loan assigned to ${officerType} officer successfully`,
        loan,
      });
    } catch (err) {
      res
        .status(500)
        .json({ success: false, message: "Server error assigning officer" });
    }
  },
);

// POST /api/loans/:id/add-remark (admin)
router.post(
  "/:id/add-remark",
  adminAuth,
  [
    body("remark").notEmpty(),
    body("remarkType").isIn(["precollection", "collection", "general"]),
    body("callOutcome")
      .optional()
      .isIn([
        "answered",
        "no-answer",
        "busy",
        "wrong-number",
        "promised-payment",
        "dispute",
        "payment-made",
      ]),
    body("paymentStatus")
      .optional()
      .isIn([
        "no_payment",
        "promise_to_pay",
        "partial_payment",
        "full_payment",
      ]),
    body("paymentAmount").optional().isNumeric().isFloat({ min: 0 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { remark, remarkType, callOutcome, paymentStatus, paymentAmount } =
        req.body;
      const loan = await Loan.findByPk(req.params.id);
      if (!loan)
        return res
          .status(404)
          .json({ success: false, message: "Loan not found" });

      const remarkData = {
        remark,
        addedBy: req.admin.id,
        addedAt: new Date(),
        callOutcome,
        paymentStatus,
      };
      const updates = {};

      if (paymentAmount && paymentAmount > 0) {
        remarkData.paymentAmount = paymentAmount;
        if (
          paymentStatus === "partial_payment" ||
          paymentStatus === "full_payment"
        ) {
          const newBalance = Math.max(
            0,
            parseFloat(loan.remainingBalance) - parseFloat(paymentAmount),
          );
          updates.remainingBalance = newBalance;
          if (newBalance === 0) updates.status = "completed";
        }
      }

      if (remarkType === "precollection") {
        const arr = [...(loan.precollectionRemarks || [])];
        arr.push(remarkData);
        updates.precollectionRemarks = arr;
      } else if (remarkType === "collection") {
        const arr = [...(loan.collectionRemarks || [])];
        arr.push(remarkData);
        updates.collectionRemarks = arr;
      } else {
        const arr = [...(loan.adminNotes || [])];
        arr.push({ note: remark, addedBy: req.admin.id, addedAt: new Date() });
        updates.adminNotes = arr;
      }

      await loan.update(updates);
      if (remarkType !== "general")
        await performanceTrackingService.trackRemarkPerformance(
          req.admin.id,
          loan.id,
          remarkType,
          { remark, callOutcome, paymentStatus, paymentAmount },
        );
      res.json({ success: true, message: "Remark added successfully", loan });
    } catch (err) {
      res
        .status(500)
        .json({ success: false, message: "Server error adding remark" });
    }
  },
);

// PUT /api/loans/:id/hang-status (admin)
router.put(
  "/:id/hang-status",
  adminAuth,
  [
    body("action").isIn(["hang-up", "hang-down"]),
    body("statusType").isIn(["assignment", "precollection", "collection"]),
    body("remarks").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { action, statusType, remarks } = req.body;
      const loan = await Loan.findByPk(req.params.id);
      if (!loan)
        return res
          .status(404)
          .json({ success: false, message: "Loan not found" });

      const updates = {};
      if (statusType === "assignment")
        updates.assignmentStatus =
          action === "hang-up" ? "hung-up" : "assigned";
      else if (statusType === "precollection")
        updates.precollectionStatus =
          action === "hang-up" ? "hung-up" : "assigned";
      else if (statusType === "collection")
        updates.collectionStatus =
          action === "hang-up" ? "hung-up" : "assigned";

      if (remarks) {
        const notes = [...(loan.adminNotes || [])];
        notes.push({
          note: `${statusType} ${action}: ${remarks}`,
          addedBy: req.admin.id,
          addedAt: new Date(),
        });
        updates.adminNotes = notes;
      }
      await loan.update(updates);
      res.json({
        success: true,
        message: `Loan ${action} status updated successfully`,
        loan,
      });
    } catch (err) {
      res
        .status(500)
        .json({ success: false, message: "Server error updating hang status" });
    }
  },
);

// POST /api/loans/bridge-disbursement-webhook (public — called by Bridge AGW)
// Processes Bridge MTC (payout) callbacks. Bridge identifies the loan via the
// transaction_id we stored in loan.disbursementReference.
router.post("/bridge-disbursement-webhook", async (req, res) => {
  try {
    const payload = req.body || {};

    // Bridge callback fields per docs: trans_ref = merchant transaction_id,
    // trans_status = outcome code (000/001/002/003), message = description.
    const transactionId =
      payload.trans_ref || payload.transaction_id || payload.transactionId;
    const responseCode = String(
      payload.trans_status || payload.response_code || payload.status || "",
    );
    const responseMessage =
      payload.message ||
      payload.response_message ||
      payload.status_desc ||
      "Bridge disbursement callback";

    if (!transactionId) {
      return res
        .status(200)
        .json({ success: true, message: "Missing transaction_id — ignored" });
    }

    // Match the loan using the transaction_id we stored at disbursement initiation
    const loan = await Loan.findOne({
      where: { disbursementReference: transactionId, status: "approved" },
      include: [loanUserInclude],
    });
    if (!loan) {
      // Already processed or not found — acknowledge so Bridge doesn't retry
      return res
        .status(200)
        .json({ success: true, message: "Loan not found or already processed" });
    }

    const now = new Date();
    const adminNotes = [...(loan.adminNotes || [])];

    if (responseCode === "000") {
      // Successful disbursement — activate loan
      adminNotes.push({
        note: `Bridge MTC disbursement confirmed (code ${responseCode}): ${responseMessage}`,
        addedAt: now,
        type: "bridge_disbursement_confirmed",
      });

      const loanLifecycleSettings = await getLoanLifecycleSettings();
      const disbursementUpdates = buildDisbursementActivationUpdates({
        loan,
        now,
        activateLoan: loanLifecycleSettings.activateLoanOnDisbursement,
      });

      await loan.update({
        ...disbursementUpdates,
        disbursementStatus: "sent",
        adminNotes,
        disbursementGatewayResponse: {
          transactionId,
          responseCode,
          responseMessage,
          receivedAt: now.toISOString(),
          rawPayload: payload,
        },
      });

      const finalStatus = loanLifecycleSettings.activateLoanOnDisbursement
        ? "active"
        : "disbursed";
      const io = req.app.get("io");
      if (io && loan.userId) {
        io.to(`user-${loan.userId}`).emit("loan-status-changed", {
          loanId: loan.id,
          status: finalStatus,
          message:
            "Your loan has been disbursed to your mobile money account. Repayment countdown has started.",
        });
      }
      await createLoanNotification(loan.userId, loan, finalStatus);
    } else if (["001", "003"].includes(responseCode)) {
      // Failed or cancelled
      adminNotes.push({
        note: `Bridge MTC disbursement failed (code ${responseCode}): ${responseMessage}`,
        addedAt: now,
        type: "bridge_disbursement_failed",
      });
      await loan.update({
        disbursementStatus: "failed",
        disbursementFailureReason: responseMessage,
        disbursementFailedAt: now,
        adminNotes,
        disbursementGatewayResponse: {
          transactionId,
          responseCode,
          responseMessage,
          receivedAt: now.toISOString(),
          rawPayload: payload,
        },
      });
    } else {
      // Pending (002) or unknown — record and wait
      await loan.update({
        disbursementGatewayResponse: {
          transactionId,
          responseCode,
          responseMessage,
          receivedAt: now.toISOString(),
          rawPayload: payload,
        },
      });
    }

    return res.status(200).json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("Bridge disbursement webhook error:", error);
    // Always return 200 so Bridge doesn't retry indefinitely
    return res
      .status(200)
      .json({ success: true, message: "Webhook received with error" });
  }
});

// GET /api/loans/failed-disbursements (admin)
// Returns approved loans that have a disbursement failure flag or are awaiting disbursement.
router.get("/failed-disbursements", adminAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page),
      limitNum = parseInt(limit);
    const { count, rows: loans } = await Loan.findAndCountAll({
      where: {
        [Op.or]: [
          // Approved but not yet disbursed — may have failed automatically
          { status: "approved", disbursementFailedAt: { [Op.ne]: null } },
          // Fallback: approved with disbursementFailureReason set
          { status: "approved", disbursementFailureReason: { [Op.ne]: null } },
        ],
      },
      include: [loanUserInclude],
      order: [["updated_at", "DESC"]],
      limit: limitNum,
      offset: (pageNum - 1) * limitNum,
    });
    res.json({
      success: true,
      loans,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: count,
        pages: Math.ceil(count / limitNum),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/loans/:id/disbursement-callback (admin/system)
// Records gateway callback outcome. Success moves loan to disbursed; failure keeps it approved.
router.post(
  "/:id/disbursement-callback",
  adminAuth,
  [
    body("status").isIn(["success", "failed"]),
    body("reference").optional().isString(),
    body("reason").optional().isString(),
    body("channel").optional().isIn(["momo", "bank", "cash", "manual"]),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const loan = await Loan.findByPk(req.params.id, {
        include: [loanUserInclude],
      });
      if (!loan || loan.status !== "approved") {
        return res.status(404).json({
          success: false,
          message: "Loan not found or not awaiting disbursement",
        });
      }

      const { status, reference, reason, channel } = req.body;
      const now = new Date();
      const adminNotes = [...(loan.adminNotes || [])];

      if (status === "success") {
        adminNotes.push({
          note: `Disbursement callback success${reference ? `, ref=${reference}` : ""}`,
          addedBy: req.admin.id,
          addedAt: now,
          type: "disbursement_callback_success",
        });

        const loanLifecycleSettings = await getLoanLifecycleSettings();
        const disbursementUpdates = buildDisbursementActivationUpdates({
          loan,
          now,
          activateLoan: loanLifecycleSettings.activateLoanOnDisbursement,
        });

        await loan.update({
          ...disbursementUpdates,
          disbursementReference: reference || loan.disbursementReference || null,
          disbursementChannel: channel || loan.disbursementChannel || null,
          adminNotes,
        });

        const callbackStatus = loanLifecycleSettings.activateLoanOnDisbursement
          ? "active"
          : "disbursed";

        const io = req.app.get("io");
        if (io && loan.userId)
          io.to(`user-${loan.userId}`).emit("loan-status-changed", {
            loanId: loan.id,
            status: callbackStatus,
            message: loanLifecycleSettings.activateLoanOnDisbursement
              ? "Your loan has been disbursed and is now active. Repayment tracking has started."
              : "Your loan has been disbursed successfully.",
          });

        await createLoanNotification(loan.userId, loan, callbackStatus);

        return res.json({
          success: true,
          message: "Disbursement callback processed successfully",
          loan,
        });
      }

      adminNotes.push({
        note: `Disbursement callback failed${reason ? `: ${reason}` : ""}`,
        addedBy: req.admin.id,
        addedAt: now,
        type: "disbursement_callback_failed",
      });

      await loan.update({
        status: "approved",
        disbursementStatus: "failed",
        disbursementFailureReason: reason || "Gateway reported failure",
        disbursementFailedAt: now,
        disbursementLastAttemptAt: now,
        disbursementAttempts: (loan.disbursementAttempts || 0) + 1,
        adminNotes,
      });

      return res.json({
        success: true,
        message: "Disbursement failure recorded; loan remains in retry queue",
        loan,
      });
    } catch (err) {
      console.error("Disbursement callback error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

// POST /api/loans/:id/disburse/retry (admin) — retry or manually record disbursement
router.post(
  "/:id/disburse/retry",
  adminAuth,
  [
    body("channel").isIn(["momo", "bank", "cash", "manual"]),
    body("reference").notEmpty().isString(),
    body("disbursedAmount").optional().isNumeric(),
    body("notes").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const loan = await Loan.findByPk(req.params.id, {
        include: [loanUserInclude],
      });
      if (!loan || loan.status !== "approved")
        return res.status(404).json({
          success: false,
          message: "Loan not found or not in approved status",
        });

      const { channel, reference, disbursedAmount, notes } = req.body;
      const loanLifecycleSettings = await getLoanLifecycleSettings();
      const adminNotes = [...(loan.adminNotes || [])];
      adminNotes.push({
        note: `Manual disbursement: channel=${channel}, ref=${reference}${notes ? ", " + notes : ""}`,
        addedBy: req.admin.id,
        addedAt: new Date(),
        type: "manual_disbursement",
      });

      const disbursementUpdates = buildDisbursementActivationUpdates({
        loan,
        now: new Date(),
        activateLoan: loanLifecycleSettings.activateLoanOnDisbursement,
      });

      if (disbursedAmount) {
        disbursementUpdates.remainingBalance = parseFloat(disbursedAmount);
      }

      await loan.update({
        ...disbursementUpdates,
        disbursementChannel: channel,
        disbursementReference: reference,
        adminNotes,
      });

      const retryStatus = loanLifecycleSettings.activateLoanOnDisbursement
        ? "active"
        : "disbursed";

      const io = req.app.get("io");
      if (io && loan.userId)
        io.to(`user-${loan.userId}`).emit("loan-status-changed", {
          loanId: loan.id,
          status: retryStatus,
          message: loanLifecycleSettings.activateLoanOnDisbursement
            ? `Your loan of GHS ${parseFloat(loan.amount).toLocaleString()} has been disbursed and activated.`
            : `Your loan of GHS ${parseFloat(loan.amount).toLocaleString()} has been disbursed.`,
        });

      await createLoanNotification(loan.userId, loan, retryStatus);

      res.json({
        success: true,
        message: "Loan disbursed successfully",
        loan,
      });
    } catch (err) {
      console.error("Disburse retry error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

module.exports = router;
