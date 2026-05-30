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
        // logging:
        //   process.env.NODE_ENV === "development"
        //     ? (sql) => console.log("📝 SQL:", sql)
        //     : false,
        logging: false,
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

const ensureLoanLifecycleColumns = async () => {
  const qi = sequelize.getQueryInterface();
  const table = { tableName: "loans", schema: "cedi_loans" };
  const tableDefinition = await qi.describeTable(table);

  if (!tableDefinition.disbursement_status) {
    await sequelize.query(
      `DO $$
       BEGIN
         IF NOT EXISTS (
           SELECT 1
           FROM pg_type t
           JOIN pg_namespace n ON n.oid = t.typnamespace
           WHERE t.typname = 'enum_loans_disbursement_status'
             AND n.nspname = 'cedi_loans'
         ) THEN
           CREATE TYPE "cedi_loans"."enum_loans_disbursement_status"
           AS ENUM ('idle', 'processing', 'failed', 'sent');
         END IF;
       END
       $$;`,
    );

    await sequelize.query(
      `ALTER TABLE "cedi_loans"."loans"
       ADD COLUMN IF NOT EXISTS "disbursement_status" "cedi_loans"."enum_loans_disbursement_status" NOT NULL DEFAULT 'idle';`,
    );
  }

  await sequelize.query(
    `ALTER TABLE "cedi_loans"."loans"
     ADD COLUMN IF NOT EXISTS "disbursement_last_attempt_at" TIMESTAMPTZ,
     ADD COLUMN IF NOT EXISTS "disbursement_failed_at" TIMESTAMPTZ,
     ADD COLUMN IF NOT EXISTS "disbursement_failure_reason" TEXT,
     ADD COLUMN IF NOT EXISTS "disbursement_attempts" INTEGER NOT NULL DEFAULT 0,
     ADD COLUMN IF NOT EXISTS "disbursement_reference" VARCHAR(255),
     ADD COLUMN IF NOT EXISTS "disbursement_channel" VARCHAR(255),
     ADD COLUMN IF NOT EXISTS "activation_confirmed_at" TIMESTAMPTZ,
     ADD COLUMN IF NOT EXISTS "activation_confirmed_by_id" UUID;`,
  );

  console.log("🧩 Loan lifecycle columns verified");
};

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

    await ensureLoanLifecycleColumns();

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
