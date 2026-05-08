const express = require("express");
const { body, validationResult } = require("express-validator");
const { Op, fn, col, literal, where: sqWhere } = require("sequelize");
const { sequelize } = require("../config/database");
const {
  Loan,
  User,
  LoanLevel,
  Payment,
  AppConfig,
  Content,
  Role,
  Admin,
  Notification,
} = require("../models");
const { adminAuth } = require("../middleware/auth");
const {
  requireMenuAccess,
  requireSubMenuAccess,
  requireDataAccess,
  requireActionPermission,
  filterLoansByRole,
  filterUserData,
  filterLoanData,
  filterPaymentData,
} = require("../middleware/roleAuth");
const {
  broadcastLoanUpdate,
  broadcastLoanStatusChanged,
  broadcastUserUpdate,
  broadcastUserStatusChanged,
  broadcastSystemConfigUpdate,
  sendNotification,
  triggerDashboardUpdate,
} = require("../middleware/realtimeMiddleware");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const router = express.Router();
router.use(adminAuth);

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

// ===== DASHBOARD =====

// GET /api/admin/dashboard/overview
router.get(
  "/dashboard/overview",
  requireMenuAccess("dashboard"),
  catchAsync(async (req, res, next) => {
    const [
      loanStats,
      userStats,
      paymentStats,
      [recentLoans, recentPayments, recentUsers],
    ] = await Promise.all([
      Loan.findAll({
        attributes: [
          "status",
          [fn("COUNT", col("id")), "count"],
          [fn("SUM", col("amount")), "totalAmount"],
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
      Payment.findAll({
        attributes: [
          "status",
          [fn("COUNT", col("id")), "count"],
          [fn("SUM", col("amount")), "totalAmount"],
        ],
        group: ["status"],
        raw: true,
      }),
      Promise.all([
        Loan.findAll({
          include: [loanUserInclude],
          order: [["created_at", "DESC"]],
          limit: 5,
        }),
        Payment.findAll({
          include: [
            loanUserInclude.model
              ? { model: Loan, as: "Loan", attributes: ["amount"] }
              : undefined,
            { model: User, as: "User", attributes: ["firstName", "lastName"] },
          ].filter(Boolean),
          order: [["created_at", "DESC"]],
          limit: 5,
        }),
        User.findAll({
          where: { registrationComplete: true },
          order: [["created_at", "DESC"]],
          limit: 5,
          attributes: ["firstName", "lastName", "email", "createdAt"],
        }),
      ]),
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
      totalPayments: 0,
      successfulPayments: 0,
      failedPayments: 0,
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
    paymentStats.forEach((s) => {
      dashboardStats.totalPayments += parseInt(s.count) || 0;
      if (s.status === "completed")
        dashboardStats.successfulPayments += parseInt(s.count) || 0;
      else if (s.status === "failed")
        dashboardStats.failedPayments += parseInt(s.count) || 0;
    });
    if (dashboardStats.totalLoans > 0)
      dashboardStats.repaymentRate = Math.round(
        (dashboardStats.completedLoans / dashboardStats.totalLoans) * 100,
      );

    res.json({
      success: true,
      data: {
        stats: dashboardStats,
        recentActivity: {
          loans: recentLoans,
          payments: recentPayments,
          users: recentUsers,
        },
      },
    });
  }),
);

// ===== USER MANAGEMENT =====

// GET /api/admin/users
router.get(
  "/users",
  requireMenuAccess("userManagement"),
  requireDataAccess("users"),
  filterUserData,
  catchAsync(async (req, res, next) => {
    const {
      page = 1,
      limit = 20,
      status,
      level,
      search,
      sortBy = "created_at",
      sortOrder = "desc",
    } = req.query;
    const where = {};

    if (status === "active") where.isActive = true;
    else if (status === "inactive") where.isActive = false;
    else if (status === "completed") where.registrationComplete = true;
    else if (status === "incomplete") where.registrationComplete = false;
    if (level) where.currentLoanLevel = parseInt(level);
    if (search)
      where[Op.or] = [
        { firstName: { [Op.iLike]: `%${search}%` } },
        { lastName: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { phoneNumber: { [Op.iLike]: `%${search}%` } },
      ];

    const { count, rows: users } = await User.findAndCountAll({
      where,
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit) * 1,
      offset: (parseInt(page) - 1) * parseInt(limit),
    });
    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / parseInt(limit)),
        },
      },
    });
  }),
);

