const express = require("express");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const { Op } = require("sequelize");
const { body, validationResult } = require("express-validator");
const { Admin, Role } = require("../models");
const { adminAuth, requirePermission } = require("../middleware/auth");
const { requireActionPermission } = require("../middleware/roleAuth");

const router = express.Router();

// ── File upload ───────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/profile-images/"),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `profile-${unique}${path.extname(file.originalname)}`);
  },
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) return cb(null, true);
    cb(new Error("Only image files are allowed"), false);
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const generateAdminToken = (id) =>
  jwt.sign({ id, type: "admin" }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });

const sendAdminTokenResponse = async (admin, statusCode, res) => {
  const token = generateAdminToken(admin.id);
  await admin.update({ lastLogin: new Date() });

  // Fetch fresh copy with Role included if not already
  const role = admin.Role || (await Role.findByPk(admin.roleId));
  const permissions = admin.getEffectivePermissions
    ? await admin.getEffectivePermissions()
    : {};

  res.status(statusCode).json({
    success: true,
    token,
    admin: {
      id: admin.id,
      email: admin.email,
      username: admin.username,
      fullName: `${admin.firstName} ${admin.lastName}`,
      role,
      permissions,
      isActive: admin.isActive,
      isEmailVerified: admin.isEmailVerified,
      lastLogin: admin.lastLogin,
    },
  });
};

// ── POST /login ───────────────────────────────────────────────────────────────
router.post(
  "/login",
  [
    body("login").notEmpty().withMessage("Email or username is required"),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { login, password } = req.body;

      const admin = await Admin.scope("withPassword").findOne({
        where: {
          [Op.or]: [{ email: login.toLowerCase() }, { username: login }],
        },
        include: [{ model: Role, as: "Role" }],
      });

      if (!admin)
        return res
          .status(401)
          .json({ success: false, message: "Invalid credentials" });
      if (admin.isLocked())
        return res.status(423).json({
          success: false,
          message: "Account is locked. Try again later.",
        });
      if (!admin.isActive)
        return res
          .status(401)
          .json({ success: false, message: "Account deactivated." });

      const ok = await admin.correctPassword(password);
      if (!ok) {
        await admin.incLoginAttempts();
        return res
          .status(401)
          .json({ success: false, message: "Invalid credentials" });
      }

      await admin.resetLoginAttempts();
      await sendAdminTokenResponse(admin, 200, res);
    } catch (error) {
      console.error("Admin login error:", error);
      res
        .status(500)
        .json({ success: false, message: "Server error during login." });
    }
  },
);

// ── POST /register ────────────────────────────────────────────────────────────
router.post(
  "/register",
  [
    adminAuth,
    requireActionPermission("createAdmin"),
    upload.single("profileImage"),
    body("email").isEmail().normalizeEmail(),
    body("username")
      .isLength({ min: 3, max: 20 })
      .matches(/^[a-zA-Z0-9_]+$/),
    body("password").isLength({ min: 8 }),
    body("firstName").notEmpty(),
    body("lastName").notEmpty(),
    body("phoneNumber").isMobilePhone(),
    body("designation").notEmpty(),
    body("dateJoined").isISO8601(),
    body("dateOfExpiry").isISO8601(),
    body("role").notEmpty().withMessage("Role ID is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const {
        email,
        username,
        password,
        firstName,
        lastName,
        phoneNumber,
        designation,
        dateJoined,
        dateOfExpiry,
        role,
      } = req.body;

      const existing = await Admin.findOne({
        where: { [Op.or]: [{ email: email.toLowerCase() }, { username }] },
      });
      if (existing)
        return res.status(400).json({
          success: false,
          message: "Admin with this email or username already exists.",
        });

      const roleRecord = await Role.findByPk(role);
      if (!roleRecord)
        return res
          .status(400)
          .json({ success: false, message: "Role not found." });

      const admin = await Admin.create({
        email: email.toLowerCase(),
        username,
        password,
        firstName,
        lastName,
        phoneNumber,
        designation,
        dateJoined: new Date(dateJoined),
        dateOfExpiry: new Date(dateOfExpiry),
        profileImage: req.file ? req.file.path : null,
        roleId: roleRecord.id,
        createdById: req.admin.id,
        isEmailVerified: true,
      });

      res.status(201).json({
        success: true,
        message: "Admin created successfully",
        admin: {
          id: admin.id,
          email: admin.email,
          username: admin.username,
          fullName: `${admin.firstName} ${admin.lastName}`,
          designation: admin.designation,
          employeeNumber: admin.employeeNumber,
          roleId: admin.roleId,
          isActive: admin.isActive,
        },
      });
    } catch (error) {
      console.error("Admin register error:", error);
      res.status(500).json({ success: false, message: "Server error." });
    }
  },
);

// ── GET /me ───────────────────────────────────────────────────────────────────
router.get("/me", adminAuth, async (req, res) => {
  const admin = req.admin;
  const permissions = admin.getEffectivePermissions
    ? admin.getEffectivePermissions()
    : {};
  res.json({
    success: true,
    admin: {
      id: admin.id,
      email: admin.email,
      username: admin.username,
      fullName: `${admin.firstName} ${admin.lastName}`,
      role: admin.Role,
      permissions,
      isActive: admin.isActive,
      isEmailVerified: admin.isEmailVerified,
      lastLogin: admin.lastLogin,
      createdAt: admin.createdAt,
    },
  });
});

