import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { notificationsAPI } from "../services/api";

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const response = await notificationsAPI.getNotificationCount();
        if (!cancelled) {
          setUnreadCount(response.count || response.unreadCount || 0);
        }
      } catch (_) {
        // silently fail — badge just won't show
      }
    };
    fetchCount();

    // Refresh count when notifications page is left
    const interval = setInterval(fetchCount, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentPath]);

  // Listen for real-time notification events to bump badge
  useEffect(() => {
    const onNotification = () => setUnreadCount((prev) => prev + 1);
    window.addEventListener("newNotification", onNotification);
    return () => window.removeEventListener("newNotification", onNotification);
  }, []);

  const navItems = [
    { path: "/home", label: "Home", icon: "🏠" },
    { path: "/apply", label: "Apply", icon: "💰" },
    { path: "/history", label: "History", icon: "📜" },
    {
      path: "/notifications",
      label: "Alerts",
      icon: "🔔",
      badge: unreadCount > 0 ? unreadCount : null,
    },
    { path: "/profile", label: "Profile", icon: "👤" },
  ];

  return (
    <div className="bottom-navigation">
      {navItems.map((item) => (
        <div
          key={item.path}
          className={`nav-item ${currentPath === item.path ? "active" : ""}`}
          onClick={() => {
            if (item.path === "/notifications") setUnreadCount(0);
            navigate(item.path);
          }}
          style={{ position: "relative" }}
        >
          <div
            className="nav-icon"
            style={{ position: "relative", display: "inline-block" }}
          >
            {item.icon}
            {item.badge && (
              <span
                style={{
                  position: "absolute",
                  top: "-6px",
                  right: "-8px",
                  background: "#ef4444",
                  color: "#fff",
                  borderRadius: "9999px",
                  fontSize: "10px",
                  fontWeight: 700,
                  lineHeight: 1,
                  minWidth: "16px",
                  height: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 3px",
                }}
              >
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </div>
          <div className="nav-label">{item.label}</div>
        </div>
      ))}
    </div>
  );
};

export default BottomNavigation;
