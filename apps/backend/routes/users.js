const express = require("express");
const { body, validationResult } = require("express-validator");
const { Op, fn, col, where: sqWhere } = require("sequelize");
const { User, LoanLevel, Loan } = require("../models");
const { auth, adminAuth } = require("../middleware/auth");
const {
  requireMenuAccess,
  requireActionPermission,
} = require("../middleware/roleAuth");
const AppError = require("../utils/appError");
const websocketService = require("../services/websocketService");

const router = express.Router();

// PUT /api/users/personal-info
router.put(
  "/personal-info",
  auth,
  [
    body("firstName").optional().trim().isLength({ min: 1 }),
    body("lastName").optional().trim().isLength({ min: 1 }),
    body("dateOfBirth").optional().isISO8601(),
    body("gender").optional().isIn(["male", "female", "other"]),
    body("phoneNumber").optional().isMobilePhone(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const user = await User.findByPk(req.user.id);
      const { firstName, lastName, dateOfBirth, gender, phoneNumber, address } =
        req.body;

      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      if (dateOfBirth) user.dateOfBirth = new Date(dateOfBirth);
      if (gender) user.gender = gender;
      if (phoneNumber) user.phoneNumber = phoneNumber;
      if (address) user.address = { ...user.address, ...address };

      await user.save();
      res.json({
        success: true,
        message: "Personal information updated successfully",
        user,
      });
    } catch (err) {
      res
        .status(500)
        .json({
          success: false,
          message: "Server error updating personal information",
        });
    }
  },
);

// PUT /api/users/work-info
router.put(
  "/work-info",
  auth,
  [
    body("employmentStatus")
      .optional()
      .isIn(["employed", "self-employed", "unemployed", "student"]),
    body("monthlyIncome").optional().isNumeric().isFloat({ min: 0 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const user = await User.findByPk(req.user.id);
      const {
        employmentStatus,
        employer,
        jobTitle,
        monthlyIncome,
        workAddress,
        yearsOfEmployment,
      } = req.body;

      if (employmentStatus) user.employmentStatus = employmentStatus;
      if (employer) user.employer = employer;
      if (jobTitle) user.jobTitle = jobTitle;
      if (monthlyIncome !== undefined) user.monthlyIncome = monthlyIncome;
      if (workAddress) user.workAddress = workAddress;
      if (yearsOfEmployment !== undefined)
        user.yearsOfEmployment = yearsOfEmployment;

      await user.save();
      res.json({
        success: true,
        message: "Work information updated successfully",
        user,
      });
    } catch (err) {
      res
        .status(500)
        .json({
          success: false,
          message: "Server error updating work information",
        });
    }
  },
);

// PUT /api/users/education-info
router.put(
  "/education-info",
  auth,
  [
    body("highestLevel")
      .optional()
      .isIn(["primary", "secondary", "tertiary", "vocational", "postgraduate"]),
    body("graduationYear")
      .optional()
      .isInt({ min: 1950, max: new Date().getFullYear() }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const user = await User.findByPk(req.user.id);
      const { highestLevel, institution, fieldOfStudy, graduationYear } =
        req.body;

      if (highestLevel) user.educationLevel = highestLevel;
      if (institution) user.educationInstitution = institution;
      if (fieldOfStudy) user.fieldOfStudy = fieldOfStudy;
      if (graduationYear) user.graduationYear = graduationYear;

      await user.save();
      res.json({
        success: true,
        message: "Education information updated successfully",
        user,
      });
    } catch (err) {
      res
        .status(500)
        .json({
          success: false,
          message: "Server error updating education information",
        });
    }
  },
);

// PUT /api/users/emergency-contacts
router.put(
  "/emergency-contacts",
  auth,
  [
    body("emergencyContacts").isArray({ min: 1, max: 3 }),
    body("emergencyContacts.*.name").trim().isLength({ min: 1 }),
    body("emergencyContacts.*.relationship").trim().isLength({ min: 1 }),
    body("emergencyContacts.*.phoneNumber").custom((value) => {
      const ghanaLocal = /^0[2-9]\d{8}$/;
      const intl = /^\+233[2-9]\d{8}$/;
      if (ghanaLocal.test(value) || intl.test(value)) return true;
      throw new Error(
        "Please provide a valid Ghana phone number (0XXXXXXXXX or +233XXXXXXXXX)",
      );
    }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const user = await User.findByPk(req.user.id);
      user.emergencyContacts = req.body.emergencyContacts;
      await user.save();
      res.json({
        success: true,
        message: "Emergency contacts updated successfully",
        user,
      });
    } catch (err) {
      res
        .status(500)
        .json({
          success: false,
          message: "Server error updating emergency contacts",
        });
    }
  },
);

// PUT /api/users/id-verification
router.put(
  "/id-verification",
  auth,
  [
    body("idType")
      .optional()
      .isIn(["national-id", "passport", "drivers-license", "voters-id"]),
    body("idNumber").optional().trim().isLength({ min: 1 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const user = await User.findByPk(req.user.id);
      const { idType, idNumber, documents } = req.body;

      if (idType) user.idType = idType;
      if (idNumber) user.idNumber = idNumber;
      if (documents)
        user.idDocuments = documents.map((doc) => ({
          type: doc,
          uploadDate: new Date(),
        }));

      await user.save();
      res.json({
        success: true,
        message: "ID verification information updated successfully",
        user,
      });
    } catch (err) {
      res
        .status(500)
        .json({
          success: false,
          message: "Server error updating ID verification",
        });
    }
  },
);

// PUT /api/users/complete-registration
router.put("/complete-registration", auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);

    const hasPersonalInfo =
      user.firstName && user.lastName && user.dateOfBirth && user.gender;
    const hasWorkInfo = user.employmentStatus;
    const hasEmergencyContacts =
      user.emergencyContacts && user.emergencyContacts.length > 0;

    if (!hasPersonalInfo || !hasWorkInfo || !hasEmergencyContacts) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Please complete all required information before finishing registration",
          missing: {
            personalInfo: !hasPersonalInfo,
            workInfo: !hasWorkInfo,
            emergencyContacts: !hasEmergencyContacts,
          },
        });
    }

    user.registrationComplete = true;
    await user.save();
    res.json({
      success: true,
      message: "Registration completed successfully",
      user,
    });
  } catch (err) {
    res
      .status(500)
      .json({
        success: false,
        message: "Server error completing registration",
      });
  }
});

