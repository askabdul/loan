const express = require("express");
const { Op } = require("sequelize");
const { Notification, AppConfig } = require("../models");
const { auth, adminAuth } = require("../middleware/auth");

const router = express.Router();

// GET /api/notifications — user's notifications
router.get("/", auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, isRead } = req.query;
    const where = { recipientUserId: req.user.id };

    if (isRead !== undefined) where.isRead = isRead === "true";

    // Exclude expired notifications
    where[Op.or] = [
      { expiresAt: null },
      { expiresAt: { [Op.gt]: new Date() } },
    ];

    const { count, rows } = await Notification.findAndCountAll({
      where,
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });
    res.json({ success: true, total: count, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/notifications/unread-count
router.get("/unread-count", auth, async (req, res) => {
  try {
    const count = await Notification.count({
      where: { recipientUserId: req.user.id, isRead: false },
    });
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/notifications/read-all  (also support PUT for legacy)
const markAllRead = async (req, res) => {
  try {
    await Notification.update(
      { isRead: true, readAt: new Date() },
      { where: { recipientUserId: req.user.id, isRead: false } },
    );
    res.json({ success: true, message: "All notifications marked as read." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
router.patch("/read-all", auth, markAllRead);
router.put("/read-all", auth, markAllRead);

// PUT /api/notifications/:id/read
router.put("/:id/read", auth, async (req, res) => {
  try {
    const notif = await Notification.findOne({
      where: { id: req.params.id, recipientUserId: req.user.id },
    });
    if (!notif)
      return res
        .status(404)
        .json({ success: false, message: "Notification not found." });
    await notif.update({ isRead: true, readAt: new Date() });
    res.json({ success: true, data: notif });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/notifications/logs — admin only, delivery log
router.get("/logs", adminAuth, async (req, res) => {
  try {
    const { limit = 100, type, status } = req.query;
    const where = {};
    if (type) where.type = type;
    if (status === "read") where.isRead = true;
    if (status === "unread") where.isRead = false;

    const logs = await Notification.findAll({
      where,
      order: [["created_at", "DESC"]],
      limit: parseInt(limit),
    });
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/notifications/templates/:type — update notification template text
router.patch("/templates/:type", adminAuth, async (req, res) => {
  try {
    const { type } = req.params;
    const { smsTemplate, emailTemplate } = req.body;

    const key = `notification_template_${type}`;
    await AppConfig.updateConfig(
      key,
      { smsTemplate, emailTemplate },
      req.admin.id,
    );

    res.json({ success: true, message: "Template updated." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/notifications/broadcast — admin marketing broadcast (stub; full in marketing route)
router.post("/broadcast", adminAuth, async (req, res) => {
  try {
    const {
      recipientRole,
      message,
      type = "broadcast",
      isBroadcast = true,
    } = req.body;

    await Notification.create({
      recipientRole: recipientRole || null,
      isBroadcast,
      type,
      message,
      priority: req.body.priority || "normal",
      isRead: false,
    });

    res.json({ success: true, message: "Broadcast notification sent." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
