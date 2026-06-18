const express = require("express");
const http = require("http");
const fs = require("fs");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const websocketService = require("./services/websocketService");
const overdueTrackingService = require("./services/overdueTrackingService");
const reserveReleaseService = require("./services/reserveReleaseService");
const {
  enhancedPerformanceMonitor,
  performanceStats,
} = require("./middleware/performancemonitor");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Ensure all upload directories exist at startup
[
  "uploads/profile-images",
  "uploads/loan-clearance",
  "uploads/extensions",
  "uploads/id-documents",
].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created upload directory: ${dir}`);
  }
});

// Security middleware
app.use(helmet());

// Rate limiting - more lenient for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 100 : 1000, // Higher limit for development
  message: "Too many requests from this IP, please try again later.",
  skip: (req) => {
    // Skip rate limiting for health checks and development
    return req.path === "/api/health" || process.env.NODE_ENV !== "production";
  },
});
app.use("/api/", limiter);

// CORS configuration
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "https://cedloan.netlify.app",
  "https://cedloan-admin.netlify.app"
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no Origin header (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== "production") {
      // In dev, allow any localhost origin regardless of port
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
    }
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};
app.use(cors(corsOptions));

// Handle preflight requests
app.options("*", cors(corsOptions));

// Initialize WebSocket service
websocketService.initialize(server);

// Performance monitoring middleware
app.use(enhancedPerformanceMonitor);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve static files from uploads directory
app.use("/uploads", express.static("uploads"));

// Performance stats endpoint
app.get("/api/performance/stats", (req, res) => {
  res.json({
    success: true,
    stats: performanceStats.getStats(),
  });
});

// Performance stats reset endpoint (admin only)
app.post("/api/performance/reset", (req, res) => {
  performanceStats.reset();
  res.json({
    success: true,
    message: "Performance statistics reset successfully",
  });
});

// Logging middleware
app.use(morgan("common"));

// Database connection
const connectDB = require("./config/database");

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/admin-auth", require("./routes/adminAuth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/loans", require("./routes/loans"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/config", require("./routes/config"));
app.use("/api/config-new", require("./routes/config-new"));
app.use("/api/content", require("./routes/content"));
app.use("/api/loan-levels", require("./routes/loanLevels"));
app.use("/api/loan-terms", require("./routes/loanTerms"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/admin-management", require("./routes/adminManagement"));
app.use("/api/admin/notifications", require("./routes/adminNotifications"));
app.use("/api/loan-clearance", require("./routes/loanClearance"));
app.use("/api/loan-extension", require("./routes/loanExtension"));
app.use("/api/collection", require("./routes/collection"));
app.use("/api/precollection", require("./routes/precollection"));
app.use("/api/realtime", require("./routes/realtime"));
app.use("/api/performance", require("./routes/performance"));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "CEDI Loan Backend API is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to CEDI Loan Backend API",
    version: "1.0.0",
    endpoints: {
      health: "/api/health",
      auth: "/api/auth",
      adminAuth: "/api/admin-auth",
      users: "/api/users",
      loans: "/api/loans",
      payments: "/api/payments",
      notifications: "/api/notifications",
      config: "/api/config",
      content: "/api/content",
      loanLevels: "/api/loan-levels",
      loanTerms: "/api/loan-terms",
      admin: "/api/admin",
      adminManagement: "/api/admin-management",
      realtime: "/api/realtime",
    },
  });
});

// Import secure error handler
const { errorHandler } = require("./middleware/errorHandler");

// Error handling middleware - secure implementation
app.use(errorHandler);

// 404 handler - secure implementation
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "ROUTE_001",
      message: "The requested resource could not be found.",
      id: require("crypto").randomBytes(8).toString("hex").toUpperCase(),
    },
  });
});

// Make websocket service available to routes
app.set("websocketService", websocketService);

// Start server with proper database connection handling
const startServer = async () => {
  try {
    // Connect to database first
    console.log("🔄 Connecting to database...");
    await connectDB();
    console.log("✅ Database connection established");

    // Start the server only after database is connected
    server.listen(PORT, () => {
      console.log(`🚀 CEDI Loan Backend Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
      console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔌 Socket.IO enabled for real-time communication`);

      // Start overdue tracking service after database is connected
      console.log("🔄 Starting overdue tracking service...");
      overdueTrackingService.start();
      reserveReleaseService.start();
      console.log("✅ All services started successfully");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

// Start the server
startServer();

// Export app, websocketService and server for use in routes
module.exports = { app, websocketService, server };
