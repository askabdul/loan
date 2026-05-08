// permissions middleware - admin.Role loaded by adminAuth middleware

/**
 * Middleware to check if admin has specific permission
 * @param {string} permission - The permission to check
 * @returns {Function} Express middleware function
 */
const hasPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const admin = req.admin;
      if (!admin) {
        return res.status(401).json({
          success: false,
          error: {
            code: "AUTH_001",
            message: "Authentication required. Please log in to continue.",
            id: require("crypto").randomBytes(8).toString("hex").toUpperCase(),
          },
        });
      }

      // Super Admin bypass
      if (admin.Role && admin.Role.name === "super-admin") {
        return next();
      }

      // Check if admin has the required permission
      const hasAccess = await admin.canPerformAction(permission);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: {
            code: "AUTH_002",
            message: "You do not have permission to perform this action.",
            id: require("crypto").randomBytes(8).toString("hex").toUpperCase(),
          },
        });
      }

      next();
    } catch (error) {
      console.error("Permission check error:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "SYS_001",
          message: "An unexpected error occurred. Our team has been notified.",
          id: require("crypto").randomBytes(8).toString("hex").toUpperCase(),
        },
      });
    }
  };
};

/**
 * Middleware to check multiple permissions
 * @param {Array} permissions - Array of permissions to check
 * @returns {Function} Express middleware function
 */
const hasAnyPermission = (permissions) => {
  return async (req, res, next) => {
    try {
      const admin = req.admin;
      if (!admin) {
        return res.status(401).json({
          success: false,
          error: {
            code: "AUTH_001",
            message: "Authentication required. Please log in to continue.",
            id: require("crypto").randomBytes(8).toString("hex").toUpperCase(),
          },
        });
      }

      // Super Admin bypass
      if (admin.Role && admin.Role.name === "super-admin") {
        return next();
      }

      // Check if admin has any of the required permissions
      const permissionChecks = await Promise.all(
        permissions.map((permission) => admin.canPerformAction(permission)),
      );

      const hasAnyAccess = permissionChecks.some((hasAccess) => hasAccess);
      if (!hasAnyAccess) {
        return res.status(403).json({
          success: false,
          error: {
            code: "AUTH_002",
            message: "You do not have permission to perform this action.",
            id: require("crypto").randomBytes(8).toString("hex").toUpperCase(),
          },
        });
      }

      next();
    } catch (error) {
      console.error("Permission check error:", error);
      return res.status(500).json({
        success: false,
        error: {
          code: "SYS_001",
          message: "An unexpected error occurred. Our team has been notified.",
          id: require("crypto").randomBytes(8).toString("hex").toUpperCase(),
        },
      });
    }
  };
};

/**
 * Middleware to check all permissions
 * @param {Array} permissions - Array of permissions to check
 * @returns {Function} Express middleware function
 */
const hasAllPermissions = (permissions) => {
  return async (req, res, next) => {
    try {
      const admin = req.admin;
      if (!admin) {
        return res.status(401).json({
          success: false,
          error: {
            code: "AUTH_001",
            message: "Authentication required. Please log in to continue.",
            id: require("crypto").randomBytes(8).toString("hex").toUpperCase(),
          },
        });
      }

      // Super Admin bypass
      if (admin.Role && admin.Role.name === "super-admin") {
        return next();
      }

      // Check if admin has all required permissions
      const permissionChecks = await Promise.all(
        permissions.map((permission) => admin.canPerformAction(permission)),
      );

      const hasAllAccess = permissionChecks.every((hasAccess) => hasAccess);
      if (!hasAllAccess) {
        return res.status(403).json({
          success: false,
          error: {
            code: "AUTH_002",
            message: "You do not have permission to perform this action.",
            id: require("crypto").randomBytes(8).toString("hex").toUpperCase(),
          },
        });
      }

      next();
    } catch (error) {
      console.error("Permission check error:", error);
      return res.status(500).json({
        success: false,
        message: "Error checking permissions",
        error: error.message,
      });
    }
  };
};

module.exports = {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
};