// GET /api/admin/users/:id
router.get(
  "/users/:id",
  requireMenuAccess("userManagement"),
  requireDataAccess("users"),
  catchAsync(async (req, res, next) => {
    const user = await User.findByPk(req.params.id);
    if (!user) return next(new AppError("User not found", 404));

    const [loans, payments] = await Promise.all([
      Loan.findAll({
        where: { userId: req.params.id },
        order: [["created_at", "DESC"]],
        attributes: [
          "id",
          "amount",
          "status",
          "createdAt",
          "approvalDate",
          "disbursementDate",
          "completionDate",
          "totalAmount",
        ],
      }),
      Payment.findAll({
        where: { userId: req.params.id },
        order: [["created_at", "DESC"]],
        include: [{ model: Loan, as: "Loan", attributes: ["amount"] }],
        attributes: ["id", "amount", "status", "createdAt", "loanId"],
      }),
    ]);

    res.json({
      success: true,
      data: {
        user,
        loans,
        payments,
        summary: {
          totalLoans: loans.length,
          activeLoans: loans.filter((l) =>
            ["approved", "disbursed", "active"].includes(l.status),
          ).length,
          completedLoans: loans.filter((l) => l.status === "completed").length,
          totalBorrowed: loans.reduce(
            (s, l) => s + parseFloat(l.amount || 0),
            0,
          ),
          totalRepaid: payments
            .filter((p) => p.status === "completed")
            .reduce((s, p) => s + parseFloat(p.amount || 0), 0),
        },
      },
    });
  }),
);

