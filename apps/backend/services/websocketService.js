const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const getModels = () => require("../models");

class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedClients = new Map();
    this.dashboardCache = null;
    this.dashboardCacheExpiry = null;
    this.CACHE_DURATION = 30000; // 30 seconds
    this.pendingDashboardUpdate = false;
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: [
          process.env.ADMIN_FRONTEND_URL || "http://localhost:3001",
          "http://localhost:3000",
          "http://localhost:3002",
          "http://127.0.0.1:3000",
          "http://127.0.0.1:3001",
          "http://127.0.0.1:3002",
        ].filter(Boolean),
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error("Authentication error"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { Admin, Role } = getModels();
        const admin = await Admin.findByPk(decoded.id, {
          include: [{ model: Role, as: "Role" }],
        });

        if (!admin) {
          return next(new Error("Admin not found"));
        }

        socket.adminId = admin.id;
        socket.adminRole = admin.Role;
        socket.adminEmail = admin.email;

        next();
      } catch (error) {
        next(new Error("Authentication error"));
      }
    });

    this.io.on("connection", (socket) => {
      console.log(`Admin connected: ${socket.adminEmail} (${socket.id})`);

      // Store client connection
      this.connectedClients.set(socket.id, {
        adminId: socket.adminId,
        adminRole: socket.adminRole,
        adminEmail: socket.adminEmail,
        socket: socket,
      });

      // Join role-based rooms
      if (socket.adminRole) {
        socket.join(`role_${socket.adminRole.name}`);
        socket.join(`admin_${socket.adminId}`);
      }

      // Handle client requests for real-time data
      socket.on("subscribe_dashboard", () => {
        socket.join("dashboard_updates");
        this.sendDashboardData(socket);
      });

      socket.on("subscribe_loans", () => {
        socket.join("loan_updates");
      });

      socket.on("subscribe_users", () => {
        socket.join("user_updates");
      });

      socket.on("subscribe_notifications", () => {
        socket.join("notification_updates");
      });

      socket.on("subscribe_level_assignments", () => {
        socket.join("level_assignment_updates");
      });

      // Handle frontend real-time data requests
      socket.on("request-dashboard-data", () => {
        socket.join("dashboard_updates");
        this.sendDashboardData(socket);
      });

      socket.on("request-user-data", async (filters = {}) => {
        socket.join("user_updates");
        await this.sendUserData(socket, filters);
      });

      socket.on("request-loan-data", async (filters = {}) => {
        socket.join("loan_updates");
        await this.sendLoanData(socket, filters);
      });

      socket.on("join-admin-room", (data) => {
        socket.join(`admin_${data.adminId}`);
        if (data.role) {
          socket.join(`role_${data.role}`);
        }
      });

      socket.on("search", async (searchData) => {
        await this.handleSearch(socket, searchData);
      });

      socket.on("disconnect", () => {
        console.log(`Admin disconnected: ${socket.adminEmail} (${socket.id})`);
        this.connectedClients.delete(socket.id);
      });
    });

    console.log("WebSocket server initialized");
  }

  // Broadcast dashboard updates with caching
  async sendDashboardData(socket = null, forceRefresh = false) {
    try {
      const now = Date.now();

      // Use cached data if available and not expired
      if (
        !forceRefresh &&
        this.dashboardCache &&
        this.dashboardCacheExpiry &&
        now < this.dashboardCacheExpiry
      ) {
        const cachedData = { ...this.dashboardCache, timestamp: new Date() };
        if (socket) {
          socket.emit("dashboard_update", cachedData);
        } else {
          this.io.to("dashboard_updates").emit("dashboard_update", cachedData);
        }
        return;
      }

      // Prevent multiple concurrent dashboard updates
      if (this.pendingDashboardUpdate && !socket) {
        return;
      }

      this.pendingDashboardUpdate = true;

      const { User, Loan, Payment } = getModels();

      const [
        totalUsers,
        totalLoans,
        pendingLoans,
        approvedLoans,
        rejectedLoans,
        totalPayments,
      ] = await Promise.all([
        User.count(),
        Loan.count(),
        Loan.count({ where: { status: "pending" } }),
        Loan.count({ where: { status: "approved" } }),
        Loan.count({ where: { status: "rejected" } }),
        Payment.count(),
      ]);

      const dashboardData = {
        totalUsers,
        totalLoans,
        pendingLoans,
        approvedLoans,
        rejectedLoans,
        totalPayments,
        timestamp: new Date(),
      };

      // Cache the data
      this.dashboardCache = dashboardData;
      this.dashboardCacheExpiry = now + this.CACHE_DURATION;
      this.pendingDashboardUpdate = false;

      if (socket) {
        socket.emit("dashboard_update", dashboardData);
      } else {
        this.io.to("dashboard_updates").emit("dashboard_update", dashboardData);
      }
    } catch (error) {
      console.error("Error sending dashboard data:", error);
      this.pendingDashboardUpdate = false;
    }
  }

  // Broadcast loan updates with debounced dashboard refresh
  broadcastLoanUpdate(loanData, eventType = "loan_update") {
    if (this.io) {
      this.io.to("loan_updates").emit(eventType, {
        loan: loanData,
        timestamp: new Date(),
      });

      // Debounced dashboard update
      this.debouncedDashboardUpdate();
    }
  }

  // Broadcast user updates with debounced dashboard refresh
  broadcastUserUpdate(userData, eventType = "user_update") {
    if (this.io) {
      this.io.to("user_updates").emit(eventType, {
        user: userData,
        timestamp: new Date(),
      });

      // Debounced dashboard update
      this.debouncedDashboardUpdate();
    }
  }

  // Broadcast user level assignment updates
  broadcastUserLevelUpdate(userData, eventType = "user_level_update") {
    if (this.io) {
      this.io.to("user_updates").emit(eventType, {
        user: userData,
        timestamp: new Date(),
      });

      // Also broadcast to level assignment subscribers
      this.io.to("level_assignment_updates").emit("level_assignment_changed", {
        user: userData,
        timestamp: new Date(),
      });

      // Also update dashboard
      this.sendDashboardData();
    }
  }

  // Broadcast bulk user level updates
  broadcastBulkUserLevelUpdate(
    updateData,
    eventType = "bulk_user_level_update",
  ) {
    if (this.io) {
      this.io.to("user_updates").emit(eventType, {
        ...updateData,
        timestamp: new Date(),
      });

      // Also broadcast to level assignment subscribers
      this.io
        .to("level_assignment_updates")
        .emit("bulk_level_assignment_changed", {
          ...updateData,
          timestamp: new Date(),
        });

      // Also update dashboard
      this.sendDashboardData();
    }
  }

  // Broadcast notifications
  broadcastNotification(notification, targetRole = null, targetAdmin = null) {
    if (this.io) {
      const notificationData = {
        ...notification,
        timestamp: new Date(),
      };

      if (targetAdmin) {
        // Send to specific admin
        this.io
          .to(`admin_${targetAdmin}`)
          .emit("notification", notificationData);
      } else if (targetRole) {
        // Send to all admins with specific role
        this.io.to(`role_${targetRole}`).emit("notification", notificationData);
      } else {
        // Send to all connected admins
        this.io
          .to("notification_updates")
          .emit("notification", notificationData);
      }
    }
  }

  // Broadcast payment updates with debounced dashboard refresh
  broadcastPaymentUpdate(paymentData, eventType = "payment_update") {
    if (this.io) {
      this.io.emit(eventType, {
        payment: paymentData,
        timestamp: new Date(),
      });

      // Debounced dashboard update
      this.debouncedDashboardUpdate();
    }
  }

  // Debounced dashboard update to prevent excessive calls
  debouncedDashboardUpdate() {
    if (this.dashboardUpdateTimeout) {
      clearTimeout(this.dashboardUpdateTimeout);
    }

    this.dashboardUpdateTimeout = setTimeout(() => {
      this.sendDashboardData(null, true); // Force refresh
    }, 1000); // Wait 1 second before updating
  }

  // Broadcast configuration updates
  broadcastConfigUpdate(configData, eventType = "config_update") {
    if (this.io) {
      this.io.emit(eventType, {
        config: configData,
        timestamp: new Date(),
      });

      console.log("Configuration update broadcasted:", eventType);
    }
  }

  // Broadcast system configuration changes to mobile app
  broadcastSystemConfigUpdate(configKey, configValue) {
    if (this.io) {
      this.io.emit("system_config_updated", {
        key: configKey,
        value: configValue,
        timestamp: new Date(),
      });

      console.log(`System config update broadcasted: ${configKey}`);
    }
  }

  // Send to specific user (by userId)
  sendToUser(userId, eventType, data) {
    if (this.io) {
      this.io
        .to(`user_${userId}`)
        .emit(eventType, { ...data, timestamp: new Date() });
    }
  }

  // Alias kept for call-sites that use broadcastToUser
  broadcastToUser(userId, eventType, data) {
    return this.sendToUser(userId, eventType, data);
  }

  // Broadcast to all admins
  broadcastToAdmins(eventType, data) {
    if (this.io) {
      this.io.emit(eventType, { ...data, timestamp: new Date() });
    }
  }

  // Broadcast dashboard update (alias for sendDashboardData)
  broadcastDashboardUpdate(data) {
    if (this.io) {
      this.io
        .to("dashboard_updates")
        .emit("dashboard_update", { ...data, timestamp: new Date() });
    }
  }

  // Get connected clients count
  getConnectedClientsCount() {
    return this.connectedClients.size;
  }

  // Get connected clients by role
  getClientsByRole(roleName) {
    return Array.from(this.connectedClients.values()).filter(
      (client) => client.adminRole && client.adminRole.name === roleName,
    );
  }
}

module.exports = new WebSocketService();
