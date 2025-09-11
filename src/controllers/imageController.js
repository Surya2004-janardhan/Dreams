const { generateImages } = require("../services/imageService");
const logger = require("../config/logger");

const generateImagesEndpoint = async (req, res) => {
  try {
    const { script } = req.body;

    if (!script) {
      return res.status(400).json({ error: "Script is required" });
    }

    logger.info("🖼️ Generating images from script");

    const images = await generateImages(script);

    res.json({
      success: true,
      images: images,
    });
  } catch (error) {
    logger.error("Image generation error:", error);
    res.status(500).json({
      error: "Failed to generate images",
      details: error.message,
    });
  }
};

module.exports = {
  generateImagesEndpoint,
};
