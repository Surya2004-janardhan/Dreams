const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");
const wav = require("wav");

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

// Generate TTS audio using Gemini API with retry logic
const generateTTSAudio = async (script, speaker = "Raj", maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is required for TTS generation");
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      logger.info(
        `🎤 Generating TTS audio with Gemini (${speaker} voice) - Attempt ${attempt}/${maxRetries}...`
      );

      const prompt = `Convert this dialogue segment to natural Indian English speech with expressive and informative delivery. Speaker: ${speaker}
Text: ${script}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName:
                  speaker === "Raj" ? "en-IN-Standard-C" : "en-IN-Standard-A", // Male and female Indian voices
              },
            },
          },
        },
      });

      const data =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!data) {
        throw new Error("No audio data received from Gemini TTS");
      }

      const audioBuffer = Buffer.from(data, "base64");
      logger.info(
        `✓ Generated TTS audio using Gemini API (${audioBuffer.length} bytes)`
      );

      return audioBuffer;
    } catch (error) {
      logger.warn(`TTS attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        logger.error(`❌ All ${maxRetries} TTS attempts failed`);
        break;
      }

      // Wait before retrying (exponential backoff)
      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      logger.info(`⏳ Waiting ${waitTime}ms before retry...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  // All attempts failed, use fallback
  logger.warn("⚠️ Using placeholder audio due to TTS API failure");

  // Fallback: Create a simple WAV header for placeholder
  const sampleRate = 22050;
  const duration = Math.max(1, Math.ceil(script.length / 10)); // Estimate duration
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

  return buffer;
};

// Main audio generation function - Multi-speaker support
const generateAudioWithBatchingStrategy = async (script) => {
  try {
    logger.info("🎤 Starting multi-speaker TTS audio generation...");

    // Parse script to separate Raj and Rani dialogues
    const dialogues = parseScriptDialogues(script);

    if (dialogues.length === 0) {
      logger.warn("⚠️ No dialogues found, using single voice");
      // Fallback to single voice
      const audioBuffer = await generateTTSAudio(script, "Raj"); // Default to Raj voice for single speaker
      const conversationFile = path.resolve(
        `audio/conversation_${Date.now()}.wav`
      );
      await saveWaveFile(conversationFile, audioBuffer);

      return {
        conversationFile: conversationFile,
        segments: [
          {
            file: conversationFile,
            speaker: "single-speaker",
            text: script,
            duration: Math.ceil(script.length / 16),
          },
        ],
        totalSegments: 1,
        apiCallsUsed: 1,
      };
    }

    // Generate audio for each dialogue segment
    const audioSegments = [];
    let totalDuration = 0;

    for (const dialogue of dialogues) {
      try {
        const voice = dialogue.speaker; // Use speaker name directly for Gemini TTS
        const audioBuffer = await generateTTSAudio(dialogue.text, voice);

        const segmentFile = path.resolve(
          `audio/segment_${dialogue.speaker}_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}.wav`
        );
        await saveWaveFile(segmentFile, audioBuffer);

        audioSegments.push({
          file: segmentFile,
          speaker: dialogue.speaker,
          text: dialogue.text,
          duration: Math.ceil(dialogue.text.length / 16),
          voice: voice,
        });

        totalDuration += Math.ceil(dialogue.text.length / 16);

        // Small delay between segments to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        logger.error(
          `Failed to generate audio for ${dialogue.speaker}:`,
          error.message
        );
        // Continue with other segments
      }
    }

    // Combine all audio segments
    const conversationFile = path.resolve(
      `audio/conversation_${Date.now()}.wav`
    );

    if (audioSegments.length === 1) {
      // Only one segment, just copy it
      fs.copyFileSync(audioSegments[0].file, conversationFile);
    } else {
      // Combine multiple segments
      await combineAudioSegments(audioSegments, conversationFile);
    }

    logger.info(`✓ Generated complete conversation: ${conversationFile}`);

    return {
      conversationFile: conversationFile,
      segments: audioSegments,
      totalSegments: audioSegments.length,
      apiCallsUsed: audioSegments.length,
    };
  } catch (error) {
    logger.error("❌ Audio generation failed:", error.message);
    throw error;
  }
};

// Parse script to extract Raj and Rani dialogues
const parseScriptDialogues = (script) => {
  const dialogues = [];
  const lines = script.split("\n").filter((line) => line.trim());

  for (const line of lines) {
    const rajMatch = line.match(/^Raj:\s*(.+)/i);
    const raniMatch = line.match(/^Rani:\s*(.+)/i);

    if (rajMatch) {
      dialogues.push({
        speaker: "Raj",
        text: rajMatch[1].trim(),
      });
    } else if (raniMatch) {
      dialogues.push({
        speaker: "Rani",
        text: raniMatch[1].trim(),
      });
    }
  }

  logger.info(`📝 Parsed ${dialogues.length} dialogue segments`);
  return dialogues;
};

// Combine multiple audio segments
const combineAudioSegments = async (segments, outputFile) => {
  return new Promise((resolve, reject) => {
    let ffmpegCommand = require("fluent-ffmpeg")();

    segments.forEach((segment) => {
      ffmpegCommand = ffmpegCommand.input(segment.file);
    });

    const inputs = segments.map((_, index) => `[${index}:0]`).join("");
    const filterComplex = `${inputs}concat=n=${segments.length}:v=0:a=1[out]`;

    ffmpegCommand
      .complexFilter(filterComplex)
      .outputOptions(["-map", "[out]"])
      .audioCodec("pcm_s16le")
      .output(outputFile)
      .on("end", () => {
        logger.info(`✓ Audio segments combined: ${outputFile}`);
        resolve(outputFile);
      })
      .on("error", (error) => {
        logger.error("Audio combination error:", error);
        reject(error);
      })
      .run();
  });
};

module.exports = {
  generateAudioWithBatchingStrategy,
  generateTTSAudio,
};
