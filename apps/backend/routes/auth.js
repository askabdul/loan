const express = require("express");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const { body, validationResult } = require("express-validator");
const { User } = require("../models");
const { auth } = require("../middleware/auth");

const router = express.Router();

// ── In-memory OTP store ───────────────────────────────────────────────────────
// Map<phoneNumber, { otp, expiresAt, sentAt, attempts }>
const otpStore = new Map();
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_OTP_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between sends

const generateOTP = () => String(Math.floor(100000 + Math.random() * 900000));

// Sweep expired entries every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, val] of otpStore.entries()) {
      if (val.expiresAt < now) otpStore.delete(key);
    }
  },
  5 * 60 * 1000,
).unref();

// ── Helpers ───────────────────────────────────────────────────────────────────
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || "7d",
  });

const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user.id);
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user.id,
      userId: user.userId,
      email: user.email,
      phoneNumber: user.phoneNumber,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.getFullName
        ? user.getFullName()
        : `${user.firstName} ${user.lastName}`,
      currentLoanLevel: user.currentLoanLevel,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      registrationComplete: user.registrationComplete,
      kycComplete: user.kycComplete,
      mustChangePinOnLogin: user.mustChangePinOnLogin,
    },
  });
};

const validPhone = body("phoneNumber").custom((value) => {
  if (/^0[2-9]\d{8}$/.test(value) || /^\+233[2-9]\d{8}$/.test(value))
    return true;
  throw new Error(
    "Please provide a valid Ghana phone number (0XXXXXXXXX or +233XXXXXXXXX)",
  );
});

// ── POST /check-phone ─────────────────────────────────────────────────────────
router.post(
  "/check-phone",
  [body("phone").isMobilePhone()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });
      const user = await User.findOne({
        where: { phoneNumber: req.body.phone },
      });
      res.json({ success: true, exists: !!user });
    } catch (error) {
      console.error("Check phone error:", error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },
);

// ── POST /send-otp ────────────────────────────────────────────────────────────
router.post("/send-otp", [validPhone], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ success: false, errors: errors.array() });

  const { phoneNumber } = req.body;

  // Rate-limit: 1 send per minute per phone
  const existing = otpStore.get(phoneNumber);
  if (existing && Date.now() < existing.sentAt + OTP_RESEND_COOLDOWN_MS) {
    return res.status(429).json({
      success: false,
      message: "Please wait 60 seconds before requesting another code.",
    });
  }

  const otp = generateOTP();
  otpStore.set(phoneNumber, {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    sentAt: Date.now(),
    attempts: 0,
  });

  // TODO: integrate SMS provider (Arkesel/Twilio) for production
  const exposeOtp = process.env.NODE_ENV !== "production" || process.env.EXPOSE_DEV_OTP === "true";
  if (exposeOtp) {
    console.log(`[DEV OTP] ${phoneNumber} → ${otp}`);
  }

  res.json({
    success: true,
    message: "Verification code sent",
    ...(exposeOtp && { devOtp: otp }),
  });
});

// ── POST /verify-otp ──────────────────────────────────────────────────────────
router.post(
  "/verify-otp",
  [validPhone, body("otp").isLength({ min: 6, max: 6 }).isNumeric()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ success: false, errors: errors.array() });

    const { phoneNumber, otp } = req.body;
    const record = otpStore.get(phoneNumber);

    if (!record || Date.now() > record.expiresAt) {
      otpStore.delete(phoneNumber);
      return res.status(400).json({
        success: false,
        message: "Verification code expired. Please request a new one.",
      });
    }

    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      otpStore.delete(phoneNumber);
      return res.status(429).json({
        success: false,
        message: "Too many failed attempts. Please request a new code.",
      });
    }

    if (record.otp !== otp) {
      record.attempts += 1;
      return res
        .status(400)
        .json({ success: false, message: "Invalid verification code." });
    }

    // Verified — consume the OTP (prevents replay)
    otpStore.delete(phoneNumber);
    res.json({ success: true, message: "Phone verified successfully." });
  },
);

