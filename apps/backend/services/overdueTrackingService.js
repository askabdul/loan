const { Op } = require('sequelize');
const websocketService = require('./websocketService');
const {
  getLoanLifecycleSettings,
  calculateOverdueDays,
} = require('./loanLifecycleSettings');

const getModels = () => require('../models');

class OverdueTrackingService {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.checkInterval = 60 * 60 * 1000; // 1 hour
  }

  start() {
    if (this.isRunning) {
      console.log('⚠️ Overdue tracking service is already running');
      return;
    }
    console.log('🚀 Starting overdue tracking service...');
    this.isRunning = true;
    this.checkOverdueLoans();
    this.updateExistingOverdueLoans();
    this.checkPreCollectionEntry();
    this.intervalId = setInterval(() => {
      this.checkOverdueLoans();
      this.updateExistingOverdueLoans();
      this.checkPreCollectionEntry();
    }, this.checkInterval);
    console.log(`✅ Overdue tracking service started - checking every ${this.checkInterval / 1000 / 60} minutes`);
  }

  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Overdue tracking service is not running');
      return;
    }
    console.log('🛑 Stopping overdue tracking service...');
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    this.isRunning = false;
    console.log('✅ Overdue tracking service stopped');
  }

  async checkOverdueLoans() {
    try {
      console.log('🔍 Checking for overdue loans...');
      const { Loan, User } = getModels();
      const now = new Date();
      const loanLifecycleSettings = await getLoanLifecycleSettings();

      const overdueLoans = await Loan.findAll({
        where: { status: 'active', dueDate: { [Op.lte]: now }, isOverdue: false },
        include: [{ model: User, as: 'User', attributes: ['id', 'firstName', 'lastName', 'email', 'phoneNumber'] }],
      });

      if (overdueLoans.length === 0) {
        console.log('✅ No new overdue loans found');
        return;
      }

      console.log(`📋 Found ${overdueLoans.length} loans that are now overdue`);

      const results = await Promise.all(overdueLoans.map(async (loan) => {
        const overdueDays = calculateOverdueDays({
          dueDate: loan.dueDate,
          now,
          mode: loanLifecycleSettings.overdueDayCountMode,
        });
        const overdueAmount = this.calculateOverdueAmount(loan, overdueDays);

        // Enter the collection queue when going overdue for the first time
        const collectionUpdate = {
          status: 'overdue',
          isOverdue: true,
          overdueDays,
          overdueAmount,
        };
        if (!loan.collectionStatus) {
          collectionUpdate.collectionStatus = 'pending-assignment';
        }
        // Exit pre-collection queue since loan is now overdue
        if (loan.precollectionStatus && loan.precollectionStatus !== 'completed') {
          collectionUpdate.precollectionStatus = 'completed';
        }
        await loan.update(collectionUpdate);

        console.log(`📊 Loan ${loan.loanId} marked as overdue - ${overdueDays} days, penalty: GHS ${overdueAmount.toFixed(2)}`);

        if (websocketService && loan.User) {
          websocketService.sendToUser(loan.User.id, 'loan-overdue', {
            loanId: loan.id,
            loanNumber: loan.loanId,
            overdueDays,
            overdueAmount,
            remainingBalance: loan.remainingBalance,
            message: `Your loan ${loan.loanId} is now ${overdueDays} day(s) overdue. Please make a payment to avoid additional penalties.`,
          });
        }

        return {
          loanId: loan.loanId,
          userId: loan.User?.id,
          userName: loan.User ? `${loan.User.firstName || ''} ${loan.User.lastName || ''}`.trim() : '',
          overdueDays,
          overdueAmount,
          remainingBalance: loan.remainingBalance,
        };
      }));

      if (websocketService) {
        websocketService.broadcastToAdmins('overdue-loans-updated', { newOverdueLoans: results, totalOverdueCount: results.length, timestamp: now });
      }

      console.log(`✅ Successfully processed ${results.length} overdue loans`);
    } catch (error) {
      console.error('❌ Error checking overdue loans:', error);
    }
  }

  // Ensure active loans are in the pre-collection queue.
  // Two cases handled:
  //   1. Loans with null precollectionStatus (old rows before the column existed) → backfill
  //   2. Active loans within the 7-day advance window that haven't been queued yet
  async checkPreCollectionEntry() {
    try {
      const { Loan } = getModels();
      const windowDays = 7;
      const now = new Date();
      const windowEnd = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);

      // Case 1: active loans with null precollectionStatus (DB backfill for old rows)
      const nullStatusLoans = await Loan.findAll({
        where: {
          status: 'active',
          precollectionStatus: null,
        },
      });

      // Case 2: active loans within the advance window not yet queued
      const windowLoans = await Loan.findAll({
        where: {
          status: 'active',
          dueDate: { [Op.lte]: windowEnd },
          precollectionStatus: null,
        },
      });

      // Merge both sets by ID (avoid duplicates)
      const seen = new Set();
      const toQueue = [...nullStatusLoans, ...windowLoans].filter((l) => {
        if (seen.has(l.id)) return false;
        seen.add(l.id);
        return true;
      });

      if (toQueue.length === 0) return;

      await Promise.all(
        toQueue.map((loan) => loan.update({ precollectionStatus: 'pending-assignment' })),
      );

      console.log(`📋 Placed ${toQueue.length} loan(s) into pre-collection pending queue`);

      if (websocketService) {
        websocketService.broadcastToAdmins('precollection-queue-updated', {
          count: toQueue.length,
          timestamp: now,
        });
      }
    } catch (error) {
      console.error('❌ Error checking pre-collection entry:', error);
    }
  }

  calculateOverdueAmount(loan, overdueDays) {
    // Simple interest: rate per day on current remaining balance
    // Rate baked into loan at creation (overdueFeePct), fallback to 2%
    const dailyRate = (parseFloat(loan.overdueFeePct) || 2) / 100;
    const dailyCharge = parseFloat(loan.remainingBalance || 0) * dailyRate;
    return Math.round(dailyCharge * overdueDays * 100) / 100;
  }

  async updateExistingOverdueLoans() {
    try {
      console.log('🔄 Updating existing overdue loans...');
      const { Loan } = getModels();
      const now = new Date();
      const loanLifecycleSettings = await getLoanLifecycleSettings();

      // Backfill null collectionStatus on overdue loans (DB rows from before column existed)
      await Loan.update(
        { collectionStatus: 'pending-assignment' },
        { where: { status: 'overdue', collectionStatus: null } },
      );

      const existingOverdueLoans = await Loan.findAll({ where: { status: 'overdue', isOverdue: true } });

      if (existingOverdueLoans.length === 0) {
        console.log('✅ No existing overdue loans to update');
        return;
      }

      const results = await Promise.all(existingOverdueLoans.map(async (loan) => {
        const overdueDays = calculateOverdueDays({
          dueDate: loan.dueDate,
          now,
          mode: loanLifecycleSettings.overdueDayCountMode,
        });
        const overdueAmount = this.calculateOverdueAmount(loan, overdueDays);
        await loan.update({ overdueDays, overdueAmount, totalOverdueFee: overdueAmount });
        return { loanId: loan.loanId, overdueDays, overdueAmount };
      }));

      console.log(`✅ Updated ${results.length} existing overdue loans`);
    } catch (error) {
      console.error('❌ Error updating existing overdue loans:', error);
    }
  }

  getStatus() {
    return { isRunning: this.isRunning, checkInterval: this.checkInterval, nextCheck: this.intervalId ? new Date(Date.now() + this.checkInterval) : null };
  }

  async manualCheck() {
    console.log('🔧 Manual overdue check triggered');
    await this.checkOverdueLoans();
    await this.updateExistingOverdueLoans();
    await this.checkPreCollectionEntry();
  }
}

const overdueTrackingService = new OverdueTrackingService();
module.exports = overdueTrackingService;
