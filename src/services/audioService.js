const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");
const wav = require("wav");

// Initialize Google GenAI client
const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// Define audio directory
const audioDir = "audio";

// Ensure audio directory exists
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

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

    writer.on("error", reject);

    writer.write(pcmData);
    writer.end();
  });
};

// Generate TTS audio using Gemini API with retry logic
const generateTTSAudio = async (text, voiceName = "Kore") => {
  try {
    logger.info(`🎤 Generating TTS audio for voice: ${voiceName}`);

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-preview-tts",
    });

    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName,
            },
          },
        },
      },
    });

    const audioData = result.candidates[0].content.parts[0].inlineData.data;

    const buffer = Buffer.from(audioData, "base64");
    const fileName = `tts_${Date.now()}_${voiceName}.wav`;
    const filePath = path.join(audioDir, fileName);

    await saveWaveFile(filePath, buffer);

    logger.info(`✓ TTS audio generated: ${filePath}`);
    return filePath;
  } catch (error) {
    logger.error("❌ TTS generation failed:", error.message);
    throw error;
  }
};

// Main audio generation function - Multi-speaker support
const generateAudioWithBatchingStrategy = async (script) => {
  try {
    logger.info("🎭 Generating multi-speaker conversation audio");

    const dialogues = parseScriptDialogues(script);
    const audioSegments = [];

    if (dialogues.length === 0) {
      throw new Error("No dialogues found in script");
    }

    // Use multi-speaker voice config for the entire conversation
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-preview-tts",
    });

    // Prepare the conversation text with speaker labels
    const conversationText = dialogues
      .map((dialogue) => `${dialogue.speaker}: ${dialogue.text}`)
      .join("\n");

    // Custom prompt for natural Indian English speech
    const systemPrompt = `You are generating audio for a natural conversation between Rani (female speaker) and Raj (male speaker) in authentic Indian English. 

Key requirements:
- Rani should sound curious, enthusiastic, and use natural Indian English expressions
- Raj should sound knowledgeable, friendly, and conversational in Indian English
- Use natural speech patterns with appropriate enthusiasm and informativeness
- Maintain distinct voices for each speaker
- Keep the conversation flowing naturally

Conversation script:
${conversationText}`;

    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: systemPrompt }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: "Rani",
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: "Kore" },
                },
              },
              {
                speaker: "Raj",
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: "Puck" },
                },
              },
            ],
          },
        },
      },
    });

    const audioData = result.candidates[0].content.parts[0].inlineData.data;

    const buffer = Buffer.from(audioData, "base64");
    const conversationFile = path.join(
      audioDir,
      `conversation_${Date.now()}.wav`
    );
    await saveWaveFile(conversationFile, buffer);

    // Since we're doing a single API call, create a single segment
    const estimatedDuration = 70; // Based on script design for 70 seconds
    audioSegments.push({
      file: conversationFile,
      duration: estimatedDuration,
      speaker: "Multi-speaker conversation",
    });

    logger.info(`✓ Generated complete conversation: ${conversationFile}`);

    return {
      conversationFile: conversationFile,
      segments: audioSegments,
      totalSegments: 1, // Single API call
      apiCallsUsed: 1,
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