// ── POST /register/complete ───────────────────────────────────────────────────
// Lightweight registration: phone + PIN + personal info only.
// KYC data is NOT collected here — it is collected at the KYC Gate when the
// user first applies for a loan.
router.post(
  "/register/complete",
  [
    validPhone,
    body("pin")
      .isLength({ min: 4, max: 4 })
      .isNumeric()
      .withMessage("PIN must be exactly 4 digits"),
    body("firstName").trim().isLength({ min: 1 }),
    body("lastName").trim().isLength({ min: 1 }),
    body("dateOfBirth").isISO8601().toDate(),
    body("gender").isIn(["male", "female", "other"]),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const {
        phoneNumber,
        pin,
        firstName,
        lastName,
        dateOfBirth,
        gender,
        address,
        email,
      } = req.body;

      // Age validation: must be 18+
      const dob = new Date(dateOfBirth);
      const age = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (age < 18) {
        return res.status(400).json({
          success: false,
          message: "You must be at least 18 years old to register.",
        });
      }

      // Duplicate phone check
      const existing = await User.findOne({ where: { phoneNumber } });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "An account with this phone number already exists.",
        });
      }

      if (email) {
        const existingEmail = await User.findOne({ where: { email } });
        if (existingEmail) {
          return res.status(400).json({
            success: false,
            message: "An account with this email already exists.",
          });
        }
      }

      const user = await User.create({
        phoneNumber,
        pin,
        email: email || null,
        authMethod: "phone-pin",
        firstName,
        lastName,
        dateOfBirth: dob,
        gender,
        address: address
          ? {
              street: address.street,
              city: address.city,
              region: address.region,
              country: address.country || "Ghana",
            }
          : { country: "Ghana" },
        isPhoneVerified: true,
        registrationComplete: true,
        kycComplete: false,
        mustChangePinOnLogin: false,
      });

      sendTokenResponse(user, 201, res);
    } catch (error) {
      console.error("Register complete error:", error);
      res
        .status(500)
        .json({ success: false, message: "Server error during registration." });
    }
  },
);

// ── POST /register/minimal ────────────────────────────────────────────────────
// New lightweight registration: phone + PIN only.
// Personal info is collected later at the KYC Gate when applying for a loan.
router.post(
  "/register/minimal",
  [
    validPhone,
    body("pin")
      .isLength({ min: 4, max: 4 })
      .isNumeric()
      .withMessage("PIN must be exactly 4 digits"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { phoneNumber, pin } = req.body;

      const existing = await User.findOne({ where: { phoneNumber } });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "An account with this phone number already exists.",
        });
      }

      const user = await User.create({
        phoneNumber,
        pin,
        authMethod: "phone-pin",
        isPhoneVerified: true,
        registrationComplete: false,
        kycComplete: false,
        mustChangePinOnLogin: false,
      });

      sendTokenResponse(user, 201, res);
    } catch (error) {
      console.error("Register minimal error:", error);
      res
        .status(500)
        .json({ success: false, message: "Server error during registration." });
    }
  },
);

