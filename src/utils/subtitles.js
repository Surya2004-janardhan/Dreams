const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");

// Initialize Google GenAI client with main API key
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/**
 * Generate subtitles from audio file using Gemini AI
 */
const generateSubtitlesFromAudio = async (audioFilePath) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "GEMINI_API_KEY environment variable is required for subtitle generation"
      );
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    // Convert path to use forward slashes for cross-platform compatibility
    const normalizedPath = audioFilePath.replace(/\\/g, "/");
    console.log(`📤 Processing audio file: ${normalizedPath}`);

    // Ensure the file exists
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found: ${audioFilePath}`);
    }

    // Get file stats to verify it's readable
    const stats = fs.statSync(audioFilePath);
    console.log(`📊 Audio file size: ${stats.size} bytes`);

    // Try alternative upload method with better error handling
    let myfile;
    let uploadAttempts = 0;
    const maxAttempts = 3;

    while (uploadAttempts < maxAttempts) {
      try {
        uploadAttempts++;
        console.log(`📤 Upload attempt ${uploadAttempts}/${maxAttempts}`);

        myfile = await ai.files.upload({
          file: normalizedPath,
          config: {
            mimeType:
              path.extname(audioFilePath).toLowerCase() === ".wav"
                ? "audio/wav"
                : "audio/mpeg",
          },
        });

        console.log(`✅ Audio file uploaded successfully: ${myfile.uri}`);
        break; // Success, exit the loop
      } catch (uploadError) {
        console.error(
          `❌ Upload attempt ${uploadAttempts} failed:`,
          uploadError.message
        );

        if (uploadAttempts >= maxAttempts) {
          throw new Error(
            `File upload failed after ${maxAttempts} attempts: ${uploadError.message}`
          );
        }

        // Wait before retrying
        console.log("⏳ Waiting before retry...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Wait for file processing with longer delay
    console.log("⏳ Waiting for file processing...");
    await new Promise((resolve) => setTimeout(resolve, 8000)); // Increased to 8 seconds

    // Verify file is ready
    try {
      const fileInfo = await ai.files.get(myfile.name);
      if (fileInfo.state !== "ACTIVE") {
        throw new Error(`File is not ready. State: ${fileInfo.state}`);
      }
      console.log("✅ File is ready for processing");
    } catch (verifyError) {
      console.warn("⚠️ Could not verify file state:", verifyError.message);
    }

    // Generate transcription using reference format structure
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              fileData: {
                fileUri: myfile.uri,
                mimeType: myfile.mimeType,
              },
            },
            {
              text: `Transcribe this audio conversation between Raj and Rani with precise timestamps. Format as SRT subtitles with exact timing for each spoken segment. Include natural pauses and conversation flow.

Requirements:
- Raj and Rani are having a natural conversation
- Raj is the knowledgeable male expert
- Rani is the curious female questioner
- Provide timestamps in HH:MM:SS,mmm format
- Each subtitle segment should be 1-3 seconds long
- Include speaker identification (Raj: or Rani:)
- Capture Indian English expressions and natural speech patterns
- Format exactly like this:

1
00:00:00,000 --> 00:00:02,500
Rani: Hey, can you tell me about...

2
00:00:02,500 --> 00:00:05,200
Raj: Yaar, that's actually quite interesting...

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
      await ai.files.delete(myfile.name);
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
