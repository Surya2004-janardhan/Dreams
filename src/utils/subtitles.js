const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");
const ffmpegPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");

ffmpeg.setFfmpegPath(ffmpegPath);

// Initialize Google GenAI client with main API key
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY_FOR_AUDIO || process.env.GEMINI_API_KEY,
});

/**
 * Get audio duration using ffmpeg
 */
const getAudioDuration = (audioPath) => {
  return new Promise((resolve, reject) => {
    // Set ffmpeg path explicitly
    const ffmpegPath = require("ffmpeg-static");
    ffmpeg.setFfmpegPath(ffmpegPath);

    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        console.error("❌ FFprobe error:", err.message);
        reject(new Error(`Could not get audio duration: ${err.message}`));
      } else {
        if (!metadata || !metadata.format || !metadata.format.duration) {
          reject(new Error("Invalid audio file or no duration information"));
        } else {
          const duration = metadata.format.duration;
          resolve(duration);
        }
      }
    });
  });
};

/**
 * Validate SRT subtitle format
 */
const validateSRTFormat = (srtContent) => {
  const errors = [];
  const lines = srtContent.split("\n");

  // Check for basic SRT structure
  let hasSequenceNumbers = false;
  let hasTimestamps = false;
  let hasText = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for sequence numbers (should be numeric)
    if (/^\d+$/.test(line)) {
      hasSequenceNumbers = true;
    }

    // Check for timestamps (HH:MM:SS,mmm --> HH:MM:SS,mmm)
    if (
      /^\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}$/.test(line)
    ) {
      hasTimestamps = true;
    }

    // Check for text content
    if (
      line.length > 0 &&
      !/^\d+$/.test(line) &&
      !line.includes("-->") &&
      !line.includes(":")
    ) {
      hasText = true;
    }
  }

  if (!hasSequenceNumbers) errors.push("Missing sequence numbers");
  if (!hasTimestamps) errors.push("Missing timestamp format");
  if (!hasText) errors.push("Missing subtitle text");

  return {
    isValid: errors.length === 0,
    errors: errors,
  };
};

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
      apiKey:
        process.env.GEMINI_API_KEY_FOR_AUDIO || process.env.GEMINI_API_KEY,
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

    // Validate audio file before processing
    try {
      const audioBuffer = fs.readFileSync(audioFilePath);
      if (audioBuffer.length < 100) {
        throw new Error("Audio file is too small or corrupted");
      }
      console.log("✅ Audio file validation passed");
    } catch (validationError) {
      throw new Error(
        `Audio file validation failed: ${validationError.message}`
      );
    }

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
                : path.extname(audioFilePath).toLowerCase() === ".mp3"
                ? "audio/mpeg"
                : "audio/raw",
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

    // Get audio duration for accurate timing
    let audioDuration = 70; // Default fallback
    try {
      audioDuration = await getAudioDuration(audioFilePath);
      console.log(
        `📊 Audio duration detected: ${audioDuration.toFixed(2)} seconds`
      );
    } catch (durationError) {
      console.warn(
        "⚠️ Could not detect audio duration, using default:",
        durationError.message
      );
    }

    // Generate transcription with retry logic for API overload
    let transcription = null;
    const maxRetries = 5;
    const retryDelay = 10000; // 10 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🎯 Transcription attempt ${attempt}/${maxRetries}`);

        const response = await ai.models.generateContent({
          model: "gemini-1.5-flash", // Try a more stable model
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
                  text: `Transcribe this audio conversation between Raj and Rani with PRECISE timestamps that match the actual audio duration and pacing. Format as SRT subtitles with exact timing for each spoken segment.

CRITICAL REQUIREMENTS:
- Audio duration detected: ${audioDuration.toFixed(2)} seconds
- This is an educational conversation between Raj (male expert) and Rani (female questioner)
- Analyze the ENTIRE audio file and distribute timestamps proportionally across ${audioDuration.toFixed(
                    2
                  )} seconds
- Start from 00:00:00,000 and end at ${Math.floor(audioDuration / 60)
                    .toString()
                    .padStart(2, "0")}:${(audioDuration % 60)
                    .toFixed(3)
                    .replace(".", ",")
                    .padEnd(6, "0")}
- Speaker identification: "Raj:" or "Rani:" at the start of each line
- Capture authentic Indian English expressions and natural speech patterns
- Ensure timestamps NEVER overlap and cover the entire ${audioDuration.toFixed(
                    2
                  )} second duration

FORMAT EXAMPLE:
1
00:00:00,000 --> 00:00:03,500
Rani: Hey Raj, can you tell me about this topic...

2
00:00:03,500 --> 00:00:08,200
Raj: Yaar, that's actually quite interesting. See, basically...

3
00:00:08,200 --> 00:00:12,800
Rani: Oh really? But how does it work exactly...

IMPORTANT:
- Distribute timestamps evenly across the entire ${audioDuration.toFixed(
                    2
                  )} second audio
- Make sure the last timestamp reaches the end of the audio
- Focus on technical terms and key educational concepts`,
                },
              ],
            },
          ],
        });

        transcription = response.candidates?.[0]?.content?.parts?.[0]?.text;

        if (transcription) {
          console.log(`✅ Audio transcription completed on attempt ${attempt}`);
          break; // Success, exit retry loop
        } else {
          // Log the full response for debugging
          console.error(
            `❌ Attempt ${attempt} - No transcription received. Full response:`,
            JSON.stringify(response, null, 2)
          );
          throw new Error("No transcription received from Gemini");
        }
      } catch (transcriptionError) {
        console.error(
          `❌ Transcription attempt ${attempt} failed:`,
          transcriptionError.message
        );

        // Check if it's a 503/unavailable error that we should retry
        if (
          transcriptionError.message.includes("503") ||
          transcriptionError.message.includes("UNAVAILABLE") ||
          transcriptionError.message.includes("overloaded")
        ) {
          if (attempt < maxRetries) {
            // Exponential backoff for overloaded API (start at 10s, double each time)
            const backoffDelay = retryDelay * Math.pow(2, attempt - 1);
            console.log(
              `⏳ API overloaded (attempt ${attempt}/${maxRetries}), waiting ${
                backoffDelay / 1000
              }s before retry...`
            );
            console.log(
              `🔄 Using API key: ${
                process.env.GEMINI_API_KEY_FOR_AUDIO ? "AUDIO_KEY" : "MAIN_KEY"
              }`
            );
            await new Promise((resolve) => setTimeout(resolve, backoffDelay));
            continue; // Retry
          } else {
            console.log(
              `❌ All ${maxRetries} attempts failed due to API overload`
            );
            console.log(
              `💡 Suggestion: Try again later or use a different API key`
            );
          }
        }

        // For other errors or if we've exhausted retries, throw the error
        throw transcriptionError;
      }
    }

    if (!transcription) {
      throw new Error("Failed to generate transcription after all retries");
    }

    // Validate SRT format
    const srtValidation = validateSRTFormat(transcription);
    if (!srtValidation.isValid) {
      console.warn(
        "⚠️ Generated subtitles may have format issues:",
        srtValidation.errors
      );
      console.log("📄 Raw transcription:", transcription.substring(0, 500));
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
  getAudioDuration,
  validateSRTFormat,
};