// PATCH /api/admin/users/:id/status
router.patch(
  "/users/:id/status",
  requireMenuAccess("userManagement"),
  requireActionPermission("updateUserStatus"),
  [body("isActive").isBoolean(), body("reason").optional().isString()],
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return next(new AppError("Validation errors", 400, errors.array()));

    const { isActive, reason } = req.body;
    const user = await User.findByPk(req.params.id);
    if (!user) return next(new AppError("User not found", 404));

    await user.update({ isActive });
    res.json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully`,
      data: { user },
    });
  }),
);

// PATCH /api/admin/users/:id/level
router.patch(
  "/users/:id/level",
  requireMenuAccess("userManagement"),
  requireActionPermission("updateUserLevel"),
  [
    body("level").isInt({ min: 1, max: 10 }),
    body("reason").optional().isString(),
  ],
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return next(new AppError("Validation errors", 400, errors.array()));

    const { level, reason } = req.body;
    const user = await User.findByPk(req.params.id);
    if (!user) return next(new AppError("User not found", 404));

    const loanLevel = await LoanLevel.findOne({
      where: { level, isActive: true },
    });
    if (!loanLevel) return next(new AppError("Invalid loan level", 400));

    const history = [...(user.levelProgressionHistory || [])];
    history.push({
      fromLevel: user.currentLoanLevel,
      toLevel: level,
      changedBy: req.admin.id,
      reason: reason || "Updated by admin",
      changedAt: new Date(),
    });
    await user.update({
      currentLoanLevel: level,
      levelProgressionHistory: history,
    });
    res.json({
      success: true,
      message: "User loan level updated successfully",
      data: { user },
    });
  }),
);

// ===== LOAN MANAGEMENT =====

// GET /api/admin/loans
router.get(
  "/loans",
  requireMenuAccess("creditReview"),
  requireDataAccess("loans"),
  filterLoansByRole,
  filterLoanData,
  catchAsync(async (req, res, next) => {
    const {
      page = 1,
      limit = 20,
      status,
      level,
      amountMin,
      amountMax,
      dateFrom,
      dateTo,
      search,
      sortBy = "created_at",
      sortOrder = "desc",
    } = req.query;
    const where = { ...(req.loanFilter || {}) };

    // Tab-based status mapping
    if (status) {
      switch (status) {
        case "pending":
          where.status = "pending";
          where.assignedOfficerId = null;
          break;
        case "assigned":
          where.assignedOfficerId = { [Op.ne]: null };
          where.status = { [Op.in]: ["pending", "under-review"] };
          break;
        case "hanged_up":
        case "hanged-up":
          where.status = "hanged-up";
          break;
        case "approved":
          // Approved loans awaiting disbursement
          where.status = "approved";
          break;
        case "active-loans":
          // Disbursed loans currently being repaid
          where.status = { [Op.in]: ["disbursed", "active", "overdue"] };
          break;
        case "completed":
          // Terminal states only: loan is fully done
          where.status = {
            [Op.in]: ["rejected", "completed", "defaulted", "cancelled"],
          };
          break;
        default:
          where.status = status;
      }
    }
    if (level) where.loanLevel = parseInt(level);
    if (amountMin || amountMax) {
      where.amount = {};
      if (amountMin) where.amount[Op.gte] = parseFloat(amountMin);
      if (amountMax) where.amount[Op.lte] = parseFloat(amountMax);
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
      if (dateTo) where.createdAt[Op.lte] = new Date(dateTo);
    }

    let userIdsForSearch;
    if (search) {
      const matchedUsers = await User.findAll({
        where: {
          [Op.or]: [
            { firstName: { [Op.iLike]: `%${search}%` } },
            { lastName: { [Op.iLike]: `%${search}%` } },
            { email: { [Op.iLike]: `%${search}%` } },
          ],
        },
        attributes: ["id"],
      });
      userIdsForSearch = matchedUsers.map((u) => u.id);
      where.userId = { [Op.in]: userIdsForSearch };
    }

    const adminAttributes = ["id", "firstName", "lastName", "email"];
    const { count, rows: loans } = await Loan.findAndCountAll({
      where,
      include: [
        loanUserInclude,
        {
          model: Admin,
          as: "AssignedOfficer",
          attributes: adminAttributes,
          required: false,
        },
        {
          model: Admin,
          as: "ReviewedBy",
          attributes: adminAttributes,
          required: false,
        },
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit) * 1,
      offset: (parseInt(page) - 1) * parseInt(limit),
    });
    res.json({
      success: true,
      data: {
        loans,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / parseInt(limit)),
        },
      },
    });
  }),
);

// GET /api/admin/loans/:id
router.get(
  "/loans/:id",
  requireMenuAccess("loanManagement"),
  requireDataAccess("loans"),
  catchAsync(async (req, res, next) => {
    const loan = await Loan.findByPk(req.params.id, {
      include: [loanUserInclude],
    });
    if (!loan) return next(new AppError("Loan not found", 404));
    const payments = await Payment.findAll({
      where: { loanId: req.params.id },
      order: [["created_at", "DESC"]],
    });
    res.json({ success: true, data: { loan, payments } });
  }),
);

// PATCH /api/admin/loans/:id/status
router.patch(
  "/loans/:id/status",
  requireMenuAccess("loanManagement"),
  requireActionPermission("updateLoanStatus"),
  [
    body("status").isIn([
      "pending",
      "under-review",
      "approved",
      "rejected",
      "disbursed",
      "active",
      "completed",
      "cancelled",
    ]),
    body("rejectionReason").optional().isString(),
    body("adminNotes").optional().isString(),
  ],
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return next(new AppError("Validation errors", 400, errors.array()));

    const { status, rejectionReason, adminNotes } = req.body;
    const loan = await Loan.findByPk(req.params.id);
    if (!loan) return next(new AppError("Loan not found", 404));

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
    if (["approved", "rejected", "hanged-up"].includes(status)) {
      updates.reviewedById = req.admin.id;
      updates.reviewDate = new Date();
    }
    if (status === "approved") updates.approvalDate = new Date();
    else if (status === "disbursed") {
      const disbDate = new Date();
      updates.disbursementDate = disbDate;
      // Set remaining balance to full repayment amount so customer sees correct balance
      updates.remainingBalance = loan.totalAmount || loan.amount;
      // Calculate due date from disbursement date + loan term
      if (loan.termInDays) {
        const dueDate = new Date(disbDate);
        dueDate.setDate(dueDate.getDate() + Number(loan.termInDays));
        updates.dueDate = dueDate;
      }
    }

    await loan.update(updates);

    const io = req.app.get("io");
    if (io && loan.userId)
      io.to(`user-${loan.userId}`).emit("loan-status-changed", {
        loanId: loan.id,
        status,
        message: `Your loan status has been updated to: ${status}`,
      });

    // Persist notification for offline users
    const statusMeta = {
      approved: { title: "🎉 Loan Approved!", priority: "high" },
      rejected: { title: "📋 Loan Application Update", priority: "medium" },
      disbursed: { title: "💰 Loan Disbursed!", priority: "high" },
      "under-review": { title: "🔍 Application Under Review", priority: "low" },
      active: { title: "✅ Loan Now Active", priority: "medium" },
      completed: { title: "🏁 Loan Fully Repaid!", priority: "high" },
      cancelled: { title: "❌ Application Cancelled", priority: "low" },
    };
    const meta = statusMeta[status];
    if (meta && loan.userId) {
      try {
        const reason = rejectionReason || adminNotes;
        await Notification.create({
          recipientUserId: loan.userId,
          title: meta.title,
          message:
            status === "rejected"
              ? `Your loan application was not approved${reason ? ": " + reason : "."}`
              : `Your loan application status has been updated to: ${status}.`,
          type: "loan_status",
          priority: meta.priority,
          data: {
            loanId: loan.id,
            loanRef: loan.loanId,
            amount: loan.amount,
            status,
          },
        });
      } catch (e) {
        console.error("Notification create error:", e.message);
      }
    }

    res.json({
      success: true,
      message: `Loan status updated to ${status}`,
      data: { loan },
    });
  }),
);

// POST /api/admin/loans/assign
router.post(
  "/loans/assign",
  requireMenuAccess("creditReview"),
  requireActionPermission("assignLoans"),
  [
    body("loanIds").isArray(),
    body("officerIds").isArray(),
    body("assignmentType").isIn(["manual", "even"]),
  ],
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return next(new AppError("Validation errors", 400, errors.array()));

    const { loanIds, officerIds, assignmentType } = req.body;

    const loans = await Loan.findAll({
      where: {
        id: { [Op.in]: loanIds },
        status: { [Op.in]: ["pending", "under-review"] },
      },
    });
    if (loans.length !== loanIds.length)
      return next(
        new AppError("Some loans not found or not in assignable status", 400),
      );

    const officers = await Admin.findAll({
      where: { id: { [Op.in]: officerIds }, isActive: true },
      include: [{ model: Role, as: "Role" }],
    });
    if (officers.length !== officerIds.length)
      return next(new AppError("Some officers not found or inactive", 400));

    const assignmentDate = new Date();
    let updatedCount = 0;

    if (assignmentType === "even") {
      for (let i = 0; i < loans.length; i++) {
        const officer = officers[i % officers.length];
        await loans[i].update({
          assignedOfficerId: officer.id,
          assignmentDate,
          status: "under-review",
          assignmentStatus: "assigned",
        });
        updatedCount++;
      }
    } else {
      for (const loan of loans) {
        await loan.update({
          assignedOfficerId: officers[0].id,
          assignmentDate,
          status: "under-review",
          assignmentStatus: "assigned",
        });
        updatedCount++;
      }
    }

    res.json({
      success: true,
      message: `Successfully assigned ${updatedCount} loans to ${officers.length} officer(s)`,
      data: {
        assignedLoans: updatedCount,
        officers: officers.map((o) => ({
          id: o.id,
          name: `${o.firstName} ${o.lastName}`,
          email: o.email,
        })),
      },
    });
  }),
);

// ===== CONFIG MANAGEMENT =====

// GET /api/admin/config
router.get(
  "/config",
  requireMenuAccess("systemSettings"),
  requireDataAccess("configurations"),
  catchAsync(async (req, res, next) => {
    const configs = await AppConfig.findAll();
    const configObject = {};
    configs.forEach((c) => {
      configObject[c.key] = c.value;
    });
    res.json({ success: true, data: configObject });
  }),
);

// PUT /api/admin/config/:key
router.put(
  "/config/:key",
  requireMenuAccess("systemSettings"),
  requireActionPermission("updateConfiguration"),
  [body("value").exists()],
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return next(new AppError("Validation errors", 400, errors.array()));

    const config = await AppConfig.updateConfig(
      req.params.key,
      req.body.value,
      req.admin.id,
    );
    const websocketService = require("../services/websocketService");
    websocketService.broadcastSystemConfigUpdate(
      req.params.key,
      req.body.value,
    );
    res.json({
      success: true,
      message: "Configuration updated successfully",
      data: { config },
    });
  }),
);

// PUT /api/admin/config
router.put(
  "/config",
  requireMenuAccess("systemSettings"),
  requireActionPermission("updateConfiguration"),
  catchAsync(async (req, res, next) => {
    const configs = req.body;
    const flatten = (obj, prefix = "") => {
      const result = {};
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "object" && v !== null && !Array.isArray(v))
          Object.assign(result, flatten(v, `${prefix}${k}.`));
        else result[`${prefix}${k}`] = v;
      }
      return result;
    };

    const flat = flatten(configs);
    const updatedConfigs = [];
    const websocketService = require("../services/websocketService");
    for (const [key, value] of Object.entries(flat)) {
      const config = await AppConfig.updateConfig(key, value, req.admin.id);
      updatedConfigs.push(config);
      websocketService.broadcastSystemConfigUpdate(key, value);
    }
    res.json({
      success: true,
      message: "Configurations updated successfully",
      data: { configs: updatedConfigs },
    });
  }),
);

// ===== CONTENT MANAGEMENT =====

// GET /api/admin/content
router.get(
  "/content",
  requireMenuAccess("contentManagement"),
  requireDataAccess("content"),
  catchAsync(async (req, res, next) => {
    const where = {};
    if (req.query.type) where.type = req.query.type;
    if (req.query.isActive !== undefined)
      where.isActive = req.query.isActive === "true";
    const content = await Content.findAll({
      where,
      order: [
        ["type", "ASC"],
        ["sort_order", "ASC"],
      ],
    });
    res.json({ success: true, data: content });
  }),
);

// POST /api/admin/content
router.post(
  "/content",
  requireMenuAccess("contentManagement"),
  requireActionPermission("createContent"),
  [
    body("key").isString().isLength({ min: 1 }),
    body("type").isIn(["faq", "process_guide", "contact_info", "general"]),
    body("content").isObject(),
  ],
  catchAsync(async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return next(new AppError("Validation errors", 400, errors.array()));
    const item = await Content.create({
      ...req.body,
      createdById: req.admin.id,
    });
    res.status(201).json({
      success: true,
      message: "Content created successfully",
      data: { content: item },
    });
  }),
);

// PUT /api/admin/content/:id
router.put(
  "/content/:id",
  requireMenuAccess("contentManagement"),
  requireActionPermission("updateContent"),
  catchAsync(async (req, res, next) => {
    const item = await Content.findByPk(req.params.id);
    if (!item) return next(new AppError("Content not found", 404));
    await item.update({ ...req.body, updatedById: req.admin.id });
    res.json({
      success: true,
      message: "Content updated successfully",
      data: { content: item },
    });
  }),
);

// DELETE /api/admin/content/:id
router.delete(
  "/content/:id",
  requireMenuAccess("contentManagement"),
  requireActionPermission("deleteContent"),
  catchAsync(async (req, res, next) => {
    const item = await Content.findByPk(req.params.id);
    if (!item) return next(new AppError("Content not found", 404));
    await item.destroy();
    res.json({ success: true, message: "Content deleted successfully" });
  }),
);

// ===== ANALYTICS =====

function getPeriodFilter(period) {
  const now = new Date();
  const ms = { "7d": 7, "30d": 30, "90d": 90, "1y": 365 };
  const days = ms[period] || 30;
  return {
    createdAt: {
      [Op.gte]: new Date(now.getTime() - days * 24 * 60 * 60 * 1000),
    },
  };
}

// GET /api/admin/analytics/loans
router.get(
  "/analytics/loans",
  requireMenuAccess("analytics"),
  requireDataAccess("loanAnalytics"),
  filterLoansByRole,
  catchAsync(async (req, res, next) => {
    const where = getPeriodFilter(req.query.period || "30d");
    const [loanTrends, statusDistribution, amountDistribution] =
      await Promise.all([
        Loan.findAll({
          where,
          attributes: [
            [fn("DATE", col("created_at")), "date"],
            [fn("COUNT", col("id")), "count"],
            [fn("SUM", col("amount")), "totalAmount"],
          ],
          group: [fn("DATE", col("created_at"))],
          order: [[fn("DATE", col("created_at")), "ASC"]],
          raw: true,
        }),
        Loan.findAll({
          where,
          attributes: [
            "status",
            [fn("COUNT", col("id")), "count"],
            [fn("SUM", col("amount")), "totalAmount"],
          ],
          group: ["status"],
          raw: true,
        }),
        sequelize.query(
          `SELECT CASE WHEN amount < 500 THEN '0-500' WHEN amount < 1000 THEN '500-1000' WHEN amount < 2000 THEN '1000-2000' WHEN amount < 5000 THEN '2000-5000' WHEN amount < 10000 THEN '5000-10000' ELSE '10000+' END as bucket, COUNT(*) as count, SUM(amount) as total FROM cedi_loans.loans WHERE created_at >= :since GROUP BY bucket`,
          {
            replacements: { since: where.createdAt[Op.gte] },
            type: sequelize.QueryTypes.SELECT,
          },
        ),
      ]);
    res.json({
      success: true,
      data: { loanTrends, statusDistribution, amountDistribution },
    });
  }),
);

// GET /api/admin/analytics/users
router.get(
  "/analytics/users",
  requireMenuAccess("analytics"),
  requireDataAccess("userAnalytics"),
  catchAsync(async (req, res, next) => {
    const where = getPeriodFilter(req.query.period || "30d");
    const [userGrowth, levelDistribution, registrationCompletion] =
      await Promise.all([
        User.findAll({
          where,
          attributes: [
            [fn("DATE", col("created_at")), "date"],
            [fn("COUNT", col("id")), "count"],
          ],
          group: [fn("DATE", col("created_at"))],
          order: [[fn("DATE", col("created_at")), "ASC"]],
          raw: true,
        }),
        User.findAll({
          attributes: ["current_loan_level", [fn("COUNT", col("id")), "count"]],
          group: ["current_loan_level"],
          order: [["current_loan_level", "ASC"]],
          raw: true,
        }),
        User.findAll({
          attributes: [
            "registration_complete",
            [fn("COUNT", col("id")), "count"],
          ],
          group: ["registration_complete"],
          raw: true,
        }),
      ]);
    res.json({
      success: true,
      data: { userGrowth, levelDistribution, registrationCompletion },
    });
  }),
);

// ===== ROLES (for dropdowns) =====

router.get(
  "/roles",
  catchAsync(async (req, res, next) => {
    const roles = await Role.findAll({
      where: { isActive: true },
      attributes: ["id", "name", "displayName", "description", "hierarchy"],
      order: [["hierarchy", "ASC"]],
    });
    res.json({ success: true, data: roles });
  }),
);

// ===== PAYMENT MANAGEMENT =====

router.get(
  "/payments",
  requireMenuAccess("fundManagement"),
  requireDataAccess("payments"),
  filterPaymentData,
  catchAsync(async (req, res, next) => {
    const {
      page = 1,
      limit = 20,
      status,
      loanId,
      userId,
      search,
      sortBy = "created_at",
      sortOrder = "desc",
    } = req.query;
    const where = {};
    if (status && status !== "all") where.status = status;
    if (loanId) where.loanId = loanId;
    if (userId) where.userId = userId;
    if (search)
      where[Op.or] = [{ transactionId: { [Op.iLike]: `%${search}%` } }];

    const { count, rows: payments } = await Payment.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "User",
          attributes: [
            "firstName",
            "lastName",
            "email",
            "phoneNumber",
            "userId",
            "currentLoanLevel",
          ],
        },
        {
          model: Loan,
          as: "Loan",
          attributes: ["amount", "status", "loanId", "loanLevel"],
        },
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    res.json({
      success: true,
      payments,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(count / parseInt(limit)),
        total: count,
        limit: parseInt(limit),
      },
    });
  }),
);

// ===== OVERDUE TRACKING =====

router.get(
  "/overdue-tracking/status",
  catchAsync(async (req, res, next) => {
    const overdueTrackingService = require("../services/overdueTrackingService");
    res.json({ success: true, status: overdueTrackingService.getStatus() });
  }),
);

router.post(
  "/overdue-tracking/manual-check",
  catchAsync(async (req, res, next) => {
    const overdueTrackingService = require("../services/overdueTrackingService");
    overdueTrackingService
      .manualCheck()
      .catch((err) => console.error("Manual overdue check error:", err));
    res.json({
      success: true,
      message: "Manual overdue check triggered successfully",
    });
  }),
);

router.post(
  "/overdue-tracking/start",
  catchAsync(async (req, res, next) => {
    const overdueTrackingService = require("../services/overdueTrackingService");
    overdueTrackingService.start();
    res.json({
      success: true,
      message: "Overdue tracking service started successfully",
    });
  }),
);

router.post(
  "/overdue-tracking/stop",
  catchAsync(async (req, res, next) => {
    const overdueTrackingService = require("../services/overdueTrackingService");
    overdueTrackingService.stop();
    res.json({
      success: true,
      message: "Overdue tracking service stopped successfully",
    });
  }),
);

module.exports = router;
