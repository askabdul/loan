import React, { createContext, useContext, useState, useEffect } from 'react';
import apiService from '../services/api';

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

  useEffect(() => {
    // Check if user is logged in on app start
    const storedToken = localStorage.getItem('adminToken');
    const storedUser = localStorage.getItem('adminUser');
    const storedPermissions = localStorage.getItem('adminPermissions');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      if (storedPermissions) {
        setPermissions(JSON.parse(storedPermissions));
      }
      // Fetch fresh permissions if we have a token but no stored permissions
      if (!storedPermissions) {
        fetchPermissions(storedToken);
      }
    }
    
    setLoading(false);
  }, []);

  const fetchPermissions = async () => {
    try {
      const resp = await apiService.getAdminPermissions();
      const perms = resp?.data?.permissions || resp?.data?.data?.permissions;
      if (perms) {
        setPermissions(perms);
        localStorage.setItem('adminPermissions', JSON.stringify(perms));
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  };

  const login = async (emailOrUsername, password) => {
    try {
      const data = await apiService.login({ login: emailOrUsername, password });

      if (data?.success) {
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
      const message = error?.response?.data?.message || error.message;
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
  };

  const isAuthenticated = () => {
    return !!(token && user);
  };

  // Helper function to check if user is super admin (God Mode)
  const isSuperAdmin = () => {
    return user?.role?.name === 'super-admin';
  };

  // Helper function to check menu permissions
  const hasMenuAccess = (menuName) => {
    if (isSuperAdmin()) return true; // Super Admin bypass
    if (!permissions) return false;
    return permissions.menus?.[menuName] === true;
  };

  // Helper function to check sub-menu permissions
  const hasSubMenuAccess = (menuName, subMenuName) => {
    if (isSuperAdmin()) return true; // Super Admin bypass
    if (!permissions) return false;
    return permissions.subMenus?.[menuName]?.[subMenuName] === true;
  };

  // Helper function to check action permissions
  const hasActionPermission = (actionName) => {
    if (isSuperAdmin()) return true; // Super Admin bypass
    if (!permissions) return false;
    return permissions.actions?.[actionName] === true;
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
