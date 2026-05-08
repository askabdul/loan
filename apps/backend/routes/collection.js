/**
 * Collection Routes
 * Handles overdue loan case management: assign, status update, reserve, rank analytics, app usage.
 */

const express = require("express");
const { Op, fn, col, literal } = require("sequelize");
const { sequelize } = require("../config/database");
const { adminAuth } = require("../middleware/auth");
const { Loan, User, Admin, Payment, AppUsageLog } = require("../models");

const router = express.Router();

// All routes require admin authentication
router.use(adminAuth);

// ── GET /cases ────────────────────────────────────────────────────────────────
// Overdue case list with filtering by collectionStatus
router.get("/cases", async (req, res) => {
  try {
    const { status, officerId, page = 1, limit = 20 } = req.query;
    const where = { status: "overdue" };

    if (status) where.collectionStatus = status;
    if (officerId) where.collectionOfficerId = officerId;

    // Officers see only their own cases
    if (
      req.admin.role?.name === "collection-officer" ||
      req.admin.role?.name === "precollection-officer"
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
router.patch("/cases/:id/assign", async (req, res) => {
  try {
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
router.patch("/cases/:id/status", async (req, res) => {
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

    await loan.update({ collectionStatus: status });
    res.json({ success: true, loan });
  } catch (error) {
    console.error("Update collection status error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── PATCH /cases/:id/reserve ──────────────────────────────────────────────────
router.patch("/cases/:id/reserve", async (req, res) => {
  try {
    const loan = await Loan.findByPk(req.params.id);
    if (!loan)
      return res
        .status(404)
        .json({ success: false, message: "Loan not found" });

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
router.get("/rank1", async (req, res) => {
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
router.get("/rank2", async (req, res) => {
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
router.get("/credit-review/count", async (req, res) => {
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
router.post("/app-usage/log", async (req, res) => {
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
router.get("/app-usage", async (req, res) => {
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

module.exports = router;
