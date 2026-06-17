import React, { createContext, useContext, useState, useEffect } from 'react';
import apiService from '../services/api';
import { clearTabStorage } from './TabContext';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('adminToken'));
  const [permissions, setPermissions] = useState(null);
  const [loading, setLoading] = useState(true);
  const hasUser = Boolean(user);

  useEffect(() => {
    // Check if user is logged in on app start
    const storedToken = localStorage.getItem('adminToken');
    const storedUser = localStorage.getItem('adminUser');
    const storedPermissions = localStorage.getItem('adminPermissions');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        setUser(null);
      }
      if (storedPermissions) {
        try {
          setPermissions(JSON.parse(storedPermissions));
        } catch {
          setPermissions(null);
        }
      }
      // Always fetch fresh permissions so role updates reflect after refresh
      fetchPermissions();
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
      setPermissions(null);
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      localStorage.removeItem('adminPermissions');
    };

    window.addEventListener('admin:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('admin:unauthorized', handleUnauthorized);
  }, []);

  const fetchPermissions = async () => {
    const activeToken = localStorage.getItem('adminToken');
    if (!activeToken) {
      return;
    }

    try {
      const resp = await apiService.getAdminPermissions();
      const perms = resp?.data?.permissions || resp?.data?.data?.permissions;
      const roleName = resp?.data?.role || resp?.data?.data?.role;
      if (perms) {
        setPermissions(perms);
        localStorage.setItem('adminPermissions', JSON.stringify(perms));
      }
      if (roleName) {
        setUser((prevUser) => {
          if (!prevUser) return prevUser;
          const prevRoleName = prevUser?.role?.name || prevUser?.Role?.name;
          if (prevRoleName === roleName) {
            return prevUser;
          }
          const nextUser = {
            ...prevUser,
            role:
              prevUser?.role && typeof prevUser.role === 'object'
                ? { ...prevUser.role, name: roleName }
                : { name: roleName },
            Role:
              prevUser?.Role && typeof prevUser.Role === 'object'
                ? { ...prevUser.Role, name: roleName }
                : { name: roleName },
          };
          localStorage.setItem('adminUser', JSON.stringify(nextUser));
          return nextUser;
        });
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  };

  useEffect(() => {
    if (!token || !hasUser) return;

    const handleVisibilityRefresh = () => {
      if (document.visibilityState === 'visible') {
        fetchPermissions();
      }
    };

    const handleFocusRefresh = () => fetchPermissions();
    const intervalId = setInterval(() => fetchPermissions(), 60000);

    window.addEventListener('focus', handleFocusRefresh);
    document.addEventListener('visibilitychange', handleVisibilityRefresh);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocusRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
    };
  }, [token, hasUser]);

  const login = async (emailOrUsername, password) => {
    try {
      const data = await apiService.login({ login: emailOrUsername, password });

      if (data?.success) {
        // Clear any tabs from a previous user's session before setting new credentials
        clearTabStorage();
        window.dispatchEvent(new Event('admin:session-reset'));

        setToken(data.token);
        setUser(data.admin);
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminUser', JSON.stringify(data.admin));

        // Fetch permissions after successful login
        await fetchPermissions();

        return { success: true };
      } else {
        throw new Error(data?.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      const firstValidationError =
        Array.isArray(error?.response?.data?.errors) &&
        error.response.data.errors.length > 0
          ? error.response.data.errors[0]?.msg
          : null;
      const message =
        firstValidationError ||
        error?.response?.data?.message ||
        error.message ||
        'Login failed';
      return { success: false, message };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setPermissions(null);
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    localStorage.removeItem('adminPermissions');
    clearTabStorage();
  };

  const isAuthenticated = () => {
    return !!(token && user);
  };

  // Helper function to check if user is super admin (God Mode)
  const isSuperAdmin = () => {
    return user?.role?.name === 'super-admin';
  };

  const normalizeKey = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  const menuAliasGroups = {
    user: ["user", "usermanagement", "usermanagement"],
    order: ["order", "loanmanagement"],
    precollection: ["precollection"],
    collection: ["collection"],
    creditreview: ["creditreview"],
    fundmanagement: ["fundmanagement"],
    appconfiguration: ["appconfiguration", "systemconfig", "config"],
    datastatistics: ["datastatistics", "dashboard", "analytics"],
    system: ["system", "adminmanagement"],
    contentmanagement: ["contentmanagement", "content"],
    notificationmanagement: ["notificationmanagement", "notifications"],
  };

  const normalizeMenuGroup = (value) => {
    const key = normalizeKey(value);
    const group = Object.entries(menuAliasGroups).find(([, aliases]) =>
      aliases.includes(key),
    );
    return group ? group[0] : key;
  };

  const actionAliasGroups = {
    updateLoanStatus: [
      "updateLoanStatus",
      "approveLoans",
      "rejectLoans",
      "hangUpLoans",
      "approveLoan",
      "rejectLoan",
      "hangUpApplication",
      "updateLoan",
    ],
    assignLoan: ["assignLoan", "assignLoans", "reassignLoan"],
    editUsers: ["editUsers", "edit_user"],
    updateConfiguration: [
      "updateConfiguration",
      "updateConfig",
      "editConfig",
      "systemConfig",
      "manageSystemConfig",
    ],
    manageRoles: [
      "manageRoles",
      "createRole",
      "editRole",
      "deleteRole",
      "manageUserRoles",
    ],
    createUser: ["createUser", "createUsers"],
    resetPin: ["resetPin", "resetPassword", "reset_password"],
    updateContent: ["updateContent", "editContent"],
    manageNotifications: [
      "manageNotifications",
      "viewNotifications",
      "editNotifications",
    ],
    loan_clearance: ["loan_clearance", "loanClearance"],
    viewReports: ["viewReports", "viewStatistics"],
  };

  const normalizeActionGroup = (value) => {
    const key = normalizeKey(value);
    const group = Object.entries(actionAliasGroups).find(([, aliases]) =>
      aliases.some((alias) => normalizeKey(alias) === key),
    );
    return group ? group[0] : key;
  };

  // Helper function to check menu permissions
  const hasMenuAccess = (menuName) => {
    if (isSuperAdmin()) return true; // Super Admin bypass
    if (!permissions) return false;
    if (permissions.menus?.[menuName] === true) return true;

    const target = normalizeMenuGroup(menuName);
    return Object.entries(permissions.menus || {}).some(
      ([key, value]) => value === true && normalizeMenuGroup(key) === target,
    );
  };

  // Helper function to check sub-menu permissions
  const hasSubMenuAccess = (menuName, subMenuName) => {
    if (isSuperAdmin()) return true; // Super Admin bypass
    if (!permissions) return false;
    if (permissions.subMenus?.[menuName]?.[subMenuName] === true) return true;

    const directMenuSubMenus = permissions.subMenus?.[menuName];
    if (hasMenuAccess(menuName) && !directMenuSubMenus) {
      return true;
    }

    const targetMenu = normalizeMenuGroup(menuName);
    const targetSub = normalizeKey(subMenuName);
    const matchedMenus = Object.entries(permissions.subMenus || {}).filter(
      ([key]) => normalizeMenuGroup(key) === targetMenu,
    );
    if (matchedMenus.length === 0) return hasMenuAccess(menuName);

    const hasAnyExplicitSubMenu = matchedMenus.some(([, subMenus]) =>
      Object.values(subMenus || {}).some((value) => value === true),
    );

    if (!hasAnyExplicitSubMenu && hasMenuAccess(menuName)) {
      const normalizedRequestedSub = normalizeKey(subMenuName);
      if (normalizedRequestedSub === "list") {
        return true;
      }
    }

    if (targetMenu === "precollection" && targetSub === "list") {
      const hasAllList = matchedMenus.some(([, subMenus]) =>
        Object.entries(subMenus || {}).some(
          ([key, value]) => value === true && normalizeKey(key) === "alllist",
        ),
      );
      if (hasAllList && hasMenuAccess(menuName)) {
        return true;
      }
    }

    return matchedMenus.some(([, subMenus]) => {
      if (!subMenus) return hasMenuAccess(menuName);
      return Object.entries(subMenus || {}).some(
        ([key, value]) => value === true && normalizeKey(key) === targetSub,
      );
    });
  };

  // Helper function to check action permissions
  const hasActionPermission = (actionName) => {
    if (isSuperAdmin()) return true; // Super Admin bypass
    if (!permissions) return false;
    if (permissions.actions?.[actionName] === true) return true;

    const target = normalizeActionGroup(actionName);
    return Object.entries(permissions.actions || {}).some(
      ([key, value]) =>
        value === true && normalizeActionGroup(key) === target,
    );
  };

  // Helper function to check data access permissions
  const hasDataAccess = (dataType, accessLevel = null) => {
    if (isSuperAdmin()) return true; // Super Admin bypass
    if (!permissions) return false;
    
    if (accessLevel) {
      // Check for specific access level (e.g., 'loans.amount')
      const specificPermission = `${dataType}.${accessLevel}`;
      const hasSpecificAccess = permissions.dataAccess?.[specificPermission] === true;
      if (hasSpecificAccess) {
        return true;
      }
      
      // Check if the nested structure exists (e.g., loans: { amount: true })
      const hasNestedAccess = permissions.dataAccess?.[dataType]?.[accessLevel] === true;
      if (hasNestedAccess) {
        return true;
      }
      
      // Fallback to general data type access
      const hasGeneralAccess = permissions.dataAccess?.[dataType] === true;
      return hasGeneralAccess;
    }
    
    // Standard data type access check
    return permissions.dataAccess?.[dataType] === true;
  };

  // Helper function to check UI element permissions
  const hasUIElementAccess = (elementType, elementName) => {
    if (isSuperAdmin()) return true; // Super Admin bypass
    if (!permissions) return false;
    return permissions.uiElements?.[elementType]?.[elementName] === true;
  };

  // Helper function to check button permissions
  const hasButtonAccess = (buttonName) => {
    if (isSuperAdmin()) return true; // Super Admin bypass
    if (!permissions) return false;
    return permissions.uiElements?.buttons?.[buttonName] === true;
  };

  // Helper function to check table permissions
  const hasTableAccess = (tableName) => {
    if (isSuperAdmin()) return true; // Super Admin bypass
    if (!permissions) return false;
    return permissions.uiElements?.tables?.[tableName] === true;
  };

  // Helper function to check modal permissions
  const hasModalAccess = (modalName) => {
    if (isSuperAdmin()) return true; // Super Admin bypass
    if (!permissions) return false;
    return permissions.uiElements?.modals?.[modalName] === true;
  };

  // Helper function to check form permissions
  const hasFormAccess = (formName) => {
    if (isSuperAdmin()) return true; // Super Admin bypass
    if (!permissions) return false;
    return permissions.uiElements?.forms?.[formName] === true;
  };

  // Helper function to check navigation permissions
  const hasNavigationAccess = (navName) => {
    if (isSuperAdmin()) return true; // Super Admin bypass
    if (!permissions) return false;
    return permissions.uiElements?.navigation?.[navName] === true;
  };

  // Helper function to check widget permissions
  const hasWidgetAccess = (widgetName) => {
    if (isSuperAdmin()) return true; // Super Admin bypass
    if (!permissions) return false;
    return permissions.uiElements?.widgets?.[widgetName] === true;
  };

  // Comprehensive permission checker for any module and action
  const hasModulePermission = (module, action) => {
    if (isSuperAdmin()) return true; // Super Admin bypass
    if (!permissions) return false;
    return permissions.subMenus?.[module]?.[action] === true;
  };

  // Check if user has any permission from a list (OR logic)
  const hasAnyPermission = (permissionList) => {
    if (isSuperAdmin()) return true; // Super Admin bypass
    if (!permissions || !Array.isArray(permissionList)) return false;
    return permissionList.some(permission => {
      const [type, ...path] = permission.split('.');
      switch (type) {
        case 'menu':
          return hasMenuAccess(path[0]);
        case 'submenu':
          return hasSubMenuAccess(path[0], path[1]);
        case 'action':
          return hasActionPermission(path[0]);
        case 'data':
          return hasDataAccess(path[0]);
        case 'button':
          return hasButtonAccess(path[0]);
        case 'table':
          return hasTableAccess(path[0]);
        case 'modal':
          return hasModalAccess(path[0]);
        case 'form':
          return hasFormAccess(path[0]);
        case 'navigation':
          return hasNavigationAccess(path[0]);
        case 'widget':
          return hasWidgetAccess(path[0]);
        case 'module':
          return hasModulePermission(path[0], path[1]);
        default:
          return false;
      }
    });
  };

  // Check if user has all permissions from a list (AND logic)
  const hasAllPermissions = (permissionList) => {
    if (isSuperAdmin()) return true; // Super Admin bypass
    if (!permissions || !Array.isArray(permissionList)) return false;
    return permissionList.every(permission => {
      const [type, ...path] = permission.split('.');
      switch (type) {
        case 'menu':
          return hasMenuAccess(path[0]);
        case 'submenu':
          return hasSubMenuAccess(path[0], path[1]);
        case 'action':
          return hasActionPermission(path[0]);
        case 'data':
          return hasDataAccess(path[0]);
        case 'button':
          return hasButtonAccess(path[0]);
        case 'table':
          return hasTableAccess(path[0]);
        case 'modal':
          return hasModalAccess(path[0]);
        case 'form':
          return hasFormAccess(path[0]);
        case 'navigation':
          return hasNavigationAccess(path[0]);
        case 'widget':
          return hasWidgetAccess(path[0]);
        case 'module':
          return hasModulePermission(path[0], path[1]);
        default:
          return false;
      }
    });
  };

  const value = {
    user,
    token,
    permissions,
    login,
    logout,
    isAuthenticated,
    loading,
    fetchPermissions,
    isSuperAdmin,
    hasMenuAccess,
    hasSubMenuAccess,
    hasActionPermission,
    hasDataAccess,
    hasUIElementAccess,
    hasButtonAccess,
    hasTableAccess,
    hasModalAccess,
    hasFormAccess,
    hasNavigationAccess,
    hasWidgetAccess,
    hasModulePermission,
    hasAnyPermission,
    hasAllPermissions
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
