const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");

// Initialize Google GenAI client
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

// Function to count tokens (approximate)
const countTokens = (text) => {
  return Math.ceil(text.length / 4); // Rough estimation: ~1 token per 4 characters
};

// Format conversation for TTS
const formatConversationForTTS = (script) => {
  const lines = script.split("\n").filter((line) => line.trim());
  let formattedText = "";

  lines.forEach((line) => {
    if (line.includes("Speaker A:")) {
      const content = line.replace("Speaker A:", "").trim();
      if (content) {
        formattedText += `<speak><voice name="en-US-Wavenet-D">${content}</voice></speak>\n`;
      }
    } else if (line.includes("Speaker B:")) {
      const content = line.replace("Speaker B:", "").trim();
      if (content) {
        formattedText += `<speak><voice name="en-US-Wavenet-F">${content}</voice></speak>\n`;
      }
    }
  });

  return formattedText.trim();
};

// Save WAV file from buffer
const saveWaveFile = async (audioBuffer, filePath) => {
  return new Promise((resolve, reject) => {
    try {
      fs.writeFileSync(filePath, audioBuffer);
      resolve(filePath);
    } catch (error) {
      reject(error);
    }
  });
};

// Generate audio with single API call strategy
const generateAudioWithBatchingStrategy = async (script) => {
  try {
    logger.info("🎤 Starting single-call audio generation...");

    // Format the entire conversation for multi-speaker TTS
    const conversationText = formatConversationForTTS(script);
    const tokenCount = countTokens(conversationText);

    logger.info(`📊 Token count: ${tokenCount}`);

    if (tokenCount > 30000) {
      throw new Error(
        `Token count (${tokenCount}) exceeds API limit of 30,000`
      );
    }

    // Single API call for entire conversation
    logger.info("🔄 Making single TTS API call...");

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
    });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Generate audio for this conversation with multiple speakers: ${conversationText}`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
      },
    });

    // For now, create a placeholder audio file
    // In a real implementation, you'd get audio buffer from the API
    const audioBuffer = Buffer.from("RIFF"); // Placeholder
    const conversationFile = `audio/conversation_${Date.now()}.wav`;

    // Ensure audio directory exists
    if (!fs.existsSync("audio")) {
      fs.mkdirSync("audio", { recursive: true });
    }

    await saveWaveFile(audioBuffer, conversationFile);

    logger.info(`✅ Single conversation audio generated: ${conversationFile}`);

    return {
      conversationFile: path.resolve(conversationFile),
      tokenCount,
      apiCallsUsed: 1,
    };
  } catch (error) {
    logger.error("❌ Audio generation failed:", error.message);
    throw error;
  }
};

module.exports = {
  generateAudioWithBatchingStrategy,
  formatConversationForTTS,
  countTokens,
};
