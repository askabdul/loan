import React, { useState, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  FiRefreshCw,
  FiPlus,
  FiSearch,
  FiEye,
  FiEdit2,
  FiTrash2,
  FiX,
  FiShield,
  FiCheck,
  FiAlertTriangle,
} from "react-icons/fi";
import apiService from "../services/api";
import { useAuth } from "../contexts/AuthContext";

// ── Helpers ───────────────────────────────────────────────────────────────────

const HIERARCHY_LABELS = {
  1: "Super Admin",
  2: "Admin",
  3: "Manager",
  4: "Lead",
  5: "Officer",
  6: "Staff",
};
const hierarchyLabel = (h) => HIERARCHY_LABELS[h] || `Level ${h}`;

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

const camelToWords = (s) =>
  s.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

// ── Tiny sub-components ───────────────────────────────────────────────────────

const StatusBadge = ({ active }) =>
  active ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <FiCheck size={10} /> Active
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500 border border-gray-200">
      Inactive
    </span>
  );

const PermGrid = ({ entries, path = [], getLabel }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
    {entries.map(([key, val]) => (
      <div
        key={key}
        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs border ${
          val
            ? "bg-emerald-50 border-emerald-100 text-emerald-800"
            : "bg-gray-50 border-gray-100 text-gray-400"
        }`}
      >
        <span>{getLabel ? getLabel(path, key) : camelToWords(key)}</span>
        {val ? (
          <span className="text-emerald-500 text-sm">✓</span>
        ) : (
          <span className="text-gray-300 text-sm">—</span>
        )}
      </div>
    ))}
  </div>
);

const PermCheckboxGroup = ({ entries, onChange, path = [], getLabel }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
    {entries.map(([key, val]) => (
      <label
        key={key}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs transition-colors ${
          val
            ? "bg-blue-50 border-blue-200 text-blue-800"
            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
        }`}
      >
        <input
          type="checkbox"
          checked={val}
          onChange={(e) => onChange(key, e.target.checked)}
          className="accent-blue-600 flex-shrink-0"
        />
        {getLabel ? getLabel(path, key) : camelToWords(key)}
      </label>
    ))}
  </div>
);

