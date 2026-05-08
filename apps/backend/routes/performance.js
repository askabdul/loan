const express = require('express');
const { adminAuth } = require('../middleware/auth');
const performanceTrackingService = require('../services/performanceTrackingService');

const router = express.Router();

router.get('/rankings', adminAuth, async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;
    const rankings = await performanceTrackingService.getPerformanceRankings({ startDate: startDate ? new Date(startDate) : undefined, endDate: endDate ? new Date(endDate) : undefined, type });
    res.json({ success: true, rankings });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error while fetching performance rankings' }); }
});

router.get('/officer/:officerId', adminAuth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const performance = await performanceTrackingService.getOfficerPerformance(req.params.officerId, { startDate: startDate ? new Date(startDate) : undefined, endDate: endDate ? new Date(endDate) : undefined });
    res.json({ success: true, performance });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error while fetching officer performance' }); }
});

router.get('/daily-collections', adminAuth, async (req, res) => {
  try {
    const collections = await performanceTrackingService.getDailyCollections(req.query.date ? new Date(req.query.date) : new Date());
    res.json({ success: true, collections });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error while fetching daily collections' }); }
});

router.get('/weekly-rankings', adminAuth, async (req, res) => {
  try {
    let start, end;
    if (req.query.startDate && req.query.endDate) {
      start = new Date(req.query.startDate); end = new Date(req.query.endDate);
    } else {
      const now = new Date();
      start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0,0,0,0);
      end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
    }
    const rankings = await performanceTrackingService.getPerformanceRankings({ startDate: start, endDate: end });
    res.json({ success: true, rankings, period: { startDate: start, endDate: end } });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error while fetching weekly rankings' }); }
});

router.post('/reset', adminAuth, async (req, res) => {
  try {
    if (req.admin.Role?.name !== 'super-admin') return res.status(403).json({ success: false, message: 'Only super admin can reset performance metrics' });
    await performanceTrackingService.resetMetrics();
    res.json({ success: true, message: 'Performance metrics reset successfully' });
  } catch (err) { res.status(500).json({ success: false, message: 'Server error while resetting performance metrics' }); }
});

module.exports = router;
