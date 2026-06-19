import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const AdminSocketContext = createContext(null);

export const useAdminSocket = () => useContext(AdminSocketContext);

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8001/api";
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || API_URL.replace(/\/api$/, "");

export const AdminSocketProvider = ({ children }) => {
  const { token } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [dashboardStats, setDashboardStats] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      timeout: 10000,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
    });

    socketRef.current = newSocket;

    newSocket.on("connect", () => {
      setIsConnected(true);
      newSocket.emit("subscribe_dashboard");
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
    });

    // Backend emits dashboard_update (underscore)
    newSocket.on("dashboard_update", (data) => {
      setDashboardStats(data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  return (
    <AdminSocketContext.Provider value={{ socket, isConnected, dashboardStats }}>
      {children}
    </AdminSocketContext.Provider>
  );
};