const PermissionSectionEditor = ({
  title,
  tree,
  onChange,
  path = [],
  getLabel,
}) => {
  const entries = Object.entries(tree || {});
  if (!entries.length) return null;

  const leafEntries = entries.filter(([, value]) => typeof value !== "object");
  const nestedEntries = entries.filter(([, value]) => typeof value === "object");

  return (
    <div className="space-y-3">
      {title && (
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
          {title}
        </p>
      )}

      {leafEntries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {leafEntries.map(([key, value]) => (
            <label
              key={[...path, key].join(".")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs transition-colors ${
                value
                  ? "bg-blue-50 border-blue-200 text-blue-800"
                  : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <input
                type="checkbox"
                checked={!!value}
                onChange={(e) => onChange([...path, key], e.target.checked)}
                className="accent-blue-600 flex-shrink-0"
              />
              {getLabel ? getLabel(path, key) : camelToWords(key)}
            </label>
          ))}
        </div>
      )}

      {nestedEntries.map(([key, value]) => (
        <div
          key={[...path, key].join(".")}
          className="bg-gray-50 border border-gray-100 rounded-xl p-3"
        >
          <PermissionSectionEditor
            title={getLabel ? getLabel(path, key) : camelToWords(key)}
            tree={value}
            onChange={onChange}
            path={[...path, key]}
            getLabel={getLabel}
          />
        </div>
      ))}
    </div>
  );
};

const PermissionSectionView = ({ title, tree, path = [], getLabel }) => {
  const entries = Object.entries(tree || {});
  if (!entries.length) return null;

  const leafEntries = entries.filter(([, value]) => typeof value !== "object");
  const nestedEntries = entries.filter(([, value]) => typeof value === "object");

  return (
    <div className="space-y-3">
      {title && (
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
          {title}
        </p>
      )}

      {leafEntries.length > 0 && (
        <PermGrid entries={leafEntries} path={path} getLabel={getLabel} />
      )}

      {nestedEntries.map(([key, value]) => (
        <div
          key={key}
          className="bg-gray-50 border border-gray-100 rounded-xl p-3"
        >
          <PermissionSectionView
            title={getLabel ? getLabel(path, key) : camelToWords(key)}
            tree={value}
            path={[...path, key]}
            getLabel={getLabel}
          />
        </div>
      ))}
    </div>
  );
};

// Renders at document.body via portal so it is never clipped by .main-content's
// overflow:hidden stacking context, and sits above the sidebar (z-index 1000).
const Modal = ({ onClose, children, wide = false }) =>
  ReactDOM.createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 250,
        right: 0,
        bottom: 0,
        zIndex: 1200,
        backgroundColor: "rgba(15,23,42,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "16px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
          width: "100%",
          maxWidth: wide ? "800px" : "520px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );

const ModalHeader = ({ title, subtitle, onClose }) => (
  <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
    <div>
      <h2 className="text-base font-bold text-gray-800 m-0 leading-none">
        {title}
      </h2>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
    <button
      onClick={onClose}
      className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition"
    >
      <FiX size={18} />
    </button>
  </div>
);

// ── Centralized permission catalog used by Role Management ───────────────────
const PERMISSION_CATALOG = {
  menus: [
    "user",
    "userManagement",
    "order",
    "fundManagement",
    "creditReview",
    "preCollection",
    "collection",
    "appConfiguration",
    "dataStatistics",
    "system",
    "contentManagement",
    "notificationManagement",
    "marketing",
    "dashboard",
    "reports",
  ],
  subMenus: {
    user: [
      "listOfUsers",
      "findOne",
      "manualRegistration",
      "userManagement",
      "levelAssignment",
    ],
    order: [
      "orderList",
      "orderLending",
      "orderRepayment",
      "reviewRepayment",
      "extensionOrder",
      "loanDetails",
      "paymentFailed",
      "repaymentPlan",
      "repaymentDetails",
      "repayPending",
      "ussd",
      "callbackOrder",
      "cantSettled",
    ],
    fundManagement: [
      "paymentManagement",
      "paymentOrder",
      "paymentReview",
      "billVerification",
      "airtime",
      "airtimeReview",
      "batchPaymentApply",
      "airtimeStat",
    ],
    creditReview: ["assign", "list", "count"],
    preCollection: [
      "allList",
      "list",
      "assign",
      "repayment",
      "rank1",
      "rank2",
      "paymentRecord",
      "shiftList",
      "monitorCenter",
      "colRate",
      "appUsage",
      "monitorCenter2",
      "handCases",
    ],
    collection: [
      "list",
      "assign",
      "repayment",
      "rank1",
      "rank2",
      "paymentRecord",
      "officers",
      "shiftList",
      "monitorCenter",
      "appUsage",
      "monitorCenter2",
      "handCases",
    ],
    appConfiguration: [
      "generalSettings",
      "loanSettings",
      "loanConfiguration",
      "loanRateCalculation",
      "appBranding",
      "contactInfo",
      "faq",
      "termsConditions",
    ],
    dataStatistics: ["dashboard"],
    system: ["adminManagement", "roleManagement", "serverLogs", "bin"],
  },
  dataAccess: [
    "viewAllLoans",
    "viewAssignedLoans",
    "viewAllUsers",
    "editUserData",
    "approveLoans",
    "rejectLoans",
    "assignLoans",
    "exportData",
    "viewPayments",
    "viewFinancialData",
    "configurations",
    "content",
    "loanAnalytics",
    "userAnalytics",
    "payments",
    "viewReports",
    "viewStatistics",
    "viewNotifications",
    "editNotifications",
    "viewConfig",
    "editConfig",
    "viewSystemLogs",
    "viewAuditTrail",
    "manageSystemConfig",
    "manageUserRoles",
    "users.personalInfo",
    "users.phone",
    "users.financialInfo",
    "users.loanHistory",
    "users.workInfo",
    "loans.basic",
    "loans.amount",
    "loans.terms",
    "loans.history",
    "loans.documents",
    "payments.amount",
    "payments.provider",
    "payments.details",
  ],
  actions: [
    "createAdmin",
    "editAdmin",
    "deleteAdmin",
    "manageRoles",
    "createRole",
    "editRole",
    "deleteRole",
    "manageUserRoles",
    "createUser",
    "createUsers",
    "viewUsers",
    "editUsers",
    "edit_user",
    "resetPin",
    "resetPassword",
    "reset_password",
    "toggleUserStatus",
    "updateUserLevel",
    "assignLoan",
    "assignLoans",
    "reassignLoan",
    "updateLoanStatus",
    "approveLoans",
    "rejectLoans",
    "hangUpLoans",
    "approveLoan",
    "rejectLoan",
    "hangUpApplication",
    "updateLoan",
    "viewLoans",
    "managePayments",
    "loan_clearance",
    "manageNotifications",
    "updateConfiguration",
    "updateConfig",
    "editConfig",
    "systemConfig",
    "manageSystemConfig",
    "createContent",
    "editContent",
    "updateContent",
    "deleteContent",
    "viewReports",
    "exportReports",
  ],
  uiElements: {
    buttons: [
      "createAdmin",
      "editAdmin",
      "deleteAdmin",
      "assignCase",
      "bulkAssign",
      "exportData",
    ],
    tables: ["users", "loans", "payments", "officers", "roles"],
    forms: ["userEdit", "roleEdit", "loanApproval", "paymentReview"],
    modals: ["userDetails", "roleDetails", "assignment"],
    navigation: ["sidebar", "topbar", "breadcrumbs"],
    widgets: ["dashboardStats", "performanceChart", "alertsPanel"],
  },
  bulkActions: ["bulkAssign", "bulkUnassign", "bulkDeactivate", "bulkExport"],
};

const PERMISSION_LABELS = {
  "menus.user": "Users",
  "menus.userManagement": "User Management",
  "menus.order": "Orders",
  "menus.fundManagement": "Fund Management",
  "menus.creditReview": "Credit Review",
  "menus.preCollection": "Pre-Collection",
  "menus.collection": "Collection",
  "menus.appConfiguration": "App Configuration",
  "menus.dataStatistics": "Data Statistics",
  "menus.system": "System",
  "menus.contentManagement": "Content Management",
  "menus.notificationManagement": "Notification Management",
  "menus.marketing": "Marketing",
  "menus.dashboard": "Dashboard",
  "menus.reports": "Reports",
  "subMenus.user": "Users",
  "subMenus.order": "Orders",
  "subMenus.creditReview": "Credit Review",
  "subMenus.preCollection": "Pre-Collection",
  "subMenus.collection": "Collection",
  "subMenus.appConfiguration": "App Configuration",
  "subMenus.fundManagement": "Fund Management",
  "subMenus.dataStatistics": "Data Statistics",
  "subMenus.system": "System",
  "subMenus.preCollection.allList": "Shiftiest / All List",
  "subMenus.preCollection.list": "Pre-Assignment List",
  "subMenus.preCollection.paymentRecord": "Pre-Repayment Record",
  "subMenus.creditReview.list": "Review List",
  "subMenus.creditReview.count": "Review Statistics",
  "dataAccess.viewAllLoans":
    "[Loan tables: Credit Review / Orders / Collection / Pre-Collection] View All Loans",
  "dataAccess.viewAssignedLoans":
    "[Loan tables: officer views] View Only Assigned Loans",
  "dataAccess.viewAllUsers":
    "[Users module + Dashboard cards] View All Users",
  "dataAccess.editUserData":
    "[Users > Management forms] Edit User Data",
  "dataAccess.approveLoans":
    "[Credit Review operations column] Approve Loans",
  "dataAccess.rejectLoans":
    "[Credit Review operations column] Reject Loans",
  "dataAccess.assignLoans":
    "[Credit Review / Pre-Collection / Collection assignment tables] Assign Loans",
  "dataAccess.exportData": "[List pages + reports] Export Data",
  "dataAccess.viewPayments":
    "[Fund Management / dashboard financial cards] View Payments",
  "dataAccess.viewFinancialData":
    "[Dashboard financial cards + analytics] View Financial Data",
  "dataAccess.configurations":
    "[App Configuration endpoints/forms] View Configurations",
  "dataAccess.content": "[Content Management table] View Content",
  "dataAccess.loanAnalytics":
    "[Data Statistics pages] View Loan Analytics",
  "dataAccess.userAnalytics":
    "[Data Statistics pages] View User Analytics",
  "dataAccess.payments":
    "[Fund Management endpoints] View Payment Data",
  "dataAccess.viewReports": "[Reports pages] View Reports",
  "dataAccess.viewStatistics": "[Analytics pages] View Statistics",
  "dataAccess.viewNotifications":
    "[Notifications module] View Notifications",
  "dataAccess.editNotifications":
    "[Notifications module] Edit Notifications",
  "dataAccess.viewConfig": "[Configuration pages] View Config",
  "dataAccess.editConfig": "[Configuration forms] Edit Config",
  "dataAccess.viewSystemLogs": "[System > Server Logs] View System Logs",
  "dataAccess.viewAuditTrail": "[System > Audit Trails] View Audit Trail",
  "dataAccess.manageSystemConfig":
    "[System + App Configuration] Manage System Config",
  "dataAccess.manageUserRoles":
    "[System > Role Management] Manage User-Role Mapping",
  "dataAccess.users.personalInfo":
    "[User Detail Modal > Personal tab] View Personal Info",
  "dataAccess.users.phone": "[User tables/details] View Phone Number",
  "dataAccess.users.financialInfo":
    "[User Detail Modal > Financial tab] View Financial Info",
  "dataAccess.users.loanHistory":
    "[User Detail Modal > Loan History tab] View Loan History",
  "dataAccess.users.workInfo":
    "[User Detail Modal > Work tab] View Work Info",
  "dataAccess.loans.basic": "[Loan tables/details] View Basic Loan Fields",
  "dataAccess.loans.amount": "[Loan tables/details] View Loan Amount Fields",
  "dataAccess.loans.terms": "[Loan details] View Loan Terms",
  "dataAccess.loans.history": "[Loan details] View Loan History",
  "dataAccess.loans.documents":
    "[Loan details] View Loan Documents / Uploads",
  "dataAccess.payments.amount":
    "[Payment tables/details] View Payment Amount",
  "dataAccess.payments.provider":
    "[Payment tables/details] View Payment Provider",
  "dataAccess.payments.details":
    "[Payment tables/details] View Full Payment Details",
  "actions.updateLoanStatus":
    "[Credit Review List / Detail Modal / Order Lending] Change Loan Status & Decisions",
  "actions.assignLoan":
    "[Credit Review Assign + List / Pre-Collection / Collection] Assign or Reassign Cases",
  "actions.manageRoles":
    "[System > Role Management table] Create/Edit/Delete Roles",
  "actions.editUsers":
    "[Users > List / Find / Management table] Edit User Records",
  "actions.edit_user":
    "[Users > List / Find / Management table] Edit User Records",
  "actions.createUser":
    "[Users > Manual Registration table/forms] Create User Records",
  "actions.createUsers":
    "[Users > Manual Registration table/forms] Create User Records",
  "actions.approveLoans":
    "[Credit Review operations column] Approve Loan",
  "actions.rejectLoans":
    "[Credit Review operations column] Reject Loan",
  "actions.hangUpLoans":
    "[Credit Review operations column] Hang Up Loan",
  "actions.approveLoan":
    "[Credit Review operations column] Approve Loan",
  "actions.rejectLoan":
    "[Credit Review operations column] Reject Loan",
  "actions.hangUpApplication":
    "[Credit Review operations column] Hang Up Loan",
  "actions.viewLoans":
    "[Credit Review / Order / Collection tables] View Loan Records",
  "actions.managePayments":
    "[Fund Management > Payment table] Manage Payments",
  "actions.loan_clearance":
    "[Order Repayment + Review Payment tables] Process Loan Clearance",
  "actions.loanClearance":
    "[Order Repayment + Review Payment tables] Process Loan Clearance",
  "actions.manageNotifications":
    "[Notifications table] Create/Edit/Delete Notifications",
  "actions.createContent": "[Content table] Create Content",
  "actions.updateContent": "[Content table] Update Content",
  "actions.editContent": "[Content table] Update Content",
  "actions.deleteContent": "[Content table] Delete Content",
  "actions.viewReports":
    "[Data Statistics / Reports tables] View Reports",
  "actions.viewStatistics":
    "[Data Statistics / Reports tables] View Reports",
  "actions.updateConfiguration":
    "[App Configuration forms] Update Configuration",
  "actions.updateConfig":
    "[App Configuration forms] Update Configuration",
};

const MODULE_PERMISSION_GROUPS = [
  {
    id: "user",
    title: "Users",
    description: "User list, search, registration, management and levels",
    menuKey: "user",
    subMenuKey: "user",
    actionKeys: [
      "viewUsers",
      "createUser",
      "editUsers",
      "resetPin",
      "toggleUserStatus",
      "updateUserLevel",
    ],
    dataAccessKeys: [
      "viewAllUsers",
      "editUserData",
      "users.personalInfo",
      "users.phone",
      "users.financialInfo",
      "users.loanHistory",
      "users.workInfo",
    ],
  },
  {
    id: "order",
    title: "Orders",
    description: "Order lending, repayment, extension and loan detail pages",
    menuKey: "order",
    subMenuKey: "order",
    actionKeys: ["loan_clearance"],
    dataAccessKeys: [
      "loans.basic",
      "loans.amount",
      "loans.terms",
      "loans.history",
      "loans.documents",
    ],
  },
  {
    id: "creditReview",
    title: "Credit Review",
    description: "Review list, assignment and decision operations",
    menuKey: "creditReview",
    subMenuKey: "creditReview",
    actionKeys: ["viewLoans", "assignLoan", "updateLoanStatus"],
    dataAccessKeys: [
      "viewAllLoans",
      "viewAssignedLoans",
      "loans.basic",
      "loans.amount",
      "loans.terms",
    ],
  },
  {
    id: "preCollection",
    title: "Pre-Collection",
    description: "Pre-assignment, shiftiest list, repayment and ranks",
    menuKey: "preCollection",
    subMenuKey: "preCollection",
    actionKeys: [],
    dataAccessKeys: ["viewAllLoans", "viewAssignedLoans"],
  },
  {
    id: "collection",
    title: "Collection",
    description: "Overdue list, assignment, officers and ranks",
    menuKey: "collection",
    subMenuKey: "collection",
    actionKeys: [],
    dataAccessKeys: ["viewAllLoans", "viewAssignedLoans"],
  },
  {
    id: "fundManagement",
    title: "Fund Management",
    description: "Payment management and financial operations",
    menuKey: "fundManagement",
    subMenuKey: "fundManagement",
    actionKeys: ["managePayments"],
    dataAccessKeys: [
      "viewPayments",
      "viewFinancialData",
      "payments",
      "payments.amount",
      "payments.provider",
      "payments.details",
    ],
  },
  {
    id: "content-notification",
    title: "Content & Notifications",
    description: "Content management and notification manager",
    menuKey: "contentManagement",
    subMenuKey: null,
    actionKeys: [
      "manageNotifications",
      "createContent",
      "updateContent",
      "deleteContent",
    ],
    dataAccessKeys: ["content", "viewNotifications", "editNotifications"],
  },
  {
    id: "appConfiguration",
    title: "App Configuration",
    description: "General settings, loan config and branding",
    menuKey: "appConfiguration",
    subMenuKey: "appConfiguration",
    actionKeys: ["updateConfiguration"],
    dataAccessKeys: ["configurations", "viewConfig", "editConfig", "manageSystemConfig"],
  },
  {
    id: "dataStatistics",
    title: "Data Statistics",
    description: "Dashboard and analytics data",
    menuKey: "dataStatistics",
    subMenuKey: "dataStatistics",
    actionKeys: ["viewReports", "exportReports"],
    dataAccessKeys: [
      "loanAnalytics",
      "userAnalytics",
      "viewReports",
      "viewStatistics",
      "viewFinancialData",
    ],
  },
  {
    id: "system",
    title: "System",
    description: "Admin management, role management and system controls",
    menuKey: "system",
    subMenuKey: "system",
    actionKeys: [
      "createAdmin",
      "editAdmin",
      "deleteAdmin",
      "manageRoles",
      "createRole",
      "editRole",
      "deleteRole",
      "manageUserRoles",
    ],
    dataAccessKeys: [
      "manageUserRoles",
      "viewSystemLogs",
      "viewAuditTrail",
      "manageSystemConfig",
    ],
  },
];

const getModuleActionKeys = (moduleGroup) => moduleGroup.actionKeys || [];

const ModulePermissionView = ({ permissions = {}, getLabel }) => (
  <div className="space-y-4">
    {MODULE_PERMISSION_GROUPS.map((moduleGroup) => {
      const menuEntries = moduleGroup.menuKey
        ? [[moduleGroup.menuKey, permissions.menus?.[moduleGroup.menuKey] === true]]
        : [];
      const subMenuEntries = moduleGroup.subMenuKey
        ? Object.entries(permissions.subMenus?.[moduleGroup.subMenuKey] || {})
        : [];
      const actionEntries = getModuleActionKeys(moduleGroup)
        .filter((key) => Object.prototype.hasOwnProperty.call(permissions.actions || {}, key))
        .map((key) => [key, permissions.actions?.[key] === true]);
      const dataEntries = (moduleGroup.dataAccessKeys || [])
        .filter((key) => Object.prototype.hasOwnProperty.call(permissions.dataAccess || {}, key))
        .map((key) => [key, permissions.dataAccess?.[key] === true]);

      return (
        <div
          key={moduleGroup.id}
          className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3"
        >
          <div>
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              {moduleGroup.title}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">{moduleGroup.description}</p>
          </div>

          {menuEntries.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                Menu
              </p>
              <PermGrid entries={menuEntries} path={["menus"]} getLabel={getLabel} />
            </div>
          )}

          {subMenuEntries.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                Submenus
              </p>
              <PermGrid
                entries={subMenuEntries}
                path={["subMenus", moduleGroup.subMenuKey]}
                getLabel={getLabel}
              />
            </div>
          )}

          {actionEntries.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                Operations & Actions
              </p>
              <PermGrid entries={actionEntries} path={["actions"]} getLabel={getLabel} />
            </div>
          )}

          {dataEntries.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                Data Attributes
              </p>
              <PermGrid entries={dataEntries} path={["dataAccess"]} getLabel={getLabel} />
            </div>
          )}
        </div>
      );
    })}
  </div>
);

