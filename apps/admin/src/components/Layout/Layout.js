import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { useAuth } from "../../contexts/AuthContext";
import websocketService from "../../services/websocket";
import Sidebar from "../Sidebar/Sidebar";
import TabBar from "../TabBar";
import "./Layout.css";

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Listen for customer disbursement requests and alert admins in real-time
  useEffect(() => {
    const unsub = websocketService.on("disbursement-requested", (data) => {
      const amount = data.amount
        ? `GHS ${parseFloat(data.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : "an approved loan";
      toast.info(
        `💰 A customer has requested disbursement for ${amount}. Go to Credit Review → Approved tab.`,
        { autoClose: 8000, toastId: `disbursement-${data.loanId}` },
      );
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!showDropdown) return;
    const close = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target))
        setShowDropdown(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showDropdown]);

  const handleLogout = () => {
    logout();
    setShowDropdown(false);
  };

  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user?.email?.[0]?.toUpperCase() || "A";
  };

  const getUserName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user?.email || "Administrator";
  };

  const getRoleName = () => {
    // user.Role is the Sequelize-associated Role object; user.role may also be the object
    const roleObj =
      user?.Role ??
      (user?.role && typeof user.role === "object" ? user.role : null);
    if (roleObj?.name) return roleObj.name.replace(/-/g, " ");
    if (typeof user?.role === "string") return user.role;
    return "Admin";
  };

  return (
    <div className="layout">
      <Sidebar />
      <div className="main-content">
        <header className="main-header">
          <div className="header-content">
            <div className="header-left">
              <h1 className="page-title">Admin Dashboard</h1>
            </div>
            <div className="header-right">
              <div className="nav-user" ref={dropdownRef}>
                <button
                  className="nav-user-btn"
                  onClick={() => setShowDropdown((v) => !v)}
                >
                  <div className="nav-avatar">{getUserInitials()}</div>
                  <div className="nav-user-text">
                    <span className="nav-user-name">{getUserName()}</span>
                    <span className="nav-user-role">{getRoleName()}</span>
                  </div>
                  <svg
                    className={`nav-chevron ${showDropdown ? "open" : ""}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    width="14"
                    height="14"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {showDropdown && (
                  <div className="nav-dropdown">
                    <div className="nav-dropdown-header">
                      <div className="nav-dropdown-avatar">
                        {getUserInitials()}
                      </div>
                      <div className="nav-dropdown-info">
                        <span className="nav-dropdown-name">
                          {getUserName()}
                        </span>
                        <span className="nav-dropdown-email">
                          {user?.email}
                        </span>
                        <span className="nav-dropdown-role">
                          {getRoleName()}
                        </span>
                      </div>
                    </div>
                    <div className="nav-dropdown-divider" />
                    <button
                      className="nav-dropdown-item nav-dropdown-logout"
                      onClick={handleLogout}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        width="15"
                        height="15"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1"
                        />
                      </svg>
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        <TabBar />
        <main className="main-body">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
