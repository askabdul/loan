import { io } from "socket.io-client";

// Derive socket URL from env; if API includes '/api', strip it to reach server root
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8001/api";
const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || API_URL.replace(/\/api$/, "");

class WebSocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
    this.isConnected = false;
  }

  connect() {
    if (this.socket && this.isConnected) {
      return;
    }

    const token = localStorage.getItem("adminToken");

    this.socket = io(SOCKET_URL, {
      auth: {
        token: token,
      },
      transports: ["websocket", "polling"],
    });

    this.socket.on("connect", () => {
      this.isConnected = true;
    });

    this.socket.on("disconnect", () => {
      this.isConnected = false;
    });

    this.socket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
      this.isConnected = false;
    });

    // Listen for real-time updates
    this.socket.on("user_registered", (data) => {
      this.emit("user_registered", data);
    });

    this.socket.on("loan_application", (data) => {
      this.emit("loan_application", data);
    });

    this.socket.on("loan_status_updated", (data) => {
      this.emit("loan_status_updated", data);
    });

    this.socket.on("payment_received", (data) => {
      this.emit("payment_received", data);
    });

    this.socket.on("dashboard_update", (data) => {
      this.emit("dashboard_update", data);
    });

    this.socket.on("user_activity", (data) => {
      this.emit("user_activity", data);
    });

    this.socket.on("disbursement-requested", (data) => {
      this.emit("disbursement-requested", data);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Subscribe to events
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  // Unsubscribe from events
  off(event, callback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      if (callback) {
        // Remove specific callback
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      } else {
        // Remove all callbacks for this event
        this.listeners.set(event, []);
      }
    }
  }

  // Emit events to listeners
  emit(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(
            `Error in WebSocket event listener for ${event}:`,
            error,
          );
        }
      });
    }
  }

  // Send data to server
  send(event, data) {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    } else {
    }
  }

  // Get connection status
  getConnectionStatus() {
    return this.isConnected;
  }
}

// Create and export singleton instance
const websocketService = new WebSocketService();
export default websocketService;

// Auto-connect when service is imported
if (typeof window !== "undefined") {
  // Only connect in browser environment
  const token = localStorage.getItem("adminToken");
  if (token) {
    websocketService.connect();
  }
}
