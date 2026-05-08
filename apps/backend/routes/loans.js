const express = require("express");
const { body, validationResult } = require("express-validator");
const { Op, fn, col, literal } = require("sequelize");
const { sequelize } = require("../config/database");
const { Loan, User, LoanLevel, Payment, Notification } = require("../models");
const { auth, adminAuth } = require("../middleware/auth");
const kycCheck = require("../middleware/kycCheck");
const performanceTrackingService = require("../services/performanceTrackingService");
const { checkAndPromoteLevel } = require("../services/levelProgressionService");

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
    body("amount").isNumeric().isFloat({ min: 100, max: 50000 }),
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
      });

      const io = req.app.get("io");
      if (io)
        io.to(`user-${req.user.id}`).emit("loan-status-changed", {
          loanId: loan.id,
          status: loan.status,
          amount: loan.amount,
          message: "Your loan application has been submitted successfully!",
        });

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
      amount < 100 ||
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

// POST /api/loans/:id/request-disbursement  (customer requests disbursement of approved loan)
router.post("/:id/request-disbursement", auth, async (req, res) => {
  try {
    const loan = await Loan.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id,
        status: "approved",
      },
    });
    if (!loan)
      return res.status(404).json({
        success: false,
        message: "Loan not found or not in approved status",
      });

    // Mark with a disbursementRequestedAt note in adminNotes
    const notes = [...(loan.adminNotes || [])];
    notes.push({
      note: "Customer requested disbursement",
      addedAt: new Date(),
      type: "disbursement_request",
    });
    await loan.update({ adminNotes: notes });

    // Notify admins via socket — emit to "loan_updates" which all authenticated admins join automatically
    const io = req.app.get("io");
    if (io) {
      io.to("loan_updates").emit("disbursement-requested", {
        loanId: loan.id,
        loanRef: loan.loanId,
        userId: loan.userId,
        amount: loan.amount,
        requestedAt: new Date(),
      });
    }

    res.json({
      success: true,
      message:
        "Disbursement request submitted. The admin will process it shortly.",
    });
  } catch (err) {
    console.error("Error requesting disbursement:", err);
    res.status(500).json({ success: false, message: "Server error" });
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

      const { status, rejectionReason, adminNotes } = req.body;
      const loan = await Loan.findByPk(req.params.id, {
        include: [loanUserInclude],
      });
      if (!loan)
        return res
          .status(404)
          .json({ success: false, message: "Loan not found" });

      const updates = { status };
      if (status === "rejected" && rejectionReason)
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
      if (status === "approved") {
        updates.approvalDate = new Date();
        updates.reviewedById = req.admin.id;
        // Seed remainingBalance when loan is first approved so it is visible
        // on the customer app before disbursement
        if (!parseFloat(loan.remainingBalance)) {
          updates.remainingBalance = parseFloat(loan.totalAmount);
        }
      } else if (status === "disbursed") {
        updates.disbursementDate = new Date();
        // Set remaining balance and due date on disbursement so the customer
        // repayment screen shows accurate data immediately
        if (!parseFloat(loan.remainingBalance)) {
          updates.remainingBalance = parseFloat(loan.totalAmount);
        }
        if (!loan.dueDate) {
          updates.dueDate = new Date(
            Date.now() + (loan.termInDays || 30) * 24 * 60 * 60 * 1000,
          );
        }
      } else if (status === "active") {
        // Repayment clock starts: ensure dueDate and remainingBalance are set
        if (!loan.disbursementDate) updates.disbursementDate = new Date();
        updates.dueDate = new Date(
          Date.now() + (loan.termInDays || 30) * 24 * 60 * 60 * 1000,
        );
        if (!parseFloat(loan.remainingBalance)) {
          updates.remainingBalance = parseFloat(loan.totalAmount);
        }
      }

      await loan.update(updates);
      const io = req.app.get("io");
      if (io && loan.userId)
        io.to(`user-${loan.userId}`).emit("loan-status-changed", {
          loanId: loan.id,
          status,
          message: `Your loan application status has been updated to: ${status}`,
        });

      // Persist notification so user sees it in notification bell even when offline
      await createLoanNotification(
        loan.userId,
        loan,
        status,
        rejectionReason || adminNotes,
      );

      res.json({
        success: true,
        message: `Loan status updated to ${status}`,
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

      const { status, assignmentStatus, remarks } = req.body;
      const loan = await Loan.findByPk(req.params.id);
      if (!loan)
        return res
          .status(404)
          .json({ success: false, message: "Loan not found" });

      const validTransitions = {
        pending: ["under-review", "approved", "rejected", "cancelled"],
        "under-review": ["approved", "rejected", "cancelled"],
        approved: ["active", "cancelled"],
        active: ["completed", "overdue", "cancelled"],
        overdue: ["completed", "active", "cancelled"],
        rejected: ["under-review"],
        completed: [],
        cancelled: [],
      };
      if (!validTransitions[loan.status]?.includes(status))
        return res.status(400).json({
          success: false,
          message: `Invalid status transition from ${loan.status} to ${status}`,
        });

      const updates = { status };
      if (assignmentStatus) updates.assignmentStatus = assignmentStatus;
      if (status === "approved") {
        updates.approvalDate = new Date();
        updates.reviewedById = req.admin.id;
        updates.reviewDate = new Date();
      }
      if (status === "active") {
        updates.disbursementDate = new Date();
        updates.dueDate = new Date(
          Date.now() + loan.termInDays * 24 * 60 * 60 * 1000,
        );
      }
      if (status === "completed") updates.completionDate = new Date();
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
          status,
          message: `Your loan status has been updated to: ${status}`,
        });

      await createLoanNotification(loan.userId, loan, status, remarks);

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

module.exports = router;
