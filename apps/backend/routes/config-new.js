const express = require('express');
const router = express.Router();
const { AppConfig, LoanTerm } = require('../models');
const { adminAuth } = require('../middleware/auth');
const { Op } = require('sequelize');
const { invalidateSettingsCache } = require('../services/loanLifecycleSettings');

// Keys whose changes should bust the backend lifecycle-settings cache immediately
const LIFECYCLE_KEYS = new Set([
  'auto_disburse_on_approval',
  'activate_loan_on_disbursement',
  'overdue_day_count_mode',
  'loan_extension_daily_fee_rate',
  'max_extension_days_per_request',
  'max_extension_count',
  'max_overdue_days_for_extension',
  'reserve_release_days',
  'dashboard_refresh_interval_seconds',
  'dashboard_cache_ttl_seconds',
]);

function maybeBustCache(key) {
  if (LIFECYCLE_KEYS.has(key)) invalidateSettingsCache();
}

// Fee-rate AppConfig keys → LoanTerm column mapping
// e.g. 'interest_rate_7_days' → { durationDays: 7, column: 'interestRate' }
const FEE_RATE_KEY_MAP = {
  interest_rate_7_days:    { durationDays: 7,  column: 'interestRate' },
  service_fee_7_days:      { durationDays: 7,  column: 'serviceFeePct' },
  admin_fee_7_days:        { durationDays: 7,  column: 'administrationFeePct' },
  commitment_fee_7_days:   { durationDays: 7,  column: 'commitmentFeePct' },
  interest_rate_14_days:   { durationDays: 14, column: 'interestRate' },
  service_fee_14_days:     { durationDays: 14, column: 'serviceFeePct' },
  admin_fee_14_days:       { durationDays: 14, column: 'administrationFeePct' },
  commitment_fee_14_days:  { durationDays: 14, column: 'commitmentFeePct' },
  interest_rate_30_days:   { durationDays: 30, column: 'interestRate' },
  service_fee_30_days:     { durationDays: 30, column: 'serviceFeePct' },
  admin_fee_30_days:       { durationDays: 30, column: 'administrationFeePct' },
  commitment_fee_30_days:  { durationDays: 30, column: 'commitmentFeePct' },
};

// After saving a fee-rate AppConfig key, mirror the value to the LoanTerm row
// so GET /loan-calculations/:termDays always reflects the latest admin setting.
async function syncFeeRateToLoanTerm(key, value) {
  const mapping = FEE_RATE_KEY_MAP[key];
  if (!mapping) return;
  try {
    const term = await LoanTerm.findOne({ where: { durationDays: mapping.durationDays } });
    if (term) {
      await term.update({ [mapping.column]: Number(value) });
    }
  } catch (err) {
    // Non-fatal — log but do not fail the config save
    console.error(`[config-new] Failed to sync ${key} to LoanTerm:`, err.message);
  }
}

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

// Helper: build rate object for a term — AppConfig takes priority, LoanTerm is fallback
async function getRatesForTerm(termNumber, loanTermRow) {
  const [irCfg, sfCfg, afCfg, cfCfg] = await Promise.all([
    AppConfig.getConfig(`interest_rate_${termNumber}_days`),
    AppConfig.getConfig(`service_fee_${termNumber}_days`),
    AppConfig.getConfig(`admin_fee_${termNumber}_days`),
    AppConfig.getConfig(`commitment_fee_${termNumber}_days`),
  ]);
  return {
    interestRate: irCfg ? Number(irCfg.value) : Number(loanTermRow?.interestRate || 0),
    serviceFee:   sfCfg ? Number(sfCfg.value) : Number(loanTermRow?.serviceFeePct || 0),
    adminFee:     afCfg ? Number(afCfg.value) : Number(loanTermRow?.administrationFeePct || 0),
    commitmentFee:cfCfg ? Number(cfCfg.value) : Number(loanTermRow?.commitmentFeePct || 0),
  };
}

// GET /loan-calculations - public
router.get('/loan-calculations', async (req, res) => {
  try {
    const loanTerms = await LoanTerm.getEnabledTerms();
    const loanParams = {};
    await Promise.all(loanTerms.map(async (term) => {
      loanParams[`${term.durationDays}_days`] = await getRatesForTerm(term.durationDays, term);
    }));
    res.json({ success: true, data: loanParams });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to fetch loan calculation parameters' }); }
});

// GET /loan-calculations/:termDays - public
router.get('/loan-calculations/:termDays', async (req, res) => {
  try {
    const termNumber = parseInt(req.params.termDays);
    const loanTerm = await LoanTerm.findOne({ where: { durationDays: termNumber, enabled: true } });
    if (!loanTerm) return res.status(404).json({ success: false, message: `Loan term for ${termNumber} days not found or not enabled` });
    const rates = await getRatesForTerm(termNumber, loanTerm);
    const upfrontCfg = await AppConfig.getConfig('upfront_deduction_pct').catch(() => null);
    rates.upfrontDeductionPct = upfrontCfg ? Number(upfrontCfg.value) : 20;
    res.json({ success: true, data: rates });
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
    maybeBustCache(req.params.key);
    await syncFeeRateToLoanTerm(req.params.key, value);
    const ws = require('../services/websocketService');
    ws.broadcastSystemConfigUpdate(req.params.key, value);
    res.json({ success: true, message: 'Configuration updated successfully', data: config });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to update configuration' }); }
});

// PUT /admin/bulk-update - admin
router.put('/admin/bulk-update', adminAuth, async (req, res) => {
  try {
    const { configs } = req.body;
    if (!configs || !Array.isArray(configs)) return res.status(400).json({ success: false, message: 'Configs array is required' });
    for (const c of configs) if (!c.key || c.value === undefined) return res.status(400).json({ success: false, message: 'Each config must have key and value' });

    const ws = require('../services/websocketService');
    let modified = 0;
    for (const c of configs) {
      await AppConfig.updateConfig(c.key, c.value, req.admin.id);
      maybeBustCache(c.key);
      await syncFeeRateToLoanTerm(c.key, c.value);
      ws.broadcastSystemConfigUpdate(c.key, c.value);
      modified++;
    }
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

    const ws = require('../services/websocketService');
    for (const u of updates) {
      await AppConfig.updateConfig(u.key, u.value, req.admin.id);
      maybeBustCache(u.key);
      ws.broadcastSystemConfigUpdate(u.key, u.value);
    }
    res.json({ success: true, message: `Successfully updated loan calculation parameters for ${termNumber} days`, data: { modifiedCount: updates.length } });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to update loan calculation parameters' }); }
});

module.exports = router;
