const { generateScript } = require("../services/scriptService");
const cleanLLMData = require("../utils/textCleaner");
const logger = require("../config/logger");

const generateScriptEndpoint = async (req, res) => {
  try {
    const { topic } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    logger.info(`📝 Generating script for topic: ${topic}`);

    const rawScript = await generateScript(topic);
    const cleanedScript = cleanLLMData.extractConversation(rawScript);

    res.json({
      success: true,
      script: cleanedScript,
      rawScript: rawScript,
    });
  } catch (error) {
    logger.error("Script generation error:", error);
    res.status(500).json({
      error: "Failed to generate script",
      details: error.message,
    });
  }
};

module.exports = {
  generateScriptEndpoint,
};