const ModulePermissionEditor = ({ permissions = {}, onChange, getLabel }) => (
  <div className="space-y-4">
    {MODULE_PERMISSION_GROUPS.map((moduleGroup) => {
      const menuEntries = moduleGroup.menuKey
        ? [[moduleGroup.menuKey, permissions.menus?.[moduleGroup.menuKey] === true]]
        : [];
      const subMenuEntries = moduleGroup.subMenuKey
        ? Object.entries(permissions.subMenus?.[moduleGroup.subMenuKey] || {})
        : [];
      const actionEntries = getModuleActionKeys(moduleGroup)
        .filter((key) => Object.prototype.hasOwnProperty.call(permissions.actions || {}, key))
        .map((key) => [key, permissions.actions?.[key] === true]);
      const dataEntries = (moduleGroup.dataAccessKeys || [])
        .filter((key) => Object.prototype.hasOwnProperty.call(permissions.dataAccess || {}, key))
        .map((key) => [key, permissions.dataAccess?.[key] === true]);

      const handleMenuToggle = (key, value) => {
        onChange(["menus", key], value);

        if (!value || !moduleGroup.subMenuKey) return;

        const currentSubMenus = permissions.subMenus?.[moduleGroup.subMenuKey] || {};
        const hasAnyEnabled = Object.values(currentSubMenus).some(
          (enabled) => enabled === true,
        );

        if (!hasAnyEnabled && Object.prototype.hasOwnProperty.call(currentSubMenus, "list")) {
          onChange(["subMenus", moduleGroup.subMenuKey, "list"], true);
        }
      };

      return (
        <div
          key={moduleGroup.id}
          className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3"
        >
          <div>
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              {moduleGroup.title}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">{moduleGroup.description}</p>
          </div>

          {menuEntries.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                Menu
              </p>
              <PermCheckboxGroup
                entries={menuEntries}
                onChange={handleMenuToggle}
                path={["menus"]}
                getLabel={getLabel}
              />
            </div>
          )}

          {subMenuEntries.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                Submenus
              </p>
              <PermCheckboxGroup
                entries={subMenuEntries}
                onChange={(key, value) =>
                  onChange(["subMenus", moduleGroup.subMenuKey, key], value)
                }
                path={["subMenus", moduleGroup.subMenuKey]}
                getLabel={getLabel}
              />
            </div>
          )}

          {actionEntries.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                Operations & Actions
              </p>
              <PermCheckboxGroup
                entries={actionEntries}
                onChange={(key, value) => onChange(["actions", key], value)}
                path={["actions"]}
                getLabel={getLabel}
              />
            </div>
          )}

          {dataEntries.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                Data Attributes
              </p>
              <PermCheckboxGroup
                entries={dataEntries}
                onChange={(key, value) => onChange(["dataAccess", key], value)}
                path={["dataAccess"]}
                getLabel={getLabel}
              />
            </div>
          )}
        </div>
      );
    })}
  </div>
);

