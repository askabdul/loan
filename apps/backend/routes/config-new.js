const express = require('express');
const router = express.Router();
const { AppConfig, LoanTerm } = require('../models');
const { adminAuth } = require('../middleware/auth');
const { Op } = require('sequelize');

// GET / - public
router.get('/', async (req, res) => {
  try {
    const configs = await AppConfig.findAll({
      where: { isPublic: true, isActive: true },
    });
    const configObject = {};
    configs.forEach(c => { configObject[c.key] = c.value; });
    res.json({ success: true, data: configObject });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to fetch app configurations' }); }
});

// GET /loan-calculations - public
router.get('/loan-calculations', async (req, res) => {
  try {
    const loanTerms = await LoanTerm.getEnabledTerms();
    const loanParams = {};
    loanTerms.forEach(term => {
      loanParams[`${term.durationDays}_days`] = { interestRate: term.interestRate || 0, serviceFee: term.serviceFeeRate || 0, adminFee: term.processingFeeRate || 0, commitmentFee: term.commitmentFeeRate || 0 };
    });
    res.json({ success: true, data: loanParams });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to fetch loan calculation parameters' }); }
});

// GET /loan-calculations/:termDays - public
router.get('/loan-calculations/:termDays', async (req, res) => {
  try {
    const termNumber = parseInt(req.params.termDays);
    const loanTerm = await LoanTerm.findOne({ where: { durationDays: termNumber, enabled: true } });
    if (!loanTerm) return res.status(404).json({ success: false, message: `Loan term for ${termNumber} days not found or not enabled` });
    res.json({ success: true, data: { interestRate: loanTerm.interestRate || 0, serviceFee: loanTerm.serviceFeeRate || 0, adminFee: loanTerm.processingFeeRate || 0, commitmentFee: loanTerm.commitmentFeeRate || 0 } });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to fetch loan calculation parameters' }); }
});

// GET /contact-info - public
router.get('/contact-info', async (req, res) => {
  try {
    const config = await AppConfig.getConfig('contact_info');
    res.json({ success: true, data: config?.value || {} });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to fetch contact information' }); }
});

// GET /app-branding - public
router.get('/app-branding', async (req, res) => {
  try {
    const config = await AppConfig.getConfig('app_branding');
    res.json({ success: true, data: config?.value || {} });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to fetch app branding information' }); }
});

// GET /loan-settings - public
router.get('/loan-settings', async (req, res) => {
  try {
    const config = await AppConfig.getConfig('loan_settings');
    res.json({ success: true, data: config?.value || {} });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to fetch loan settings' }); }
});

// GET /admin/all - admin
router.get('/admin/all', adminAuth, async (req, res) => {
  try {
    const configs = await AppConfig.findAll({ order: [['key', 'ASC']] });
    res.json({ success: true, data: configs });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to fetch configurations' }); }
});

// GET /:key - public (must come AFTER specific paths above)
router.get('/:key', async (req, res) => {
  try {
    const config = await AppConfig.getConfig(req.params.key);
    if (!config) return res.status(404).json({ success: false, message: 'Configuration not found' });
    res.json({ success: true, data: config });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to fetch configuration' }); }
});

// PUT /:key - admin
router.put('/:key', adminAuth, async (req, res) => {
  try {
    const { value } = req.body;
    if (value === undefined) return res.status(400).json({ success: false, message: 'Value is required' });
    const config = await AppConfig.updateConfig(req.params.key, value, req.admin.id);
    res.json({ success: true, message: 'Configuration updated successfully', data: config });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to update configuration' }); }
});

// PUT /admin/bulk-update - admin
router.put('/admin/bulk-update', adminAuth, async (req, res) => {
  try {
    const { configs } = req.body;
    if (!configs || !Array.isArray(configs)) return res.status(400).json({ success: false, message: 'Configs array is required' });
    for (const c of configs) if (!c.key || c.value === undefined) return res.status(400).json({ success: false, message: 'Each config must have key and value' });

    let modified = 0;
    for (const c of configs) { await AppConfig.updateConfig(c.key, c.value, req.admin.id); modified++; }
    res.json({ success: true, message: `Successfully updated ${modified} configurations`, data: { modifiedCount: modified } });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to bulk update configurations' }); }
});

// PUT /admin/loan-calculations/:termDays - admin
router.put('/admin/loan-calculations/:termDays', adminAuth, async (req, res) => {
  try {
    const termNumber = parseInt(req.params.termDays);
    if (![7, 14, 30].includes(termNumber)) return res.status(400).json({ success: false, message: 'Invalid term. Must be 7, 14, or 30 days' });

    const { interestRate, serviceFee, adminFee, commitmentFee } = req.body;
    const updates = [];
    if (interestRate !== undefined) updates.push({ key: `interest_rate_${termNumber}_days`, value: interestRate });
    if (serviceFee !== undefined) updates.push({ key: `service_fee_${termNumber}_days`, value: serviceFee });
    if (adminFee !== undefined) updates.push({ key: `admin_fee_${termNumber}_days`, value: adminFee });
    if (commitmentFee !== undefined) updates.push({ key: `commitment_fee_${termNumber}_days`, value: commitmentFee });

    if (updates.length === 0) return res.status(400).json({ success: false, message: 'At least one parameter must be provided' });

    for (const u of updates) await AppConfig.updateConfig(u.key, u.value, req.admin.id);
    res.json({ success: true, message: `Successfully updated loan calculation parameters for ${termNumber} days`, data: { modifiedCount: updates.length } });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to update loan calculation parameters' }); }
});

module.exports = router;
