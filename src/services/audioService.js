const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");
const wav = require("wav");

// Initialize Google GenAI client
const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

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

// Generate TTS audio using new Gemini API
const generateTTSAudio = async (text, voice = "en-IN-Wavenet-A") => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is required for TTS generation");
    }

    // Determine speaker based on voice parameter
    const isFemale = voice.includes("A") || voice.toLowerCase().includes("female");
    const speakerName = isFemale ? "Jane" : "Joe";
    const voiceName = isFemale ? "Puck" : "Kore"; // Gemini voice names

    const prompt = `Generate natural-sounding speech for the following text in Indian English accent: "${text}"

Instructions:
- Use clear, natural Indian English pronunciation
- Maintain conversational tone and moderate pace
- Include natural pauses and intonation
- Ensure proper pronunciation of technical terms
- Voice should sound engaging and educational
- Keep the delivery friendly and informative`;

    const response = await genAI.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName,
            },
          },
        },
      }
    });

    const data = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!data) {
      throw new Error("No audio data received from Gemini TTS API");
    }

    const audioBuffer = Buffer.from(data, "base64");
    logger.info(`✓ Generated TTS audio using Gemini API (${audioBuffer.length} bytes)`);

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

        await saveWaveFile(segmentFile, audioBuffer);
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
