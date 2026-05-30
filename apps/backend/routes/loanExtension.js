const express = require('express');
const multer = require('multer');
const path = require('path');
const { Op } = require('sequelize');
const { Loan, User } = require('../models');
const { auth, adminAuth } = require('../middleware/auth');
const websocketService = require('../services/websocketService');
const { getPlatformRuntimeSettings } = require('../services/loanLifecycleSettings');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/extensions/'),
  filename: (req, file, cb) => cb(null, `extension-${Date.now()}-${Math.round(Math.random()*1e9)}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5*1024*1024 }, fileFilter: (req, file, cb) => {
  if (/jpeg|jpg|png|pdf/.test(path.extname(file.originalname).toLowerCase())) return cb(null, true);
  cb(new Error('Only JPEG, PNG, and PDF files are allowed'));
}});

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getExtensionPolicy = async (loan) => {
  const settings = await getPlatformRuntimeSettings();
  const termLimit = Number(loan?.termInDays || 0);
  const configuredLimit = Number(settings.maxExtensionDaysPerRequest || 0);
  const maxDaysPerRequest = configuredLimit > 0
    ? Math.min(configuredLimit, termLimit || configuredLimit)
    : (termLimit || 30);

  return {
    dailyFeeRate: Number(settings.loanExtensionDailyFeeRate || 0),
    maxDaysPerRequest: Math.max(1, Math.floor(maxDaysPerRequest)),
    maxExtensionCount: Math.max(1, Math.floor(Number(settings.maxExtensionCount || 3))),
    maxOverdueDaysForExtension: Math.max(0, Math.floor(Number(settings.maxOverdueDaysForExtension || 30))),
  };
};

const calculateDaysPastDue = (loan) => {
  const dueDate = loan?.extendedDueDate || loan?.dueDate;
  if (!dueDate) return 0;
  const todayStart = startOfDay(new Date());
  const dueStart = startOfDay(dueDate);
  const diff = Math.floor((todayStart - dueStart) / (24 * 60 * 60 * 1000));
  return Math.max(0, diff);
};

// POST /api/loan-extension/submit
router.post('/submit', auth, upload.single('popFile'), async (req, res) => {
  try {
    const { loanId, extensionDays, reason } = req.body;
    if (!loanId || !extensionDays || !reason) return res.status(400).json({ success: false, message: 'Loan ID, extension days, and reason are required' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Proof of payment is required before extension can be requested' });

    const loan = await Loan.findByPk(loanId);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.userId !== req.user.id) return res.status(403).json({ success: false, message: 'Unauthorized access to loan' });
    if (loan.status !== 'active') return res.status(400).json({ success: false, message: 'Only active loans can be extended' });
    if (loan.extensionStatus === 'pending') return res.status(400).json({ success: false, message: 'There is already a pending extension request for this loan' });

    const extensionPolicy = await getExtensionPolicy(loan);
    if ((loan.extensionCount || 0) >= extensionPolicy.maxExtensionCount) {
      return res.status(400).json({ success: false, message: `Maximum extension limit reached (${extensionPolicy.maxExtensionCount} extensions)` });
    }

    const daysPastDue = calculateDaysPastDue(loan);
    if (daysPastDue > extensionPolicy.maxOverdueDaysForExtension) {
      return res.status(400).json({ success: false, message: `Loan is overdue by more than ${extensionPolicy.maxOverdueDaysForExtension} days` });
    }

    const requestedDays = parseInt(extensionDays);
    if (!Number.isInteger(requestedDays) || requestedDays < 1) {
      return res.status(400).json({ success: false, message: 'Extension days must be a positive integer' });
    }
    if (requestedDays > extensionPolicy.maxDaysPerRequest) {
      return res.status(400).json({ success: false, message: `Extension days cannot exceed ${extensionPolicy.maxDaysPerRequest} days` });
    }

    const extensionFee = parseFloat(loan.amount) * extensionPolicy.dailyFeeRate * requestedDays;
    const updates = { extensionDays: requestedDays, extensionFee, extensionReason: reason, extensionStatus: 'pending', extensionRequestDate: new Date(), extensionPopUrl: req.file.path };

    await loan.update(updates);

    websocketService.broadcastToAdmins('loan-extension-request', { loanId: loan.id, userId: req.user.id, extensionDays: requestedDays, extensionFee, reason, timestamp: new Date() });

    res.json({ success: true, message: 'Extension request submitted successfully', data: { extensionFee, extensionDays: requestedDays, status: 'pending', policy: extensionPolicy } });
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to submit extension request' }); }
});

// POST /api/loan-extension/calculate-fee
router.post('/calculate-fee', auth, async (req, res) => {
  try {
    const { loanId, extensionDays } = req.body;
    if (!loanId || !extensionDays) return res.status(400).json({ success: false, message: 'Loan ID and extension days are required' });

    const loan = await Loan.findByPk(loanId);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.userId !== req.user.id) return res.status(403).json({ success: false, message: 'Unauthorized access to loan' });

    const extensionPolicy = await getExtensionPolicy(loan);
    if ((loan.extensionCount || 0) >= extensionPolicy.maxExtensionCount) {
      return res.status(400).json({ success: false, message: `Maximum extension limit reached (${extensionPolicy.maxExtensionCount} extensions)` });
    }

    const daysPastDue = calculateDaysPastDue(loan);
    if (daysPastDue > extensionPolicy.maxOverdueDaysForExtension) {
      return res.status(400).json({ success: false, message: `Loan is overdue by more than ${extensionPolicy.maxOverdueDaysForExtension} days` });
    }

    const requestedDays = parseInt(extensionDays);
    if (!Number.isInteger(requestedDays) || requestedDays < 1) return res.status(400).json({ success: false, message: 'Extension days must be a positive integer' });
    if (requestedDays > extensionPolicy.maxDaysPerRequest) return res.status(400).json({ success: false, message: `Extension days cannot exceed ${extensionPolicy.maxDaysPerRequest} days` });

    const extensionFee = parseFloat(loan.amount) * extensionPolicy.dailyFeeRate * requestedDays;
    res.json({ success: true, data: { extensionFee, dailyRate: extensionPolicy.dailyFeeRate, loanAmount: loan.amount, extensionDays: requestedDays, policy: extensionPolicy } });
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to calculate extension fee' }); }
});

// GET /api/loan-extension/status/:loanId
router.get('/status/:loanId', auth, async (req, res) => {
  try {
    const loan = await Loan.findByPk(req.params.loanId);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.userId !== req.user.id) return res.status(403).json({ success: false, message: 'Unauthorized access to loan' });

    const extensionPolicy = await getExtensionPolicy(loan);

    res.json({ success: true, data: { extensionStatus: loan.extensionStatus || 'none', extensionDays: loan.extensionDays || 0, extensionFee: loan.extensionFee || 0, extensionReason: loan.extensionReason || '', extensionRequestDate: loan.extensionRequestDate || null, extensionApprovedDate: loan.extensionApprovedDate || null, extendedDueDate: loan.extendedDueDate || null, policy: extensionPolicy } });
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to get extension status' }); }
});

// GET /api/loan-extension/history/:loanId
router.get('/history/:loanId', auth, async (req, res) => {
  try {
    const loan = await Loan.findByPk(req.params.loanId);
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.userId !== req.user.id) return res.status(403).json({ success: false, message: 'Unauthorized access to loan' });

    const history = [];
    if (loan.extensionStatus && loan.extensionStatus !== 'none') {
      history.push({ status: loan.extensionStatus, days: loan.extensionDays, fee: loan.extensionFee, reason: loan.extensionReason, requestDate: loan.extensionRequestDate, approvedDate: loan.extensionApprovedDate, extendedDueDate: loan.extendedDueDate });
    }
    res.json({ success: true, data: history });
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to get extension history' }); }
});

// GET /api/loan-extension/search (admin)
router.get('/search', adminAuth, async (req, res) => {
  try {
    const { userId, loanId } = req.query;
    if (!userId || !loanId) return res.status(400).json({ success: false, message: 'Both User ID and Loan ID are required' });

    const user = await User.findByPk(userId, { attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber'] });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const loan = await Loan.findByPk(loanId, { include: [{ model: User, as: 'User', attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber'] }] });
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });

    if (loan.userId !== userId) return res.status(400).json({ success: false, message: 'Mismatch Error: This loan does not belong to the specified user.' });
    if (loan.status !== 'active') return res.status(400).json({ success: false, message: 'Only active loans can be extended' });

    const extensionPolicy = await getExtensionPolicy(loan);

    res.json({ success: true, data: { loan: { id: loan.id, loanId: loan.loanId, userId: loan.userId, amount: loan.amount, status: loan.status, dueDate: loan.dueDate, extensionStatus: loan.extensionStatus || 'none', extensionDays: loan.extensionDays || 0, extensionFee: loan.extensionFee || 0, extensionCount: loan.extensionCount || 0, termInDays: loan.termInDays || 0, user: loan.User }, policy: extensionPolicy } });
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to search loan' }); }
});

// GET /api/loan-extension/admin/recent
router.get('/admin/recent', adminAuth, async (req, res) => {
  try {
    const loans = await Loan.findAll({
      where: { extensionStatus: 'pending' },
      include: [{ model: User, as: 'User', attributes: ['firstName', 'lastName', 'email', 'phoneNumber'] }],
      order: [['extension_request_date', 'DESC']],
      limit: 50,
    });
    res.json({ success: true, data: loans });
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to get recent extensions' }); }
});

// PUT /api/loan-extension/admin/review/:loanId
router.put('/admin/review/:loanId', adminAuth, async (req, res) => {
  try {
    const { action, rejectionReason } = req.body;
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ success: false, message: 'Valid action (approve/reject) is required' });

    const loan = await Loan.findByPk(req.params.loanId, { include: [{ model: User, as: 'User', attributes: ['id', 'firstName', 'lastName', 'email'] }] });
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.extensionStatus !== 'pending') return res.status(400).json({ success: false, message: 'No pending extension request found' });

    if (action === 'approve') {
      if (!loan.extensionPopUrl) {
        return res.status(400).json({ success: false, message: 'Cannot approve extension without payment proof (POP)' });
      }
      const newDueDate = new Date(loan.dueDate);
      newDueDate.setDate(newDueDate.getDate() + loan.extensionDays);
      await loan.update({ extensionStatus: 'approved', extensionApprovedDate: new Date(), extendedDueDate: newDueDate, dueDate: newDueDate, extensionCount: (loan.extensionCount || 0) + 1 });
      websocketService.broadcastToUser(loan.userId, 'loan-extension-approved', { loanId: loan.id, extensionDays: loan.extensionDays, newDueDate, extensionFee: loan.extensionFee, timestamp: new Date() });
      res.json({ success: true, message: 'Extension request approved successfully', data: { newDueDate, extensionDays: loan.extensionDays, extensionFee: loan.extensionFee } });
    } else {
      await loan.update({ extensionStatus: 'rejected', extensionRejectionReason: rejectionReason || 'No reason provided', extensionRejectedDate: new Date() });
      websocketService.broadcastToUser(loan.userId, 'loan-extension-rejected', { loanId: loan.id, rejectionReason: loan.extensionRejectionReason, timestamp: new Date() });
      res.json({ success: true, message: 'Extension request rejected successfully', data: { rejectionReason: loan.extensionRejectionReason } });
    }
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to review extension request' }); }
});

// POST /api/loan-extension/admin-extend
router.post('/admin-extend', adminAuth, upload.single('popFile'), async (req, res) => {
  try {
    const { userId, loanId, extensionDays } = req.body;
    if (!userId || !loanId || !extensionDays) return res.status(400).json({ success: false, message: 'User ID, Loan ID, and extension days are required' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Proof of payment is required before admin extension' });

    const loan = await Loan.findByPk(loanId, { include: [{ model: User, as: 'User', attributes: ['id', 'firstName', 'lastName', 'email'] }] });
    if (!loan) return res.status(404).json({ success: false, message: 'Loan not found' });
    if (loan.userId !== userId) return res.status(403).json({ success: false, message: 'Loan does not belong to the specified user' });
    if (loan.status !== 'active') return res.status(400).json({ success: false, message: 'Only active loans can be extended' });

    const extensionPolicy = await getExtensionPolicy(loan);
    if ((loan.extensionCount || 0) >= extensionPolicy.maxExtensionCount) {
      return res.status(400).json({ success: false, message: `Maximum extension limit reached (${extensionPolicy.maxExtensionCount} extensions)` });
    }

    const daysPastDue = calculateDaysPastDue(loan);
    if (daysPastDue > extensionPolicy.maxOverdueDaysForExtension) {
      return res.status(400).json({ success: false, message: `Loan is overdue by more than ${extensionPolicy.maxOverdueDaysForExtension} days` });
    }

    const requestedDays = parseInt(extensionDays);
    if (!Number.isInteger(requestedDays) || requestedDays < 1) return res.status(400).json({ success: false, message: 'Extension days must be a positive integer' });
    if (requestedDays > extensionPolicy.maxDaysPerRequest) return res.status(400).json({ success: false, message: `Extension days cannot exceed ${extensionPolicy.maxDaysPerRequest} days` });

    const extensionFee = parseFloat(loan.amount) * extensionPolicy.dailyFeeRate * requestedDays;
    const newDueDate = new Date(loan.dueDate);
    newDueDate.setDate(newDueDate.getDate() + requestedDays);

    const updates = { extensionDays: requestedDays, extensionFee, extensionReason: 'Admin-initiated extension', extensionStatus: 'approved', extensionRequestDate: new Date(), extensionApprovedDate: new Date(), extendedDueDate: newDueDate, dueDate: newDueDate, extensionPopUrl: req.file.path, extensionCount: (loan.extensionCount || 0) + 1 };

    await loan.update(updates);
    websocketService.broadcastToUser(loan.userId, 'loan-extension-approved', { loanId: loan.id, extensionDays: requestedDays, newDueDate, extensionFee, adminInitiated: true, timestamp: new Date() });

    res.json({ success: true, message: 'Loan extended successfully by admin', data: { newDueDate, extensionDays: requestedDays, extensionFee, adminInitiated: true, policy: extensionPolicy } });
  } catch (error) { res.status(500).json({ success: false, message: 'Failed to extend loan' }); }
});

module.exports = router;
