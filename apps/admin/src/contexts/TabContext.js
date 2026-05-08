import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

const TabContext = createContext();

export const useTab = () => {
  const context = useContext(TabContext);
  if (!context) {
    throw new Error("useTab must be used within a TabProvider");
  }
  return context;
};

// Route to title mapping
const routeTitleMap = {
  "/": "Dashboard",
  "/dashboard": "Dashboard",
  "/data-statistics/dashboard": "Analytics Dashboard",
  "/user/list": "User List",
  "/user/find": "Find User",
  "/user/level-assignment": "Level Assignment",
  "/order/repayment": "Order Repayment",
  "/order/extension": "Loan Extension",
  "/order/review-repayment": "Repayment Review",
  "/fund-management/payments": "Payment Management",
  "/notifications": "Notifications",
  "/roles": "Role Management",
  "/credit-review/list": "Credit Review",
  "/pre-collection/all-list": "Pre-collection All",
  "/pre-collection/list": "Pre-collection List",
  "/pre-collection/rank1": "Pre-collection Rank 1",
  "/pre-collection/rank2": "Pre-collection Rank 2",
  "/pre-collection/payment-record": "Pre-collection Payments",
  "/collection/list": "Collection List",
  "/collection/rank1": "Collection Rank 1",
  "/collection/rank2": "Collection Rank 2",
  "/collection/payment-record": "Collection Payments",
  "/config": "Configuration",
  "/app-config": "App Configuration",
  "/loan-settings": "Loan Settings",
  "/loan-configuration": "Loan Configuration",
  "/loan-rate-calculation": "Rate Calculation",
  "/app-branding": "App Branding",
  "/contact-info": "Contact Info",
  "/faq": "FAQ",
  "/terms-conditions": "Terms & Conditions",
  "/content": "Content Management",
  "/admin-management": "Admin Management",
};

const getRouteTitle = (path) => {
  return (
    routeTitleMap[path] ||
    path
      .split("/")
      .pop()
      .replace(/-/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase())
  );
};

const STORAGE_KEY = "cedi_admin_tabs";

const loadFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.tabs)) return parsed;
    }
  } catch (_) {}
  return { tabs: [], activeTab: null };
};

const saveToStorage = (tabs, activeTab) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeTab }));
  } catch (_) {}
};

export const TabProvider = ({ children }) => {
  const initial = loadFromStorage();
  const [tabs, setTabs] = useState(initial.tabs);
  const [activeTab, setActiveTab] = useState(initial.activeTab);
  const location = useLocation();
  const navigate = useNavigate();

  // Persist whenever tabs or activeTab change
  useEffect(() => {
    saveToStorage(tabs, activeTab);
  }, [tabs, activeTab]);

  // Add or activate a tab
  const addTab = useCallback((path, title = null) => {
    const tabTitle = title || getRouteTitle(path);
    const tabId = path;

    setTabs((prevTabs) => {
      const existingTab = prevTabs.find((tab) => tab.id === tabId);
      if (existingTab) {
        setActiveTab(tabId);
        return prevTabs;
      }

      const newTab = {
        id: tabId,
        title: tabTitle,
        path: path,
        closable: path !== "/",
      };

      const newTabs = [...prevTabs, newTab];
      setActiveTab(tabId);
      return newTabs;
    });
  }, []);

  // Close a tab
  const closeTab = useCallback(
    (tabId) => {
      setTabs((prevTabs) => {
        const tabIndex = prevTabs.findIndex((tab) => tab.id === tabId);
        if (tabIndex === -1) return prevTabs;

        const newTabs = prevTabs.filter((tab) => tab.id !== tabId);

        if (activeTab === tabId) {
          if (newTabs.length > 0) {
            const newActiveIndex = tabIndex > 0 ? tabIndex - 1 : 0;
            const newActiveTab = newTabs[newActiveIndex];
            setActiveTab(newActiveTab.id);
            navigate(newActiveTab.path);
          } else {
            setActiveTab(null);
            navigate("/");
          }
        }

        return newTabs;
      });
    },
    [activeTab, navigate],
  );

  // Close all tabs to the right of tabId
  const closeTabsToRight = useCallback(
    (tabId) => {
      setTabs((prevTabs) => {
        const idx = prevTabs.findIndex((t) => t.id === tabId);
        if (idx === -1) return prevTabs;
        const toRemove = prevTabs.slice(idx + 1).filter((t) => t.closable);
        const newTabs = prevTabs.filter(
          (t) => !toRemove.some((r) => r.id === t.id),
        );
        // If active tab was removed, switch to tabId
        if (toRemove.some((t) => t.id === activeTab)) {
          setActiveTab(tabId);
          navigate(tabId);
        }
        return newTabs;
      });
    },
    [activeTab, navigate],
  );

  // Close all tabs to the left of tabId
  const closeTabsToLeft = useCallback(
    (tabId) => {
      setTabs((prevTabs) => {
        const idx = prevTabs.findIndex((t) => t.id === tabId);
        if (idx === -1) return prevTabs;
        const toRemove = prevTabs.slice(0, idx).filter((t) => t.closable);
        const newTabs = prevTabs.filter(
          (t) => !toRemove.some((r) => r.id === t.id),
        );
        if (toRemove.some((t) => t.id === activeTab)) {
          setActiveTab(tabId);
          navigate(tabId);
        }
        return newTabs;
      });
    },
    [activeTab, navigate],
  );

  // Close all other tabs (keep tabId and the non-closable Dashboard)
  const closeOtherTabs = useCallback(
    (tabId) => {
      setTabs((prevTabs) => {
        const newTabs = prevTabs.filter((t) => t.id === tabId || !t.closable);
        if (activeTab !== tabId) {
          setActiveTab(tabId);
          navigate(tabId);
        }
        return newTabs;
      });
    },
    [activeTab, navigate],
  );

  // Switch to a tab
  const switchTab = useCallback(
    (tabId) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (tab) {
        setActiveTab(tabId);
        navigate(tab.path);
      }
    },
    [tabs, navigate],
  );

  // Initialize home tab if no tabs exist
  React.useEffect(() => {
    if (tabs.length === 0) {
      addTab("/", "Dashboard");
    }
  }, [tabs.length, addTab]);

  // Update active tab when location changes
  React.useEffect(() => {
    const currentPath = location.pathname;
    addTab(currentPath);
  }, [location.pathname, addTab]);

  const value = {
    tabs,
    activeTab,
    addTab,
    closeTab,
    closeTabsToRight,
    closeTabsToLeft,
    closeOtherTabs,
    switchTab,
  };

  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
};
