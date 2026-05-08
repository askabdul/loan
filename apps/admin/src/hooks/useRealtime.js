import { useState, useEffect, useRef, useCallback } from "react";
import io from "socket.io-client";
import { useAuth } from "../contexts/AuthContext";

// Use env API URL and strip '/api' to get socket server root
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8001/api";
const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || API_URL.replace(/\/api$/, "");

export const useRealtime = () => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [loanData, setLoanData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const { user, token } = useAuth();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Initialize socket connection
  useEffect(() => {
    if (!token || !user) return;

    const newSocket = io(SOCKET_URL, {
      auth: {
        token: token,
        userId: user._id,
        role: user.role?.name || "admin",
      },
      transports: ["websocket", "polling"],
      timeout: 20000,
      forceNew: true,
    });

    // Connection events
    newSocket.on("connect", () => {
      setConnected(true);
      reconnectAttempts.current = 0;

      // Join admin room
      newSocket.emit("join-admin-room", {
        adminId: user._id,
        role: user.role?.name || "admin",
      });
    });

    newSocket.on("disconnect", (reason) => {
      setConnected(false);
    });

    newSocket.on("connect_error", (error) => {
      console.error("🔥 Connection error:", error);
      setConnected(false);

      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        setTimeout(() => {
          newSocket.connect();
        }, 2000 * reconnectAttempts.current);
      }
    });

    // Real-time data events
    newSocket.on("dashboard-update", (data) => {
      setDashboardData(data);
    });

    newSocket.on("loan-update", (data) => {
      setLoanData(data);
    });

    newSocket.on("loan-status-changed", (data) => {
      setLoanData((prevData) => {
        if (!prevData) return data;

        // Update specific loan in the list
        const updatedLoans = prevData.loans?.map((loan) =>
          loan._id === data.loanId ? { ...loan, status: data.status } : loan,
        );

        return {
          ...prevData,
          loans: updatedLoans || prevData.loans,
        };
      });
    });

    newSocket.on("user-update", (data) => {
      setUserData(data);
    });

    newSocket.on("user-status-changed", (data) => {
      setUserData((prevData) => {
        if (!prevData) return data;

        // Update specific user in the list
        const updatedUsers = prevData.users?.map((user) =>
          user._id === data.userId
            ? { ...user, isActive: data.isActive }
            : user,
        );

        return {
          ...prevData,
          users: updatedUsers || prevData.users,
        };
      });
    });

    newSocket.on("notification", (data) => {
      setNotifications((prev) => [data, ...prev.slice(0, 9)]); // Keep last 10 notifications
    });

    newSocket.on("system-config-update", (data) => {
      // Trigger a refresh or update config state
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token, user]);

  // Request live dashboard data
  const requestDashboardData = useCallback(() => {
    if (socket && connected) {
      socket.emit("request-dashboard-data");
    }
  }, [socket, connected]);

  // Request live loan data
  const requestLoanData = useCallback(
    (filters = {}) => {
      if (socket && connected) {
        socket.emit("request-loan-data", filters);
      }
    },
    [socket, connected],
  );

  // Request live user data
  const requestUserData = useCallback(
    (filters = {}) => {
      if (socket && connected) {
        socket.emit("request-user-data", filters);
      }
    },
    [socket, connected],
  );

  // Perform real-time search
  const performSearch = useCallback(
    (query, type = "all") => {
      if (socket && connected && query.length >= 2) {
        socket.emit("search", { query, type });

        // Listen for search results
        socket.on("search-results", (results) => {
          setSearchResults(results);
        });
      } else {
        setSearchResults(null);
      }
    },
    [socket, connected],
  );

  // Clear search results
  const clearSearch = useCallback(() => {
    setSearchResults(null);
  }, []);

  // Send notification to specific user/role
  const sendNotification = useCallback(
    (notification) => {
      if (socket && connected) {
        socket.emit("send-notification", notification);
      }
    },
    [socket, connected],
  );

  // Broadcast system announcement
  const broadcastAnnouncement = useCallback(
    (announcement) => {
      if (socket && connected) {
        socket.emit("broadcast-announcement", announcement);
      }
    },
    [socket, connected],
  );

  return {
    // Connection state
    connected,
    socket,

    // Real-time data
    dashboardData,
    loanData,
    userData,
    notifications,
    searchResults,

    // Actions
    requestDashboardData,
    requestLoanData,
    requestUserData,
    performSearch,
    clearSearch,
    sendNotification,
    broadcastAnnouncement,
  };
};

export default useRealtime;
