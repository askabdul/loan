const express = require('express');
const { AppConfig } = require('../models');
const { adminAuth, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/config — public configs
router.get('/', optionalAuth, async (req, res) => {
  try {
    const where = { isActive: true };
    if (!req.admin) where.isPublic = true;   // non-admins only see public configs
    const configs = await AppConfig.findAll({ where });
    const result = {};
    configs.forEach((c) => { result[c.key] = c.value; });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/config/:key — single config
router.get('/:key', async (req, res) => {
  try {
    const config = await AppConfig.getConfig(req.params.key);
    if (!config) return res.status(404).json({ success: false, message: 'Config not found.' });
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/config/:key — admin upsert
router.put('/:key', adminAuth, async (req, res) => {
  try {
    const config = await AppConfig.updateConfig(req.params.key, req.body.value, req.admin.id);
    res.json({ success: true, data: config });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/config/:key — admin (soft-delete)
router.delete('/:key', adminAuth, async (req, res) => {
  try {
    const config = await AppConfig.findOne({ where: { key: req.params.key } });
    if (!config) return res.status(404).json({ success: false, message: 'Config not found.' });
    await config.update({ isActive: false, updatedById: req.admin.id });
    res.json({ success: true, message: 'Config removed.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
