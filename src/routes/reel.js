const express = require("express");
const router = express.Router();
const {
  generateReelContent,
  getReelStatus,
  downloadReel,
} = require("../controllers/reelController");

// POST /reel/generate - Generate reel content from topic
router.post("/generate", generateReelContent);

// GET /reel/status/:taskId - Get reel generation status
router.get("/status/:taskId", getReelStatus);

// GET /reel/download/:taskId - Download generated reel
router.get("/download/:taskId", downloadReel);

module.exports = router;
