const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const Content = sequelize.define(
  "Content",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    key: {
      type: DataTypes.STRING(200),
      allowNull: false,
      unique: true,
    },
    type: {
      type: DataTypes.ENUM("faq", "process_guide", "contact_info", "general"),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Flexible JSONB field — can be a string, array, or nested object
    content: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: "order",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // { icon, color, category, tags }
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    updatedById: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    schema: "cedi_config",
    tableName: "contents",
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ["key"] },
      { fields: ["type", "is_active"] },
      { fields: ["order"] },
    ],
  },
);

// ── Static helpers matching original Mongoose static methods ──────────────────
Content.getByType = function (type) {
  return Content.findAll({
    where: { type, isActive: true },
    order: [
      ["order", "ASC"],
      ["created_at", "ASC"],
    ],
  });
};

Content.getByKey = function (key) {
  return Content.findOne({ where: { key, isActive: true } });
};

Content.updateContent = async function (key, updates, userId) {
  const [record, created] = await Content.findOrCreate({
    where: { key },
    defaults: { ...updates, updatedById: userId },
  });
  if (!created) {
    await record.update({ ...updates, updatedById: userId });
  }
  return record;
};

module.exports = Content;
