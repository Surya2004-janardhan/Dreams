const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Import configurations
require("./src/config/ffmpeg"); // Initialize FFmpeg
const logger = require("./src/config/logger");

// Import middleware
const upload = require("./src/middleware/upload");

// Import routes
const workflowRoutes = require("./src/routes/workflow");
const scriptRoutes = require("./src/routes/script");
const audioRoutes = require("./src/routes/audio");
const imageRoutes = require("./src/routes/images");
const videoRoutes = require("./src/routes/video");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Static file serving
app.use("/audio", express.static("audio"));
app.use("/images", express.static("images"));
app.use("/videos", express.static("videos"));
app.use("/temp", express.static("temp"));

// Routes
app.use("/workflow", workflowRoutes);
app.use("/script", scriptRoutes);
app.use("/audio", audioRoutes);
app.use("/images", imageRoutes);
app.use("/video", videoRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "🎥 AI Content Automation Server v2.0",
    endpoints: {
      workflow: "/workflow/run",
      status: "/workflow/status",
      script: "/script/generate",
      audio: "/audio/generate",
      images: "/images/generate",
      video: "/video/base",
      health: "/health",
    },
    documentation: "See README.md for API documentation",
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error("Unhandled error:", error);

  if (error.message && error.message.includes("Only video files are allowed")) {
    return res.status(400).json({ error: error.message });
  }

  res.status(500).json({
    error: "Internal server error",
    details: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    path: req.originalUrl,
    method: req.method,
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 AI Content Automation Server v2.0 running on port ${PORT}`);
  logger.info(`📍 Health check: http://localhost:${PORT}/health`);
  logger.info(`🎬 Main workflow: http://localhost:${PORT}/workflow/run`);
  console.log(`
    ╭─────────────────────────────────────────────╮
    │  🎥 AI Content Automation Server v2.0       │
    │  ─────────────────────────────────────────  │
    │  🌐 Server: http://localhost:${PORT}           │
    │  📊 Status: http://localhost:${PORT}/health     │
    │  🎬 Workflow: http://localhost:${PORT}/workflow │
    ╰─────────────────────────────────────────────╯
  `);
});

module.exports = app;