// GET /api/users/profile
router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    res.json({ success: true, user });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error getting profile" });
  }
});

// GET /api/users/with-levels (admin)
router.get(
  "/with-levels",
  adminAuth,
  requireMenuAccess("user-management"),
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        search = "",
        sortBy = "created_at",
        sortOrder = "desc",
        level = "",
        status = "",
      } = req.query;
      const where = {};

      if (search)
        where[Op.or] = [
          { firstName: { [Op.iLike]: `%${search}%` } },
          { lastName: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
          { phoneNumber: { [Op.iLike]: `%${search}%` } },
        ];
      if (level) where.currentLoanLevel = parseInt(level);
      if (status) where.isActive = status === "active";

      const { count, rows: users } = await User.findAndCountAll({
        where,
        order: [[sortBy, sortOrder.toUpperCase()]],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
      });

      const loanLevels = await LoanLevel.findAll({
        where: { isActive: true },
        order: [["level", "ASC"]],
        attributes: ["id", "name", "level"],
      });

      const usersWithLevels = await Promise.all(
        users.map(async (u) => {
          const levelDetails = await LoanLevel.findOne({
            where: { level: u.currentLoanLevel },
          });
          return { ...u.toJSON(), currentLevel: levelDetails };
        }),
      );

      const transformed = usersWithLevels.map((u) => ({
        _id: u.id,
        name: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
        email: u.email,
        phone: u.phoneNumber,
        currentLevel: u.currentLevel,
        isActive: u.isActive,
        totalLoansCompleted: u.totalLoansCompleted || 0,
        totalAmountRepaid: u.totalAmountRepaid || 0,
        createdAt: u.createdAt,
        levelProgressionHistory: u.levelProgressionHistory || [],
      }));

      res.json({
        success: true,
        data: {
          users: transformed,
          loanLevels,
          pagination: {
            current: parseInt(page),
            total: Math.ceil(count / parseInt(limit)),
            count,
            limit: parseInt(limit),
          },
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

// PUT /api/users/:userId/level (admin)
router.put(
  "/:userId/level",
  adminAuth,
  requireActionPermission("edit_user"),
  [
    body("levelId").notEmpty(),
    body("reason").optional().trim().isLength({ min: 1, max: 500 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { levelId, reason } = req.body;
      const user = await User.findByPk(req.params.userId);
      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found" });

      const newLevel = await LoanLevel.findByPk(levelId);
      if (!newLevel)
        return res
          .status(404)
          .json({ success: false, message: "Loan level not found" });

      const history = [...(user.levelProgressionHistory || [])];
      history.push({
        fromLevel: user.currentLoanLevel,
        toLevel: newLevel.level,
        changedBy: req.admin.id,
        reason: reason || "Manual assignment by admin",
        changedAt: new Date(),
      });

      await user.update({
        currentLoanLevel: newLevel.level,
        levelProgressionHistory: history,
      });

      const responseUserData = {
        _id: user.id,
        name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
        email: user.email,
        phone: user.phoneNumber,
        currentLevel: newLevel,
        isActive: user.isActive,
        totalLoansCompleted: user.totalLoansCompleted || 0,
        totalAmountRepaid: user.totalAmountRepaid || 0,
      };
      websocketService.broadcastUserLevelUpdate(
        responseUserData,
        "user_level_updated",
      );

      res.json({
        success: true,
        message: "User level updated successfully",
        data: { user: responseUserData },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

// PUT /api/users/bulk-level-update (admin)
router.put(
  "/bulk-level-update",
  adminAuth,
  requireActionPermission("edit_user"),
  [
    body("userIds").isArray({ min: 1 }),
    body("levelId").notEmpty(),
    body("reason").optional().trim().isLength({ min: 1, max: 500 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { userIds, levelId, reason } = req.body;
      const newLevel = await LoanLevel.findByPk(levelId);
      if (!newLevel)
        return res
          .status(404)
          .json({ success: false, message: "Loan level not found" });

      const users = await User.findAll({ where: { id: { [Op.in]: userIds } } });
      if (users.length === 0)
        return res
          .status(400)
          .json({ success: false, message: "No valid users found" });

      let updatedCount = 0;
      for (const user of users) {
        if (user.currentLoanLevel === newLevel.level) continue;
        const history = [...(user.levelProgressionHistory || [])];
        history.push({
          fromLevel: user.currentLoanLevel,
          toLevel: newLevel.level,
          changedBy: req.admin.id,
          reason: reason || "Bulk assignment by admin",
          changedAt: new Date(),
        });
        await user.update({
          currentLoanLevel: newLevel.level,
          levelProgressionHistory: history,
        });
        updatedCount++;
      }

      const bulkData = {
        totalRequested: userIds.length,
        updated: updatedCount,
        skipped: userIds.length - updatedCount,
        levelId,
        reason: reason || "Bulk assignment by admin",
      };
      websocketService.broadcastBulkUserLevelUpdate(
        bulkData,
        "bulk_user_level_updated",
      );

      res.json({
        success: true,
        message: `Successfully updated ${updatedCount} user(s)`,
        data: bulkData,
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

// GET /api/users/:userId/level-history (admin)
router.get(
  "/:userId/level-history",
  adminAuth,
  requireMenuAccess("user-management"),
  async (req, res) => {
    try {
      const user = await User.findByPk(req.params.userId, {
        attributes: ["id", "firstName", "lastName", "levelProgressionHistory"],
      });
      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found" });

      res.json({
        success: true,
        data: {
          user: {
            _id: user.id,
            name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
          },
          history: user.levelProgressionHistory || [],
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

// POST /api/users/admin-register (admin)
router.post(
  "/admin-register",
  adminAuth,
  requireMenuAccess("userManagement"),
  requireActionPermission("createUser"),
  [
    body("phoneNumber").custom((value) => {
      if (/^0[2-9]\d{8}$/.test(value) || /^\+233[2-9]\d{8}$/.test(value))
        return true;
      throw new Error(
        "Please provide a valid Ghana phone number (0XXXXXXXXX or +233XXXXXXXXX)",
      );
    }),
    body("pin")
      .isLength({ min: 4, max: 4 })
      .isNumeric()
      .withMessage("PIN must be exactly 4 digits"),
    body("personalInfo.firstName").trim().isLength({ min: 1 }),
    body("personalInfo.lastName").trim().isLength({ min: 1 }),
    body("personalInfo.email").optional().isEmail().normalizeEmail(),
    body("personalInfo.dateOfBirth").isISO8601().toDate(),
    body("personalInfo.gender").isIn(["male", "female", "other"]),
    body("workInfo.employmentStatus").isIn([
      "employed",
      "self-employed",
      "unemployed",
      "student",
      "retired",
    ]),
    body("emergencyContacts").isArray({ min: 1 }),
    body("assignedLoanLevel").optional().isInt({ min: 1, max: 10 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const {
        phoneNumber,
        pin,
        personalInfo,
        workInfo,
        educationInfo,
        emergencyContacts,
        idVerification,
        assignedLoanLevel = 1,
      } = req.body;

      const allPhones = [
        phoneNumber,
        ...emergencyContacts.map((c) => c.phoneNumber).filter(Boolean),
      ];
      const uniquePhones = new Set(allPhones);
      if (uniquePhones.size !== allPhones.length)
        return res
          .status(400)
          .json({
            success: false,
            message: "Duplicate phone numbers detected.",
          });

      const existingUsers = await User.findAll({
        where: { [Op.or]: [{ phoneNumber: { [Op.in]: allPhones } }] },
      });
      if (existingUsers.length > 0)
        return res
          .status(400)
          .json({
            success: false,
            message: "Phone number already registered.",
          });

      if (personalInfo.email) {
        const existingEmail = await User.findOne({
          where: { email: personalInfo.email },
        });
        if (existingEmail)
          return res
            .status(400)
            .json({
              success: false,
              message: "Email address is already registered",
            });
      }

      const loanLevel = await LoanLevel.findOne({
        where: { level: assignedLoanLevel, isActive: true },
      });
      if (!loanLevel)
        return res
          .status(400)
          .json({ success: false, message: "Invalid loan level specified" });

      const user = await User.create({
        phoneNumber,
        pin,
        email: personalInfo.email || null,
        authMethod: "phone-pin",
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        email: personalInfo.email || null,
        dateOfBirth: personalInfo.dateOfBirth,
        gender: personalInfo.gender,
        address: {
          street: personalInfo.address?.street,
          city: personalInfo.address?.city,
          region: personalInfo.address?.region,
          country: personalInfo.address?.country || "Ghana",
        },
        employmentStatus: workInfo.employmentStatus,
        employer: workInfo.employer,
        jobTitle: workInfo.jobTitle,
        monthlyIncome: workInfo.monthlyIncome,
        workAddress: workInfo.workAddress,
        yearsOfEmployment: workInfo.yearsOfEmployment,
        educationLevel: educationInfo?.highestLevel,
        educationInstitution: educationInfo?.institution,
        fieldOfStudy: educationInfo?.fieldOfStudy,
        graduationYear: educationInfo?.graduationYear,
        emergencyContacts,
        idType: idVerification?.idType,
        idNumber: idVerification?.idNumber,
        currentLoanLevel: assignedLoanLevel,
        isActive: true,
        isPhoneVerified: true,
        registrationComplete: true,
      });

      websocketService.broadcastNotification({
        type: "user_registered",
        message: `New user registered: ${user.firstName} ${user.lastName}`,
        data: {
          userId: user.id,
          userName: `${user.firstName} ${user.lastName}`,
          registeredBy: req.admin.username || req.admin.email,
          timestamp: new Date(),
        },
      });

      res
        .status(201)
        .json({
          success: true,
          message: "User registered successfully",
          data: {
            user: {
              id: user.id,
              userId: user.userId,
              fullName: `${user.firstName} ${user.lastName}`,
              phoneNumber: user.phoneNumber,
              email: user.email,
              currentLoanLevel: user.currentLoanLevel,
              isActive: user.isActive,
              registrationComplete: user.registrationComplete,
              createdAt: user.createdAt,
            },
          },
        });
    } catch (err) {
      console.error("Admin register error:", err);
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

// GET /api/users/list (admin)
router.get(
  "/list",
  adminAuth,
  requireMenuAccess("userManagement"),
  requireActionPermission("viewUsers"),
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 10,
        search = "",
        status = "all",
        loanLevel = "all",
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query;
      const pageNum = parseInt(page),
        limitNum = parseInt(limit);
      const where = {};

      if (search)
        where[Op.or] = [
          { firstName: { [Op.iLike]: `%${search}%` } },
          { lastName: { [Op.iLike]: `%${search}%` } },
          { phoneNumber: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } },
          { userId: { [Op.iLike]: `%${search}%` } },
        ];
      if (status === "active") where.isActive = true;
      else if (status === "inactive") where.isActive = false;
      if (loanLevel !== "all") where.currentLoanLevel = parseInt(loanLevel);

      const { count, rows: users } = await User.findAndCountAll({
        where,
        order: [
          [
            sortBy === "createdAt" ? "created_at" : sortBy,
            sortOrder.toUpperCase(),
          ],
        ],
        limit: limitNum,
        offset: (pageNum - 1) * limitNum,
      });

      const formatted = users.map((u) => ({
        id: u.id,
        userId: u.userId,
        fullName: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
        firstName: u.firstName,
        lastName: u.lastName,
        phoneNumber: u.phoneNumber,
        email: u.email,
        currentLoanLevel: u.currentLoanLevel,
        isActive: u.isActive,
        registrationComplete: u.registrationComplete,
        registrationDate: u.createdAt,
        lastLevelChange:
          u.levelProgressionHistory?.length > 0
            ? u.levelProgressionHistory[u.levelProgressionHistory.length - 1]
                .changedAt
            : null,
      }));

      res.json({
        success: true,
        data: {
          users: formatted,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(count / limitNum),
            totalUsers: count,
            hasNextPage: pageNum < Math.ceil(count / limitNum),
            hasPrevPage: pageNum > 1,
            limit: limitNum,
          },
          filters: { search, status, loanLevel, sortBy, sortOrder },
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

// PUT /api/users/:userId/info (admin)
router.put(
  "/:userId/info",
  adminAuth,
  requireMenuAccess("userManagement"),
  requireActionPermission("editUsers"),
  [
    body("personalInfo.firstName").optional().trim().isLength({ min: 1 }),
    body("personalInfo.lastName").optional().trim().isLength({ min: 1 }),
    body("personalInfo.email").optional().isEmail().normalizeEmail(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const user = await User.findByPk(req.params.userId);
      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found" });

      const { personalInfo, phone, currentLevel } = req.body;
      const updates = {};
      if (personalInfo?.firstName) updates.firstName = personalInfo.firstName;
      if (personalInfo?.lastName) updates.lastName = personalInfo.lastName;
      if (personalInfo?.email) updates.email = personalInfo.email;
      if (phone) {
        const dup = await User.findOne({
          where: { phoneNumber: phone, id: { [Op.ne]: req.params.userId } },
        });
        if (dup)
          return res
            .status(400)
            .json({
              success: false,
              message: "Phone number is already registered",
            });
        updates.phoneNumber = phone;
      }
      if (currentLevel) updates.currentLoanLevel = currentLevel;

      await user.update(updates);
      websocketService.broadcastToAdmins("userUpdated", {
        userId: user.id,
        updatedBy: req.admin.id,
        changes: { personalInfo, phone, currentLevel },
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: "User information updated successfully",
        user: {
          _id: user.id,
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          phoneNumber: user.phoneNumber,
          currentLoanLevel: user.currentLoanLevel,
          isActive: user.isActive,
          updatedAt: user.updatedAt,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

// PUT /api/users/:userId/reset-pin (admin)
router.put(
  "/:userId/reset-pin",
  adminAuth,
  requireMenuAccess("userManagement"),
  requireActionPermission("resetPin"),
  [body("newPin").isLength({ min: 4, max: 4 }).isNumeric()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const user = await User.findByPk(req.params.userId);
      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found" });

      // Trigger pin hash via beforeUpdate hook by setting the raw pin
      await user.update({ pin: req.body.newPin });
      websocketService.broadcastToAdmins("userPinReset", {
        userId: user.id,
        resetBy: req.admin.id,
        timestamp: new Date(),
      });

      res.json({ success: true, message: "User PIN reset successfully" });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

// PUT /api/users/:userId/status (admin)
router.put(
  "/:userId/status",
  adminAuth,
  requireMenuAccess("userManagement"),
  requireActionPermission("toggleUserStatus"),
  [body("isActive").isBoolean()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const user = await User.findByPk(req.params.userId);
      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found" });

      await user.update({ isActive: req.body.isActive });
      websocketService.broadcastToAdmins("userStatusChanged", {
        userId: user.id,
        newStatus: req.body.isActive,
        changedBy: req.admin.id,
        timestamp: new Date(),
      });

      res.json({
        success: true,
        message: `User ${req.body.isActive ? "activated" : "deactivated"} successfully`,
        user: {
          _id: user.id,
          userId: user.userId,
          isActive: user.isActive,
          updatedAt: user.updatedAt,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

// PATCH /api/users/me/kyc — submit KYC data from KYC Gate (cedLoan)
router.patch(
  "/me/kyc",
  auth,
  [
    body("employmentStatus").isIn([
      "employed",
      "self-employed",
      "unemployed",
      "student",
      "retired",
    ]),
    body("monthlyIncome").isFloat({ min: 0 }),
    body("educationLevel").isIn([
      "primary",
      "secondary",
      "diploma",
      "bachelor",
      "master",
      "doctorate",
      "tertiary",
      "vocational",
      "postgraduate",
      "university",
      "other",
    ]),
    body("emergencyContacts").isArray({ min: 1 }),
    body("emergencyContacts.*.name").trim().isLength({ min: 1 }),
    body("emergencyContacts.*.relationship").trim().isLength({ min: 1 }),
    body("emergencyContacts.*.phoneNumber").trim().isLength({ min: 1 }),
    body("idType").isIn([
      "national-id",
      "passport",
      "drivers-license",
      "voters-id",
    ]),
    body("idNumber").trim().isLength({ min: 1 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const user = await User.findByPk(req.user.id);
      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      if (user.kycComplete)
        return res
          .status(200)
          .json({ success: true, message: "KYC already completed.", user });

      const {
        employmentStatus,
        employer,
        jobTitle,
        monthlyIncome,
        workAddress,
        yearsOfEmployment,
        educationLevel,
        educationInstitution,
        fieldOfStudy,
        graduationYear,
        emergencyContacts,
        idType,
        idNumber,
        idDocuments,
      } = req.body;

      await user.update({
        employmentStatus,
        employer: employer || null,
        jobTitle: jobTitle || null,
        monthlyIncome,
        workAddress: workAddress || null,
        yearsOfEmployment: yearsOfEmployment || null,
        educationLevel,
        educationInstitution: educationInstitution || null,
        fieldOfStudy: fieldOfStudy || null,
        graduationYear: graduationYear || null,
        emergencyContacts,
        idType,
        idNumber,
        idDocuments: idDocuments || user.idDocuments || [],
        kycComplete: true,
      });

      res.json({ success: true, message: "KYC completed successfully.", user });
    } catch (err) {
      console.error("KYC update error:", err);
      res
        .status(500)
        .json({ success: false, message: "Server error updating KYC." });
    }
  },
);

module.exports = router;
