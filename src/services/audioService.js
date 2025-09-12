const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");
const wav = require("wav");

// Initialize Google GenAI client
const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Save WAV file helper function
const saveWaveFile = async (
  filename,
  pcmData,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
) => {
  return new Promise((resolve, reject) => {
    const writer = new wav.FileWriter(filename, {
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    writer.on("finish", resolve);
    writer.on("error", reject);

    writer.write(pcmData);
    writer.end();
  });
};

// Generate TTS audio using Gemini API - exact reference implementation
const generateTTSAudio = async (prompt, voice = "en-IN-Wavenet-A") => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is required for TTS generation");
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: "Joe",
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: "Kore" }, // Male voice
                },
              },
              {
                speaker: "Jane",
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: "Puck" }, // Female voice
                },
              },
            ],
          },
          speakingRate: 1.2, // Slightly faster speaking rate for 60-second target
        },
      },
    });

    const data =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!data) {
      throw new Error("No audio data received from Gemini TTS API");
    }

    const audioBuffer = Buffer.from(data, "base64");
    logger.info(
      `✓ Generated multi-speaker TTS audio using Gemini API (${audioBuffer.length} bytes)`
    );

    return audioBuffer;
  } catch (error) {
    logger.error(`TTS generation failed: ${error.message}`);

    // Fallback: Create a simple WAV header for placeholder
    const sampleRate = 22050;
    const duration = Math.max(1, Math.ceil(text.length / 10)); // Estimate duration
    const samples = sampleRate * duration;
    const buffer = Buffer.alloc(44 + samples * 2);

    // WAV header
    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + samples * 2, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write("data", 36);
    buffer.writeUInt32LE(samples * 2, 40);

    // Generate simple tone for placeholder
    for (let i = 0; i < samples; i++) {
      const sample = Math.sin((i * 440 * 2 * Math.PI) / sampleRate) * 16383;
      buffer.writeInt16LE(sample, 44 + i * 2);
    }

    logger.warn("⚠️ Using placeholder audio due to TTS API failure");
    return buffer;
  }
};

// Main audio generation function - Single call for entire conversation
const generateAudioWithBatchingStrategy = async (script) => {
  try {
    logger.info("🎤 Starting multi-speaker TTS audio generation...");

    // Generate audio for the entire conversation in one call
    logger.info(
      "🔄 Generating audio for entire conversation with multi-speaker voices"
    );

    try {
      // Use the actual script content instead of hardcoded prompt
      const customPrompt = `TTS the following conversation between Joe and Jane:
${script}`;

      const audioBuffer = await generateTTSAudio(customPrompt, "multi-speaker");
      const conversationFile = path.resolve(
        `audio/conversation_${Date.now()}.wav`
      );

      await saveWaveFile(conversationFile, audioBuffer);

      logger.info(`✓ Generated complete conversation: ${conversationFile}`);

      return {
        conversationFile: conversationFile,
        segments: [
          {
            file: conversationFile,
            speaker: "multi-speaker",
            text: script,
            duration: Math.ceil(script.length / 18), // Estimate duration for whole conversation with faster speaking rate
          },
        ],
        totalSegments: 1,
        apiCallsUsed: 1,
      };
    } catch (error) {
      logger.error("Failed to generate conversation audio:", error.message);
      throw error;
    }
  } catch (error) {
    logger.error("❌ Audio generation failed:", error.message);
    throw error;
  }
};

module.exports = {
  generateAudioWithBatchingStrategy,
  generateTTSAudio,
};
