const { Op } = require("sequelize");
// Models lazy-loaded to avoid circular deps
const getModels = () => require("../models");

// Middleware to check if admin has specific menu access
const requireMenuAccess = (menuName) => {
  return async (req, res, next) => {
    try {
      const admin = req.admin;
      if (!admin) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // Super Admin bypass

      if (admin.Role && admin.Role?.name === "super-admin") {
        return next();
      }

      const hasAccess = await admin.canAccessMenu(menuName);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: `Access denied to ${menuName} menu`,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error checking menu permissions",
        error: error.message,
      });
    }
  };
};

// Middleware to check if admin has specific sub-menu access
const requireSubMenuAccess = (menuName, subMenuName) => {
  return async (req, res, next) => {
    try {
      const admin = req.admin;
      if (!admin) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // Super Admin bypass

      if (admin.Role && admin.Role?.name === "super-admin") {
        return next();
      }

      const hasAccess = await admin.canAccessSubMenu(menuName, subMenuName);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: `Access denied to ${menuName}.${subMenuName}`,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error checking sub-menu permissions",
        error: error.message,
      });
    }
  };
};

// Middleware to check if admin has specific data access
const requireDataAccess = (dataType, accessLevel = null) => {
  return async (req, res, next) => {
    try {
      const admin = req.admin;
      if (!admin) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // Super Admin bypass

      if (admin.Role && admin.Role?.name === "super-admin") {
        return next();
      }

      const hasAccess = accessLevel
        ? await admin.canAccessData(dataType, accessLevel)
        : await admin.canAccessData(dataType);

      if (!hasAccess) {
        const message = accessLevel
          ? `Access denied to ${dataType}.${accessLevel} data`
          : `Access denied to ${dataType} data`;
        return res.status(403).json({
          success: false,
          message,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error checking data access permissions",
        error: error.message,
      });
    }
  };
};

// Middleware to check if admin can perform specific action
const requireActionPermission = (actionName) => {
  return async (req, res, next) => {
    try {
      const admin = req.admin;
      if (!admin) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // Super Admin bypass

      if (admin.Role && admin.Role?.name === "super-admin") {
        return next();
      }

      const canPerform = await admin.canPerformAction(actionName);
      if (!canPerform) {
        return res.status(403).json({
          success: false,
          message: `Permission denied for action: ${actionName}`,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error checking action permissions",
        error: error.message,
      });
    }
  };
};

// Middleware to check if admin has specific UI element access
const requireUIElementAccess = (elementType, elementName) => {
  return async (req, res, next) => {
    try {
      const admin = req.admin;
      if (!admin) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // Super Admin bypass

      if (admin.Role && admin.Role?.name === "super-admin") {
        return next();
      }

      const hasAccess =
        admin.Role?.permissions?.uiElements?.[elementType]?.[elementName] ===
        true;

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: `Access denied to ${elementType}: ${elementName}`,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error checking UI element permissions",
        error: error.message,
      });
    }
  };
};

// Middleware to check if admin has specific button access
const requireButtonAccess = (buttonName) => {
  return requireUIElementAccess("buttons", buttonName);
};

// Middleware to check if admin has specific table access
const requireTableAccess = (tableName) => {
  return requireUIElementAccess("tables", tableName);
};

// Middleware to check if admin has specific modal access
const requireModalAccess = (modalName) => {
  return requireUIElementAccess("modals", modalName);
};

// Middleware to check if admin has specific form access
const requireFormAccess = (formName) => {
  return requireUIElementAccess("forms", formName);
};

// Middleware to check if admin has specific navigation access
const requireNavigationAccess = (navName) => {
  return requireUIElementAccess("navigation", navName);
};

// Middleware to check if admin has specific widget access
const requireWidgetAccess = (widgetName) => {
  return requireUIElementAccess("widgets", widgetName);
};

