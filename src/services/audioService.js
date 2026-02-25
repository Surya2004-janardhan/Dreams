const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");

// Define audio directory
const audioDir = "audio";

// Ensure audio directory exists
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

module.exports = {};