// ── PUT /update-profile ───────────────────────────────────────────────────────
router.put(
  "/update-profile",
  [
    adminAuth,
    body("firstName").optional().notEmpty(),
    body("lastName").optional().notEmpty(),
    body("email").optional().isEmail().normalizeEmail(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { firstName, lastName, email } = req.body;
      const updates = { lastModifiedById: req.admin.id };

      if (firstName) updates.firstName = firstName;
      if (lastName) updates.lastName = lastName;
      if (email && email !== req.admin.email) {
        const taken = await Admin.findOne({
          where: { email: email.toLowerCase() },
        });
        if (taken)
          return res
            .status(400)
            .json({ success: false, message: "Email already in use." });
        updates.email = email.toLowerCase();
        updates.isEmailVerified = false;
      }

      await req.admin.update(updates);
      res.json({ success: true, message: "Profile updated successfully." });
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ success: false, message: "Server error." });
    }
  },
);

// ── PUT /change-password ──────────────────────────────────────────────────────
router.put(
  "/change-password",
  [
    adminAuth,
    body("currentPassword").notEmpty(),
    body("newPassword").isLength({ min: 8 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { currentPassword, newPassword } = req.body;
      const admin = await Admin.scope("withPassword").findByPk(req.admin.id);
      const ok = await admin.correctPassword(currentPassword);
      if (!ok)
        return res
          .status(400)
          .json({ success: false, message: "Current password is incorrect." });

      admin.password = newPassword;
      await admin.save();
      res.json({ success: true, message: "Password changed successfully." });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ success: false, message: "Server error." });
    }
  },
);

// ── GET /admins ───────────────────────────────────────────────────────────────
router.get(
  "/admins",
  adminAuth,
  requirePermission("admin.read"),
  async (req, res) => {
    try {
      const { page = 1, limit = 10, search, role, isActive } = req.query;
      const where = {};

      if (search) {
        where[Op.or] = [
          { email: { [Op.iLike]: `%${search}%` } },
          { username: { [Op.iLike]: `%${search}%` } },
          { firstName: { [Op.iLike]: `%${search}%` } },
          { lastName: { [Op.iLike]: `%${search}%` } },
        ];
      }
      if (role) where.roleId = role;
      if (isActive !== undefined) where.isActive = isActive === "true";

      const { count, rows } = await Admin.findAndCountAll({
        where,
        include: [{ model: Role, as: "Role" }],
        order: [["created_at", "DESC"]],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
      });

      res.json({
        success: true,
        count: rows.length,
        total: count,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(count / parseInt(limit)),
        },
        admins: rows.map((a) => ({
          id: a.id,
          email: a.email,
          username: a.username,
          fullName: `${a.firstName} ${a.lastName}`,
          designation: a.designation,
          employeeNumber: a.employeeNumber,
          role: a.Role,
          isActive: a.isActive,
          lastLogin: a.lastLogin,
          createdAt: a.createdAt,
        })),
      });
    } catch (error) {
      console.error("Get admins error:", error);
      res.status(500).json({ success: false, message: "Server error." });
    }
  },
);

// ── PUT /admins/:id/status ────────────────────────────────────────────────────
router.put(
  "/admins/:id/status",
  adminAuth,
  requirePermission("admin.write"),
  async (req, res) => {
    try {
      const { isActive } = req.body;
      if (typeof isActive !== "boolean")
        return res
          .status(400)
          .json({ success: false, message: "isActive must be boolean." });

      const admin = await Admin.findByPk(req.params.id);
      if (!admin)
        return res
          .status(404)
          .json({ success: false, message: "Admin not found." });
      if (admin.id === req.admin.id && !isActive)
        return res.status(400).json({
          success: false,
          message: "Cannot deactivate your own account.",
        });

      await admin.update({ isActive, lastModifiedById: req.admin.id });
      res.json({
        success: true,
        message: `Admin ${isActive ? "activated" : "deactivated"} successfully.`,
      });
    } catch (error) {
      console.error("Admin status error:", error);
      res.status(500).json({ success: false, message: "Server error." });
    }
  },
);

// ── DELETE /admins/:id ────────────────────────────────────────────────────────
router.delete(
  "/admins/:id",
  adminAuth,
  requirePermission("admin.delete"),
  async (req, res) => {
    try {
      const admin = await Admin.findByPk(req.params.id);
      if (!admin)
        return res
          .status(404)
          .json({ success: false, message: "Admin not found." });
      if (admin.id === req.admin.id)
        return res
          .status(400)
          .json({ success: false, message: "Cannot delete your own account." });

      await admin.destroy();
      res.json({ success: true, message: "Admin deleted successfully." });
    } catch (error) {
      console.error("Delete admin error:", error);
      res.status(500).json({ success: false, message: "Server error." });
    }
  },
);

module.exports = router;
