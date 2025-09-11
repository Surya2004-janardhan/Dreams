const express = require("express");
const { generateScriptEndpoint } = require("../controllers/scriptController");

const router = express.Router();

// POST /script/generate - Generate conversation script
router.post("/generate", generateScriptEndpoint);

module.exports = router;
