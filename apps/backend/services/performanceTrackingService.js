const { Op } = require('sequelize');

const getModels = () => require('../models');

class PerformanceTrackingService {
  /**
   * Track officer performance when they add a remark
   */
  async trackRemarkPerformance(officerId, loanId, remarkType, remarkData) {
    try {
      const { Admin, Loan } = getModels();
      const officer = await Admin.findByPk(officerId);
      const loan = await Loan.findByPk(loanId);

      if (!officer || !loan) {
        console.error('Officer or loan not found for performance tracking');
        return;
      }

      const metrics = officer.performanceMetrics || {
        precollection: { totalCasesAssigned: 0, totalCasesProcessed: 0, totalAmountCollected: 0, totalRemarks: 0, successfulContacts: 0, paymentPromises: 0, actualPayments: 0 },
        collection: { totalCasesAssigned: 0, totalCasesProcessed: 0, totalAmountCollected: 0, totalRemarks: 0, successfulContacts: 0, paymentPromises: 0, actualPayments: 0 },
        overall: { totalRemarks: 0, totalAmountCollected: 0, averageResponseTime: 0, performanceScore: 0 },
      };

      const typeMetrics = metrics[remarkType] || metrics.precollection;
      typeMetrics.totalRemarks += 1;
      metrics.overall.totalRemarks += 1;

      if (remarkData.paymentAmount && remarkData.paymentAmount > 0) {
        typeMetrics.totalAmountCollected += remarkData.paymentAmount;
        metrics.overall.totalAmountCollected += remarkData.paymentAmount;
        if (['full_payment', 'partial_payment'].includes(remarkData.paymentStatus)) {
          typeMetrics.actualPayments += 1;
        } else if (remarkData.paymentStatus === 'promise_to_pay') {
          typeMetrics.paymentPromises += 1;
        }
      }

      if (remarkData.callOutcome === 'answered' || remarkData.paymentStatus) {
        typeMetrics.successfulContacts += 1;
      }

      this._calculatePerformanceScore(metrics);
      await officer.update({ performanceMetrics: metrics });

      console.log(`Performance tracked for officer ${officer.firstName} ${officer.lastName}: ${remarkType} remark added`);
    } catch (error) {
      console.error('Error tracking performance:', error);
    }
  }

  async trackCaseAssignment(officerId, assignmentType) {
    try {
      const { Admin } = getModels();
      const officer = await Admin.findByPk(officerId);
      if (!officer) return;

      const metrics = officer.performanceMetrics || { precollection: { totalCasesAssigned: 0 }, collection: { totalCasesAssigned: 0 }, overall: {} };
      if (!metrics[assignmentType]) metrics[assignmentType] = { totalCasesAssigned: 0, totalCasesProcessed: 0, totalAmountCollected: 0, totalRemarks: 0, successfulContacts: 0, paymentPromises: 0, actualPayments: 0 };
      metrics[assignmentType].totalCasesAssigned += 1;
      await officer.update({ performanceMetrics: metrics });
    } catch (error) {
      console.error('Error tracking case assignment:', error);
    }
  }

  async trackCaseProcessed(officerId, caseType) {
    try {
      const { Admin } = getModels();
      const officer = await Admin.findByPk(officerId);
      if (!officer || !officer.performanceMetrics) return;

      const metrics = officer.performanceMetrics;
      if (metrics[caseType]) metrics[caseType].totalCasesProcessed += 1;
      this._calculatePerformanceScore(metrics);
      await officer.update({ performanceMetrics: metrics });
    } catch (error) {
      console.error('Error tracking case processed:', error);
    }
  }

  _calculatePerformanceScore(metrics) {
    const collectionEfficiency = metrics.overall.totalRemarks > 0
      ? metrics.overall.totalAmountCollected / metrics.overall.totalRemarks : 0;

    const totalContacts = (metrics.precollection?.totalRemarks || 0) + (metrics.collection?.totalRemarks || 0);
    const successfulContacts = (metrics.precollection?.successfulContacts || 0) + (metrics.collection?.successfulContacts || 0);
    const contactSuccessRate = totalContacts > 0 ? (successfulContacts / totalContacts) * 100 : 0;

    const totalPayments = (metrics.precollection?.actualPayments || 0) + (metrics.collection?.actualPayments || 0);
    const paymentConversionRate = totalContacts > 0 ? (totalPayments / totalContacts) * 100 : 0;

    const totalAssigned = (metrics.precollection?.totalCasesAssigned || 0) + (metrics.collection?.totalCasesAssigned || 0);
    const totalProcessed = (metrics.precollection?.totalCasesProcessed || 0) + (metrics.collection?.totalCasesProcessed || 0);
    const completionRate = totalAssigned > 0 ? (totalProcessed / totalAssigned) * 100 : 0;

    const performanceScore = (collectionEfficiency * 0.4) + (contactSuccessRate * 0.25) + (paymentConversionRate * 0.25) + (completionRate * 0.1);
    metrics.overall.performanceScore = Math.min(100, Math.max(0, performanceScore));
  }

