const fs = require("fs");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

/**
 * Generate subtitles from audio file using Gemini AI
 */
const generateSubtitlesFromAudio = async (audioFilePath) => {
  try {
    if (!process.env.GEMINI_API_KEY_FOR_AUDIO) {
      throw new Error(
        "GEMINI_API_KEY environment variable is required for subtitle generation"
      );
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY_FOR_AUDIO,
    });

    // Upload audio file to Gemini
    const uploadedFile = await ai.files.upload({
      file: audioFilePath,
      config: {
        mimeType:
          path.extname(audioFilePath).toLowerCase() === ".wav"
            ? "audio/wav"
            : "audio/mpeg",
      },
    });

    console.log(`✅ Audio file uploaded to Gemini: ${uploadedFile.uri}`);

    // Generate transcription with timestamps
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                fileUri: uploadedFile.uri,
                mimeType: uploadedFile.mimeType,
              },
            },
            {
              text: `Transcribe this audio conversation between Jane and Joe with precise timestamps. Format as SRT subtitles with exact timing for each spoken segment. Include natural pauses and conversation flow.

Requirements:
- Jane and Joe are having a natural conversation
- Provide timestamps in HH:MM:SS,mmm format
- Each subtitle segment should be 1-3 seconds long
- Include speaker identification (Jane: or Joe:)
- Capture Indian English expressions and natural speech patterns
- Format exactly like this:

1
00:00:00,000 --> 00:00:02,500
Jane: Hey, can you tell me about...

2
00:00:02,500 --> 00:00:05,200
Joe: Yaar, that's actually quite interesting...

Make sure timestamps are accurate and segments are appropriately timed for reading.`,
            },
          ],
        },
      ],
    });

    const transcription = response.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!transcription) {
      throw new Error("No transcription received from Gemini");
    }

    console.log("✅ Audio transcription completed");

    // Clean up uploaded file
    try {
      await ai.files.delete(uploadedFile.name);
      console.log("🗑️ Uploaded file cleaned up");
    } catch (cleanupError) {
      console.warn("⚠️ Failed to cleanup uploaded file:", cleanupError.message);
    }

    return transcription;
  } catch (error) {
    console.error("❌ Subtitle generation failed:", error.message);
    throw new Error(`Failed to generate subtitles: ${error.message}`);
  }
};

/**
 * Save subtitles to SRT file
 */
const saveSubtitlesToFile = async (subtitlesContent, outputPath) => {
  try {
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, subtitlesContent, "utf8");
    console.log(`✅ Subtitles saved to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error("❌ Failed to save subtitles:", error.message);
    throw error;
  }
};

/**
 * Generate and save subtitles from audio file
 */
const createSubtitlesFromAudio = async (audioFilePath, outputPath = null) => {
  try {
    // Generate subtitles content
    const subtitlesContent = await generateSubtitlesFromAudio(audioFilePath);

    // Determine output path if not provided
    if (!outputPath) {
      const audioDir = path.dirname(audioFilePath);
      const audioName = path.basename(
        audioFilePath,
        path.extname(audioFilePath)
      );
      outputPath = path.join(audioDir, `${audioName}.srt`);
    }

    // Save to file
    await saveSubtitlesToFile(subtitlesContent, outputPath);

    return {
      subtitlesPath: outputPath,
      content: subtitlesContent,
    };
  } catch (error) {
    console.error("❌ Subtitle creation failed:", error.message);
    throw error;
  }
};

module.exports = {
  generateSubtitlesFromAudio,
  saveSubtitlesToFile,
  createSubtitlesFromAudio,
};