// ── POST /register-phone ──────────────────────────────────────────────────────
router.post(
  "/register-phone",
  [
    validPhone,
    body("pin").isLength({ min: 4, max: 4 }).isString(),
    body("personalInfo.firstName").trim().isLength({ min: 1 }),
    body("personalInfo.lastName").trim().isLength({ min: 1 }),
    body("personalInfo.email").isEmail().normalizeEmail(),
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
      } = req.body;

      // Duplicate phone check
      const allPhones = [
        phoneNumber,
        ...(emergencyContacts || []).map((c) => c.phoneNumber).filter(Boolean),
      ];
      if (new Set(allPhones).size !== allPhones.length) {
        return res.status(400).json({
          success: false,
          message: "Duplicate phone numbers detected.",
        });
      }

      const existingPhone = await User.findOne({
        where: { phoneNumber: { [Op.in]: allPhones } },
      });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: "One or more phone numbers already registered.",
        });
      }

      if (personalInfo.email) {
        const existingEmail = await User.findOne({
          where: { email: personalInfo.email },
        });
        if (existingEmail)
          return res
            .status(400)
            .json({ success: false, message: "Email already registered." });
      }

      const user = await User.create({
        phoneNumber,
        pin,
        email: personalInfo.email,
        authMethod: "phone-pin",
        firstName: personalInfo.firstName,
        lastName: personalInfo.lastName,
        dateOfBirth: personalInfo.dateOfBirth,
        gender: personalInfo.gender,
        maritalStatus: personalInfo.maritalStatus,
        address: {
          street: personalInfo.address,
          city: personalInfo.city,
          state: personalInfo.state,
          postalCode: personalInfo.postalCode,
          country: "Ghana",
        },
        employmentStatus: workInfo?.employmentStatus,
        employer: workInfo?.employer,
        jobTitle: workInfo?.jobTitle,
        monthlyIncome: workInfo?.monthlyIncome,
        workAddress: workInfo?.workAddress,
        yearsOfEmployment: workInfo?.yearsOfEmployment,
        educationLevel: educationInfo?.highestLevel,
        educationInstitution: educationInfo?.institution,
        fieldOfStudy: educationInfo?.fieldOfStudy,
        graduationYear: educationInfo?.graduationYear,
        emergencyContacts: emergencyContacts.map((c) => ({
          name: c.name,
          relationship: c.relationship,
          phoneNumber: c.phoneNumber,
          email: c.email,
        })),
        idType: idVerification?.idType,
        idNumber: idVerification?.idNumber,
        idVerified: false,
        isPhoneVerified: true,
        registrationComplete: true,
      });

      sendTokenResponse(user, 201, res);
    } catch (error) {
      console.error("Phone registration error:", error);
      res
        .status(500)
        .json({ success: false, message: "Server error during registration" });
    }
  },
);

// ── POST /register ────────────────────────────────────────────────────────────
router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
    body("firstName").trim().isLength({ min: 1 }),
    body("lastName").trim().isLength({ min: 1 }),
    body("phoneNumber").isMobilePhone(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { email, password, firstName, lastName, phoneNumber } = req.body;

      const existing = await User.findOne({
        where: { [Op.or]: [{ email }, { phoneNumber }] },
      });
      if (existing)
        return res.status(400).json({
          success: false,
          message: "User already exists with this email or phone.",
        });

      const user = await User.create({
        email,
        password,
        pin: "0000",
        firstName,
        lastName,
        phoneNumber,
      });
      sendTokenResponse(user, 201, res);
    } catch (error) {
      console.error("Registration error:", error);
      res
        .status(500)
        .json({ success: false, message: "Server error during registration" });
    }
  },
);

// ── POST /login ───────────────────────────────────────────────────────────────
router.post(
  "/login",
  [
    body("phone").isMobilePhone(),
    body("pin").isLength({ min: 4, max: 4 }).isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({
          success: false,
          message: "Please provide valid phone and PIN.",
        });

      const { phone, pin } = req.body;
      const user = await User.scope("withPin").findOne({
        where: { phoneNumber: phone },
      });

      if (!user || !(await user.correctPin(pin))) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid credentials" });
      }

      await user.update({ lastLogin: new Date() });
      sendTokenResponse(user, 200, res);
    } catch (error) {
      console.error("Login error:", error);
      res
        .status(500)
        .json({ success: false, message: "Server error during login" });
    }
  },
);