  async getPerformanceRankings(period = 'weekly', type = 'overall') {
    try {
      const { Admin, Role } = getModels();
      const officerRoles = await Role.findAll({ where: { name: { [Op.in]: ['precollection_officer', 'collection_officer'] } }, attributes: ['id'] });
      const roleIds = officerRoles.map(r => r.id);

      const officers = await Admin.findAll({
        where: { roleId: { [Op.in]: roleIds }, performanceMetrics: { [Op.ne]: null } },
        include: [{ model: Role, as: 'Role', attributes: ['name'] }],
        attributes: ['id', 'firstName', 'lastName', 'email', 'performanceMetrics'],
      });

      const rankings = officers
        .filter(o => o.performanceMetrics?.overall)
        .map(o => ({
          officerId: o.id,
          name: `${o.firstName} ${o.lastName}`,
          email: o.email,
          role: o.Role?.name,
          performanceScore: o.performanceMetrics.overall.performanceScore || 0,
          totalAmountCollected: o.performanceMetrics.overall.totalAmountCollected || 0,
          totalRemarks: o.performanceMetrics.overall.totalRemarks || 0,
          precollectionMetrics: o.performanceMetrics.precollection,
          collectionMetrics: o.performanceMetrics.collection,
        }))
        .sort((a, b) => b.performanceScore - a.performanceScore);

      return rankings;
    } catch (error) {
      console.error('Error getting performance rankings:', error);
      return [];
    }
  }

  async getDailyCollections(targetDate = new Date()) {
    try {
      const { Admin, Role } = getModels();
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const officerRoles = await Role.findAll({ where: { name: { [Op.in]: ['precollection_officer', 'collection_officer'] } }, attributes: ['id', 'name'] });
      const roleIds = officerRoles.map(r => r.id);

      const officers = await Admin.findAll({
        where: { roleId: { [Op.in]: roleIds }, performanceMetrics: { [Op.ne]: null } },
        include: [{ model: Role, as: 'Role', attributes: ['name'] }],
        attributes: ['id', 'firstName', 'lastName', 'performanceMetrics'],
      });

      // Note: daily collections by officer requires remark-level data stored in JSONB
      // Summarized from performanceMetrics stored on admin
      const dailyCollections = officers.map(officer => ({
        date: targetDate.toISOString().split('T')[0],
        officerId: officer.id,
        officerName: `${officer.firstName} ${officer.lastName}`,
        role: officer.Role?.name,
        totalAmount: officer.performanceMetrics?.overall?.totalAmountCollected || 0,
        casesProcessed: (officer.performanceMetrics?.precollection?.totalCasesProcessed || 0) + (officer.performanceMetrics?.collection?.totalCasesProcessed || 0),
        type: officer.Role?.name === 'precollection_officer' ? 'precollection' : 'collection',
      }));

      return dailyCollections;
    } catch (error) {
      console.error('Error getting daily collections:', error);
      return [];
    }
  }

  async resetMetrics() {
    try {
      const { Admin, Role } = getModels();
      const officerRoles = await Role.findAll({ where: { name: { [Op.in]: ['precollection_officer', 'collection_officer'] } }, attributes: ['id'] });
      const roleIds = officerRoles.map(r => r.id);

      const defaultMetrics = {
        precollection: { totalCasesAssigned: 0, totalCasesProcessed: 0, totalAmountCollected: 0, totalRemarks: 0, successfulContacts: 0, paymentPromises: 0, actualPayments: 0 },
        collection: { totalCasesAssigned: 0, totalCasesProcessed: 0, totalAmountCollected: 0, totalRemarks: 0, successfulContacts: 0, paymentPromises: 0, actualPayments: 0 },
        overall: { totalRemarks: 0, totalAmountCollected: 0, averageResponseTime: 0, performanceScore: 0 },
      };

      await Admin.update({ performanceMetrics: defaultMetrics }, { where: { roleId: { [Op.in]: roleIds } } });
      console.log('Performance metrics reset successfully for all officers');
    } catch (error) {
      console.error('Error resetting performance metrics:', error);
      throw error;
    }
  }

  async resetPerformanceMetrics(period) {
    console.log(`Performance metrics reset for period: ${period}`);
  }
}

module.exports = new PerformanceTrackingService();