const getPermissionLabel = (path, key) => {
  const fullPath = [...path, key].join(".");
  return PERMISSION_LABELS[fullPath] || camelToWords(key);
};

const buildPermissionTemplate = (catalog) => {
  const tree = {
    menus: {},
    subMenus: {},
    dataAccess: {},
    actions: {},
    uiElements: {},
    bulkActions: {},
  };

  (catalog.menus || []).forEach((key) => {
    tree.menus[key] = false;
  });

  Object.entries(catalog.subMenus || {}).forEach(([menuKey, keys]) => {
    tree.subMenus[menuKey] = {};
    (keys || []).forEach((key) => {
      tree.subMenus[menuKey][key] = false;
    });
  });

  (catalog.dataAccess || []).forEach((key) => {
    tree.dataAccess[key] = false;
  });

  (catalog.actions || []).forEach((key) => {
    tree.actions[key] = false;
  });

  Object.entries(catalog.uiElements || {}).forEach(([section, keys]) => {
    tree.uiElements[section] = {};
    (keys || []).forEach((key) => {
      tree.uiElements[section][key] = false;
    });
  });

  (catalog.bulkActions || []).forEach((key) => {
    tree.bulkActions[key] = false;
  });

  return tree;
};

const permissionTemplate = buildPermissionTemplate(PERMISSION_CATALOG);

