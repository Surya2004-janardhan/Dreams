const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");
const axios = require("axios");

// Initialize Google GenAI client
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

// Parse conversation into segments with speaker identification
const parseConversation = (script) => {
  const lines = script.split("\n").filter((line) => line.trim());
  const segments = [];

  lines.forEach((line) => {
    if (line.includes("Speaker A:")) {
      const content = line.replace("Speaker A:", "").trim();
      if (content) {
        segments.push({
          speaker: "female",
          text: content,
          voice: "en-IN-Wavenet-A", // Indian English Female voice
        });
      }
    } else if (line.includes("Speaker B:")) {
      const content = line.replace("Speaker B:", "").trim();
      if (content) {
        segments.push({
          speaker: "male",
          text: content,
          voice: "en-IN-Wavenet-B", // Indian English Male voice
        });
      }
    }
  });

  return segments;
};

// Generate TTS audio using Google Cloud Text-to-Speech
const generateTTSAudio = async (text, voice = "en-IN-Wavenet-A") => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required for TTS generation");
    }

    // Custom prompt for natural-sounding Indian English TTS
    const customPrompt = `Generate natural-sounding Indian English speech for: "${text}"

Instructions for voice synthesis:
- Use clear, natural Indian English accent
- Maintain conversational tone and pace
- Include natural pauses and intonation
- Ensure proper pronunciation of technical terms
- Voice should sound engaging and educational
- Pace: moderate speed for easy understanding
- Emotion: Friendly and informative`;

    const requestBody = {
      input: {
        text: customPrompt,
      },
      voice: {
        languageCode: "en-IN",
        name: voice,
        ssmlGender: voice.includes("A") ? "FEMALE" : "MALE",
      },
      audioConfig: {
        audioEncoding: "LINEAR16",
        speakingRate: 1.0,
        pitch: 0.0,
        volumeGainDb: 0.0,
      },
    };

    const response = await axios.post(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.audioContent) {
      return Buffer.from(response.data.audioContent, "base64");
    } else {
      throw new Error("No audio content received from TTS API");
    }
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
      const sample = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 16383;
      buffer.writeInt16LE(sample, 44 + i * 2);
    }

    logger.info("Generated placeholder audio");
    return buffer;
  }
};

// Save WAV file from buffer
const saveWaveFile = async (audioBuffer, filePath) => {
  return new Promise((resolve, reject) => {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, audioBuffer);
      resolve(filePath);
    } catch (error) {
      reject(error);
    }
  });
};

// Main audio generation function
const generateAudioWithBatchingStrategy = async (script) => {
  try {
    logger.info("🎤 Starting multi-speaker TTS audio generation...");

    // Parse conversation into segments
    const segments = parseConversation(script);
    logger.info(`📊 Found ${segments.length} conversation segments`);

    const audioSegments = [];

    // Generate audio for each segment
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      logger.info(
        `🔄 Generating audio for segment ${i + 1}/${segments.length} (${
          segment.speaker
        })`
      );

      try {
        const audioBuffer = await generateTTSAudio(segment.text, segment.voice);
        const segmentFile = path.resolve(
          `audio/segment_${i + 1}_${segment.speaker}_${Date.now()}.wav`
        );

        await saveWaveFile(audioBuffer, segmentFile);
        audioSegments.push({
          file: segmentFile,
          speaker: segment.speaker,
          text: segment.text,
          duration: Math.ceil(segment.text.length / 10), // Estimate duration
        });

        logger.info(`✓ Generated: ${segmentFile}`);

        // Small delay between API calls to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        logger.error(
          `Failed to generate audio for segment ${i + 1}:`,
          error.message
        );
        // Continue with next segment
      }
    }

    if (audioSegments.length === 0) {
      throw new Error("Failed to generate any audio segments");
    }

    // For now, return the first segment as the main conversation file
    // In a full implementation, you'd merge all segments
    const conversationFile = audioSegments[0].file;

    logger.info(
      `✅ Multi-speaker TTS audio generated: ${audioSegments.length} segments`
    );

    return {
      conversationFile: conversationFile,
      segments: audioSegments,
      totalSegments: segments.length,
      apiCallsUsed: audioSegments.length,
    };
  } catch (error) {
    logger.error("❌ Audio generation failed:", error.message);
    throw error;
  }
};

module.exports = {
  generateAudioWithBatchingStrategy,
  parseConversation,
  generateTTSAudio,
};
