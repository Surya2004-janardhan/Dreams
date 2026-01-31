const axios = require("axios");
const fs = require("fs");
const path = require("path");
const ffmpegPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");

ffmpeg.setFfmpegPath(ffmpegPath);

// AssemblyAI API configuration
const API_TOKEN = process.env.ASSEMBLYAI_API_KEY;

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
 * Generate subtitles from audio file using AssemblyAI
 */
const generateSubtitlesFromAudio = async (audioFilePath) => {
  try {
    if (!API_TOKEN) {
      throw new Error("ASSEMBLYAI_API_KEY environment variable is required");
    }

    console.log(`📤 Processing audio file: ${audioFilePath}`);

    // Ensure the file exists
    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found: ${audioFilePath}`);
    }

    // Upload the file
    const uploadUrl = await upload_file(API_TOKEN, audioFilePath);
    if (!uploadUrl) {
      throw new Error("Upload failed");
    }

    // Transcribe the audio
    const transcript = await transcribeAudio(API_TOKEN, uploadUrl);

    // Export subtitles in SRT format
    const subtitles = await exportSubtitles(API_TOKEN, transcript.id, "srt");

    console.log("✅ Subtitles generated successfully");
    return subtitles;
  } catch (error) {
    console.error("❌ Subtitle generation failed:", {
      error: error.message,
      stack: error.stack,
      audioFile: audioFilePath,
      apiResponse: error.response?.data,
      timestamp: new Date().toISOString(),
    });
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
      const audioName = path.basename(
        audioFilePath,
        path.extname(audioFilePath)
      );
      outputPath = path.join("subtitles", `${audioName}.srt`);
    }

    // Save to file
    await saveSubtitlesToFile(subtitlesContent, outputPath);

    return {
      subtitlesPath: outputPath,
      content: subtitlesContent,
    };
  } catch (error) {
    console.error("❌ Subtitle creation failed:", {
      error: error.message,
      stack: error.stack,
      audioFile: audioFilePath,
      outputPath: outputPath,
      timestamp: new Date().toISOString(),
    });
    throw error;
  }
};

const upload_file = async (api_token, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File does not exist for upload: ${filePath}`);
      return null;
    }

    const stats = fs.statSync(filePath);
    console.log(`📤 Uploading file: ${path.basename(filePath)} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    const fileStream = fs.createReadStream(filePath);
    const url = "https://api.assemblyai.com/v2/upload";

    const response = await axios.post(url, fileStream, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Authorization": api_token,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 300000, // 5 minute timeout for upload
    });

    if (response.status === 200) {
      return response.data["upload_url"];
    } else {
      console.error(`❌ Upload failed with status: ${response.status} - ${response.statusText}`);
      return null;
    }
  } catch (error) {
    if (error.response) {
      console.error(`❌ AssemblyAI Upload API Error [${error.response.status}]:`, error.response.data);
    } else if (error.request) {
      console.error(`❌ AssemblyAI Upload Network Error (No response):`, error.message);
      if (error.message.includes('AggregateError')) {
         console.warn("💡 Pro-tip: This usually means a connection issue. Check your internet or if api.assemblyai.com is blocked.");
      }
    } else {
      console.error(`❌ AssemblyAI Upload Setup Error:`, error.message);
    }
    return null;
  }
};

// Async function that sends a request to the AssemblyAI transcription API and retrieves the transcript
const transcribeAudio = async (api_token, audio_url) => {
  const headers = {
    authorization: api_token,
    "content-type": "application/json",
  };

  // Send a POST request to the transcription API with the audio URL in the request body
  const response = await axios.post(
    "https://api.assemblyai.com/v2/transcript",
    {
      audio_url,
      speaker_labels: true,
    },
    { headers }
  );

  // Retrieve the ID of the transcript from the response data
  const transcriptId = response.data.id;

  // Construct the polling endpoint URL using the transcript ID
  const pollingEndpoint = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;

  // Poll the transcription API until the transcript is ready
  while (true) {
    // Send a GET request to the polling endpoint to retrieve the status of the transcript
    const pollingResponse = await axios.get(pollingEndpoint, { headers });

    // Retrieve the transcription result from the response data
    const transcriptionResult = pollingResponse.data;

    // If the transcription is complete, return the transcript object
    if (transcriptionResult.status === "completed") {
      return transcriptionResult;
    }
    // If the transcription has failed, throw an error with the error message
    else if (transcriptionResult.status === "error") {
      throw new Error(`Transcription failed: ${transcriptionResult.error}`);
    }
    // If the transcription is still in progress, wait for a few seconds before polling again
    else {
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
};

// Async function to export subtitles in the specified format
const exportSubtitles = async (api_token, transcriptId, format) => {
  const exportUrl = `https://api.assemblyai.com/v2/transcript/${transcriptId}/${format}`;

  const exportResponse = await axios.get(exportUrl, {
    headers: {
      "Content-Type": "application/octet-stream",
      Authorization: api_token,
    },
  });

  return exportResponse.data;
};

module.exports = {
  generateSubtitlesFromAudio,
  saveSubtitlesToFile,
  createSubtitlesFromAudio,
  getAudioDuration,
  validateSRTFormat,
  upload_file,
  transcribeAudio,
  exportSubtitles,
};
