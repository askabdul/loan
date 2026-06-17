const express = require("express");
const { Op, fn, col } = require("sequelize");
const { body, validationResult } = require("express-validator");
const { Payment, Loan, User } = require("../models");
const { auth } = require("../middleware/auth");
const { checkAndPromoteLevel } = require("../services/levelProgressionService");
const {
  BRIDGE_SUCCESS_CODE,
  BRIDGE_FAILED_CODE,
  BRIDGE_PENDING_CODE,
  BRIDGE_CANCELLED_CODE,
  initiateBridgeCollection,
  syncPaymentFromBridgeStatus: syncFromBridge,
} = require("../services/bridgeService");
const {
  getLoanLifecycleSettings,
  calculateOverdueDays,
} = require("../services/loanLifecycleSettings");

const router = express.Router();

function calculateCalendarDueDate(activationDate, termInDays) {
  const due = new Date(activationDate);
  due.setHours(0, 0, 0, 0);
  due.setDate(due.getDate() + Number(termInDays || 0));
  return due;
}

async function syncPaymentFromBridgeStatus(payment, req = null) {
  const { statusCode, statusMessage, raw: statusBody, response } =
    await syncFromBridge(payment, req);
  const gatewayResponse = {
    ...(payment.gatewayResponse || {}),
    statusLookup: {
      at: new Date().toISOString(),
      httpStatus: response.status,
      body: statusBody,
    },
  };

  if (statusCode === BRIDGE_SUCCESS_CODE && payment.status !== "completed") {
    const loan = await Loan.findByPk(payment.loanId);
    if (loan) {
      await processSuccessfulPayment(payment, loan, req, {
        externalTransactionId: statusBody?.response_data?.network_transaction_id,
        gatewayResponse: {
          ...gatewayResponse,
          responseCode: statusCode,
          responseMessage: statusMessage,
          rawResponse: statusBody,
          networkTransactionId: statusBody?.response_data?.network_transaction_id,
        },
      });
    }
  } else if ([BRIDGE_FAILED_CODE, BRIDGE_CANCELLED_CODE].includes(statusCode)) {
    if (!["failed", "completed", "cancelled"].includes(payment.status)) {
      if (statusCode === BRIDGE_CANCELLED_CODE) {
        await payment.update({
          status: "cancelled",
          failedAt: new Date(),
          failureReason: statusMessage,
          gatewayResponse: { ...gatewayResponse, responseCode: statusCode, responseMessage: statusMessage, rawResponse: statusBody },
        });
      } else {
        await payment.markAsFailed(statusMessage, { ...gatewayResponse, responseCode: statusCode, responseMessage: statusMessage, rawResponse: statusBody });
      }
    }
  } else if (statusCode === BRIDGE_PENDING_CODE) {
    if (["pending", "processing"].includes(payment.status)) {
      await payment.update({
        status: "processing",
        gatewayResponse: { ...gatewayResponse, responseCode: statusCode, responseMessage: statusMessage, rawResponse: statusBody },
      });
    }
  }

  return { statusCode, statusMessage, raw: statusBody };
}

