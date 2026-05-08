const express = require('express');
const { Content } = require('../models');
const { adminAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/content — public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { type } = req.query;
    const where = { isActive: true };
    if (type) where.type = type;
    const items = await Content.findAll({ where, order: [['order', 'ASC']] });
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/content/:key — public
router.get('/:key', async (req, res) => {
  try {
    const item = await Content.findOne({ where: { key: req.params.key, isActive: true } });
    if (!item) return res.status(404).json({ success: false, message: 'Content not found.' });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/content — admin
router.post('/', adminAuth, async (req, res) => {
  try {
    const item = await Content.create({ ...req.body, updatedById: req.admin.id });
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PUT /api/content/:key — admin
router.put('/:key', adminAuth, async (req, res) => {
  try {
    const item = await Content.updateContent(req.params.key, req.body, req.admin.id);
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/content/:key — admin (soft-delete)
router.delete('/:key', adminAuth, async (req, res) => {
  try {
    const item = await Content.findOne({ where: { key: req.params.key } });
    if (!item) return res.status(404).json({ success: false, message: 'Content not found.' });
    await item.update({ isActive: false, updatedById: req.admin.id });
    res.json({ success: true, message: 'Content deactivated.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
