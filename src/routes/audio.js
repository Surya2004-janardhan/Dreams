const express = require("express");
const { generateAudioEndpoint } = require("../controllers/audioController");

const router = express.Router();

// POST /audio/generate - Generate conversation audio
router.post("/generate", generateAudioEndpoint);

module.exports = router;
