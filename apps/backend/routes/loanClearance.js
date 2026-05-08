const express = require("express");
const multer = require("multer");
const path = require("path");
const { Op } = require("sequelize");
const { body, validationResult } = require("express-validator");
const { LoanClearance, Loan, User, Admin } = require("../models");
const { sequelize } = require("../config/database");
const { adminAuth } = require("../middleware/auth");
const { checkAndPromoteLevel } = require("../services/levelProgressionService");
const notificationService = require("../services/notificationService");

const router = express.Router();

// ── File upload ───────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/loan-clearance/"),
  filename: (req, file, cb) => {
    const u = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `pop-${u}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/jpeg|jpg|png|pdf/.test(path.extname(file.originalname).toLowerCase()))
      return cb(null, true);
    cb(new Error("Only JPEG, JPG, PNG, and PDF files are allowed"));
  },
});

// POST /api/loan-clearance/submit
router.post(
  "/submit",
  adminAuth,
  upload.single("popFile"),
  [
    body("userId").isUUID(),
    body("loanId").isUUID(),
    body("paymentType").isIn(["full", "partial"]),
    body("amountCleared").isFloat({ min: 1 }),
    body("submissionNotes").optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { userId, loanId, paymentType, amountCleared, submissionNotes } =
        req.body;

      const user = await User.findByPk(userId);
      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found." });

      const loan = await Loan.findByPk(loanId);
      if (!loan)
        return res
          .status(404)
          .json({ success: false, message: "Loan not found." });

      if (loan.userId !== userId) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              "Mismatch: This loan does not belong to the specified user.",
            details: { providedUserId: userId, loanBelongsToUser: loan.userId },
          });
      }
      // Allow clearance for both active AND overdue loans
      if (!["active", "overdue"].includes(loan.status))
        return res
          .status(400)
          .json({
            success: false,
            message: "Can only clear active or overdue loans.",
          });
      if (
        paymentType === "partial" &&
        parseFloat(amountCleared) > parseFloat(loan.remainingBalance)
      ) {
        return res
          .status(400)
          .json({
            success: false,
            message: `Partial amount (${amountCleared}) exceeds outstanding balance (${loan.remainingBalance}).`,
          });
      }
      if (!req.file)
        return res
          .status(400)
          .json({
            success: false,
            message: "Proof of Payment (POP) file is required.",
          });

      const clearanceRequest = await LoanClearance.create({
        userId,
        loanId,
        paymentType,
        amountCleared: parseFloat(amountCleared),
        popUrl: req.file.path,
        submittedById: req.admin.id,
        submissionNotes,
        originalLoanBalance: loan.remainingBalance,
        remainingBalanceAfter:
          paymentType === "full"
            ? 0
            : parseFloat(loan.remainingBalance) - parseFloat(amountCleared),
      });

      res
        .status(201)
        .json({
          success: true,
          message: "Clearance request submitted.",
          data: clearanceRequest,
        });
    } catch (error) {
      console.error("Submit clearance error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

// GET /api/loan-clearance/list
router.get("/list", adminAuth, async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 10,
      submittedBy,
      paymentType,
      dateFrom,
      dateTo,
      search,
    } = req.query;
    const where = {};

    if (status) {
      where.status = status.includes(",")
        ? { [Op.in]: status.split(",") }
        : status;
    }
    if (submittedBy) where.submittedById = submittedBy;
    if (paymentType) where.paymentType = paymentType;
    if (dateFrom || dateTo) {
      where.submittedAt = {};
      if (dateFrom) where.submittedAt[Op.gte] = new Date(dateFrom);
      if (dateTo) {
        const e = new Date(dateTo);
        e.setHours(23, 59, 59, 999);
        where.submittedAt[Op.lte] = e;
      }
    }

    const include = [
      {
        model: User,
        as: "User",
        attributes: ["firstName", "lastName", "phoneNumber"],
      },
      {
        model: Loan,
        as: "Loan",
        attributes: ["loanId", "amount", "remainingBalance"],
      },
      { model: Admin, as: "SubmittedBy", attributes: ["username", "email"] },
      { model: Admin, as: "ReviewedBy", attributes: ["username", "email"] },
    ];

    let { count, rows } = await LoanClearance.findAndCountAll({
      where,
      include,
      order: [["submitted_at", "DESC"]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    // In-memory search filter on populated fields
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter((r) => {
        const name =
          `${r.User?.firstName || ""} ${r.User?.lastName || ""}`.toLowerCase();
        const phone = (r.User?.phoneNumber || "").toLowerCase();
        const lid = (r.Loan?.loanId || "").toLowerCase();
        const by = (r.SubmittedBy?.username || "").toLowerCase();
        return (
          name.includes(s) ||
          phone.includes(s) ||
          lid.includes(s) ||
          by.includes(s)
        );
      });
    }

    res.json({
      success: true,
      data: {
        docs: rows,
        totalDocs: count,
        limit: parseInt(limit),
        page: parseInt(page),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("List clearance error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/loan-clearance/review/:id
router.put(
  "/review/:id",
  adminAuth,
  upload.single("verificationPopFile"),
  [
    body("action").isIn(["approve", "reject"]),
    body("reviewNotes").optional().isString(),
    body("rejectionReason").if(body("action").equals("reject")).notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { action, reviewNotes, rejectionReason } = req.body;

      const clearanceRequest = await LoanClearance.findByPk(req.params.id, {
        include: [
          { model: Loan, as: "Loan" },
          { model: User, as: "User" },
        ],
      });

      if (!clearanceRequest)
        return res
          .status(404)
          .json({ success: false, message: "Clearance request not found." });
      if (clearanceRequest.status !== "pending")
        return res
          .status(400)
          .json({
            success: false,
            message: "Can only review pending requests.",
          });

      if (action === "approve") {
        if (!req.file)
          return res
            .status(400)
            .json({
              success: false,
              message: "Verification POP file required for approval.",
            });

        let loanCompleted = false;

        // Run all loan + clearance updates in a single DB transaction
        await sequelize.transaction(async (t) => {
          await clearanceRequest.markAsReviewed(
            req.admin.id,
            req.file.path,
            reviewNotes,
          );

          const loan = clearanceRequest.Loan;
          if (clearanceRequest.paymentType === "full") {
            await loan.update(
              {
                status: "completed",
                remainingBalance: 0,
                totalPaid:
                  parseFloat(loan.totalPaid || 0) +
                  parseFloat(clearanceRequest.amountCleared),
                lastPaymentDate: new Date(),
                completionDate: new Date(),
                isOverdue: false,
                overdueDays: 0,
              },
              { transaction: t },
            );
            loanCompleted = true;
          } else {
            const newBalance = Math.max(
              0,
              parseFloat(loan.remainingBalance) -
                parseFloat(clearanceRequest.amountCleared),
            );
            await loan.update(
              {
                remainingBalance: newBalance,
                totalPaid:
                  parseFloat(loan.totalPaid || 0) +
                  parseFloat(clearanceRequest.amountCleared),
                lastPaymentDate: new Date(),
                ...(newBalance === 0
                  ? {
                      status: "completed",
                      completionDate: new Date(),
                      isOverdue: false,
                      overdueDays: 0,
                    }
                  : {}),
              },
              { transaction: t },
            );
            if (newBalance === 0) loanCompleted = true;
          }

          // Increment user totalLoansCompleted and totalAmountRepaid if loan completed
          if (loanCompleted) {
            const user = clearanceRequest.User;
            await user.increment(
              {
                totalLoansCompleted: 1,
                totalAmountRepaid: parseFloat(clearanceRequest.amountCleared),
              },
              { transaction: t },
            );
          }

          await clearanceRequest.markAsCompleted();
        });

        // Post-transaction: trigger level progression and notifications (non-blocking)
        if (loanCompleted) {
          const userId = clearanceRequest.User?.id || clearanceRequest.userId;
          checkAndPromoteLevel(userId).catch((e) =>
            console.error("[Clearance] Level progression error:", e.message),
          );
          notificationService
            .paymentConfirmed(userId, clearanceRequest.amountCleared)
            .catch((e) =>
              console.error("[Clearance] Notification error:", e.message),
            );
        }

        res.json({
          success: true,
          message: "Clearance approved and loan updated.",
          data: clearanceRequest,
        });
      } else {
        await clearanceRequest.markAsRejected(rejectionReason);
        res.json({
          success: true,
          message: "Clearance rejected.",
          data: clearanceRequest,
        });
      }
    } catch (error) {
      console.error("Review clearance error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

// PUT /api/loan-clearance/withdraw/:id
router.put(
  "/withdraw/:id",
  adminAuth,
  [body("withdrawalReason").notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const clearanceRequest = await LoanClearance.findByPk(req.params.id);
      if (!clearanceRequest)
        return res
          .status(404)
          .json({ success: false, message: "Clearance request not found." });
      if (clearanceRequest.submittedById !== req.admin.id)
        return res
          .status(403)
          .json({
            success: false,
            message: "You can only withdraw your own requests.",
          });

      await clearanceRequest.withdraw(req.body.withdrawalReason);
      res.json({
        success: true,
        message: "Clearance request withdrawn.",
        data: clearanceRequest,
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },
);

// GET /api/loan-clearance/search-loan
router.get("/search-loan", adminAuth, async (req, res) => {
  try {
    const { userId, loanId } = req.query;
    if (!userId || !loanId)
      return res
        .status(400)
        .json({ success: false, message: "userId and loanId are required." });

    const user = await User.findByPk(userId, {
      attributes: ["id", "firstName", "lastName", "phoneNumber"],
    });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found." });

    const loan = await Loan.findByPk(loanId, {
      include: [
        {
          model: User,
          as: "User",
          attributes: ["id", "firstName", "lastName", "phoneNumber"],
        },
      ],
    });
    if (!loan)
      return res
        .status(404)
        .json({ success: false, message: "Loan not found." });

    if (loan.userId !== userId) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Mismatch: loan does not belong to specified user.",
          details: {
            providedUserId: userId,
            loanBelongsToUser: loan.userId,
            userDetails: user,
            loanOwnerDetails: loan.User,
          },
        });
    }

    res.json({
      success: true,
      message: "Loan found and verified.",
      data: {
        user,
        loan: {
          id: loan.id,
          loanId: loan.loanId,
          amount: loan.amount,
          remainingBalance: loan.remainingBalance,
          status: loan.status,
          dueDate: loan.dueDate,
        },
        isMatch: true,
      },
    });
  } catch (error) {
    console.error("Search loan error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
