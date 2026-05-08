const express = require('express');
const { Op } = require('sequelize');
const { LoanLevel, User } = require('../models');
const { adminAuth, auth } = require('../middleware/auth');

const router = express.Router();

// GET /api/loan-levels — public
router.get('/', async (req, res) => {
  try {
    const levels = await LoanLevel.findAll({ where: { isActive: true }, order: [['level', 'ASC']] });
    res.json({ status: 'success', results: levels.length, data: { levels } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/loan-levels/user/current — protected user
router.get('/user/current', auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    const currentLevel = await LoanLevel.getLevelByNumber(user.currentLoanLevel || 1);
    const nextLevel = await LoanLevel.getNextLevel(user.currentLoanLevel || 1);
    res.json({
      status: 'success',
      data: {
        currentLevel,
        nextLevel,
        totalLoansCompleted: user.totalLoansCompleted,
        totalAmountRepaid: user.totalAmountRepaid,
        progressionHistory: user.levelProgressionHistory,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/loan-levels/:level — public
router.get('/:level', async (req, res) => {
  try {
    const level = await LoanLevel.getLevelByNumber(parseInt(req.params.level));
    if (!level) return res.status(404).json({ success: false, message: 'Loan level not found.' });
    res.json({ status: 'success', data: { level } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/loan-levels — admin
router.post('/', adminAuth, async (req, res) => {
  try {
    const level = await LoanLevel.create(req.body);
    res.status(201).json({ status: 'success', data: { level } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PATCH /api/loan-levels/:id — admin
router.patch('/:id', adminAuth, async (req, res) => {
  try {
    const level = await LoanLevel.findByPk(req.params.id);
    if (!level) return res.status(404).json({ success: false, message: 'Loan level not found.' });
    await level.update(req.body);
    res.json({ status: 'success', data: { level } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PATCH /api/loan-levels/:id/terms — admin
router.patch('/:id/terms', adminAuth, async (req, res) => {
  try {
    const { availableTerms } = req.body;
    if (!Array.isArray(availableTerms)) return res.status(400).json({ success: false, message: 'availableTerms must be an array.' });
    const level = await LoanLevel.findByPk(req.params.id);
    if (!level) return res.status(404).json({ success: false, message: 'Loan level not found.' });
    await level.update({ availableTerms });
    res.json({ status: 'success', data: { level } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PATCH /api/loan-levels/:id/auto-approval — admin
router.patch('/:id/auto-approval', adminAuth, async (req, res) => {
  try {
    const { autoApproval } = req.body;
    if (!autoApproval || typeof autoApproval !== 'object') return res.status(400).json({ success: false, message: 'autoApproval must be an object.' });
    const level = await LoanLevel.findByPk(req.params.id);
    if (!level) return res.status(404).json({ success: false, message: 'Loan level not found.' });
    await level.update({ autoApproval });
    res.json({ status: 'success', data: { level } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// PATCH /api/loan-levels/user/:userId/level — admin
router.patch('/user/:userId/level', adminAuth, async (req, res) => {
  try {
    const { newLevel, reason, notes } = req.body;
    if (!newLevel) return res.status(400).json({ success: false, message: 'newLevel is required.' });

    const user = await User.findByPk(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    const oldLevel = user.currentLoanLevel;
    const history = [...(user.levelProgressionHistory || []), {
      fromLevel: oldLevel, toLevel: newLevel, reason, notes,
      changedBy: req.admin.id, changedAt: new Date(),
    }];
    await user.update({ currentLoanLevel: newLevel, levelProgressionHistory: history });

    res.json({ status: 'success', message: 'User level updated.', data: { userId: user.id, oldLevel, newLevel } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE /api/loan-levels/:id — admin (soft-delete)
router.delete('/:id', adminAuth, async (req, res) => {
  try {
    const level = await LoanLevel.findByPk(req.params.id);
    if (!level) return res.status(404).json({ success: false, message: 'Loan level not found.' });
    await level.update({ isActive: false });
    res.json({ status: 'success', message: 'Loan level deactivated.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
