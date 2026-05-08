const express = require('express');
const { Op, fn, col, literal } = require('sequelize');
const { body, validationResult } = require('express-validator');
const { Payment, Loan } = require('../models');
const { auth } = require('../middleware/auth');

const router = express.Router();

// ── Helper ────────────────────────────────────────────────────────────────────
async function processSuccessfulPayment(payment, loan, req = null) {
  await payment.markAsCompleted(`EXT-${Date.now()}`, { responseCode: 'SUCCESS', responseMessage: 'Payment completed' });

  const overdueFeePaid = Math.min(parseFloat(payment.amount), parseFloat(loan.totalOverdueFee) || 0);
  const principalPaid = parseFloat(payment.amount) - overdueFeePaid;

  const updates = {
    remainingBalance: Math.max(0, parseFloat(loan.remainingBalance) - principalPaid),
    totalPaid: parseFloat(loan.totalPaid || 0) + parseFloat(payment.amount),
    lastPaymentDate: new Date(),
  };

  if (overdueFeePaid > 0) {
    updates.totalOverdueFee = Math.max(0, parseFloat(loan.totalOverdueFee) - overdueFeePaid);
    if (updates.totalOverdueFee === 0) { updates.isOverdue = false; updates.overdueDays = 0; }
  }

  if (updates.remainingBalance === 0) {
    updates.status = 'completed';
    updates.completionDate = new Date();
  } else {
    updates.status = 'active';
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    updates.nextPaymentDate = next;
  }

  await loan.update(updates);

  const io = req ? req.app.get('io') : null;
  if (io) {
    io.to(`user-${payment.userId}`).emit('payment-received', {
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
router.post('/initiate', auth, [
  body('loanId').isUUID(),
  body('amount').isFloat({ min: 1 }),
  body('paymentType').isIn(['full', 'partial']),
  body('mobileMoneyProvider').isIn(['MTN', 'Hubtel', 'AirtelTigo']),
  body('mobileNumber').isMobilePhone(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { loanId, amount, paymentType, mobileMoneyProvider, mobileNumber } = req.body;

    const loan = await Loan.findOne({ where: { id: loanId, userId: req.user.id, status: { [Op.in]: ['approved', 'active'] } } });
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found or not eligible for payment.' });

    loan.updateOverdueStatus();
    const totalOwed = parseFloat(loan.remainingBalance) + parseFloat(loan.totalOverdueFee || 0);
    const amt = parseFloat(amount);

    if (paymentType === 'full' && amt < totalOwed) {
      return res.status(400).json({ success: false, message: `Full payment requires GHS ${totalOwed.toFixed(2)}`, requiredAmount: totalOwed });
    }
    if (paymentType === 'partial' && amt >= totalOwed) {
      return res.status(400).json({ success: false, message: 'Partial payment must be less than total owed.', totalOwed });
    }
    if (amt > totalOwed) {
      return res.status(400).json({ success: false, message: 'Amount cannot exceed total owed.', totalOwed });
    }

    const payment = await Payment.create({
      userId: req.user.id,
      loanId,
      amount: amt,
      paymentType,
      mobileMoneyProvider,
      mobileNumber,
      status: 'pending',
      metadata: { userAgent: req.get('User-Agent'), ipAddress: req.ip },
    });

    // Simulate async processing (replace with real mobile money SDK call)
    setTimeout(async () => {
      try {
        if (Math.random() > 0.1) {
          await processSuccessfulPayment(payment, loan, req);
        } else {
          await payment.markAsFailed('Payment failed at provider', { responseCode: 'FAILED' });
        }
      } catch (err) { console.error('Payment processing error:', err); }
    }, 2000);

    res.status(201).json({ success: true, message: 'Payment initiated.', payment: { id: payment.id, transactionId: payment.transactionId, amount: payment.amount, status: payment.status } });
  } catch (error) {
    console.error('Initiate payment error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/payments/status/:paymentId
router.get('/status/:paymentId', auth, async (req, res) => {
  try {
    const payment = await Payment.findOne({
      where: { id: req.params.paymentId, userId: req.user.id },
      include: [{ model: Loan, as: 'Loan', attributes: ['remainingBalance', 'totalAmount', 'status'] }],
    });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' });
    res.json({ success: true, payment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/payments/history
router.get('/history', auth, async (req, res) => {
  try {
    const { loanId, status, page = 1, limit = 10 } = req.query;
    const where = { userId: req.user.id };
    if (loanId) where.loanId = loanId;
    if (status) where.status = status;

    const { count, rows } = await Payment.findAndCountAll({
      where,
      include: [{ model: Loan, as: 'Loan', attributes: ['amount', 'totalAmount', 'status'] }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    res.json({ success: true, payments: rows, pagination: { page: parseInt(page), limit: parseInt(limit), total: count, pages: Math.ceil(count / parseInt(limit)) } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/payments/:paymentId/retry
router.post('/:paymentId/retry', auth, async (req, res) => {
  try {
    const payment = await Payment.findOne({ where: { id: req.params.paymentId, userId: req.user.id, status: 'failed' } });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found or cannot be retried.' });

    await payment.retry();

    setTimeout(async () => {
      try {
        const loan = await Loan.findByPk(payment.loanId);
        if (Math.random() > 0.3) {
          await processSuccessfulPayment(payment, loan);
        } else {
          await payment.markAsFailed('Retry failed', { responseCode: 'RETRY_FAILED' });
        }
      } catch (err) { console.error('Retry error:', err); }
    }, 1500);

    res.json({ success: true, message: 'Payment retry initiated.', payment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// GET /api/payments/stats/summary
router.get('/stats/summary', auth, async (req, res) => {
  try {
    const rows = await Payment.findAll({
      where: { userId: req.user.id },
      attributes: ['status', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('amount')), 'totalAmount']],
      group: ['status'],
      raw: true,
    });

    const summary = { totalPayments: 0, totalAmount: 0, successfulPayments: 0, failedPayments: 0, pendingPayments: 0 };
    rows.forEach((r) => {
      summary.totalPayments += parseInt(r.count);
      summary.totalAmount += parseFloat(r.totalAmount || 0);
      if (r.status === 'completed') summary.successfulPayments += parseInt(r.count);
      else if (r.status === 'failed') summary.failedPayments += parseInt(r.count);
      else if (['pending', 'processing'].includes(r.status)) summary.pendingPayments += parseInt(r.count);
    });

    res.json({ success: true, stats: summary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