const cloneDeep = (value) => JSON.parse(JSON.stringify(value));

const normalizePermissionAliases = (permissions = {}) => {
  const next = cloneDeep(permissions || {});

  next.menus = next.menus || {};
  if (
    Object.prototype.hasOwnProperty.call(next.menus, "preCollection") ||
    Object.prototype.hasOwnProperty.call(next.menus, "precollection")
  ) {
    next.menus.preCollection =
      Boolean(next.menus.preCollection) || Boolean(next.menus.precollection);
  }
  delete next.menus.precollection;

  next.subMenus = next.subMenus || {};
  const preCollectionSubMenus = next.subMenus.preCollection || {};
  const precollectionSubMenus = next.subMenus.precollection || {};
  const mergedSubMenuKeys = Array.from(
    new Set([
      ...Object.keys(preCollectionSubMenus),
      ...Object.keys(precollectionSubMenus),
    ]),
  );
  if (mergedSubMenuKeys.length > 0) {
    next.subMenus.preCollection = mergedSubMenuKeys.reduce((acc, key) => {
      acc[key] =
        Boolean(preCollectionSubMenus[key]) ||
        Boolean(precollectionSubMenus[key]);
      return acc;
    }, {});
  }
  delete next.subMenus.precollection;

  next.actions = next.actions || {};
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
  };

  Object.entries(actionAliasGroups).forEach(([canonical, aliases]) => {
    const hasAnyAlias = aliases.some((alias) => Boolean(next.actions[alias]));
    if (hasAnyAlias) {
      next.actions[canonical] = true;
    }
  });

  return next;
};

