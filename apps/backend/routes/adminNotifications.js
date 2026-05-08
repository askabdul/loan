const express = require('express');
const { body, validationResult } = require('express-validator');
const { Op, fn, col, literal } = require('sequelize');
const { sequelize } = require('../config/database');
const { Notification, User, Admin } = require('../models');
const { adminAuth } = require('../middleware/auth');
const { requireMenuAccess, requireActionPermission, requireDataAccess } = require('../middleware/roleAuth');

const router = express.Router();
router.use(adminAuth);

const notifInclude = [
  { model: User, as: 'RecipientUser', attributes: ['firstName', 'lastName', 'email'], required: false },
  { model: Admin, as: 'RecipientAdmin', attributes: ['firstName', 'lastName', 'email'], required: false },
  { model: Admin, as: 'CreatedBy', attributes: ['firstName', 'lastName', 'email'], required: false },
];

// GET /api/admin/notifications
router.get('/',
  requireMenuAccess('notificationManagement'),
  requireDataAccess('notifications'),
  async (req, res) => {
    try {
      const { page = 1, limit = 20, type, priority, isRead, recipient, search } = req.query;
      const where = {};

      if (type) where.type = type;
      if (priority) where.priority = priority;
      if (isRead !== undefined) where.isRead = isRead === 'true';
      if (recipient === 'broadcast') where.isBroadcast = true;
      if (recipient === 'users') where.recipientUserId = { [Op.ne]: null };
      if (recipient === 'admins') where.recipientAdminId = { [Op.ne]: null };
      if (search) where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { message: { [Op.iLike]: `%${search}%` } },
      ];

      const { count, rows } = await Notification.findAndCountAll({
        where,
        include: notifInclude,
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
      });

      res.json({ success: true, data: rows, pagination: { current: parseInt(page), total: Math.ceil(count / parseInt(limit)), count } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  }
);

// POST /api/admin/notifications
router.post('/',
  requireMenuAccess('notificationManagement'),
  requireActionPermission('createNotification'),
  [
    body('title').notEmpty(),
    body('message').notEmpty(),
    body('type').isIn(['info', 'success', 'warning', 'error', 'loan_status', 'payment', 'system']),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
    body('recipient').isObject(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

      const { title, message, type, priority, recipient, data, expiresAt } = req.body;

      const notif = await Notification.create({
        title,
        message,
        type: type || 'info',
        priority: priority || 'medium',
        recipientUserId: recipient.userId || null,
        recipientAdminId: recipient.adminId || null,
        recipientRole: recipient.role || null,
        isBroadcast: !!recipient.broadcast,
        data,
        createdById: req.admin.id,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      const full = await Notification.findByPk(notif.id, { include: notifInclude });
      res.status(201).json({ success: true, message: 'Notification created and sent successfully', data: full });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  }
);

// GET /api/admin/notifications/stats
router.get('/stats',
  requireMenuAccess('notificationManagement'),
  requireDataAccess('notifications'),
  async (req, res) => {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const [typeStats, priorityStats, readStats, recentActivity] = await Promise.all([
        Notification.findAll({ attributes: ['type', [fn('COUNT', col('id')), 'count']], group: ['type'], raw: true }),
        Notification.findAll({ attributes: ['priority', [fn('COUNT', col('id')), 'count']], group: ['priority'], raw: true }),
        Notification.findAll({ attributes: ['is_read', [fn('COUNT', col('id')), 'count']], group: ['is_read'], raw: true }),
        Notification.findAll({
          where: { createdAt: { [Op.gte]: sevenDaysAgo } },
          attributes: [
            [fn('DATE', col('created_at')), 'date'],
            [fn('COUNT', col('id')), 'count'],
          ],
          group: [fn('DATE', col('created_at'))],
          order: [[fn('DATE', col('created_at')), 'ASC']],
          raw: true,
        }),
      ]);
      res.json({ success: true, data: { typeStats, priorityStats, readStats, recentActivity } });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  }
);

// GET /api/admin/notifications/:id
router.get('/:id',
  requireMenuAccess('notificationManagement'),
  requireDataAccess('notifications'),
  async (req, res) => {
    try {
      const notif = await Notification.findByPk(req.params.id, { include: notifInclude });
      if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });
      res.json({ success: true, data: notif });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  }
);

// PUT /api/admin/notifications/:id
router.put('/:id',
  requireMenuAccess('notificationManagement'),
  requireActionPermission('updateNotification'),
  [
    body('title').optional().notEmpty(),
    body('message').optional().notEmpty(),
    body('type').optional().isIn(['info', 'success', 'warning', 'error', 'loan_status', 'payment', 'system']),
    body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

      const notif = await Notification.findByPk(req.params.id);
      if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });

      await notif.update(req.body);
      const full = await Notification.findByPk(notif.id, { include: notifInclude });
      res.json({ success: true, message: 'Notification updated successfully', data: full });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  }
);

// DELETE /api/admin/notifications/:id
router.delete('/:id',
  requireMenuAccess('notificationManagement'),
  requireActionPermission('deleteNotification'),
  async (req, res) => {
    try {
      const notif = await Notification.findByPk(req.params.id);
      if (!notif) return res.status(404).json({ success: false, message: 'Notification not found' });
      await notif.destroy();
      res.json({ success: true, message: 'Notification deleted successfully' });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  }
);

// POST /api/admin/notifications/broadcast
router.post('/broadcast',
  requireMenuAccess('notificationManagement'),
  requireActionPermission('broadcastNotification'),
  [body('title').notEmpty(), body('message').notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

      const { title, message, type, priority, data, expiresAt } = req.body;
      const notif = await Notification.create({
        title, message, type: type || 'system', priority: priority || 'medium',
        isBroadcast: true, data, createdById: req.admin.id,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });
      res.status(201).json({ success: true, message: 'Broadcast notification sent successfully', data: notif });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  }
);

module.exports = router;