// Middleware to filter loans based on admin's role and assignments
const filterLoansByRole = async (req, res, next) => {
  try {
    const admin = req.admin;
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Super Admin bypass - can view all loans without filtering

    if (admin.Role && admin.Role?.name === "super-admin") {
      req.loanFilter = {};
      return next();
    }

    const canViewAll = await admin.canAccessData("viewAllLoans");
    const canViewAssigned = await admin.canAccessData("viewAssignedLoans");

    if (!canViewAll && !canViewAssigned) {
      return res.status(403).json({
        success: false,
        message: "No permission to view loan data",
      });
    }

    // If admin can view all loans, no filtering needed
    if (canViewAll) {
      req.loanFilter = {};
      return next();
    }

    // If admin can only view assigned loans, filter by assignments and reviewed loans
    if (canViewAssigned) {
      const assignedLoanIds = admin.getAssignedLoanIds
        ? admin.getAssignedLoanIds()
        : [];
      req.loanFilter = {
        [Op.or]: [
          ...(assignedLoanIds.length
            ? [{ id: { [Op.in]: assignedLoanIds } }]
            : []),
          { assignedOfficerId: admin.id }, // Loans assigned to this officer
          { reviewedById: admin.id }, // Loans reviewed by this officer
        ],
      };
      return next();
    }

    // Default: no access
    return res.status(403).json({
      success: false,
      message: "Access denied to loan data",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error filtering loans by role",
      error: error.message,
    });
  }
};

// Middleware to check if admin can view specific loan
const requireLoanAccess = async (req, res, next) => {
  try {
    const admin = req.admin;
    const loanId = req.params.id || req.params.loanId;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!loanId) {
      return res.status(400).json({
        success: false,
        message: "Loan ID is required",
      });
    }

    // Super Admin bypass

    if (admin.Role && admin.Role?.name === "super-admin") {
      return next();
    }

    const canView = await admin.canViewLoan(loanId);
    if (!canView) {
      return res.status(403).json({
        success: false,
        message: "Access denied to this loan",
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error checking loan access",
      error: error.message,
    });
  }
};

// Middleware to get admin permissions for frontend
const getAdminPermissions = async (req, res, next) => {
  try {
    const admin = req.admin;
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const permissions = await admin.getEffectivePermissions();
    req.adminPermissions = permissions;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error getting admin permissions",
      error: error.message,
    });
  }
};

// Middleware to check role hierarchy (for admin management)
const requireRoleHierarchy = async (req, res, next) => {
  try {
    const admin = req.admin;
    const targetAdminId = req.params.adminId || req.body.adminId;

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Super admin can manage anyone
    if (admin.Role?.name === "super-admin") {
      return next();
    }

    // Admin can manage lower roles but not super-admin or other admins
    if (admin.Role?.name === "admin") {
      if (targetAdminId) {
        const { Admin, Role } = getModels();
        const targetAdmin = await Admin.findByPk(targetAdminId, {
          include: [{ model: Role, as: "Role" }],
        });
        if (
          targetAdmin &&
          ["super-admin", "admin"].includes(targetAdmin.Role?.name)
        ) {
          return res.status(403).json({
            success: false,
            message: "Cannot manage admin of equal or higher role",
          });
        }
      }
      return next();
    }

    // Other roles cannot manage admins
    return res.status(403).json({
      success: false,
      message: "Insufficient privileges for admin management",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error checking role hierarchy",
      error: error.message,
    });
  }
};

// Middleware to filter user data based on admin's data access permissions
const filterUserData = async (req, res, next) => {
  try {
    const admin = req.admin;
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Super Admin bypass - can access all user data

    if (admin.Role && admin.Role?.name === "super-admin") {
      req.userDataFilter = {
        personalInfo: true,
        phone: true,
        financialInfo: true,
        loanHistory: true,
        workInfo: true,
      };
      return next();
    }

    // Check what user data the admin can access
    const canAccessPersonalInfo = await admin.canAccessData(
      "users",
      "personalInfo",
    );
    const canAccessPhone = await admin.canAccessData("users", "phone");
    const canAccessFinancialInfo = await admin.canAccessData(
      "users",
      "financialInfo",
    );
    const canAccessLoanHistory = await admin.canAccessData(
      "users",
      "loanHistory",
    );
    const canAccessWorkInfo = await admin.canAccessData("users", "workInfo");

    req.userDataFilter = {
      personalInfo: canAccessPersonalInfo,
      phone: canAccessPhone,
      financialInfo: canAccessFinancialInfo,
      loanHistory: canAccessLoanHistory,
      workInfo: canAccessWorkInfo,
    };

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error filtering user data permissions",
      error: error.message,
    });
  }
};

