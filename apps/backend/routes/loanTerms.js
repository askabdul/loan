const express = require('express');
const { Op } = require('sequelize');
const { LoanTerm, Admin, User } = require('../models');
const { adminAuth, auth: userAuth } = require('../middleware/auth');
const { hasPermission } = require('../middleware/permissions');

const router = express.Router();

const termInclude = [
  { model: Admin, as: 'CreatedBy', attributes: ['id', 'email', 'firstName', 'lastName'], required: false },
  { model: Admin, as: 'LastUpdatedBy', attributes: ['id', 'email', 'firstName', 'lastName'], required: false },
];

// GET /api/loan-terms (public)
router.get('/', async (req, res) => {
  try {
    const terms = await LoanTerm.getEnabledTerms();
    res.json({ success: true, count: terms.length, data: terms });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to fetch loan terms' }); }
});

// GET /api/loan-terms/available (user)
router.get('/available', userAuth, async (req, res) => {
  try {
    const userLevel = req.user.currentLoanLevel || 1;
    const terms = await LoanTerm.getAvailableTermsForUser(req.user.id, userLevel);
    res.json({ success: true, count: terms.length, data: terms, userLevel });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to fetch available loan terms' }); }
});

// GET /api/loan-terms/level/:level (admin)
router.get('/level/:level', adminAuth, async (req, res) => {
  try {
    const level = parseInt(req.params.level);
    if (isNaN(level) || level < 1 || level > 15) return res.status(400).json({ success: false, message: 'Invalid level. Must be between 1 and 15' });
    const terms = await LoanTerm.getAvailableTermsForLevel(level);
    res.json({ success: true, count: terms.length, data: terms, level });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to fetch loan terms for level' }); }
});

// GET /api/loan-terms/admin (admin)
router.get('/admin', adminAuth, hasPermission('manageLoanTerms'), async (req, res) => {
  try {
    const { page = 1, limit = 10, enabled, level } = req.query;
    const where = { isActive: true };

    if (enabled !== undefined) where.enabled = enabled === 'true';
    if (level) {
      const levelNum = parseInt(level);
      if (!isNaN(levelNum)) {
        // levelRestrictions is an array; find terms where it's empty or contains this level
        where[Op.or] = [
          { levelRestrictions: [] },
          { levelRestrictions: { [Op.contains]: [levelNum] } },
        ];
      }
    }

    const { count, rows } = await LoanTerm.findAndCountAll({
      where,
      include: termInclude,
      order: [['sort_order', 'ASC'], ['duration_days', 'ASC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    res.json({ success: true, count: rows.length, total: count, pages: Math.ceil(count / parseInt(limit)), currentPage: parseInt(page), data: rows });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to fetch loan terms' }); }
});

// GET /api/loan-terms/:id (admin)
router.get('/:id', adminAuth, async (req, res) => {
  try {
    const term = await LoanTerm.findByPk(req.params.id, { include: termInclude });
    if (!term) return res.status(404).json({ success: false, message: 'Loan term not found' });
    res.json({ success: true, data: term });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to fetch loan term' }); }
});

// POST /api/loan-terms (admin)
router.post('/', adminAuth, hasPermission('manageLoanTerms'), async (req, res) => {
  try {
    const term = await LoanTerm.create({ ...req.body, createdById: req.admin.id, lastUpdatedById: req.admin.id });
    res.status(201).json({ success: true, message: 'Loan term created successfully', data: term });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') return res.status(400).json({ success: false, message: 'Loan term with this ID already exists' });
    if (err.name === 'SequelizeValidationError') return res.status(400).json({ success: false, message: 'Validation error', errors: err.errors.map(e => e.message) });
    res.status(500).json({ success: false, message: 'Failed to create loan term' });
  }
});

// PUT /api/loan-terms/:id
router.put('/:id', adminAuth, hasPermission('manageLoanTerms'), async (req, res) => {
  try {
    const term = await LoanTerm.findByPk(req.params.id);
    if (!term) return res.status(404).json({ success: false, message: 'Loan term not found' });
    await term.update({ ...req.body, lastUpdatedById: req.admin.id });
    const full = await LoanTerm.findByPk(term.id, { include: termInclude });
    res.json({ success: true, message: 'Loan term updated successfully', data: full });
  } catch (err) {
    if (err.name === 'SequelizeValidationError') return res.status(400).json({ success: false, message: 'Validation error', errors: err.errors.map(e => e.message) });
    res.status(500).json({ success: false, message: 'Failed to update loan term' });
  }
});

// PATCH /api/loan-terms/:id (partial update, same as PUT)
router.patch('/:id', adminAuth, hasPermission('manageLoanTerms'), async (req, res) => {
  try {
    const term = await LoanTerm.findByPk(req.params.id);
    if (!term) return res.status(404).json({ success: false, message: 'Loan term not found' });
    await term.update({ ...req.body, lastUpdatedById: req.admin.id });
    const full = await LoanTerm.findByPk(term.id, { include: termInclude });
    res.json({ success: true, message: 'Loan term updated successfully', data: full });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to update loan term' }); }
});

// PATCH /api/loan-terms/:id/toggle
router.patch('/:id/toggle', adminAuth, hasPermission('manageLoanTerms'), async (req, res) => {
  try {
    const term = await LoanTerm.findByPk(req.params.id);
    if (!term) return res.status(404).json({ success: false, message: 'Loan term not found' });
    await term.update({ enabled: !term.enabled, lastUpdatedById: req.admin.id });
    res.json({ success: true, message: `Loan term ${term.enabled ? 'enabled' : 'disabled'} successfully`, data: { id: term.id, enabled: term.enabled } });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to toggle loan term status' }); }
});

// PATCH /api/loan-terms/:id/users
router.patch('/:id/users', adminAuth, hasPermission('manageLoanTerms'), async (req, res) => {
  try {
    const { userIds, action = 'add' } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) return res.status(400).json({ success: false, message: 'User IDs array is required' });

    const term = await LoanTerm.findByPk(req.params.id);
    if (!term) return res.status(404).json({ success: false, message: 'Loan term not found' });

    let specificUsers = [...(term.specificUsers || [])];
    if (action === 'add') {
      specificUsers = [...new Set([...specificUsers, ...userIds])];
    } else if (action === 'remove') {
      specificUsers = specificUsers.filter(uid => !userIds.includes(uid));
    }

    await term.update({ specificUsers, lastUpdatedById: req.admin.id });
    res.json({ success: true, message: `Users ${action === 'add' ? 'assigned to' : 'removed from'} loan term successfully`, data: term });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to assign users to loan term' }); }
});

// PATCH /api/loan-terms/:id/levels
router.patch('/:id/levels', adminAuth, hasPermission('manageLoanTerms'), async (req, res) => {
  try {
    const { levels, action = 'set' } = req.body;
    if (!Array.isArray(levels)) return res.status(400).json({ success: false, message: 'Levels array is required' });
    const invalid = levels.filter(l => l < 1 || l > 15);
    if (invalid.length) return res.status(400).json({ success: false, message: 'All levels must be between 1 and 15' });

    const term = await LoanTerm.findByPk(req.params.id);
    if (!term) return res.status(404).json({ success: false, message: 'Loan term not found' });

    let levelRestrictions = [...(term.levelRestrictions || [])];
    if (action === 'set') levelRestrictions = levels;
    else if (action === 'add') levelRestrictions = [...new Set([...levelRestrictions, ...levels])];
    else if (action === 'remove') levelRestrictions = levelRestrictions.filter(l => !levels.includes(l));

    await term.update({ levelRestrictions, lastUpdatedById: req.admin.id });
    res.json({ success: true, message: 'Level restrictions updated successfully', data: { id: term.id, levelRestrictions: term.levelRestrictions } });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to update level restrictions' }); }
});

// DELETE /api/loan-terms/:id (soft delete)
router.delete('/:id', adminAuth, hasPermission('manageLoanTerms'), async (req, res) => {
  try {
    const term = await LoanTerm.findByPk(req.params.id);
    if (!term) return res.status(404).json({ success: false, message: 'Loan term not found' });
    await term.update({ isActive: false, enabled: false, lastUpdatedById: req.admin.id });
    res.json({ success: true, message: 'Loan term deleted successfully' });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to delete loan term' }); }
});

// PATCH /api/loan-terms/bulk-update
router.patch('/bulk-update', adminAuth, hasPermission('manageLoanTerms'), async (req, res) => {
  try {
    const { termIds, updates } = req.body;
    if (!Array.isArray(termIds) || termIds.length === 0) return res.status(400).json({ success: false, message: 'Term IDs array is required' });
    if (!updates || typeof updates !== 'object') return res.status(400).json({ success: false, message: 'Updates object is required' });

    const [count] = await LoanTerm.update({ ...updates, lastUpdatedById: req.admin.id }, { where: { id: { [Op.in]: termIds }, isActive: true } });
    res.json({ success: true, message: `Successfully updated ${count} loan terms`, modifiedCount: count });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to bulk update loan terms' }); }
});

// POST /api/loan-terms/initialize-defaults
router.post('/initialize-defaults', adminAuth, hasPermission('manageLoanTerms'), async (req, res) => {
  try {
    await LoanTerm.createDefaultTerms();
    res.json({ success: true, message: 'Default loan terms initialized successfully' });
  } catch (err) { res.status(500).json({ success: false, message: 'Failed to initialize default loan terms' }); }
});

module.exports = router;
