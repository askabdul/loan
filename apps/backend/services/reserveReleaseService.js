/**
 * Reserve Release Service
 * Daily check that auto-releases loans that have been "hung-up" (reserved)
 * for more than 10 days in either pre-collection or collection queues.
 * Runs every 24 hours using setInterval (same pattern as overdueTrackingService).
 */

const { Op } = require("sequelize");

const RESERVE_DAYS = 10;
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function releaseExpiredReserves() {
  const { Loan } = require("../models");
  const cutoff = new Date(Date.now() - RESERVE_DAYS * 24 * 60 * 60 * 1000);

  try {
    const [preColl] = await Loan.update(
      {
        precollectionStatus: "pending-assignment",
        reservedAt: null,
        reservedByOfficerId: null,
      },
      {
        where: {
          precollectionStatus: "hung-up",
          reservedAt: { [Op.lte]: cutoff },
        },
      },
    );

    const [coll] = await Loan.update(
      {
        collectionStatus: "pending-assignment",
        reservedAt: null,
        reservedByOfficerId: null,
      },
      {
        where: {
          collectionStatus: "hung-up",
          reservedAt: { [Op.lte]: cutoff },
        },
      },
    );

    if (preColl + coll > 0) {
      console.log(
        `[ReserveRelease] Released ${preColl} pre-collection + ${coll} collection reserves older than ${RESERVE_DAYS} days.`,
      );
    }
  } catch (error) {
    console.error("[ReserveRelease] Error releasing reserves:", error.message);
  }
}

let intervalId = null;

const reserveReleaseService = {
  start() {
    if (intervalId) return;
    // Run immediately, then every 24h
    releaseExpiredReserves();
    intervalId = setInterval(releaseExpiredReserves, INTERVAL_MS);
    console.log("✅ Reserve release service started (runs every 24 hours).");
  },
  stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  },
  run: releaseExpiredReserves,
};

module.exports = reserveReleaseService;
