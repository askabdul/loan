const { Sequelize } = require("sequelize");
require("dotenv").config();

// Build connection from individual env vars or a full DATABASE_URL
const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: "postgres",
      logging:
        process.env.NODE_ENV === "development"
          ? (sql) => console.log("📝 SQL:", sql)
          : false,
      dialectOptions:
        process.env.NODE_ENV === "production"
          ? { ssl: { require: true, rejectUnauthorized: false } }
          : {},
      pool: {
        max: 10,
        min: 2,
        acquire: 30000,
        idle: 30000,
      },
      define: {
        underscored: true, // map camelCase JS fields to snake_case DB columns
        timestamps: true, // adds created_at / updated_at automatically
        freezeTableName: true, // table names stay exactly as defined
      },
    })
  : new Sequelize(
      process.env.DB_NAME || "cedi_loan",
      process.env.DB_USER || "postgres",
      process.env.DB_PASS || "",
      {
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432"),
        dialect: "postgres",
        logging:
          process.env.NODE_ENV === "development"
            ? (sql) => console.log("📝 SQL:", sql)
            : false,
        pool: {
          max: 10,
          min: 2,
          acquire: 30000,
          idle: 30000,
        },
        define: {
          underscored: true,
          timestamps: true,
          freezeTableName: true,
        },
      },
    );

/**
 * Create all PostgreSQL schemas (namespaces) if they don't exist,
 * then sync all Sequelize models.
 */
const SCHEMAS = [
  "cedi_auth",
  "cedi_loans",
  "cedi_payments",
  "cedi_notifications",
  "cedi_config",
];

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("🔗 PostgreSQL connected successfully");

    // Create schemas (namespaces) if they don't exist
    for (const schema of SCHEMAS) {
      await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${schema}";`);
      console.log(`📂 Schema ready: ${schema}`);
    }

    // Import models so they register themselves with sequelize
    // (models/index.js calls this file, so we import lazily to avoid circular dep)
    const { initAssociations } = require("../models");
    initAssociations();

    // Sync all models — creates / alters tables as needed.
    // Use { force: true } only once for a clean slate, then switch to { alter: true } or migrations.
    const syncOptions =
      process.env.DB_SYNC === "force"
        ? { force: true }
        : process.env.DB_SYNC === "alter"
          ? { alter: true }
          : {};

    await sequelize.sync(syncOptions);
    console.log(
      `✅ All tables synced (DB_SYNC=${process.env.DB_SYNC || "none"})`,
    );

    // Graceful shutdown
    process.on("SIGINT", async () => {
      await sequelize.close();
      console.log("🛑 PostgreSQL connection pool closed");
      process.exit(0);
    });

    return sequelize;
  } catch (error) {
    console.error("❌ PostgreSQL connection error:", error.message);
    throw error;
  }
};

module.exports = connectDB;
module.exports.sequelize = sequelize;
