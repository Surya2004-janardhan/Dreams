const {
  generateAudioWithBatchingStrategy,
} = require("../services/audioService");
const logger = require("../config/logger");

const generateAudioEndpoint = async (req, res) => {
  try {
    const { script } = req.body;

    if (!script) {
      return res.status(400).json({ error: "Script is required" });
    }

    logger.info("🎤 Generating audio from script");

    const audioResult = await generateAudioWithBatchingStrategy(script);

    res.json({
      success: true,
      audio: audioResult,
    });
  } catch (error) {
    logger.error("Audio generation error:", error);
    res.status(500).json({
      error: "Failed to generate audio",
      details: error.message,
    });
  }
};

module.exports = {
  generateAudioEndpoint,
};
