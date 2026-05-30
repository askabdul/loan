/**
 * Collection Routes
 * Handles overdue loan case management: assign, status update, reserve, rank analytics, app usage.
 */

const express = require("express");
const { Op, fn, col, literal } = require("sequelize");
const { sequelize } = require("../config/database");
const { adminAuth } = require("../middleware/auth");
const { requireMenuAccess, requireSubMenuAccess } = require("../middleware/roleAuth");
const { Loan, User, Admin, Payment, AppUsageLog, Role } = require("../models");

const router = express.Router();

const COLLECTION_LEAD_ROLES = new Set([
  "super-admin",
  "admin",
  "local-manager",
  "collection-lead",
]);

const getRoleName = (admin) => admin?.Role?.name || admin?.role?.name;
const canManageAssignments = (admin) =>
  COLLECTION_LEAD_ROLES.has(getRoleName(admin));

// All routes require admin authentication
router.use(adminAuth);
router.use(requireMenuAccess("collection"));

// ── GET /cases ────────────────────────────────────────────────────────────────
// Overdue case list with filtering by collectionStatus.
// "completed" tab shows loans whose main status = completed (they were collected).
router.get("/cases", requireSubMenuAccess("collection", "list"), async (req, res) => {
  try {
    const { status, officerId, page = 1, limit = 20, search } = req.query;
    const adminRoleName = req.admin?.Role?.name || req.admin?.role?.name;

    // "completed" tab — these loans have been fully repaid
    const where =
      status === "completed"
        ? { status: "completed", collectionOfficerId: { [Op.not]: null } }
        : { status: "overdue" };

    if (status && status !== "completed") where.collectionStatus = status;
    if (officerId) where.collectionOfficerId = officerId;

    // Search by borrower name, phone, or loan ID
    let userWhere = {};
    if (search) {
      const s = `%${search}%`;
      userWhere = {
        [Op.or]: [
          { firstName: { [Op.iLike]: s } },
          { lastName: { [Op.iLike]: s } },
          { phoneNumber: { [Op.iLike]: s } },
        ],
      };
    }

    // Officers see only their own cases
    if (
      adminRoleName === "collection-officer" ||
      adminRoleName === "precollection-officer"
    ) {
      where.collectionOfficerId = req.admin.id;
    }

    const { count, rows } = await Loan.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "User",
          attributes: ["id", "userId", "firstName", "lastName", "phoneNumber"],
          ...(Object.keys(userWhere).length
            ? { where: userWhere, required: true }
            : {}),
        },
        {
          model: Admin,
          as: "CollectionOfficer",
          attributes: ["id", "firstName", "lastName", "username"],
        },
      ],
      order: [["updatedAt", "DESC"]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    res.json({
      success: true,
      total: count,
      page: parseInt(page),
      loans: rows,
    });
  } catch (error) {
    console.error("Collection cases error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── PATCH /cases/:id/assign ───────────────────────────────────────────────────
router.patch("/cases/:id/assign", requireSubMenuAccess("collection", "list"), async (req, res) => {
  try {
    if (!canManageAssignments(req.admin)) {
      return res.status(403).json({
        success: false,
        message: "Only collection leads can assign cases",
      });
    }

    const { officerId } = req.body;
    const loan = await Loan.findByPk(req.params.id);
    if (!loan)
      return res
        .status(404)
        .json({ success: false, message: "Loan not found" });

    await loan.update({
      collectionOfficerId: officerId,
      collectionStatus: "assigned",
    });
    res.json({ success: true, loan });
  } catch (error) {
    console.error("Assign collection error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── PATCH /cases/:id/status ───────────────────────────────────────────────────
router.patch("/cases/:id/status", requireSubMenuAccess("collection", "list"), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = [
      "pending-assignment",
      "assigned",
      "processed",
      "hung-up",
      "completed",
    ];
    if (!allowed.includes(status))
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });

    const loan = await Loan.findByPk(req.params.id);
    if (!loan)
      return res
        .status(404)
        .json({ success: false, message: "Loan not found" });

    const roleName = getRoleName(req.admin);
    const canUpdateAny = canManageAssignments(req.admin);
    const canUpdateOwn =
      roleName === "collection-officer" && loan.collectionOfficerId === req.admin.id;

    if (!canUpdateAny && !canUpdateOwn) {
      return res.status(403).json({
        success: false,
        message: "You can only update statuses for cases assigned to you",
      });
    }

    await loan.update({ collectionStatus: status });
    res.json({ success: true, loan });
  } catch (error) {
    console.error("Update collection status error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── PATCH /cases/:id/reserve ──────────────────────────────────────────────────
router.patch("/cases/:id/reserve", requireSubMenuAccess("collection", "list"), async (req, res) => {
  try {
    const loan = await Loan.findByPk(req.params.id);
    if (!loan)
      return res
        .status(404)
        .json({ success: false, message: "Loan not found" });

    const roleName = getRoleName(req.admin);
    const canReserveAny = canManageAssignments(req.admin);
    const canReserveOwn =
      roleName === "collection-officer" && loan.collectionOfficerId === req.admin.id;

    if (!canReserveAny && !canReserveOwn) {
      return res.status(403).json({
        success: false,
        message: "You can only reserve cases assigned to you",
      });
    }

    await loan.update({
      collectionStatus: "hung-up",
      reservedAt: new Date(),
      reservedByOfficerId: req.admin.id,
    });
    res.json({ success: true, loan });
  } catch (error) {
    console.error("Reserve collection error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /rank1 ────────────────────────────────────────────────────────────────
// Amount collected by officers broken down by date
router.get("/rank1", requireSubMenuAccess("collection", "rank1"), async (req, res) => {
  try {
    const { startDate, endDate, groupBy = "day" } = req.query;
    const where = {};
    if (startDate || endDate) {
      where.completedAt = {};
      if (startDate) where.completedAt[Op.gte] = new Date(startDate);
      if (endDate) where.completedAt[Op.lte] = new Date(endDate);
    }

    const payments = await Payment.findAll({
      where: { ...where, status: "completed" },
      include: [
        {
          model: Loan,
          as: "Loan",
          attributes: ["collectionOfficerId"],
          required: true,
        },
      ],
      attributes: [
        [fn("SUM", col("amount")), "totalCollected"],
        [fn("COUNT", col("Payment.id")), "totalCases"],
        "Loan.collectionOfficerId",
      ],
      group: ["Loan.collectionOfficerId"],
      raw: true,
    });

    res.json({ success: true, data: payments });
  } catch (error) {
    console.error("Collection rank1 error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /rank2 ────────────────────────────────────────────────────────────────
// Officer performance percentage
router.get("/rank2", requireSubMenuAccess("collection", "rank2"), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate) dateFilter[Op.gte] = new Date(startDate);
    if (endDate) dateFilter[Op.lte] = new Date(endDate);

    const officers = await Admin.findAll({
      where: {
        "$Role.name$": { [Op.in]: ["collection-officer", "collection-lead"] },
      },
      include: [
        {
          model: require("../models/auth/Role"),
          as: "Role",
          attributes: ["name"],
        },
      ],
    });

    const result = await Promise.all(
      officers.map(async (officer) => {
        const assigned = await Loan.count({
          where: { collectionOfficerId: officer.id },
        });
        const completedLoans = await Loan.count({
          where: {
            collectionOfficerId: officer.id,
            status: "completed",
            ...(startDate || endDate ? { updatedAt: dateFilter } : {}),
          },
        });
        const payments = await Payment.findAll({
          where: {
            status: "completed",
            ...(startDate || endDate ? { completedAt: dateFilter } : {}),
          },
          include: [
            {
              model: Loan,
              as: "Loan",
              where: { collectionOfficerId: officer.id },
              required: true,
            },
          ],
          attributes: [[fn("SUM", col("amount")), "total"]],
          raw: true,
        });
        const totalCollected = parseFloat(payments[0]?.total || 0);

        return {
          officerId: officer.id,
          officerName: `${officer.firstName} ${officer.lastName}`,
          totalAssigned: assigned,
          totalCollected,
          fullPayments: completedLoans,
          collectionPercentage:
            assigned > 0 ? ((completedLoans / assigned) * 100).toFixed(1) : 0,
        };
      }),
    );

    result.sort(
      (a, b) =>
        parseFloat(b.collectionPercentage) - parseFloat(a.collectionPercentage),
    );
    res.json({ success: true, officers: result });
  } catch (error) {
    console.error("Collection rank2 error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /credit-review/count ──────────────────────────────────────────────────
router.get("/credit-review/count", requireSubMenuAccess("collection", "list"), async (req, res) => {
  try {
    const { startDate, endDate, officerId } = req.query;
    const dateFilter = {};
    if (startDate) dateFilter[Op.gte] = new Date(startDate);
    if (endDate) dateFilter[Op.lte] = new Date(endDate);

    const where = {};
    if (officerId) where.assignedOfficerId = officerId;

    const loans = await Loan.findAll({
      where,
      include: [
        {
          model: User,
          as: "User",
          attributes: ["id", "firstName", "lastName"],
        },
        {
          model: Admin,
          as: "AssignedOfficer",
          attributes: ["id", "firstName", "lastName"],
        },
      ],
    });

    // Group by officer
    const officerMap = {};
    for (const loan of loans) {
      const oid = loan.assignedOfficerId;
      if (!oid) continue;
      if (!officerMap[oid]) {
        officerMap[oid] = {
          officerId: oid,
          officerName: loan.AssignedOfficer
            ? `${loan.AssignedOfficer.firstName} ${loan.AssignedOfficer.lastName}`
            : "Unknown",
          casesAssigned: 0,
          totalContacted: 0,
          fullPayments: 0,
          partialPayments: 0,
          pending: 0,
        };
      }
      officerMap[oid].casesAssigned++;

      if (loan.status === "completed") officerMap[oid].fullPayments++;
      else officerMap[oid].pending++;

      // Count contact notes by this officer
      const notes = Array.isArray(loan.contactNotes) ? loan.contactNotes : [];
      officerMap[oid].totalContacted += notes.filter(
        (n) => n.addedBy === oid,
      ).length;
    }

    const result = Object.values(officerMap).map((o) => ({
      ...o,
      completionRate:
        o.casesAssigned > 0
          ? ((o.fullPayments / o.casesAssigned) * 100).toFixed(1)
          : 0,
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Credit review count error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── POST /app-usage/log ───────────────────────────────────────────────────────
router.post("/app-usage/log", requireSubMenuAccess("collection", "list"), async (req, res) => {
  try {
    const {
      adminId,
      totalActiveMinutes,
      backgroundEvents = [],
      lastFlushedAt,
    } = req.body;

    const today = new Date().toISOString().split("T")[0];

    const [log, created] = await AppUsageLog.findOrCreate({
      where: { adminId: adminId || req.admin.id, sessionDate: today },
      defaults: {
        adminId: adminId || req.admin.id,
        sessionDate: today,
        loginTime: new Date(),
        totalActiveMinutes: 0,
        totalBackgroundMinutes: 0,
        backgroundEvents: [],
      },
    });

    const bgMinutes = backgroundEvents.reduce(
      (sum, e) => sum + (e.durationMinutes || 0),
      0,
    );

    await log.update({
      totalActiveMinutes: Math.max(
        log.totalActiveMinutes,
        totalActiveMinutes || 0,
      ),
      totalBackgroundMinutes: log.totalBackgroundMinutes + bgMinutes,
      backgroundEvents: [...(log.backgroundEvents || []), ...backgroundEvents],
      logoutTime: lastFlushedAt ? new Date(lastFlushedAt) : log.logoutTime,
    });

    res.json({ success: true, log });
  } catch (error) {
    console.error("App usage log error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /app-usage ────────────────────────────────────────────────────────────
router.get("/app-usage", requireSubMenuAccess("collection", "list"), async (req, res) => {
  try {
    const { startDate, endDate, officerId } = req.query;
    const where = {};
    if (officerId) where.adminId = officerId;
    if (startDate || endDate) {
      where.sessionDate = {};
      if (startDate) where.sessionDate[Op.gte] = startDate;
      if (endDate) where.sessionDate[Op.lte] = endDate;
    }

    const logs = await AppUsageLog.findAll({
      where,
      include: [
        {
          model: Admin,
          as: "Admin",
          attributes: ["id", "firstName", "lastName", "username"],
        },
      ],
      order: [["sessionDate", "DESC"]],
    });

    res.json({ success: true, logs });
  } catch (error) {
    console.error("App usage get error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── PATCH /cases/:id/unassign ─────────────────────────────────────────────────
// Remove officer assignment — case returns to pending-assignment queue
router.patch("/cases/:id/unassign", requireSubMenuAccess("collection", "list"), async (req, res) => {
  try {
    if (!canManageAssignments(req.admin)) {
      return res.status(403).json({
        success: false,
        message: "Only collection leads can unassign cases",
      });
    }

    const loan = await Loan.findByPk(req.params.id);
    if (!loan)
      return res
        .status(404)
        .json({ success: false, message: "Loan not found" });

    await loan.update({
      collectionOfficerId: null,
      collectionStatus: "pending-assignment",
      reservedAt: null,
      reservedByOfficerId: null,
    });
    res.json({ success: true, loan });
  } catch (error) {
    console.error("Unassign collection error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── POST /bulk-assign ─────────────────────────────────────────────────────────
// Distribute selected loans among multiple officers (equal split)
// Body: { loanIds: string[], officerIds: string[], mode: 'equal' | 'weighted' }
router.post("/bulk-assign", requireSubMenuAccess("collection", "list"), async (req, res) => {
  try {
    if (!canManageAssignments(req.admin)) {
      return res.status(403).json({
        success: false,
        message: "Only collection leads can bulk assign cases",
      });
    }

    const { loanIds, officerIds, mode = "equal" } = req.body;
    if (!loanIds?.length || !officerIds?.length)
      return res.status(400).json({
        success: false,
        message: "loanIds and officerIds are required",
      });

    let assignments;
    if (mode === "weighted") {
      // Load-weighted: give more to officers with fewer active cases
      const caseCountsRaw = await Promise.all(
        officerIds.map(async (id) => ({
          id,
          count: await Loan.count({
            where: { collectionOfficerId: id, collectionStatus: "assigned" },
          }),
        })),
      );
      // Sort officers by fewest cases ascending for round-robin from lightest
      caseCountsRaw.sort((a, b) => a.count - b.count);
      assignments = loanIds.map((loanId, i) => ({
        loanId,
        officerId: caseCountsRaw[i % caseCountsRaw.length].id,
      }));
    } else {
      // Equal split: simple round-robin
      assignments = loanIds.map((loanId, i) => ({
        loanId,
        officerId: officerIds[i % officerIds.length],
      }));
    }

    // Batch update
    await Promise.all(
      assignments.map(({ loanId, officerId }) =>
        Loan.update(
          { collectionOfficerId: officerId, collectionStatus: "assigned" },
          { where: { id: loanId } },
        ),
      ),
    );

    res.json({
      success: true,
      message: `${loanIds.length} loans distributed across ${officerIds.length} officers`,
      assignments,
    });
  } catch (error) {
    console.error("Bulk assign collection error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── POST /redistribute ────────────────────────────────────────────────────────
// Take ALL cases from one officer and distribute to available officers
// Body: { fromOfficerId: string, toOfficerIds: string[] }
router.post("/redistribute", requireSubMenuAccess("collection", "list"), async (req, res) => {
  try {
    if (!canManageAssignments(req.admin)) {
      return res.status(403).json({
        success: false,
        message: "Only collection leads can redistribute cases",
      });
    }

    const { fromOfficerId, toOfficerIds } = req.body;
    if (!fromOfficerId || !toOfficerIds?.length)
      return res.status(400).json({
        success: false,
        message: "fromOfficerId and toOfficerIds are required",
      });

    // Find all active cases for the officer being relieved
    const casesToRedistribute = await Loan.findAll({
      where: {
        collectionOfficerId: fromOfficerId,
        collectionStatus: { [Op.in]: ["assigned", "hung-up"] },
      },
      attributes: ["id"],
    });

    if (!casesToRedistribute.length)
      return res.json({
        success: true,
        message: "No active cases found for this officer",
        redistributed: 0,
      });

    const loanIds = casesToRedistribute.map((l) => l.id);

    // Equal round-robin distribution to toOfficerIds
    await Promise.all(
      loanIds.map((loanId, i) =>
        Loan.update(
          {
            collectionOfficerId: toOfficerIds[i % toOfficerIds.length],
            collectionStatus: "assigned",
            reservedAt: null,
            reservedByOfficerId: null,
          },
          { where: { id: loanId } },
        ),
      ),
    );

    res.json({
      success: true,
      message: `${loanIds.length} cases redistributed from officer to ${toOfficerIds.length} officer(s)`,
      redistributed: loanIds.length,
    });
  } catch (error) {
    console.error("Redistribute collection error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /officers ─────────────────────────────────────────────────────────────
// Returns active collection officers for assignment dropdowns
router.get("/officers", requireSubMenuAccess("collection", "officers"), async (req, res) => {
  try {
    const Role = require("../models/auth/Role");
    const roles = await Role.findAll({
      where: { name: { [Op.in]: ["collection-officer", "collection-lead"] } },
    });
    const roleIds = roles.map((r) => r.id);

    const officers = await Admin.findAll({
      where: { roleId: { [Op.in]: roleIds }, isActive: true },
      attributes: ["id", "firstName", "lastName", "username", "employeeNumber"],
      include: [
        { model: Role, as: "Role", attributes: ["name", "displayName"] },
      ],
    });

    // Attach current active case count
    const withCounts = await Promise.all(
      officers.map(async (o) => {
        const activeCases = await Loan.count({
          where: { collectionOfficerId: o.id, collectionStatus: "assigned" },
        });
        return { ...o.toJSON(), activeCases };
      }),
    );

    res.json({ success: true, officers: withCounts });
  } catch (error) {
    console.error("Get collection officers error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /officer-performance ──────────────────────────────────────────────────
// Aggregated performance per officer for Rank 2 — supports date range and type filter
router.get("/officer-performance", requireSubMenuAccess("collection", "officers"), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const roles = await Role.findAll({
      where: { name: { [Op.in]: ["collection-officer", "collection-lead"] } },
    });
    const roleIds = roles.map((r) => r.id);
    const officers = await Admin.findAll({
      where: { roleId: { [Op.in]: roleIds }, isActive: true },
      attributes: ["id", "firstName", "lastName", "username"],
      include: [
        { model: Role, as: "Role", attributes: ["name", "displayName"] },
      ],
    });

    const completionDateFilter = {};
    if (startDate) completionDateFilter[Op.gte] = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      completionDateFilter[Op.lte] = end;
    }

    const data = await Promise.all(
      officers.map(async (officer) => {
        const totalAssigned = await Loan.count({
          where: {
            collectionOfficerId: officer.id,
            ...(startDate || endDate
              ? { updatedAt: completionDateFilter }
              : {}),
          },
        });

        const fullPayments = await Loan.count({
          where: {
            collectionOfficerId: officer.id,
            status: "completed",
            ...(startDate || endDate
              ? { updatedAt: completionDateFilter }
              : {}),
          },
        });

        const partialPayments = await Loan.count({
          where: {
            collectionOfficerId: officer.id,
            status: { [Op.in]: ["active", "overdue"] },
            remainingBalance: { [Op.gt]: 0, [Op.lt]: sequelize.col("amount") },
            ...(startDate || endDate
              ? { updatedAt: completionDateFilter }
              : {}),
          },
        });

        // Sum all payments on loans assigned to this officer
        const paymentWhere = {
          status: "completed",
          ...(startDate || endDate
            ? { completedAt: completionDateFilter }
            : {}),
        };
        const paySum = await Payment.findOne({
          where: paymentWhere,
          include: [
            {
              model: Loan,
              as: "Loan",
              where: { collectionOfficerId: officer.id },
              required: true,
              attributes: [],
            },
          ],
          attributes: [[fn("SUM", col("Payment.amount")), "total"]],
          raw: true,
        });

        const totalCollected = parseFloat(paySum?.total || 0);

        const collectionPercentage =
          totalAssigned > 0
            ? ((fullPayments / totalAssigned) * 100).toFixed(1)
            : "0.0";

        const fullPaymentRate =
          totalAssigned > 0
            ? ((fullPayments / totalAssigned) * 100).toFixed(1)
            : "0.0";

        return {
          id: officer.id,
          officerId: officer.id,
          firstName: officer.firstName,
          lastName: officer.lastName,
          officerName: `${officer.firstName} ${officer.lastName}`,
          username: officer.username,
          Role: officer.Role,
          totalAssigned,
          totalCollected,
          fullPayments,
          partialPayments,
          pendingCases: Math.max(
            0,
            totalAssigned - fullPayments - partialPayments,
          ),
          collectionPercentage: parseFloat(collectionPercentage),
          fullPaymentRate: parseFloat(fullPaymentRate),
        };
      }),
    );

    // Sort by collection percentage desc
    data.sort((a, b) => b.collectionPercentage - a.collectionPercentage);

    res.json({ success: true, officers: data });
  } catch (error) {
    console.error("Officer performance error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /repayments ───────────────────────────────────────────────────────────
// Completed payments on collection-assigned loans
router.get("/repayments", requireSubMenuAccess("collection", "paymentRecord"), async (req, res) => {
  try {
    const { page = 1, limit = 20, officerId, startDate, endDate } = req.query;

    const paymentWhere = { status: "completed" };
    if (startDate || endDate) {
      paymentWhere.completedAt = {};
      if (startDate) paymentWhere.completedAt[Op.gte] = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        paymentWhere.completedAt[Op.lte] = end;
      }
    }

    const loanWhere = {
      collectionOfficerId: { [Op.ne]: null },
    };
    if (officerId) loanWhere.collectionOfficerId = officerId;

    const { count, rows } = await Payment.findAndCountAll({
      where: paymentWhere,
      include: [
        {
          model: Loan,
          as: "Loan",
          where: loanWhere,
          required: true,
          include: [
            {
              model: Admin,
              as: "CollectionOfficer",
              attributes: ["id", "firstName", "lastName"],
              required: false,
            },
          ],
        },
        {
          model: User,
          as: "User",
          attributes: ["id", "firstName", "lastName", "phoneNumber"],
          required: false,
        },
      ],
      order: [["completedAt", "DESC"]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    res.json({
      success: true,
      total: count,
      page: parseInt(page),
      payments: rows,
    });
  } catch (error) {
    console.error("Collection repayments error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