// ── Helper ────────────────────────────────────────────────────────────────────
async function processSuccessfulPayment(
  payment,
  loan,
  req = null,
  completion = {},
) {
  await payment.markAsCompleted(completion.externalTransactionId || `EXT-${Date.now()}`, {
    ...(payment.gatewayResponse || {}),
    ...(completion.gatewayResponse || {}),
    responseCode:
      completion.gatewayResponse?.responseCode ||
      payment.gatewayResponse?.responseCode ||
      "SUCCESS",
    responseMessage:
      completion.gatewayResponse?.responseMessage ||
      payment.gatewayResponse?.responseMessage ||
      "Payment completed",
  });

  // Use a fresh overdue fee for overdue loans so webhook processing after a
  // delayed STK-push approval doesn't use the stale DB value from hours ago.
  let liveOverdueFee = parseFloat(loan.totalOverdueFee) || 0;
  if (loan.status === "overdue") {
    try {
      const settings = await getLoanLifecycleSettings();
      const freshDays = calculateOverdueDays({
        dueDate: loan.dueDate,
        now: new Date(),
        mode: settings.overdueDayCountMode,
      });
      const dailyRate = (parseFloat(loan.overdueFeePct) || 2) / 100;
      liveOverdueFee =
        Math.round(
          parseFloat(loan.remainingBalance || 0) * dailyRate * freshDays * 100,
        ) / 100;
    } catch (_) {
      // fall back to whatever is stored
    }
  }
  const overdueFeePaid = Math.min(parseFloat(payment.amount), liveOverdueFee);
  const principalPaid = parseFloat(payment.amount) - overdueFeePaid;

  const updates = {
    remainingBalance: Math.max(
      0,
      parseFloat(loan.remainingBalance) - principalPaid,
    ),
    totalPaid: parseFloat(loan.totalPaid || 0) + parseFloat(payment.amount),
    lastPaymentDate: new Date(),
  };

  if (overdueFeePaid > 0) {
    updates.totalOverdueFee = Math.max(
      0,
      parseFloat(loan.totalOverdueFee) - overdueFeePaid,
    );
    if (updates.totalOverdueFee === 0) {
      updates.isOverdue = false;
      updates.overdueDays = 0;
    }
  }

  if (updates.remainingBalance === 0) {
    updates.status = "completed";
    updates.completionDate = new Date();
  } else {
    const wasPendingActivation = ["approved", "disbursed", "pending"].includes(
      loan.status,
    );
    updates.status = "active";
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    updates.nextPaymentDate = next;

    if (wasPendingActivation) {
      const activationNow = new Date();
      if (!loan.disbursementDate) {
        updates.disbursementDate = activationNow;
      }
      updates.activationConfirmedAt = activationNow;
      updates.dueDate = calculateCalendarDueDate(
        activationNow,
        loan.termInDays || 30,
      );
    }
  }

  await loan.update(updates);

  if (updates.status === "completed") {
    const user = await User.findByPk(payment.userId);
    if (user) {
      await user.increment({
        totalLoansCompleted: 1,
        totalAmountRepaid: parseFloat(payment.amount || 0),
      });
      await checkAndPromoteLevel(user.id);
    }
  }

  const io = req ? req.app.get("io") : null;
  if (io) {
    io.to(`user-${payment.userId}`).emit("payment-received", {
      paymentId: payment.id,
      transactionId: payment.transactionId,
      amount: payment.amount,
      status: payment.status,
      loanId: loan.id,
      remainingBalance: updates.remainingBalance,
      message: `Payment of GHS ${payment.amount} processed successfully!`,
    });
  }
}

