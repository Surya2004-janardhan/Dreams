const express = require("express");
const { getBaseVideoEndpoint } = require("../controllers/videoController");

const router = express.Router();

// GET /video/base - Get base video from Google Drive
router.get("/base", getBaseVideoEndpoint);

module.exports = router;
