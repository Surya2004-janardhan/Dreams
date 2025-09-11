const express = require("express");
const { generateImagesEndpoint } = require("../controllers/imageController");

const router = express.Router();

// POST /images/generate - Generate educational images
router.post("/generate", generateImagesEndpoint);

module.exports = router;