// POST /api/payments/initiate
router.post(
  "/initiate",
  auth,
  [
    body("loanId").isUUID(),
    body("amount").isFloat({ min: 1 }),
    body("paymentType").isIn(["full", "partial"]),
    body("mobileMoneyProvider").isIn(["MTN", "Telecel", "AirtelTigo"]),
    body("mobileNumber").isMobilePhone(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { loanId, amount, paymentType, mobileMoneyProvider, mobileNumber } =
        req.body;

      const loan = await Loan.findOne({
        where: {
          id: loanId,
          userId: req.user.id,
          status: { [Op.in]: ["approved", "active", "overdue"] },
        },
      });
      if (!loan)
        return res
          .status(404)
          .json({
            success: false,
            message: "Loan not found or not eligible for payment.",
          });

      // For overdue loans compute the current fee dynamically; for active/approved
      // use the instance method which reads nextPaymentDate.
      let currentOverdueFee = 0;
      if (loan.status === "overdue") {
        const settings = await getLoanLifecycleSettings();
        const freshDays = calculateOverdueDays({
          dueDate: loan.dueDate,
          now: new Date(),
          mode: settings.overdueDayCountMode,
        });
        const dailyRate = (parseFloat(loan.overdueFeePct) || 2) / 100;
        currentOverdueFee =
          Math.round(
            parseFloat(loan.remainingBalance || 0) * dailyRate * freshDays * 100,
          ) / 100;
      } else {
        loan.updateOverdueStatus();
        currentOverdueFee = parseFloat(loan.totalOverdueFee || 0);
      }
      const totalOwed = parseFloat(loan.remainingBalance) + currentOverdueFee;
      const amt = parseFloat(amount);

      if (paymentType === "full" && amt < totalOwed) {
        return res
          .status(400)
          .json({
            success: false,
            message: `Full payment requires GHS ${totalOwed.toFixed(2)}`,
            requiredAmount: totalOwed,
          });
      }
      if (paymentType === "partial" && amt >= totalOwed) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Partial payment must be less than total owed.",
            totalOwed,
          });
      }
      if (amt > totalOwed) {
        return res
          .status(400)
          .json({
            success: false,
            message: "Amount cannot exceed total owed.",
            totalOwed,
          });
      }

      const payment = await Payment.create({
        userId: req.user.id,
        loanId,
        amount: amt,
        paymentType,
        mobileMoneyProvider,
        mobileNumber,
        status: "pending",
        metadata: { userAgent: req.get("User-Agent"), ipAddress: req.ip },
      });

      const bridgeResult = await initiateBridgeCollection({
        payment,
        loan,
        req,
        user: req.user,
      });

      if (!bridgeResult.accepted) {
        return res.status(502).json({
          success: false,
          message: bridgeResult.responseMessage || "Payment gateway rejected request.",
          payment: {
            id: payment.id,
            transactionId: payment.transactionId,
            amount: payment.amount,
            status: "failed",
          },
          gateway: {
            code: bridgeResult.responseCode,
            httpStatus: bridgeResult.httpStatus,
          },
        });
      }

      res
        .status(201)
        .json({
          success: true,
          message: "Payment request sent. Awaiting mobile money confirmation.",
          payment: {
            id: payment.id,
            transactionId: payment.transactionId,
            amount: payment.amount,
            status: "processing",
          },
          gateway: {
            code: bridgeResult.responseCode,
            message: bridgeResult.responseMessage,
          },
        });
    } catch (error) {
      console.error("Initiate payment error:", error);
      res.status(500).json({ success: false, message: "Server error." });
    }
  },
);

