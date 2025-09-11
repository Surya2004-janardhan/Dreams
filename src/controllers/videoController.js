const { getBaseVideo } = require("../services/videoService");
const logger = require("../config/logger");

const getBaseVideoEndpoint = async (req, res) => {
  try {
    const baseVideoUrl = await getBaseVideo();
    res.json({
      success: true,
      url: baseVideoUrl,
    });
  } catch (error) {
    logger.error("Get base video error:", error);
    res.status(500).json({
      error: "Failed to get base video",
      details: error.message,
    });
  }
};

module.exports = {
  getBaseVideoEndpoint,
};
