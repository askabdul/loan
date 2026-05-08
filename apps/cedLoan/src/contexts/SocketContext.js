import React, { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { user } = useAuth();
  const { showError, showSuccess, showInfo } = useToast();

  useEffect(() => {
    if (user) {
      // Initialize socket connection
      const newSocket = io(
        (process.env.REACT_APP_API_URL || "http://localhost:8000/api").replace(
          /\/api\/?$/,
          "",
        ),
        {
          transports: ["websocket", "polling"],
          withCredentials: true,
          forceNew: true,
          reconnection: true,
          timeout: 5000,
        },
      );

      newSocket.on("connect", () => {
        console.log("🔌 Connected to server");
        setIsConnected(true);

        // Join user's personal room for targeted notifications
        newSocket.emit("join-user-room", user.id);
      });

      newSocket.on("disconnect", () => {
        console.log("🔌 Disconnected from server");
        setIsConnected(false);
      });

      // Listen for loan status changes
      newSocket.on("loan-status-changed", (data) => {
        // Dispatch custom events first so page-level handlers (e.g. LoanApplication) can react
        window.dispatchEvent(
          new CustomEvent("loanStatusUpdate", { detail: data }),
        );
        window.dispatchEvent(
          new CustomEvent("newNotification", { detail: data }),
        );
        // Show a contextual toast — LoanApplication already shows its own, so we only
        // show here when the user is NOT on a page that handles loanStatusUpdate itself.
        // We use a short setTimeout so page listeners have a chance to call
        // e.stopImmediatePropagation or a flag before we fire.
        const successStatuses = ["approved", "disbursed", "completed"];
        const errorStatuses = ["rejected", "cancelled"];
        const msg = data.message || `Loan status updated to: ${data.status}`;
        if (successStatuses.includes(data.status)) {
          showSuccess(msg);
        } else if (errorStatuses.includes(data.status)) {
          showError(msg);
        } else {
          showInfo(msg);
        }
      });

      // Listen for payment notifications
      newSocket.on("payment-received", (data) => {
        showSuccess(data.message || "Payment received successfully!");
        window.dispatchEvent(
          new CustomEvent("paymentUpdate", { detail: data }),
        );
        window.dispatchEvent(
          new CustomEvent("newNotification", { detail: data }),
        );
      });

      // Listen for system configuration updates
      newSocket.on("system_config_updated", (data) => {
        console.log("⚙️ System configuration updated:", data);
        showInfo(`Configuration updated: ${data.key}`);

        // Trigger custom event for components to listen to
        window.dispatchEvent(new CustomEvent("configUpdate", { detail: data }));
      });

      // Listen for bulk configuration updates
      newSocket.on("bulk_config_update", (data) => {
        showInfo("System configurations have been updated");
        window.dispatchEvent(
          new CustomEvent("bulkConfigUpdate", { detail: data }),
        );
      });

      // Listen for general configuration updates
      newSocket.on("system_config_update", (data) => {
        window.dispatchEvent(
          new CustomEvent("systemConfigUpdate", { detail: data }),
        );
      });

      // Handle connection errors
      newSocket.on("connect_error", () => {
        setIsConnected(false);
      });

      // Handle general errors
      newSocket.on("error", () => {});

      setSocket(newSocket);

      // Cleanup on unmount or user change
      return () => {
        newSocket.close();
        setSocket(null);
        setIsConnected(false);
      };
    } else {
      // User logged out, disconnect socket
      if (socket) {
        socket.close();
        setSocket(null);
        setIsConnected(false);
      }
    }
  }, [user, showError, showSuccess, showInfo]);

  // Function to emit events
  const emitEvent = (eventName, data) => {
    if (socket && isConnected) {
      socket.emit(eventName, data);
    } else {
      console.warn("Socket not connected. Cannot emit event:", eventName);
    }
  };

  const value = {
    socket,
    isConnected,
    emitEvent,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};