const mergePermissionTrees = (template, existing) => {
  if (typeof template !== "object" || template === null) {
    return typeof existing === "boolean" ? existing : template;
  }

  const result = Array.isArray(template) ? [...template] : {};
  const existingObject =
    existing && typeof existing === "object" ? existing : undefined;

  Object.keys(template).forEach((key) => {
    result[key] = mergePermissionTrees(template[key], existingObject?.[key]);
  });

  if (existingObject) {
    Object.keys(existingObject).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(result, key)) {
        result[key] = cloneDeep(existingObject[key]);
      }
    });
  }

  return result;
};

const mergePermissionsWithTemplate = (existingPermissions = {}) =>
  mergePermissionTrees(
    permissionTemplate,
    normalizePermissionAliases(existingPermissions),
  );

const buildDefaultForm = () => ({
  name: "",
  displayName: "",
  description: "",
  hierarchy: 1,
  isActive: true,
  permissions: cloneDeep(permissionTemplate),
});

const defaultForm = buildDefaultForm();

// ── Main component ────────────────────────────────────────────────────────────
const RoleManagement = () => {
  const { hasActionPermission, isSuperAdmin } = useAuth();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [selectedRole, setSelectedRole] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(defaultForm);
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // ── Fetch (fixed: fetchStats no longer depends on `stats`) ───────────────

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await apiService.getRoleStats();
      if (res.success)
        setStats(res.data || { total: 0, active: 0, inactive: 0 });
    } catch (_) {
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchRoles = useCallback(async (page = 1, search = "", status = "") => {
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: 10 };
      if (search) params.search = search;
      if (status) params.status = status;
      const res = await apiService.getRoles(params);
      if (res.success) {
        setRoles(res.data || []);
        setPagination({
          total: res.pagination?.count || res.data?.length || 0,
          pages: res.pagination?.total || 1,
        });
      }
    } catch (err) {
      setError("Failed to load roles. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Single initial load
  useEffect(() => {
    fetchRoles(1, "", "");
    fetchStats();
  }, [fetchRoles, fetchStats]);

  // Re-fetch on filter/page change (debounced for search)
  useEffect(() => {
    const t = setTimeout(
      () => {
        fetchRoles(currentPage, searchTerm, filterStatus);
      },
      searchTerm ? 400 : 0,
    );
    return () => clearTimeout(t);
  }, [currentPage, searchTerm, filterStatus, fetchRoles]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleRefresh = () => {
    fetchRoles(currentPage, searchTerm, filterStatus);
    fetchStats();
  };

  const openCreate = () => {
    setFormData(buildDefaultForm());
    setIsEditing(false);
    setFormError("");
    setShowFormModal(true);
  };

  const openEdit = (role) => {
    setSelectedRole(role);
    setFormData({
      name: role.name || "",
      displayName: role.displayName || "",
      description: role.description || "",
      hierarchy: role.hierarchy || 1,
      isActive: role.isActive ?? true,
      permissions: mergePermissionsWithTemplate(role.permissions || {}),
    });
    setIsEditing(true);
    setFormError("");
    setShowFormModal(true);
  };

  const openDetail = (role) => {
    setSelectedRole(role);
    setShowDetailModal(true);
  };

  const closeModals = () => {
    setShowDetailModal(false);
    setShowFormModal(false);
    setSelectedRole(null);
    setFormError("");
  };

  const handleDelete = (roleId) => {
    setRoleToDelete(roleId);
    setDeleteError("");
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!roleToDelete) return;
    setDeleteSubmitting(true);
    setDeleteError("");
    try {
      const res = await apiService.deleteRole(roleToDelete);
      if (res.success) {
        setShowDeleteModal(false);
        setRoleToDelete(null);
        fetchRoles(currentPage, searchTerm, filterStatus);
        fetchStats();
      } else {
        setDeleteError(res.message || "Failed to delete role");
      }
    } catch (err) {
      setDeleteError(err?.response?.data?.message || "Failed to delete role");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError("");
    try {
      const payload = {
        ...formData,
        permissions: normalizePermissionAliases(formData.permissions || {}),
      };
      const res = isEditing
        ? await apiService.updateRole(selectedRole.id, payload)
        : await apiService.createRole(payload);
      if (res.success) {
        closeModals();
        fetchRoles(currentPage, searchTerm, filterStatus);
        fetchStats();
      } else setFormError(res.message || "Operation failed");
    } catch (err) {
      setFormError(
        err?.response?.data?.message || "Operation failed. Please try again.",
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  const handlePermChange = (path, value) => {
    setFormData((prev) => ({
      ...prev,
      permissions: (() => {
        const next = cloneDeep(prev.permissions || {});
        let cursor = next;
        for (let index = 0; index < path.length - 1; index += 1) {
          const key = path[index];
          cursor[key] =
            cursor[key] && typeof cursor[key] === "object" ? cursor[key] : {};
          cursor = cursor[key];
        }
        cursor[path[path.length - 1]] = value;

        return next;
      })(),
    }));
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 bg-gray-50 min-h-screen w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
            <FiShield size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 m-0 leading-none">
              Role Management
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Manage system roles and permissions
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh"
            className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 bg-white text-blue-500 hover:bg-blue-50 hover:border-blue-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <FiRefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-3">
          {[
            { label: "Total", value: stats.total, color: "text-blue-600" },
            { label: "Active", value: stats.active, color: "text-emerald-600" },
            {
              label: "Inactive",
              value: stats.inactive,
              color: "text-gray-500",
            },
          ].map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-2 min-w-[64px]"
            >
              <span className={`text-xl font-bold leading-none ${s.color}`}>
                {statsLoading ? "…" : s.value}
              </span>
              <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mt-0.5">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[240px]">
          <FiSearch
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={14}
          />
          <input
            type="text"
            placeholder="Search by name or description…"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setCurrentPage(1);
          }}
          className="py-2.5 px-4 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        {(hasActionPermission("manageRoles") || isSuperAdmin()) && (
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition"
          >
            <FiPlus size={14} /> Create Role
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-5">
          <p className="text-sm text-red-700 font-medium m-0">{error}</p>
          <button
            onClick={() => setError("")}
            className="text-red-400 hover:text-red-600"
          >
            <FiX size={15} />
          </button>
        </div>
      )}

      {/* Table */}
      {(hasActionPermission("manageRoles") || isSuperAdmin()) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto mb-5 w-full">
          <table
            className="w-full text-sm border-collapse"
            style={{ minWidth: "640px" }}
          >
            <colgroup>
              <col style={{ width: "32%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead>
              <tr className="bg-gray-50 text-left">
                {[
                  "Role",
                  "Hierarchy",
                  "Permissions",
                  "Status",
                  "Created",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
                      <p className="text-sm text-gray-400">Loading roles…</p>
                    </div>
                  </td>
                </tr>
              ) : roles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <p className="text-sm text-gray-400">
                      No roles found matching your criteria.
                    </p>
                  </td>
                </tr>
              ) : (
                roles.map((role) => {
                  const menuCount = Object.values(
                    role.permissions?.menus || {},
                  ).filter(Boolean).length;
                  const actionCount = Object.values(
                    role.permissions?.actions || {},
                  ).filter(Boolean).length;
                  return (
                    <tr
                      key={role.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <FiShield size={14} className="text-blue-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800 leading-tight">
                              {role.displayName}
                            </p>
                            <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                              {role.name}
                            </p>
                            {role.description && (
                              <p
                                className="text-xs text-gray-500 mt-0.5 max-w-[200px] truncate"
                                title={role.description}
                              >
                                {role.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 text-xs font-semibold border border-purple-100">
                          {hierarchyLabel(role.hierarchy)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 flex-wrap">
                          <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] font-semibold rounded-full border border-blue-100">
                            {menuCount} menus
                          </span>
                          <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] font-semibold rounded-full border border-gray-200">
                            {actionCount} actions
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge active={role.isActive} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(role.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {true && (
                            <button
                              onClick={() => openDetail(role)}
                              title="View Details"
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition"
                            >
                              <FiEye size={14} />
                            </button>
                          )}
                          {(hasActionPermission("manageRoles") ||
                            isSuperAdmin()) && (
                            <button
                              onClick={() => openEdit(role)}
                              title="Edit Role"
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 border border-transparent hover:border-amber-100 transition"
                            >
                              <FiEdit2 size={13} />
                            </button>
                          )}
                          {(hasActionPermission("manageRoles") ||
                            isSuperAdmin()) && (
                            <button
                              onClick={() => handleDelete(role.id)}
                              title="Delete Role"
                              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition"
                            >
                              <FiTrash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-4 py-4 bg-white rounded-xl border border-gray-100 mb-5">
          <button
            onClick={() => setCurrentPage((p) => p - 1)}
            disabled={currentPage === 1 || loading}
            className="px-4 py-2 text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            ← Previous
          </button>
          <span className="text-sm text-gray-500 font-medium">
            Page {currentPage} of {pagination.pages} — {pagination.total} total
          </span>
          <button
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={currentPage === pagination.pages || loading}
            className="px-4 py-2 text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Next →
          </button>
        </div>
      )}

      {/* ── Delete Confirmation Modal ─────────────────────────────────────── */}
      {showDeleteModal && (
        <Modal
          onClose={() => {
            if (!deleteSubmitting) {
              setShowDeleteModal(false);
              setRoleToDelete(null);
            }
          }}
        >
          <div style={{ padding: "28px 28px 0" }}>
            <div
              style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}
            >
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "#fef2f2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <FiAlertTriangle size={20} style={{ color: "#ef4444" }} />
              </div>
              <div style={{ flex: 1 }}>
                <h2
                  style={{
                    margin: "0 0 6px",
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "#111827",
                  }}
                >
                  Delete Role?
                </h2>
                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    color: "#6b7280",
                    lineHeight: 1.5,
                  }}
                >
                  This role will be permanently deactivated. Any admins
                  currently assigned to it may lose access. This action cannot
                  be undone.
                </p>
              </div>
            </div>
            {deleteError && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "12px 16px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "10px",
                  fontSize: "13px",
                  color: "#dc2626",
                }}
              >
                {deleteError}
              </div>
            )}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              padding: "24px 28px",
              borderTop: "1px solid #f3f4f6",
              marginTop: "24px",
            }}
          >
            <button
              onClick={() => {
                setShowDeleteModal(false);
                setRoleToDelete(null);
              }}
              disabled={deleteSubmitting}
              style={{
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: 600,
                background: "#f3f4f6",
                color: "#374151",
                border: "none",
                borderRadius: "10px",
                cursor: deleteSubmitting ? "not-allowed" : "pointer",
                opacity: deleteSubmitting ? 0.5 : 1,
              }}
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleteSubmitting}
              style={{
                padding: "10px 20px",
                fontSize: "14px",
                fontWeight: 600,
                background: "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                cursor: deleteSubmitting ? "not-allowed" : "pointer",
                opacity: deleteSubmitting ? 0.7 : 1,
              }}
            >
              {deleteSubmitting ? "Deleting…" : "Yes, Delete"}
            </button>
          </div>
        </Modal>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedRole && (
        <Modal onClose={closeModals} wide>
          <ModalHeader
            title={selectedRole.displayName}
            subtitle={`System name: ${selectedRole.name} · Hierarchy ${selectedRole.hierarchy}`}
            onClose={closeModals}
          />
          <div className="overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                {
                  label: "Status",
                  value: <StatusBadge active={selectedRole.isActive} />,
                },
                {
                  label: "Hierarchy",
                  value: (
                    <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs font-semibold rounded-lg">
                      {hierarchyLabel(selectedRole.hierarchy)}
                    </span>
                  ),
                },
                { label: "Created", value: formatDate(selectedRole.createdAt) },
              ].map((item) => (
                <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">
                    {item.label}
                  </p>
                  <div className="text-sm font-semibold text-gray-800">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
            {selectedRole.description && (
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Description
                </p>
                <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-4">
                  {selectedRole.description}
                </p>
              </div>
            )}
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                Module Permission Matrix (Menus, Submenus, Actions, Data)
              </p>
              <ModulePermissionView
                permissions={selectedRole.permissions || {}}
                getLabel={getPermissionLabel}
              />
            </div>
            {[
              { key: "uiElements", label: "UI Element Access" },
              { key: "bulkActions", label: "Bulk Actions" },
            ].map(({ key, label }) => (
              <PermissionSectionView
                key={key}
                title={label}
                tree={selectedRole.permissions?.[key] || {}}
                path={[key]}
                getLabel={getPermissionLabel}
              />
            ))}
          </div>
          <div className="flex justify-end px-6 py-4 border-t border-gray-100 flex-shrink-0 gap-3">
            {(hasActionPermission("manageRoles") || isSuperAdmin()) && (
              <button
                onClick={() => {
                  closeModals();
                  openEdit(selectedRole);
                }}
                className="px-5 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition"
              >
                Edit Role
              </button>
            )}
            <button
              onClick={closeModals}
              className="px-5 py-2.5 text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition"
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {/* Create / Edit Modal */}
      {showFormModal &&
        (hasActionPermission("manageRoles") || isSuperAdmin()) && (
          <Modal onClose={closeModals} wide>
            <ModalHeader
              title={
                isEditing
                  ? `Edit Role — ${selectedRole?.displayName}`
                  : "Create New Role"
              }
              onClose={closeModals}
            />
            {
              <form
                onSubmit={handleFormSubmit}
                className="flex flex-col min-h-0"
              >
                <div className="overflow-y-auto p-6 space-y-5 flex-1">
                  {formError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                      {formError}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                        System Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, name: e.target.value }))
                        }
                        required
                        placeholder="e.g., review-officer"
                        className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">
                        Lowercase, hyphens only
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                        Display Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.displayName}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            displayName: e.target.value,
                          }))
                        }
                        required
                        placeholder="e.g., Review Officer"
                        className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                        Hierarchy Level <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={formData.hierarchy}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            hierarchy: parseInt(e.target.value) || 1,
                          }))
                        }
                        required
                        min={1}
                        max={10}
                        className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">
                        1 = highest authority
                      </p>
                    </div>
                    <div className="flex items-center mt-5">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isActive}
                          onChange={(e) =>
                            setFormData((p) => ({
                              ...p,
                              isActive: e.target.checked,
                            }))
                          }
                          className="accent-blue-600 w-4 h-4"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Active Role
                        </span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                      rows={2}
                      placeholder="Describe this role's responsibilities…"
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
                    />
                  </div>
                  <div className="space-y-3">
                    <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">
                      Module Permission Matrix (Menus, Submenus, Actions, Data)
                    </p>
                    <ModulePermissionEditor
                      permissions={formData.permissions || {}}
                      onChange={handlePermChange}
                      getLabel={getPermissionLabel}
                    />
                  </div>
                  {[
                    { key: "uiElements", label: "UI Element Access" },
                    { key: "bulkActions", label: "Bulk Actions" },
                  ].map(({ key, label }) => (
                    <PermissionSectionEditor
                      key={key}
                      title={label}
                      tree={formData.permissions[key] || {}}
                      onChange={handlePermChange}
                      path={[key]}
                      getLabel={getPermissionLabel}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
                  <button
                    type="button"
                    onClick={closeModals}
                    disabled={formSubmitting}
                    className="px-5 py-2.5 text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="px-5 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition disabled:opacity-60"
                  >
                    {formSubmitting
                      ? "Saving…"
                      : isEditing
                        ? "Save Changes"
                        : "Create Role"}
                  </button>
                </div>
              </form>
            }
          </Modal>
        )}
    </div>
  );
};

export default RoleManagement;
