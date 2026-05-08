const express = require('express');
const { Op, fn, col, literal } = require('sequelize');
const { adminAuth, auth: userAuth } = require('../middleware/auth');
const { requireMenuAccess } = require('../middleware/roleAuth');
const websocketService = require('../services/websocketService');
const { Loan, User, Payment, Notification } = require('../models');
const catchAsync = require('../utils/catchAsync');

const router = express.Router();

// GET /api/realtime/admin/dashboard/live
router.get('/admin/dashboard/live', adminAuth, requireMenuAccess('dashboard'), catchAsync(async (req, res, next) => {
  const [loanStats, userStats, paymentStats] = await Promise.all([
    Loan.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('amount')), 'totalAmount']], group: ['status'], raw: true }),
    User.findAll({ attributes: [[fn('COUNT', col('id')), 'totalUsers'], [fn('SUM', literal("CASE WHEN is_active = true THEN 1 ELSE 0 END")), 'activeUsers']], raw: true }),
    Payment.findAll({ attributes: ['status', [fn('COUNT', col('id')), 'count'], [fn('SUM', col('amount')), 'totalAmount']], group: ['status'], raw: true }),
  ]);

  const data = { loanStats, userStats: userStats[0] || { totalUsers: 0, activeUsers: 0 }, paymentStats, timestamp: new Date() };
  websocketService.broadcastDashboardUpdate(data);
  res.json({ success: true, data });
}));

// GET /api/realtime/admin/loans/live
router.get('/admin/loans/live', adminAuth, requireMenuAccess('loanManagement'), catchAsync(async (req, res, next) => {
  const { page = 1, limit = 20, status } = req.query;
  const where = {};
  if (status) where.status = status;

  const { count, rows: loans } = await Loan.findAndCountAll({ where, include: [{ model: User, as: 'User', attributes: ['firstName', 'lastName', 'email'] }], order: [['created_at', 'DESC']], limit: parseInt(limit) * 1, offset: (parseInt(page) - 1) * parseInt(limit) });
  const pagination = { page: parseInt(page), limit: parseInt(limit), total: count, pages: Math.ceil(count / parseInt(limit)) };

  websocketService.broadcastLoanUpdate({ loans, pagination, timestamp: new Date() });
  res.json({ success: true, data: { loans, pagination, timestamp: new Date() } });
}));

// GET /api/realtime/admin/users/live
router.get('/admin/users/live', adminAuth, requireMenuAccess('userManagement'), catchAsync(async (req, res, next) => {
  const { page = 1, limit = 20, status, search } = req.query;
  const where = {};
  if (status) where.isActive = status === 'active';
  if (search) where[Op.or] = [{ firstName: { [Op.iLike]: `%${search}%` } }, { lastName: { [Op.iLike]: `%${search}%` } }, { email: { [Op.iLike]: `%${search}%` } }];

  const { count, rows: users } = await User.findAndCountAll({ where, order: [['created_at', 'DESC']], limit: parseInt(limit) * 1, offset: (parseInt(page) - 1) * parseInt(limit), attributes: ['id', 'firstName', 'lastName', 'email', 'isActive', 'registrationComplete', 'createdAt'] });
  const pagination = { page: parseInt(page), limit: parseInt(limit), total: count, pages: Math.ceil(count / parseInt(limit)) };

  websocketService.broadcastUserUpdate({ users, pagination, timestamp: new Date() });
  res.json({ success: true, data: { users, pagination, timestamp: new Date() } });
}));

// GET /api/realtime/user/notifications/live
router.get('/user/notifications/live', userAuth, catchAsync(async (req, res, next) => {
  const notifications = await Notification.findAll({
    where: { [Op.or]: [{ recipientUserId: req.user.id }, { isBroadcast: true }], isRead: false },
    order: [['created_at', 'DESC']], limit: 10,
  });

  websocketService.broadcastNotification(req.user.id, { notifications, unreadCount: notifications.length, timestamp: new Date() });
  res.json({ success: true, data: { notifications, unreadCount: notifications.length, timestamp: new Date() } });
}));

// GET /api/realtime/user/loans/live
router.get('/user/loans/live', userAuth, catchAsync(async (req, res, next) => {
  const loans = await Loan.findAll({ where: { userId: req.user.id }, order: [['created_at', 'DESC']] });
  websocketService.broadcastLoanUpdate({ userId: req.user.id, loans, timestamp: new Date() });
  res.json({ success: true, data: { loans, timestamp: new Date() } });
}));

// GET /api/realtime/user/payments/live
router.get('/user/payments/live', userAuth, catchAsync(async (req, res, next) => {
  const payments = await Payment.findAll({ where: { userId: req.user.id }, include: [{ model: Loan, as: 'Loan', attributes: ['amount', 'status'] }], order: [['created_at', 'DESC']] });
  websocketService.broadcastPaymentUpdate({ userId: req.user.id, payments, timestamp: new Date() });
  res.json({ success: true, data: { payments, timestamp: new Date() } });
}));

// GET /api/realtime/admin/search/live
router.get('/admin/search/live', adminAuth, catchAsync(async (req, res, next) => {
  const { q: query, type = 'all' } = req.query;
  if (!query || query.length < 2) return res.json({ success: true, data: { results: [], timestamp: new Date() } });

  const searchResults = {};
  const s = `%${query}%`;

  if (type === 'all' || type === 'users') {
    searchResults.users = await User.findAll({ where: { [Op.or]: [{ firstName: { [Op.iLike]: s } }, { lastName: { [Op.iLike]: s } }, { email: { [Op.iLike]: s } }] }, attributes: ['id', 'firstName', 'lastName', 'email', 'isActive'], limit: 10 });
  }
  if (type === 'all' || type === 'loans') {
    searchResults.loans = await Loan.findAll({ where: { [Op.or]: [{ loanId: { [Op.iLike]: s } }, { status: { [Op.iLike]: s } }] }, include: [{ model: User, as: 'User', attributes: ['firstName', 'lastName', 'email'] }], attributes: ['id', 'loanId', 'amount', 'status', 'createdAt'], limit: 10 });
  }
  if (type === 'all' || type === 'payments') {
    searchResults.payments = await Payment.findAll({ where: { [Op.or]: [{ transactionId: { [Op.iLike]: s } }, { status: { [Op.iLike]: s } }] }, include: [{ model: User, as: 'User', attributes: ['firstName', 'lastName'] }, { model: Loan, as: 'Loan', attributes: ['loanId', 'amount'] }], attributes: ['id', 'transactionId', 'amount', 'status', 'createdAt'], limit: 10 });
  }

  res.json({ success: true, data: { results: searchResults, query, timestamp: new Date() } });
}));

module.exports = router;