// GET /api/payments/status/:paymentId
router.get("/status/:paymentId", auth, async (req, res) => {
  try {
    const payment = await Payment.findOne({
      where: { id: req.params.paymentId, userId: req.user.id },
      include: [
        {
          model: Loan,
          as: "Loan",
          attributes: ["remainingBalance", "totalAmount", "status"],
        },
      ],
    });
    if (!payment)
      return res
        .status(404)
        .json({ success: false, message: "Payment not found." });

    const shouldSync = String(req.query.sync || "").toLowerCase() === "true";
    if (
      shouldSync &&
      ["pending", "processing"].includes(payment.status)
    ) {
      try {
        await syncPaymentFromBridgeStatus(payment, req);
        await payment.reload({
          include: [
            {
              model: Loan,
              as: "Loan",
              attributes: ["remainingBalance", "totalAmount", "status"],
            },
          ],
        });
      } catch (syncError) {
        console.error("Bridge sync status error:", syncError.message);
      }
    }

    res.json({ success: true, payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/payments/webhook
router.post("/webhook", async (req, res) => {
  try {
    const payload = req.body || {};
    const transactionId = payload.transaction_id || payload.transactionId;
    const statusCode = String(payload.status || "");
    const statusMessage = payload.status_desc || payload.message || "Callback received";

    if (!transactionId) {
      return res.status(200).json({ success: true, message: "Missing transaction_id" });
    }

    const payment = await Payment.findOne({ where: { transactionId } });
    if (!payment) {
      return res.status(200).json({ success: true, message: "Payment not found" });
    }

    if (["completed", "failed", "cancelled"].includes(payment.status)) {
      await payment.update({
        gatewayResponse: {
          ...(payment.gatewayResponse || {}),
          lastCallback: payload,
          callbackStatusCode: statusCode,
          callbackReceivedAt: new Date().toISOString(),
        },
      });
      return res.status(200).json({ success: true, message: "Already processed" });
    }

    const callbackGatewayData = {
      ...(payment.gatewayResponse || {}),
      lastCallback: payload,
      callbackStatusCode: statusCode,
      callbackReceivedAt: new Date().toISOString(),
      responseCode: statusCode,
      responseMessage: statusMessage,
      rawResponse: payload,
      networkTransactionId: payload.network_transaction_id,
    };

    if (statusCode === BRIDGE_SUCCESS_CODE) {
      const loan = await Loan.findByPk(payment.loanId);
      if (loan) {
        await processSuccessfulPayment(payment, loan, null, {
          externalTransactionId: payload.network_transaction_id,
          gatewayResponse: callbackGatewayData,
        });
      }
    } else if (statusCode === BRIDGE_CANCELLED_CODE) {
      await payment.update({
        status: "cancelled",
        failedAt: new Date(),
        failureReason: statusMessage,
        gatewayResponse: callbackGatewayData,
      });
    } else if (statusCode === BRIDGE_FAILED_CODE) {
      await payment.markAsFailed(statusMessage, callbackGatewayData);
    } else if (statusCode === BRIDGE_PENDING_CODE) {
      await payment.update({
        status: "processing",
        gatewayResponse: callbackGatewayData,
      });
    } else {
      await payment.update({
        gatewayResponse: callbackGatewayData,
      });
    }

    return res.status(200).json({ success: true, message: "Callback processed" });
  } catch (error) {
    console.error("Bridge webhook processing error:", error);
    return res.status(200).json({ success: true, message: "Callback logged" });
  }
});

// GET /api/payments/history
router.get("/history", auth, async (req, res) => {
  try {
    const { loanId, status, page = 1, limit = 10 } = req.query;
    const where = { userId: req.user.id };
    if (loanId) where.loanId = loanId;
    if (status) where.status = status;

    const { count, rows } = await Payment.findAndCountAll({
      where,
      include: [
        {
          model: Loan,
          as: "Loan",
          attributes: ["amount", "totalAmount", "status"],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    res.json({
      success: true,
      payments: rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/payments/:paymentId/retry
router.post("/:paymentId/retry", auth, async (req, res) => {
  try {
    const payment = await Payment.findOne({
      where: {
        id: req.params.paymentId,
        userId: req.user.id,
        status: "failed",
      },
    });
    if (!payment)
      return res
        .status(404)
        .json({
          success: false,
          message: "Payment not found or cannot be retried.",
        });

    await payment.retry();

    const loan = await Loan.findByPk(payment.loanId);
    if (!loan) {
      return res
        .status(404)
        .json({ success: false, message: "Loan not found for this payment." });
    }

    const bridgeResult = await initiateBridgeCollection({
      payment,
      loan,
      req,
      user: req.user,
    });

    if (!bridgeResult.accepted) {
      return res.status(502).json({
        success: false,
        message: bridgeResult.responseMessage || "Payment retry failed at gateway.",
        gateway: {
          code: bridgeResult.responseCode,
          httpStatus: bridgeResult.httpStatus,
        },
      });
    }

    res.json({
      success: true,
      message: "Payment retry sent. Awaiting mobile money confirmation.",
      payment: {
        id: payment.id,
        transactionId: payment.transactionId,
        status: "processing",
      },
      gateway: {
        code: bridgeResult.responseCode,
        message: bridgeResult.responseMessage,
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// GET /api/payments/stats/summary
router.get("/stats/summary", auth, async (req, res) => {
  try {
    const rows = await Payment.findAll({
      where: { userId: req.user.id },
      attributes: [
        "status",
        [fn("COUNT", col("id")), "count"],
        [fn("SUM", col("amount")), "totalAmount"],
      ],
      group: ["status"],
      raw: true,
    });

    const summary = {
      totalPayments: 0,
      totalAmount: 0,
      successfulPayments: 0,
      failedPayments: 0,
      pendingPayments: 0,
    };
    rows.forEach((r) => {
      summary.totalPayments += parseInt(r.count);
      summary.totalAmount += parseFloat(r.totalAmount || 0);
      if (r.status === "completed")
        summary.successfulPayments += parseInt(r.count);
      else if (r.status === "failed")
        summary.failedPayments += parseInt(r.count);
      else if (["pending", "processing"].includes(r.status))
        summary.pendingPayments += parseInt(r.count);
    });

    res.json({ success: true, stats: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
