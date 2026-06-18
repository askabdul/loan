import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  FiUsers,
  FiTrendingUp,
  FiShoppingCart,
  FiDollarSign,
  FiFileText,
  FiArchive,
  FiFolder,
  FiClock,
  FiSettings,
  FiBarChart,
  FiMonitor,
  FiBell,
  FiShield,
  FiChevronDown,
  FiChevronRight,
} from "react-icons/fi";
import "./Sidebar.css";

const Sidebar = () => {
  const { hasMenuAccess, hasSubMenuAccess, isSuperAdmin } = useAuth();
  const location = useLocation();

  // Restore expanded state from localStorage on mount
  const [expandedItems, setExpandedItems] = useState(() => {
    try {
      const saved = localStorage.getItem("sidebar_expanded");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleExpanded = (itemId) => {
    setExpandedItems((prev) => {
      let newState;
      if (prev[itemId]) {
        // Collapse the clicked item; keep all others as-is
        newState = { ...prev, [itemId]: false };
      } else {
        // Collapse every other parent, expand this one
        newState = {};
        Object.keys(prev).forEach((key) => {
          newState[key] = false;
        });
        newState[itemId] = true;
      }
      try {
        localStorage.setItem("sidebar_expanded", JSON.stringify(newState));
      } catch {}
      return newState;
    });
  };

  // When the route changes (e.g. after a browser refresh), ensure the parent
  // of the active sub-route is expanded and all others are collapsed.
  useEffect(() => {
    // Find which menu item owns the current path
    const currentPath = location.pathname;
    let activeParentId = null;
    for (const item of menuItems) {
      if (item.hasSubmenu && item.submenu) {
        if (item.submenu.some((sub) => currentPath.startsWith(sub.path))) {
          activeParentId = item.id;
          break;
        }
      }
    }
    if (!activeParentId) return;

    setExpandedItems((prev) => {
      // Already correct — avoid re-renders
      if (prev[activeParentId]) return prev;
      const newState = {};
      // Collapse all, expand only the active parent
      Object.keys(prev).forEach((k) => {
        newState[k] = false;
      });
      newState[activeParentId] = true;
      try {
        localStorage.setItem("sidebar_expanded", JSON.stringify(newState));
      } catch {}
      return newState;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const menuItems = [
    {
      id: "user",
      title: "User",
      icon: <FiUsers />,
      path: "/user",
      hasSubmenu: true,
      menuKey: "user",
      submenu: [
        {
          title: "List of users",
          path: "/user/list",
          subMenuKey: "listOfUsers",
        },
        { title: "Find one", path: "/user/find", subMenuKey: "findOne" },
        {
          title: "Manual Registration",
          path: "/user/manual-registration",
          subMenuKey: "manualRegistration",
        },
        {
          title: "User Management",
          path: "/user/management",
          subMenuKey: "userManagement",
        },
        {
          title: "Level Assignment",
          path: "/user/level-assignment",
          subMenuKey: "levelAssignment",
        },
      ],
    },
    // {
    //   id: "marketing",
    //   title: "Marketing",
    //   icon: <FiTrendingUp />,
    //   path: "/marketing",
    //   hasSubmenu: false,
    //   menuKey: "marketing",
    // },
    // {
    //   id: "notifications",
    //   title: "Notification Management",
    //   icon: <FiBell />,
    //   path: "/notifications",
    //   hasSubmenu: false,
    //   menuKey: "notificationManagement",
    // },
    {
      id: "order",
      title: "Order",
      icon: <FiShoppingCart />,
      path: "/order",
      hasSubmenu: true,
      menuKey: "order",
      submenu: [
        { title: "Order List", path: "/order/list", subMenuKey: "orderList" },
        {
          title: "Order Lending",
          path: "/order/lending",
          subMenuKey: "orderLending",
        },
        {
          title: "Order Repayment",
          path: "/order/repayment",
          subMenuKey: "orderRepayment",
        },
        {
          title: "Review Repayment",
          path: "/order/review-repayment",
          subMenuKey: "reviewRepayment",
        },
        // Extension feature disabled — removed from navigation
        {
          title: "Loan Details",
          path: "/order/loan-details",
          subMenuKey: "loanDetails",
        },
      ],
    },
    {
      id: "fund-management",
      title: "Fund Management",
      icon: <FiDollarSign />,
      path: "/fund-management",
      hasSubmenu: true,
      menuKey: "fundManagement",
      submenu: [
        // {
        //   title: "Payment Order",
        //   path: "/fund-management/payment-order",
        //   subMenuKey: "paymentOrder",
        // },
        // {
        //   title: "Payment Review",
        //   path: "/fund-management/payment-review",
        //   subMenuKey: "paymentReview",
        // },
        {
          title: "Payment Management",
          path: "/fund-management/payments",
          subMenuKey: "paymentManagement",
        },
        // {
        //   title: "Bill verification",
        //   path: "/fund-management/bill-verification",
        //   subMenuKey: "billVerification",
        // },
        // {
        //   title: "Airtime",
        //   path: "/fund-management/airtime",
        //   subMenuKey: "airtime",
        // },
        // {
        //   title: "Airtime Review",
        //   path: "/fund-management/airtime-review",
        //   subMenuKey: "airtimeReview",
        // },
        // {
        //   title: "Batch-payment-apply",
        //   path: "/fund-management/batch-payment-apply",
        //   subMenuKey: "batchPaymentApply",
        // },
        // {
        //   title: "AirtimeStat",
        //   path: "/fund-management/airtime-stat",
        //   subMenuKey: "airtimeStat",
        // },
      ],
    },
    {
      id: "credit-review",
      title: "Credit-review",
      icon: <FiFileText />,
      path: "/credit-review",
      hasSubmenu: true,
      menuKey: "creditReview",
      submenu: [
        {
          title: "Assign",
          path: "/credit-review/assign",
          subMenuKey: "assign",
        },
        {
          title: "Review List",
          path: "/credit-review/list",
          subMenuKey: "list",
        },
        {
          title: "Statistics",
          path: "/credit-review/count",
          subMenuKey: "count",
        },
      ],
    },
    {
      id: "pre-collection",
      title: "Pre-collection",
      icon: <FiArchive />,
      path: "/pre-collection",
      hasSubmenu: true,
      menuKey: "preCollection",
      submenu: [
        // {
        //   title: "ShiftList",
        //   path: "/pre-collection/shift-list",
        //   subMenuKey: "shiftList",
        // },
        // {
        //   title: "Prc-Assign",
        //   path: "/pre-collection/assign",
        //   subMenuKey: "assign",
        // },
        {
          title: "Full Case List",
          path: "/pre-collection/all-list",
          subMenuKey: "allList",
        },
        {
          title: "Pre-Assignment",
          path: "/pre-collection/list",
          subMenuKey: "list",
        },
        // {
        //   title: "Prc-Repayment",
        //   path: "/pre-collection/repayment",
        //   subMenuKey: "repayment",
        // },
        // {
        //   title: "Monitor Center",
        //   path: "/pre-collection/monitor-center",
        //   subMenuKey: "monitorCenter",
        // },
        { title: "Rank1", path: "/pre-collection/rank1", subMenuKey: "rank1" },
        { title: "Rank2", path: "/pre-collection/rank2", subMenuKey: "rank2" },
        // {
        //   title: "Prc ColRate",
        //   path: "/pre-collection/col-rate",
        //   subMenuKey: "colRate",
        // },
        // {
        //   title: "AppUsage",
        //   path: "/pre-collection/app-usage",
        //   subMenuKey: "appUsage",
        // },
        // {
        //   title: "Monitor Center 2",
        //   path: "/pre-collection/monitor-center-2",
        //   subMenuKey: "monitorCenter2",
        // },
        // {
        //   title: "HandCases",
        //   path: "/pre-collection/hand-cases",
        //   subMenuKey: "handCases",
        // },
        {
          title: "Payment Record",
          path: "/pre-collection/payment-record",
          subMenuKey: "paymentRecord",
        },
      ],
    },
    {
      id: "collection",
      title: "Collection",
      icon: <FiFolder />,
      path: "/collection",
      hasSubmenu: true,
      menuKey: "collection",
      submenu: [
        // {
        //   title: "ShiftList",
        //   path: "/collection/shift-list",
        //   subMenuKey: "shiftList",
        // },
        // {
        //   title: "Col-Assign",
        //   path: "/collection/assign",
        //   subMenuKey: "assign",
        // },
        { title: "List", path: "/collection/list", subMenuKey: "list" },
        // {
        //   title: "Col-Repayment",
        //   path: "/collection/repayment",
        //   subMenuKey: "repayment",
        // },
        // {
        //   title: "Monitor Center",
        //   path: "/collection/monitor-center",
        //   subMenuKey: "monitorCenter",
        // },
        { title: "Rank1", path: "/collection/rank1", subMenuKey: "rank1" },
        { title: "Rank2", path: "/collection/rank2", subMenuKey: "rank2" },
        // {
        //   title: "AppUsage",
        //   path: "/collection/app-usage",
        //   subMenuKey: "appUsage",
        // },
        // {
        //   title: "Monitor Center 2",
        //   path: "/collection/monitor-center-2",
        //   subMenuKey: "monitorCenter2",
        // },
        // {
        //   title: "HandCases",
        //   path: "/collection/hand-cases",
        //   subMenuKey: "handCases",
        // },
        {
          title: "Payment Record",
          path: "/collection/payment-record",
          subMenuKey: "paymentRecord",
        },
        {
          title: "Officers",
          path: "/collection/officers",
          subMenuKey: "officers",
        },
      ],
    },
    // {
    //   id: "overtime-message",
    //   title: "Overtime Message",
    //   icon: <FiClock />,
    //   path: "/overtime-message",
    //   hasSubmenu: false,
    //   menuKey: "overtimeMessage",
    // },
    {
      id: "app-config",
      title: "App Configuration",
      icon: <FiSettings />,
      path: "/app-config",
      hasSubmenu: true,
      menuKey: "appConfiguration",
      submenu: [
        {
          title: "General Settings",
          path: "/app-config",
          subMenuKey: "generalSettings",
        },
        {
          title: "Loan Settings",
          path: "/loan-settings",
          subMenuKey: "loanSettings",
        },
        {
          title: "Loan Configuration",
          path: "/loan-configuration",
          subMenuKey: "loanConfiguration",
        },
        {
          title: "Loan Rate Calculation",
          path: "/loan-rate-calculation",
          subMenuKey: "loanRateCalculation",
        },
        {
          title: "App Branding",
          path: "/app-branding",
          subMenuKey: "appBranding",
        },
        {
          title: "Contact Info",
          path: "/contact-info",
          subMenuKey: "contactInfo",
        },
      ],
    },
    {
      id: "data-statistics",
      title: "Data statistics",
      icon: <FiBarChart />,
      path: "/data-statistics",
      hasSubmenu: true,
      menuKey: "dataStatistics",
      submenu: [
        {
          title: "Dashboard",
          path: "/data-statistics/dashboard",
          subMenuKey: "dashboard",
        },
      ],
    },
    {
      id: "system",
      title: "System",
      icon: <FiMonitor />,
      path: "/system",
      hasSubmenu: true,
      menuKey: "system",
      submenu: [
        {
          title: "Admin & Workers",
          path: "/admin-management",
          subMenuKey: "adminManagement",
        },
        {
          title: "Role Management",
          path: "/roles",
          subMenuKey: "roleManagement",
        },
      ],
    },
  ];

  const canSeeSubMenuItem = (item, subItem) => {
    if (subItem.requiresSuperAdmin && !isSuperAdmin()) {
      return false;
    }
    return (
      !subItem.subMenuKey || hasSubMenuAccess(item.menuKey, subItem.subMenuKey)
    );
  };

  const canSeeMenuItem = (item) => {
    if (item.menuKey && !hasMenuAccess(item.menuKey)) {
      return false;
    }
    if (!item.hasSubmenu || !Array.isArray(item.submenu)) {
      return true;
    }
    return item.submenu.some((subItem) => canSeeSubMenuItem(item, subItem));
  };

  return (
    <div className="sidebar bg-cedi-dark text-white w-64 min-h-screen shadow-lg">
      <div className="sidebar-header px-4 py-4 border-b border-white/10">
        <div className="logo flex items-center gap-2 font-semibold">
          <span className="logo-icon text-xl">🏦</span>
          <span className="logo-text">Admin</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <ul className="nav-list">
          {menuItems
            .filter((item) => canSeeMenuItem(item))
            .map((item) => (
              <li key={item.id} className="nav-item">
                {item.hasSubmenu ? (
                  <>
                    <div
                      className="nav-link nav-link-expandable flex items-center justify-between px-3 py-2 rounded hover:bg-white/5"
                      onClick={() => toggleExpanded(item.id)}
                    >
                      <div className="nav-link-content flex items-center gap-2">
                        <span className="nav-icon">{item.icon}</span>
                        <span className="nav-text">{item.title}</span>
                      </div>
                      <span className="expand-icon">
                        {expandedItems[item.id] ? (
                          <FiChevronDown />
                        ) : (
                          <FiChevronRight />
                        )}
                      </span>
                    </div>
                    {expandedItems[item.id] && (
                      <ul className="submenu">
                        {item.submenu
                          .filter((subItem) => canSeeSubMenuItem(item, subItem))
                          .map((subItem, index) => (
                            <li key={index} className="submenu-item">
                              <NavLink
                                to={subItem.path}
                                className={({ isActive }) =>
                                  `submenu-link ${isActive ? "active" : ""} block pl-6 py-1.5 text-sm text-white/80 hover:text-white`
                                }
                              >
                                {subItem.title}
                              </NavLink>
                            </li>
                          ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `nav-link ${isActive ? "active" : ""} flex items-center justify-between px-3 py-2 rounded hover:bg-white/5`
                    }
                  >
                    <div className="nav-link-content flex items-center gap-2">
                      <span className="nav-icon">{item.icon}</span>
                      <span className="nav-text">{item.title}</span>
                    </div>
                  </NavLink>
                )}
              </li>
            ))}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
