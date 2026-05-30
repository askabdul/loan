/**
 * Pre-Collection Routes
 * Manages loans in active status before their due date.
 * Officers proactively call customers D-7 to D-1.
 */

const express = require("express");
const { Op, fn, col, literal } = require("sequelize");
const { adminAuth } = require("../middleware/auth");
const {
  requireMenuAccess,
  requireSubMenuAccess,
  requireAnySubMenuAccess,
} = require("../middleware/roleAuth");
const { Loan, User, Admin, Payment, Role } = require("../models");

const router = express.Router();

const LEAD_ASSIGNMENT_ROLES = new Set([
  "super-admin",
  "admin",
  "local-manager",
  "precollection-lead",
]);

const getRoleName = (admin) => admin?.Role?.name || admin?.role?.name;

const canManageAssignments = (admin) =>
  LEAD_ASSIGNMENT_ROLES.has(getRoleName(admin));

const RESERVE_HOLD_DAYS = 10;
const RESERVE_HOLD_MS = RESERVE_HOLD_DAYS * 24 * 60 * 60 * 1000;

router.use(adminAuth);
router.use(requireMenuAccess("preCollection"));

// ── GET /cases ────────────────────────────────────────────────────────────────
router.get(
  "/cases",
  requireAnySubMenuAccess([
    { menu: "preCollection", subMenu: "list" },
    { menu: "preCollection", subMenu: "allList" },
  ]),
  async (req, res) => {
  try {
    const { status, officerId, page = 1, limit = 20, search } = req.query;
    const where = {};
    const adminRoleName = req.admin?.Role?.name || req.admin?.role?.name;

    const isCompletedTab = status === "completed";
    if (isCompletedTab) {
      where[Op.or] = [
        { precollectionStatus: "completed" },
        { status: "completed" },
      ];
    } else if (!status) {
      where.status = { [Op.in]: ["active", "completed"] };
    } else {
      where.status = "active";
      if (status) where.precollectionStatus = status;
    }

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
      where[Op.or] = [...(where[Op.or] || []), { loanId: { [Op.iLike]: s } }];
    }

    // Officers see only their own cases
    if (adminRoleName === "precollection-officer") {
      where.precollectionOfficerId = req.admin.id;
    } else if (officerId) {
      where.precollectionOfficerId = officerId;
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
          as: "PrecollectionOfficer",
          attributes: ["id", "firstName", "lastName", "username"],
        },
      ],
      order: [["dueDate", "ASC"]],
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
    console.error("Pre-collection cases error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
  },
);

