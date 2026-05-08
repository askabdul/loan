const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/database");

const Role = sequelize.define(
  "Role",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.ENUM(
        "super-admin",
        "admin",
        "local-manager",
        "review-lead",
        "review-officer",
        "collection-lead",
        "collection-officer",
        "precollection-lead",
        "precollection-officer",
        "customer-service",
      ),
      allowNull: false,
    },
    displayName: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    hierarchy: {
      type: DataTypes.INTEGER,
      defaultValue: 99,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    // The entire permissions tree is stored as JSONB for flexibility.
    // Keys: menus{}, subMenus{}, dataAccess{}, actions{}, uiElements{}, bulkActions{}
    permissions: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
  },
  {
    schema: "cedi_auth",
    tableName: "roles",
    underscored: true,
    timestamps: true,
    indexes: [{ unique: true, fields: ["name"] }],
  },
);

module.exports = Role;
