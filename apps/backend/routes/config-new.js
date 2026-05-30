const express = require('express');
const router = express.Router();
const { AppConfig, LoanTerm } = require('../models');
const { adminAuth } = require('../middleware/auth');
const { Op } = require('sequelize');

const toConfigObject = (configs = []) => {
  const out = {};
  configs.forEach((c) => {
    out[c.key] = c.value;
  });
  return out;
};

const DEFAULT_BRANDING = {
  appName: 'CEDI Loan',
  tagline: '',
  description: '',
  companyName: '',
  logoUrl: '',
  version: '1.0.0',
};

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
      loanParams[`${term.durationDays}_days`] = {
        interestRate: Number(term.interestRate || 0),
        serviceFee: Number(term.serviceFeePct || 0),
        adminFee: Number(term.administrationFeePct || 0),
        commitmentFee: Number(term.commitmentFeePct || 0),
      };
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
    res.json({
      success: true,
      data: {
        interestRate: Number(loanTerm.interestRate || 0),
        serviceFee: Number(loanTerm.serviceFeePct || 0),
        adminFee: Number(loanTerm.administrationFeePct || 0),
        commitmentFee: Number(loanTerm.commitmentFeePct || 0),
      },
    });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to fetch loan calculation parameters' }); }
});

// GET /contact-info - public
router.get('/contact-info', async (req, res) => {
  try {
    const configs = await AppConfig.findAll({
      where: {
        key: {
          [Op.in]: [
            'support_phone',
            'support_email',
            'support_whatsapp',
            'office_address',
            'business_hours',
            'emergency_contact',
          ],
        },
        isActive: true,
      },
    });
    const map = toConfigObject(configs);
    res.json({
      success: true,
      data: {
        phone: map.support_phone || '',
        email: map.support_email || '',
        whatsapp: map.support_whatsapp || '',
        address: map.office_address || '',
        businessHours: map.business_hours || '',
        emergency: map.emergency_contact || '',
      },
    });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to fetch contact information' }); }
});

// GET /app-branding - public
router.get('/app-branding', async (req, res) => {
  try {
    const configs = await AppConfig.findAll({
      where: {
        key: {
          [Op.in]: [
            'app_name',
            'app_tagline',
            'app_description',
            'company_name',
            'company_logo_url',
            'app_version',
          ],
        },
        isActive: true,
      },
    });
    const map = toConfigObject(configs);
    res.json({
      success: true,
      data: {
        appName: map.app_name || DEFAULT_BRANDING.appName,
        tagline: map.app_tagline || DEFAULT_BRANDING.tagline,
        description: map.app_description || DEFAULT_BRANDING.description,
        companyName: map.company_name || DEFAULT_BRANDING.companyName,
        logoUrl: map.company_logo_url || DEFAULT_BRANDING.logoUrl,
        version: map.app_version || DEFAULT_BRANDING.version,
      },
    });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to fetch app branding information' }); }
});

// GET /loan-settings - public
router.get('/loan-settings', async (req, res) => {
  try {
    const configs = await AppConfig.findAll({
      where: {
        key: {
          [Op.in]: [
            'min_loan_amount',
            'max_loan_amount',
            'default_credit_limit',
            'auto_approval_limit',
            'loan_terms_available',
            'require_collateral',
            'min_credit_score',
            'processing_fee_flat',
            'processing_fee_percentage',
          ],
        },
        isActive: true,
      },
    });
    const map = toConfigObject(configs);
    res.json({
      success: true,
      data: {
        minAmount: Number(map.min_loan_amount || 0),
        maxAmount: Number(map.max_loan_amount || 0),
        defaultCreditLimit: Number(map.default_credit_limit || 0),
        autoApprovalLimit: Number(map.auto_approval_limit || 0),
        availableTerms: Array.isArray(map.loan_terms_available)
          ? map.loan_terms_available
          : [7, 14, 30],
        requireCollateral: Boolean(map.require_collateral),
        minCreditScore: Number(map.min_credit_score || 0),
        processingFeeFlat: Number(map.processing_fee_flat || 0),
        processingFeePercentage: Number(map.processing_fee_percentage || 0),
      },
    });
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