// ── PATCH /cases/:id/status ───────────────────────────────────────────────────
router.patch(
  "/cases/:id/status",
  requireAnySubMenuAccess([
    { menu: "preCollection", subMenu: "list" },
    { menu: "preCollection", subMenu: "allList" },
  ]),
  async (req, res) => {
    try {
      const { status } = req.body;
      const allowed = [
        "pending-assignment",
        "assigned",
        "processed",
        "hung-up",
        "completed",
      ];
      if (!allowed.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid pre-collection status",
        });
      }

      const loan = await Loan.findByPk(req.params.id);
      if (!loan) {
        return res
          .status(404)
          .json({ success: false, message: "Loan not found" });
      }

      const roleName = getRoleName(req.admin);
      const canUpdateAny = canManageAssignments(req.admin);
      const canUpdateOwn =
        roleName === "precollection-officer" &&
        loan.precollectionOfficerId === req.admin.id;

      if (!canUpdateAny && !canUpdateOwn) {
        return res.status(403).json({
          success: false,
          message: "You can only update statuses for cases assigned to you",
        });
      }

      const updates = { precollectionStatus: status };
      if (status !== "hung-up") {
        updates.reservedAt = null;
        updates.reservedByOfficerId = null;
      }

      await loan.update(updates);
      res.json({ success: true, loan });
    } catch (error) {
      console.error("Update pre-collection status error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

// ── PATCH /cases/:id/assign ───────────────────────────────────────────────────
router.patch("/cases/:id/assign", requireSubMenuAccess("preCollection", "list"), async (req, res) => {
  try {
    if (!canManageAssignments(req.admin)) {
      return res.status(403).json({
        success: false,
        message: "Only pre-collection leads can assign cases",
      });
    }

    const { officerId } = req.body;
    const loan = await Loan.findByPk(req.params.id);
    if (!loan)
      return res
        .status(404)
        .json({ success: false, message: "Loan not found" });

    await loan.update({
      precollectionOfficerId: officerId,
      precollectionStatus: "assigned",
    });
    res.json({ success: true, loan });
  } catch (error) {
    console.error("Assign pre-collection error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── PATCH /cases/:id/unassign ─────────────────────────────────────────────────
router.patch(
  "/cases/:id/unassign",
  requireAnySubMenuAccess([
    { menu: "preCollection", subMenu: "list" },
    { menu: "preCollection", subMenu: "allList" },
  ]),
  async (req, res) => {
  try {
    const loan = await Loan.findByPk(req.params.id);
    if (!loan)
      return res
        .status(404)
        .json({ success: false, message: "Loan not found" });

    const roleName = getRoleName(req.admin);
    const isLead = canManageAssignments(req.admin);
    const isReservedCase = loan.precollectionStatus === "hung-up";

    if (isReservedCase) {
      const reservedAtTs = loan.reservedAt ? new Date(loan.reservedAt).getTime() : 0;
      const reserveAgeMs = reservedAtTs ? Date.now() - reservedAtTs : 0;
      const isReserveExpired = reserveAgeMs >= RESERVE_HOLD_MS;
      const isReserver = loan.reservedByOfficerId === req.admin.id;

      if (!isReserver && !(isLead && isReserveExpired)) {
        return res.status(403).json({
          success: false,
          message:
            "Only the officer who reserved this case can release it before 10 days. Admin/leads can release after 10 days.",
        });
      }
    } else {
      const canUnassignOwnAssigned =
        roleName === "precollection-officer" &&
        loan.precollectionOfficerId === req.admin.id;

      if (!isLead && !canUnassignOwnAssigned) {
        return res.status(403).json({
          success: false,
          message: "You can only unassign your own assigned cases",
        });
      }
    }

    await loan.update({
      precollectionOfficerId: null,
      precollectionStatus: "pending-assignment",
      reservedAt: null,
      reservedByOfficerId: null,
    });
    res.json({ success: true, loan });
  } catch (error) {
    console.error("Unassign pre-collection error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
  },
);

// ── PATCH /cases/:id/reserve ──────────────────────────────────────────────────
router.patch(
  "/cases/:id/reserve",
  requireAnySubMenuAccess([
    { menu: "preCollection", subMenu: "list" },
    { menu: "preCollection", subMenu: "allList" },
  ]),
  async (req, res) => {
  try {
    const loan = await Loan.findByPk(req.params.id);
    if (!loan)
      return res
        .status(404)
        .json({ success: false, message: "Loan not found" });

    const roleName = getRoleName(req.admin);
    const canReserveAny = canManageAssignments(req.admin);
    const canReserveOwn =
      roleName === "precollection-officer" &&
      loan.precollectionOfficerId === req.admin.id;

    if (!canReserveAny && !canReserveOwn) {
      return res.status(403).json({
        success: false,
        message: "You can only reserve cases assigned to you",
      });
    }

    await loan.update({
      precollectionStatus: "hung-up",
      reservedAt: new Date(),
      reservedByOfficerId: req.admin.id,
    });
    res.json({ success: true, loan });
  } catch (error) {
    console.error("Reserve pre-collection error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
  },
);

// ── POST /bulk-assign ─────────────────────────────────────────────────────────
router.post("/bulk-assign", requireSubMenuAccess("preCollection", "list"), async (req, res) => {
  try {
    if (!canManageAssignments(req.admin)) {
      return res.status(403).json({
        success: false,
        message: "Only pre-collection leads can bulk assign cases",
      });
    }

    const { loanIds, officerIds, mode = "equal" } = req.body;
    if (
      !Array.isArray(loanIds) ||
      !Array.isArray(officerIds) ||
      loanIds.length === 0 ||
      officerIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "loanIds and officerIds are required arrays",
      });
    }

    let assignments = [];

    if (mode === "equal") {
      assignments = loanIds.map((id, i) => ({
        id,
        officerId: officerIds[i % officerIds.length],
      }));
    } else {
      // Load-weighted: sort officers by current case count
      const counts = await Promise.all(
        officerIds.map(async (oid) => ({
          oid,
          count: await Loan.count({
            where: { precollectionOfficerId: oid, status: "active" },
          }),
        })),
      );
      counts.sort((a, b) => a.count - b.count);

      for (let i = 0; i < loanIds.length; i++) {
        const officer = counts[i % counts.length];
        assignments.push({ id: loanIds[i], officerId: officer.oid });
        officer.count++;
      }
    }

    await Promise.all(
      assignments.map(({ id, officerId }) =>
        Loan.update(
          {
            precollectionOfficerId: officerId,
            precollectionStatus: "assigned",
          },
          { where: { id } },
        ),
      ),
    );

    res.json({ success: true, assigned: assignments.length });
  } catch (error) {
    console.error("Bulk assign pre-collection error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /repayments ───────────────────────────────────────────────────────────
// Payments received before the official due date
router.get("/repayments", requireSubMenuAccess("preCollection", "paymentRecord"), async (req, res) => {
  try {
    const { startDate, endDate, officerId, page = 1, limit = 20 } = req.query;
    const where = { status: "completed" };

    if (startDate || endDate) {
      where.completedAt = {};
      if (startDate) where.completedAt[Op.gte] = new Date(startDate);
      if (endDate) where.completedAt[Op.lte] = new Date(endDate);
    }

    const loanWhere = {};
    if (officerId) loanWhere.precollectionOfficerId = officerId;

    const { count, rows } = await Payment.findAndCountAll({
      where,
      include: [
        {
          model: Loan,
          as: "Loan",
          where: {
            ...loanWhere,
            [Op.and]: literal(
              `"Payment"."completed_at" < COALESCE("Loan"."extended_due_date", "Loan"."due_date")`,
            ),
          },
          attributes: [
            "id",
            "loanId",
            "amount",
            "dueDate",
            "precollectionOfficerId",
          ],
          include: [
            {
              model: Admin,
              as: "PrecollectionOfficer",
              attributes: ["id", "firstName", "lastName"],
            },
          ],
          required: true,
        },
        {
          model: User,
          as: "User",
          attributes: ["id", "userId", "firstName", "lastName", "phoneNumber"],
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
    console.error("Pre-collection repayments error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /rank1 ────────────────────────────────────────────────────────────────
router.get("/rank1", requireSubMenuAccess("preCollection", "rank1"), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const where = { status: "completed" };

    if (startDate || endDate) {
      where.completedAt = {};
      if (startDate) where.completedAt[Op.gte] = new Date(startDate);
      if (endDate) where.completedAt[Op.lte] = new Date(endDate);
    }

    const payments = await Payment.findAll({
      where,
      include: [
        {
          model: Loan,
          as: "Loan",
          attributes: ["precollectionOfficerId"],
          include: [
            {
              model: Admin,
              as: "PrecollectionOfficer",
              attributes: ["id", "firstName", "lastName"],
            },
          ],
          required: true,
        },
      ],
      attributes: [
        "Loan.precollectionOfficerId",
        [fn("SUM", col("Payment.amount")), "totalCollected"],
        [fn("COUNT", col("Payment.id")), "totalCases"],
      ],
      group: [
        "Loan.precollectionOfficerId",
        "Loan->PrecollectionOfficer.id",
        "Loan->PrecollectionOfficer.first_name",
        "Loan->PrecollectionOfficer.last_name",
      ],
      raw: false,
    });

    res.json({ success: true, data: payments });
  } catch (error) {
    console.error("Pre-collection rank1 error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /officer-performance ───────────────────────────────────────────────────
// Aggregated performance per precollection officer — date range supported
router.get("/officer-performance", requireSubMenuAccess("preCollection", "list"), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const roles = await Role.findAll({
      where: {
        name: { [Op.in]: ["precollection-officer", "precollection-lead"] },
      },
    });
    const roleIds = roles.map((r) => r.id);
    const officers = await Admin.findAll({
      where: { roleId: { [Op.in]: roleIds }, isActive: true },
      attributes: ["id", "firstName", "lastName", "username"],
      include: [
        { model: Role, as: "Role", attributes: ["name", "displayName"] },
      ],
    });

    const dateFilter = {};
    if (startDate) dateFilter[Op.gte] = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter[Op.lte] = end;
    }

    const data = await Promise.all(
      officers.map(async (officer) => {
        const totalAssigned = await Loan.count({
          where: {
            precollectionOfficerId: officer.id,
            ...(startDate || endDate ? { updatedAt: dateFilter } : {}),
          },
        });

        const fullPayments = await Loan.count({
          where: {
            precollectionOfficerId: officer.id,
            status: "completed",
            ...(startDate || endDate ? { updatedAt: dateFilter } : {}),
          },
        });

        const paySum = await Payment.findOne({
          where: {
            status: "completed",
            ...(startDate || endDate ? { completedAt: dateFilter } : {}),
          },
          include: [
            {
              model: Loan,
              as: "Loan",
              where: { precollectionOfficerId: officer.id },
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

        return {
          id: officer.id,
          officerName: `${officer.firstName} ${officer.lastName}`,
          firstName: officer.firstName,
          lastName: officer.lastName,
          Role: officer.Role,
          totalAssigned,
          totalCollected,
          fullPayments,
          collectionPercentage: parseFloat(collectionPercentage),
        };
      }),
    );

    data.sort((a, b) => b.totalCollected - a.totalCollected);
    res.json({ success: true, officers: data });
  } catch (err) {
    console.error("Pre-collection officer-performance error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /officers ─────────────────────────────────────────────────────────────
// Returns active precollection officers for assignment dropdowns
router.get("/officers", requireSubMenuAccess("preCollection", "list"), async (req, res) => {
  try {
    const roles = await Role.findAll({
      where: {
        name: { [Op.in]: ["precollection-officer", "precollection-lead"] },
      },
    });
    const roleIds = roles.map((r) => r.id);

    const officers = await Admin.findAll({
      where: { roleId: { [Op.in]: roleIds }, isActive: true },
      attributes: ["id", "firstName", "lastName", "username", "employeeNumber"],
      include: [
        { model: Role, as: "Role", attributes: ["name", "displayName"] },
      ],
    });

    const withCounts = await Promise.all(
      officers.map(async (o) => {
        const activeCases = await Loan.count({
          where: {
            precollectionOfficerId: o.id,
            precollectionStatus: "assigned",
          },
        });
        return { ...o.toJSON(), activeCases };
      }),
    );

    res.json({ success: true, officers: withCounts });
  } catch (error) {
    console.error("Get precollection officers error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