// Middleware to filter loan data based on admin's data access permissions
const filterLoanData = async (req, res, next) => {
  try {
    const admin = req.admin;
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Super Admin bypass - can access all loan data

    if (admin.Role && admin.Role?.name === "super-admin") {
      req.loanDataFilter = {
        basic: true,
        amount: true,
        terms: true,
        history: true,
        documents: true,
      };
      return next();
    }

    // Check what loan data the admin can access
    const canAccessBasic = await admin.canAccessData("loans", "basic");
    const canAccessAmount = await admin.canAccessData("loans", "amount");
    const canAccessTerms = await admin.canAccessData("loans", "terms");
    const canAccessHistory = await admin.canAccessData("loans", "history");
    const canAccessDocuments = await admin.canAccessData("loans", "documents");

    req.loanDataFilter = {
      basic: canAccessBasic,
      amount: canAccessAmount,
      terms: canAccessTerms,
      history: canAccessHistory,
      documents: canAccessDocuments,
    };

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error filtering loan data permissions",
      error: error.message,
    });
  }
};

// Middleware to filter payment data based on admin's data access permissions
const filterPaymentData = async (req, res, next) => {
  try {
    const admin = req.admin;
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Super Admin bypass - can access all payment data

    if (admin.Role && admin.Role?.name === "super-admin") {
      req.paymentDataFilter = {
        amount: true,
        provider: true,
        details: true,
      };
      return next();
    }

    // Check what payment data the admin can access
    const canAccessAmount = await admin.canAccessData("payments", "amount");
    const canAccessProvider = await admin.canAccessData("payments", "provider");
    const canAccessDetails = await admin.canAccessData("payments", "details");

    req.paymentDataFilter = {
      amount: canAccessAmount,
      provider: canAccessProvider,
      details: canAccessDetails,
    };

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error filtering payment data permissions",
      error: error.message,
    });
  }
};

// Middleware to check multiple permissions at once
const requireMultiplePermissions = (permissions) => {
  return async (req, res, next) => {
    try {
      const admin = req.admin;
      if (!admin) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // Super Admin bypass

      if (admin.Role && admin.Role?.name === "super-admin") {
        return next();
      }

      const results = await Promise.all(
        permissions.map(async (permission) => {
          const { type, name, level } = permission;
          switch (type) {
            case "menu":
              return await admin.canAccessMenu(name);
            case "submenu":
              return await admin.canAccessSubMenu(permission.menu, name);
            case "action":
              return await admin.canPerformAction(name);
            case "data":
              return level
                ? await admin.canAccessData(name, level)
                : await admin.canAccessData(name);
            default:
              return false;
          }
        }),
      );

      const hasAllPermissions = results.every((result) => result === true);
      if (!hasAllPermissions) {
        return res.status(403).json({
          success: false,
          message: "Insufficient permissions for this operation",
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Error checking multiple permissions",
        error: error.message,
      });
    }
  };
};

module.exports = {
  requireMenuAccess,
  requireSubMenuAccess,
  requireDataAccess,
  requireActionPermission,
  requireUIElementAccess,
  requireButtonAccess,
  requireTableAccess,
  requireModalAccess,
  requireFormAccess,
  requireNavigationAccess,
  requireWidgetAccess,
  filterLoansByRole,
  requireLoanAccess,
  getAdminPermissions,
  requireRoleHierarchy,
  filterUserData,
  filterLoanData,
  filterPaymentData,
  requireMultiplePermissions,
};
