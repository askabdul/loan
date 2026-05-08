/**
 * middleware/auth.js
 *
 * JWT authentication middleware for users and admins.
 * Uses Sequelize models from models/index.js — no Mongoose dependency.
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Lazy-load models to avoid circular dependency at startup
const getModels = () => require('../models');

const errResp = (code, message) => ({
  success: false,
  error: { code, message, id: crypto.randomBytes(8).toString('hex').toUpperCase() },
});

const extractToken = (req) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }
  return null;
};

// ── User auth middleware ───────────────────────────────────────────────────────
const auth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json(errResp('AUTH_001', 'Authentication required. Please log in to continue.'));

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json(errResp('AUTH_003', 'Invalid authentication token. Please log in again.'));
    }

    const { User } = getModels();
    const user = await User.findByPk(decoded.id);
    if (!user) return res.status(401).json(errResp('AUTH_003', 'Invalid authentication token. Please log in again.'));
    if (!user.isActive) return res.status(401).json(errResp('AUTH_002', 'You do not have permission to perform this action.'));
    if (user.changedPasswordAfter(decoded.iat)) return res.status(401).json(errResp('AUTH_004', 'Your session has expired. Please log in again.'));

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json(errResp('SYS_001', 'An unexpected error occurred. Our team has been notified.'));
  }
};

// ── Admin auth middleware ──────────────────────────────────────────────────────
const adminAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json(errResp('AUTH_001', 'Authentication required. Please log in to continue.'));

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json(errResp('AUTH_003', 'Invalid authentication token. Please log in again.'));
    }

    if (decoded.type !== 'admin') {
      return res.status(401).json(errResp('AUTH_003', 'Invalid authentication token. Please log in again.'));
    }

    const { Admin, Role } = getModels();
    const admin = await Admin.findByPk(decoded.id, {
      include: [{ model: Role, as: 'Role' }],
    });

    if (!admin) return res.status(401).json(errResp('AUTH_003', 'Invalid authentication token. Please log in again.'));
    if (!admin.isActive) return res.status(401).json(errResp('AUTH_002', 'You do not have permission to perform this action.'));
    if (admin.isLocked()) return res.status(401).json(errResp('AUTH_002', 'Account is temporarily locked. Please try again later.'));
    if (admin.changedPasswordAfter(decoded.iat)) return res.status(401).json(errResp('AUTH_004', 'Your session has expired. Please log in again.'));

    req.admin = admin;
    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    return res.status(500).json(errResp('SYS_001', 'An unexpected error occurred. Our team has been notified.'));
  }
};

// ── Optional auth ─────────────────────────────────────────────────────────────
const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { User } = getModels();
        const user = await User.findByPk(decoded.id);
        if (user && user.isActive && !user.changedPasswordAfter(decoded.iat)) req.user = user;
      } catch { /* silent */ }
    }
    next();
  } catch { next(); }
};

// ── Role-based access for user routes ────────────────────────────────────────
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json(errResp('AUTH_001', 'Authentication required. Please log in to continue.'));
  if (!roles.includes(req.user.role)) return res.status(403).json(errResp('AUTH_002', 'You do not have permission to perform this action.'));
  next();
};

// ── Per-permission check for admins ──────────────────────────────────────────
const requirePermission = (permission) => async (req, res, next) => {
  if (!req.admin) return res.status(401).json(errResp('AUTH_001', 'Authentication required. Please log in to continue.'));
  try {
    const role = req.admin.Role;
    if (role && role.name === 'super-admin') return next();
    const canDo = await req.admin.canPerformAction(permission);
    if (!canDo) return res.status(403).json(errResp('AUTH_002', 'You do not have permission to perform this action.'));
    next();
  } catch (error) {
    console.error('Permission check error:', error);
    return res.status(500).json(errResp('SYS_001', 'An unexpected error occurred.'));
  }
};

module.exports = { auth, adminAuth, optionalAuth, authorize, requirePermission };