// ── POST /reset-pin-request ───────────────────────────────────────────────────
router.post(
  "/reset-pin-request",
  [body("phone").isMobilePhone()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { phone } = req.body;

      const user = await User.findOne({ where: { phoneNumber: phone } });
      if (!user)
        return res.status(404).json({
          success: false,
          message: "No account found with this phone number.",
        });

      // Rate-limit
      const existing = otpStore.get(phone);
      if (existing && Date.now() < existing.sentAt + OTP_RESEND_COOLDOWN_MS) {
        return res.status(429).json({
          success: false,
          message: "Please wait 60 seconds before requesting another code.",
        });
      }

      const otp = generateOTP();
      otpStore.set(phone, {
        otp,
        expiresAt: Date.now() + OTP_TTL_MS,
        sentAt: Date.now(),
        attempts: 0,
      });

      // TODO: integrate SMS provider (Arkesel/Twilio) for production
      const exposeOtp = process.env.NODE_ENV !== "production" || process.env.EXPOSE_DEV_OTP === "true";
      if (exposeOtp) {
        console.log(`[DEV OTP - PIN RESET] ${phone} → ${otp}`);
      }

      res.json({
        success: true,
        message: "Verification code sent to your phone.",
        ...(exposeOtp && { devOtp: otp }),
      });
    } catch (error) {
      console.error("PIN reset request error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process PIN reset request.",
      });
    }
  },
);

// ── POST /reset-pin-verify ────────────────────────────────────────────────────
router.post(
  "/reset-pin-verify",
  [
    body("phone").isMobilePhone(),
    body("otp").isLength({ min: 6, max: 6 }).isNumeric(),
    body("newPin").isLength({ min: 4, max: 4 }).isNumeric(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res.status(400).json({ success: false, errors: errors.array() });

      const { phone, otp, newPin } = req.body;
      const record = otpStore.get(phone);

      if (!record || Date.now() > record.expiresAt) {
        otpStore.delete(phone);
        return res.status(400).json({
          success: false,
          message: "Verification code expired. Please request a new one.",
        });
      }

      if (record.attempts >= MAX_OTP_ATTEMPTS) {
        otpStore.delete(phone);
        return res.status(429).json({
          success: false,
          message: "Too many failed attempts. Please request a new code.",
        });
      }

      if (record.otp !== otp) {
        record.attempts += 1;
        return res
          .status(400)
          .json({ success: false, message: "Invalid verification code." });
      }

      const user = await User.findOne({ where: { phoneNumber: phone } });
      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found." });

      user.pin = newPin;
      await user.save();

      // Consume OTP
      otpStore.delete(phone);
      res.json({ success: true, message: "PIN reset successfully." });
    } catch (error) {
      console.error("PIN reset verify error:", error);
      res.status(500).json({ success: false, message: "Failed to reset PIN." });
    }
  },
);

// ── POST /set-pin ─────────────────────────────────────────────────────────────
router.post(
  "/set-pin",
  auth,
  [body("pin").isLength({ min: 4, max: 4 }).isString()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res
          .status(400)
          .json({ success: false, message: "PIN must be 4 digits." });
      req.user.pin = req.body.pin;
      await req.user.save();
      res.json({ success: true, message: "PIN set successfully." });
    } catch (error) {
      console.error("Set PIN error:", error);
      res.status(500).json({ success: false, message: "Server error." });
    }
  },
);

// ── POST /verify-pin ──────────────────────────────────────────────────────────
router.post(
  "/verify-pin",
  auth,
  [body("pin").isLength({ min: 4, max: 4 }).isString()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty())
        return res
          .status(400)
          .json({ success: false, message: "PIN must be 4 digits." });

      const user = await User.scope("withPin").findByPk(req.user.id);
      const isMatch = await user.correctPin(req.body.pin);
      if (!isMatch)
        return res
          .status(401)
          .json({ success: false, message: "Invalid PIN." });
      res.json({ success: true, message: "PIN verified successfully." });
    } catch (error) {
      console.error("Verify PIN error:", error);
      res.status(500).json({ success: false, message: "Server error." });
    }
  },
);

// ── GET /me ───────────────────────────────────────────────────────────────────
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    res.json({ success: true, user });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

// ── POST /logout ──────────────────────────────────────────────────────────────
router.post("/logout", auth, (req, res) => {
  res.json({ success: true, message: "Logged out successfully." });
});

module.exports = router;
