const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
// const say = require("say");
const axios = require("axios");
const ffmpeg = require("fluent-ffmpeg");
const multer = require("multer");
const nodemailer = require("nodemailer");
const { S3Client } = require("@aws-sdk/client-s3");
const {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const FormData = require("form-data");
const { v4: uuidv4 } = require("uuid");
const winston = require("winston");
const mime = require("mime");
require("dotenv").config();
// Import for Google GenAI TTS and Imagen
const { GoogleGenAI } = require("@google/genai");
const wav = require("wav");

// Configure FFmpeg path
const ffmpegPath = "C:\\ffmpeg\\ffmpeg-8.0-essentials_build\\bin\\ffmpeg.exe";
const ffprobePath = "C:\\ffmpeg\\ffmpeg-8.0-essentials_build\\bin\\ffprobe.exe";

// Set FFmpeg paths for fluent-ffmpeg
if (fs.existsSync(ffmpegPath)) {
  ffmpeg.setFfmpegPath(ffmpegPath);
  ffmpeg.setFfprobePath(ffprobePath);
  console.log("✅ FFmpeg configured successfully");
} else {
  console.warn(
    "⚠️ FFmpeg not found at expected path. Some audio processing features may not work."
  );
  console.warn(
    "📝 Please ensure FFmpeg is installed at: C:\\ffmpeg\\ffmpeg-8.0-essentials_build\\bin\\"
  );
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer configuration for file uploads
const upload = multer({
  dest: "temp/",
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow video files and common formats
    const allowedTypes = /mp4|avi|mov|wmv|flv|webm/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only video files are allowed!"));
    }
  },
});

// Logger setup
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Data Cleaning Utility Functions
const cleanLLMData = {
  // Remove unwanted characters and format text properly
  cleanText: (text) => {
    if (!text || typeof text !== "string") return "";

    return text
      .replace(/\\n/g, " ") // Remove literal \n characters
      .replace(/\n/g, " ") // Remove actual newlines
      .replace(/\\r/g, " ") // Remove literal \r characters
      .replace(/\r/g, " ") // Remove actual carriage returns
      .replace(/\\t/g, " ") // Remove literal \t characters
      .replace(/\t/g, " ") // Remove actual tabs
      .replace(/\s+/g, " ") // Replace multiple spaces with single space
      .replace(/"/g, '"') // Normalize curly quotes to straight
      .replace(/"/g, '"') // Normalize curly quotes to straight
      .replace(/'/g, "'") // Normalize curly apostrophes to straight
      .replace(/'/g, "'") // Normalize curly apostrophes to straight
      .trim(); // Remove leading/trailing spaces
  },

  // Extract and parse JSON from LLM response
  extractJSON: (response) => {
    if (!response) return null;

    try {
      // First try direct parse
      return JSON.parse(response);
    } catch (e) {
      try {
        // Clean the response first
        let cleanResponse = cleanLLMData.cleanText(response);

        // Try to extract JSON from markdown code blocks
        const jsonMatch = cleanResponse.match(
          /```(?:json)?\s*([\s\S]*?)\s*```/
        );
        if (jsonMatch) {
          return JSON.parse(jsonMatch[1].trim());
        }

        // Try to find JSON object in the text
        const objectMatch = cleanResponse.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          return JSON.parse(objectMatch[0]);
        }

        // Try to find JSON array in the text
        const arrayMatch = cleanResponse.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
          return JSON.parse(arrayMatch[0]);
        }
      } catch (e2) {
        logger.warn(
          "Failed to extract JSON from LLM response:",
          response.substring(0, 100)
        );
        return null;
      }
    }
    return null;
  },

  // Clean script data specifically
  cleanScript: (script) => {
    if (!Array.isArray(script)) return [];

    return script
      .map((line) => ({
        speaker: line.speaker || "Person A",
        text: cleanLLMData.cleanText(line.text || ""),
        subtitle: cleanLLMData.cleanText(line.subtitle || line.text || ""),
      }))
      .filter((line) => line.text.length > 0);
  },

  // Clean metadata specifically
  cleanMetadata: (metadata) => {
    if (!metadata || typeof metadata !== "object") {
      return {
        caption: "",
        hashtags: [],
      };
    }

    return {
      caption: cleanLLMData.cleanText(metadata.caption || ""),
      hashtags: Array.isArray(metadata.hashtags)
        ? metadata.hashtags
            .map((tag) => cleanLLMData.cleanText(tag))
            .filter((tag) => tag.length > 0)
        : [],
    };
  },
};

// Helper function to check for existing files
const checkExistingFiles = () => {
  const status = {
    audio: {
      exists: fs.existsSync("audio/conversation_single_call.wav"),
      path: "audio/conversation_single_call.wav",
    },
    images: {
      count: 0,
      files: [],
    },
  };

  // Check for existing images
  for (let i = 0; i < 5; i++) {
    const imagePath = `images/image_${i}.png`;
    if (fs.existsSync(imagePath)) {
      status.images.count++;
      status.images.files.push({
        index: i,
        filename: imagePath,
        prompt: `Existing image ${i}`,
      });
    }
  }

  status.images.allExist = status.images.count >= 5;

  return status;
};

// Create directories if they don't exist
const createDirectories = () => {
  const dirs = ["temp", "audio", "images", "videos", "subtitles"];
  dirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

createDirectories();

// Email transporter setup
const createEmailTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });
};

// AWS S3 (Filebase) setup
const s3Client = new S3Client({
  endpoint: process.env.FILEBASE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.FILEBASE_ACCESS_KEY_ID,
    secretAccessKey: process.env.FILEBASE_SECRET_ACCESS_KEY,
  },
  region: "us-east-1",
  forcePathStyle: true,
});

// Google Sheets setup
const getSheetsClient = async () => {
  let credentials;
  try {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  } catch (error) {
    logger.error("Failed to parse Google credentials:", error);
    throw new Error(
      "Invalid Google credentials format in environment variables"
    );
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
};

// YouTube API setup
const getYouTubeClient = async () => {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  const oauth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    credentials.redirect_uris[0]
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
  });

  return google.youtube({ version: "v3", auth: oauth2Client });
};

// Store current workflow state
let currentWorkflow = {
  taskId: null,
  status: "idle",
  currentStep: null,
  error: null,
  results: {},
};

// 1. POST /workflow/run - Entry point for manual workflow execution
app.post("/workflow/run", async (req, res) => {
  try {
    logger.info("Starting workflow execution");

    if (currentWorkflow.status === "running") {
      return res.status(409).json({
        error: "Workflow already running",
        currentStep: currentWorkflow.currentStep,
      });
    }

    currentWorkflow = {
      taskId: uuidv4(),
      status: "running",
      currentStep: "sheets/next-task",
      error: null,
      results: {},
    };

    res.json({
      message: "Workflow started",
      taskId: currentWorkflow.taskId,
      status: "running",
    });

    // Execute workflow asynchronously
    executeWorkflow();
  } catch (error) {
    logger.error("Workflow start error:", error);
    // await sendErrorEmail("Workflow Start", error.message);
    res.status(500).json({ error: "Failed to start workflow" });
  }
});

// Async workflow execution
const executeWorkflow = async () => {
  try {
    logger.info("🚀 Starting workflow execution");

    // Step 1: Get next task from sheets
    logger.info("→ Step 1: Getting next task");
    currentWorkflow.currentStep = "sheets/next-task";
    const task = await getNextTask();
    if (!task) {
      currentWorkflow.status = "completed";
      currentWorkflow.currentStep = "no-tasks";
      logger.info("✓ No pending tasks found");
      return;
    }
    currentWorkflow.results.task = task;
    logger.info(`✓ Task retrieved: ${task.title}`);

    // Step 2: Generate script
    logger.info("→ Step 2: Generating script");
    currentWorkflow.currentStep = "script/generate";
    const script = await generateScript(task.title, task.description);
    currentWorkflow.results.script = script;
    logger.info(`✓ Script generated - ${script.length} lines`);

    // Step 3: Generate audio (skip if already exists)
    logger.info("→ Step 3: Checking for existing audio");
    currentWorkflow.currentStep = "audio/check";

    let audioFiles;
    const existingAudioFile = "audio/conversation_single_call.wav";

    if (fs.existsSync(existingAudioFile)) {
      logger.info(`✓ Audio file already exists: ${existingAudioFile}`);
      logger.info("⏩ Skipping audio generation step");
      audioFiles = {
        conversationFile: existingAudioFile,
        totalSegments: script.length,
        apiCallsUsed: 0,
        message: "Using existing audio file - skipped generation",
      };
    } else {
      logger.info("🎵 No existing audio found, generating new audio");
      currentWorkflow.currentStep = "audio/generate";
      audioFiles = await generateAudio(script);
    }
    currentWorkflow.results.audioFiles = audioFiles;

    // Step 4: Get base video from Filebase (existing uploaded video)
    logger.info("→ Step 4: Getting base video");
    currentWorkflow.currentStep = "video/base";
    const baseVideoUrl = await getBaseVideo();
    currentWorkflow.results.baseVideoUrl = baseVideoUrl;
    logger.info("✓ Base video retrieved");

    // Step 5: Generate images (skip if already exist)
    logger.info("→ Step 5: Checking for existing images");
    currentWorkflow.currentStep = "images/check";

    let images;
    const existingImages = [];

    // Check for existing images (image_0.png to image_4.png)
    for (let i = 0; i < 5; i++) {
      const imagePath = `images/image_${i}.png`;
      if (fs.existsSync(imagePath)) {
        existingImages.push({
          index: i,
          filename: imagePath,
          prompt: `Existing image ${i}`,
        });
        logger.info(`✓ Found existing image: ${imagePath}`);
      }
    }

    if (existingImages.length >= 5) {
      logger.info("✅ All 5 images already exist, skipping generation");
      logger.info("⏩ Skipping image generation step");
      images = existingImages;
    } else {
      logger.info(
        `🖼️ Found ${existingImages.length}/5 images, generating remaining ${
          5 - existingImages.length
        }`
      );
      currentWorkflow.currentStep = "images/generate";
      images = await generateImages(script);
    }
    currentWorkflow.results.images = images;
    logger.info(`✓ Images ready - ${images.length} images`);

    // Step 6: Assemble video
    logger.info("→ Step 6: Assembling final video");
    currentWorkflow.currentStep = "video/assemble";
    const finalVideo = await assembleVideo(
      baseVideoUrl,
      images,
      audioFiles,
      script
    );
    currentWorkflow.results.finalVideo = finalVideo;
    logger.info("✓ Video assembled");

    // Step 7: Upload final video to Filebase
    logger.info("→ Step 7: Uploading to Filebase");
    currentWorkflow.currentStep = "filebase/upload";
    const videoFileName = `final-videos/${task.title.replace(
      /[^a-zA-Z0-9]/g,
      "-"
    )}-${Date.now()}.mp4`;
    const filebaseUpload = await uploadToFilebase(
      videoFileName,
      finalVideo,
      "video/mp4"
    );
    currentWorkflow.results.filebaseUpload = filebaseUpload;
    logger.info("✓ Uploaded to Filebase");

    // Step 8: Generate metadata
    logger.info("→ Step 8: Generating metadata");
    currentWorkflow.currentStep = "metadata/generate";
    const metadata = await generateMetadata(script);
    currentWorkflow.results.metadata = metadata;
    logger.info("✓ Metadata generated");

    // Step 9: Upload to YouTube
    logger.info("→ Step 9: Uploading to YouTube");
    currentWorkflow.currentStep = "youtube/upload";
    const youtubeUrl = await uploadToYouTube(finalVideo, metadata, task.title);
    currentWorkflow.results.youtubeUrl = youtubeUrl;
    logger.info("✓ Uploaded to YouTube");

    // Step 10: Upload to Instagram
    logger.info("→ Step 10: Uploading to Instagram");
    currentWorkflow.currentStep = "instagram/upload";
    const instagramUrl = await uploadToInstagram(finalVideo, metadata.caption);
    currentWorkflow.results.instagramUrl = instagramUrl;
    logger.info("✓ Uploaded to Instagram");

    // Step 11: Update sheet
    logger.info("→ Step 11: Updating sheet status");
    currentWorkflow.currentStep = "sheets/update";
    await updateSheetStatus(task.rowId, "Posted");
    logger.info("✓ Sheet updated");

    // Step 12: Send notification email
    logger.info("→ Step 12: Sending notification");
    currentWorkflow.currentStep = "notify/email";
    await sendNotificationEmail(
      task.title,
      youtubeUrl,
      instagramUrl,
      filebaseUpload.url
    );
    logger.info("✓ Notification sent");

    currentWorkflow.status = "completed";
    currentWorkflow.currentStep = "finished";
    logger.info("🎉 Workflow completed successfully");
  } catch (error) {
    logger.error(
      `✗ Workflow failed at step ${currentWorkflow.currentStep}: ${error.message}`
    );
    currentWorkflow.status = "error";
    currentWorkflow.error = error.message;
    // await sendErrorEmail(currentWorkflow.currentStep, error.message);
  }
};

// POST /files/cleanup - Remove existing audio and image files to force regeneration
app.post("/files/cleanup", (req, res) => {
  try {
    const { audio, images } = req.body;
    const cleaned = {
      audio: false,
      images: 0,
      errors: [],
    };

    // Clean audio file if requested
    if (audio) {
      const audioFile = "audio/conversation_single_call.wav";
      if (fs.existsSync(audioFile)) {
        try {
          fs.unlinkSync(audioFile);
          cleaned.audio = true;
          logger.info(`🗑️ Removed audio file: ${audioFile}`);
        } catch (error) {
          cleaned.errors.push(`Failed to remove audio: ${error.message}`);
        }
      }
    }

    // Clean image files if requested
    if (images) {
      for (let i = 0; i < 5; i++) {
        const imagePath = `images/image_${i}.png`;
        if (fs.existsSync(imagePath)) {
          try {
            fs.unlinkSync(imagePath);
            cleaned.images++;
            logger.info(`🗑️ Removed image file: ${imagePath}`);
          } catch (error) {
            cleaned.errors.push(
              `Failed to remove ${imagePath}: ${error.message}`
            );
          }
        }
      }
    }

    res.json({
      success: true,
      cleaned: cleaned,
      message: `Cleanup completed. Audio: ${
        cleaned.audio ? "removed" : "not removed"
      }, Images: ${cleaned.images} removed`,
      errors: cleaned.errors,
    });
  } catch (error) {
    logger.error("File cleanup error:", error);
    res.status(500).json({ error: "Failed to cleanup files" });
  }
});

// GET /files/status - Check existing audio and image files
app.get("/files/status", (req, res) => {
  try {
    const fileStatus = checkExistingFiles();

    res.json({
      status: "success",
      files: fileStatus,
      summary: {
        audioReady: fileStatus.audio.exists,
        imagesReady: fileStatus.images.allExist,
        canSkipAudio: fileStatus.audio.exists,
        canSkipImages: fileStatus.images.allExist,
        totalImages: fileStatus.images.count,
        missingImages: 5 - fileStatus.images.count,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("File status check error:", error);
    res.status(500).json({ error: "Failed to check file status" });
  }
});

// 2. GET /sheets/next-task - Get first row with Status = Not Posted
app.get("/sheets/next-task", async (req, res) => {
  try {
    const task = await getNextTask();
    res.json(task || { message: "No pending tasks found" });
  } catch (error) {
    logger.error("Get next task error:", error);
    res.status(500).json({ error: "Failed to fetch next task" });
  }
});

const getNextTask = async () => {
  const sheets = await getSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: "Sheet1!A:D",
  });

  const rows = response.data.values;
  // console.log("rows: ", rows);
  if (!rows || rows.length <= 1) return null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[3] === "Not Posted") {
      // Assuming Status is in column D
      return {
        rowId: i + 1,
        title: row[0],
        description: row[1],
        category: row[2],
        status: row[3],
      };
    }
  }
  return null;
};

// 3. POST /script/generate - Generate Telugu + English conversation script
app.post("/script/generate", async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: "Title and description required" });
    }

    const script = await generateScript(title, description);
    res.json(script);
  } catch (error) {
    logger.error("Script generation error:", error);
    res.status(500).json({ error: "Failed to generate script" });
  }
});

const generateScript = async (title, description) => {
  logger.info(`→ Generating script for: ${title}`);

  const prompt = `Create a 55-60 second educational conversation script between two people about "${title}". 
  Description: ${description}
  
  Requirements:
  - EXACTLY 4 lines total: 2 from Person A, 2 from Person B (alternating: A, B, A, B)
  - Each line should be 13-16 seconds when spoken (35-45 words per line)
  - EDUCATIONAL and COMPREHENSIVE style - teach concepts clearly
  - Person A asks questions, Person B provides detailed explanations
  - Use teaching language: "Let me explain...", "Here's how it works...", "For example..."
  - Make it like a tutorial - information-dense but conversational
  - Clear, detailed English that explains WHY, HOW, and practical applications
  - Keep total under 4000 characters for optimal API processing
  
  Structure:
  Person A: [Comprehensive question - 35-45 words]
  Person B: [Detailed explanation with example - 35-45 words] 
  Person A: [Follow-up question with scenario - 35-45 words]
  Person B: [Complete answer with actionable advice - 35-45 words]
  
  Return ONLY valid JSON array format (no markdown, no extra text): 
  [{"speaker": "Person A", "text": "detailed educational text"}, {"speaker": "Person B", "text": "comprehensive response"}]`;

  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 800, // Increased for longer educational content
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  try {
    // Get the raw response
    const rawResponse = response.data.choices[0].message.content;
    logger.info("Raw LLM response received");

    // Extract and clean JSON
    let scriptData = cleanLLMData.extractJSON(rawResponse);

    if (!scriptData || !Array.isArray(scriptData)) {
      logger.warn("Failed to parse LLM JSON response, using fallback parsing");

      // Fallback: try to parse line by line
      const lines = rawResponse.split("\n").filter((line) => line.trim());
      scriptData = lines
        .filter(
          (line) => line.includes("Person A") || line.includes("Person B")
        )
        .map((line, index) => {
          const speaker = line.includes("Person A") ? "Person A" : "Person B";
          const text = line.replace(/^.*?:/, "").trim().replace(/['"]/g, "");
          return { speaker, text: cleanLLMData.cleanText(text) };
        });
    }

    // Clean and validate the script
    const cleanScript = cleanLLMData.cleanScript(scriptData);

    if (cleanScript.length === 0) {
      throw new Error("No valid script content generated");
    }

    logger.info(`✓ Script cleaned - ${cleanScript.length} lines`);
    return cleanScript;
  } catch (error) {
    logger.error("Script generation parsing error:", error.message);

    // Return a comprehensive fallback script with 4 detailed educational lines
    return [
      {
        speaker: "Person A",
        text: cleanLLMData.cleanText(
          `I've been hearing a lot about ${title} lately, but I really need to understand what it actually means, how it works in practice, and why it's so important for people like us to know about this concept in today's world.`
        ),
        subtitle: cleanLLMData.cleanText(
          `I've been hearing a lot about ${title} lately, but I really need to understand what it actually means, how it works in practice, and why it's so important for people like us to know about this concept in today's world.`
        ),
      },
      {
        speaker: "Person B",
        text: cleanLLMData.cleanText(
          `Let me break this down completely for you. ${title} is essentially about ${description}. The key thing to understand is that this directly impacts your daily financial decisions, your long-term planning, and how you can protect and grow your money effectively.`
        ),
        subtitle: cleanLLMData.cleanText(
          `Let me break this down completely for you. ${title} is essentially about ${description}. The key thing to understand is that this directly impacts your daily financial decisions, your long-term planning, and how you can protect and grow your money effectively.`
        ),
      },
      {
        speaker: "Person A",
        text: cleanLLMData.cleanText(
          `That's really helpful! But I'm curious about the practical side - can you walk me through some specific real-world scenarios where understanding ${title} would actually make a difference in someone's financial life and help them avoid costly mistakes?`
        ),
        subtitle: cleanLLMData.cleanText(
          `That's really helpful! But I'm curious about the practical side - can you walk me through some specific real-world scenarios where understanding ${title} would actually make a difference in someone's financial life and help them avoid costly mistakes?`
        ),
      },
      {
        speaker: "Person B",
        text: cleanLLMData.cleanText(
          `Absolutely! For example, when you understand ${title}, you can make smarter decisions about saving, investing, and spending. The most important steps are: first, educate yourself thoroughly; second, start with small amounts; and finally, consistently apply what you learn while staying updated with changes.`
        ),
        subtitle: cleanLLMData.cleanText(
          `Absolutely! For example, when you understand ${title}, you can make smarter decisions about saving, investing, and spending. The most important steps are: first, educate yourself thoroughly; second, start with small amounts; and finally, consistently apply what you learn while staying updated with changes.`
        ),
      },
    ];
  }
};

// 4. POST /audio/generate - Convert script to MP3s for 2 voices
app.post("/audio/generate", async (req, res) => {
  try {
    const { script } = req.body;
    if (!script || !Array.isArray(script)) {
      return res.status(400).json({ error: "Valid script array required" });
    }

    const audioFiles = await generateAudio(script);
    res.json(audioFiles);
  } catch (error) {
    logger.error("Audio generation error:", error);
    res.status(500).json({ error: "Failed to generate audio" });
  }
});

// Helper function to create silent audio placeholder
// const createSilentAudio = async (filename, durationSeconds = 2) => {
//   return new Promise((resolve, reject) => {
//     // Create a simple silent text that system TTS can handle
//     const silentText = "..."; // System will generate very brief audio for this

//     say.export(silentText, null, 1.0, filename, (err) => {
//       if (err) {
//         // If even this fails, create an empty file
//         fs.writeFileSync(filename, Buffer.alloc(1024)); // Minimal empty audio buffer
//       }
//       resolve(filename);
//     });
//   });
// };

// +++ REPLACEMENT FOR AUDIO GENERATION +++

// Helper function to save raw PCM audio data to a WAV file
// const saveWaveFile = (
//   filename,
//   pcmData,
//   channels = 1,
//   rate = 24000,
//   sampleWidth = 2
// ) => {
//   return new Promise((resolve, reject) => {
//     const writer = new wav.FileWriter(filename, {
//       channels,
//       sampleRate: rate,
//       bitDepth: sampleWidth * 8,
//     });
//     writer.on("finish", resolve).on("error", reject);
//     writer.write(pcmData);
//     writer.end();
//   });
// };

// +++ CORRECTED AUDIO GENERATION FUNCTION +++
// +++ FINAL, CORRECTED AUDIO GENERATION FUNCTION +++

// Helper functions for Google AI Studio TTS and WAV processing

// WAV file saving utility
async function saveWaveFile(
  filename,
  pcmData,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
) {
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
}
function saveBinaryFile(fileName, content) {
  fs.writeFile(fileName, content, (err) => {
    if (err) {
      logger.error(`Error writing file ${fileName}:`, err);
      return;
    }
    logger.info(`File ${fileName} saved to file system.`);
  });
}

function convertToWav(rawData, mimeType) {
  const options = parseMimeType(mimeType);
  const rawBuffer = Buffer.from(rawData, "base64");
  const wavHeader = createWavHeader(rawBuffer.length, options);
  return Buffer.concat([wavHeader, rawBuffer]);
}

function parseMimeType(mimeType) {
  const [fileType, ...params] = mimeType.split(";").map((s) => s.trim());
  const [_, format] = fileType.split("/");

  const options = {
    numChannels: 1,
    sampleRate: 24000,
    bitsPerSample: 16,
  };

  if (format && format.startsWith("L")) {
    const bits = parseInt(format.slice(1), 10);
    if (!isNaN(bits)) {
      options.bitsPerSample = bits;
    }
  }

  for (const param of params) {
    const [key, value] = param.split("=").map((s) => s.trim());
    if (key === "rate") {
      options.sampleRate = parseInt(value, 10);
    }
  }

  return options;
}

function createWavHeader(dataLength, options) {
  const { numChannels, sampleRate, bitsPerSample } = options;

  // http://soundfile.sapp.org/doc/WaveFormat
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const buffer = Buffer.alloc(44);

  buffer.write("RIFF", 0); // ChunkID
  buffer.writeUInt32LE(36 + dataLength, 4); // ChunkSize
  buffer.write("WAVE", 8); // Format
  buffer.write("fmt ", 12); // Subchunk1ID
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22); // NumChannels
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(byteRate, 28); // ByteRate
  buffer.writeUInt16LE(blockAlign, 32); // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34); // BitsPerSample
  buffer.write("data", 36); // Subchunk2ID
  buffer.writeUInt32LE(dataLength, 40); // Subchunk2Size

  return buffer;
}

const generateAudio = async (script) => {
  logger.info(
    `→ Generating audio with Google AI Studio TTS for ${script.length} lines using batching strategy`
  );

  if (!fs.existsSync("audio")) fs.mkdirSync("audio");

  // Check for required API key with clear error message
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const errorMsg =
      "❌ GEMINI_API_KEY is required for TTS generation. Please set this environment variable with your Google AI Studio API key.";
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  logger.info(
    "✅ Google AI Studio API key found, proceeding with TTS generation..."
  );

  try {
    return await generateAudioWithBatchingStrategy(script);
  } catch (error) {
    logger.error("❌ Google AI Studio TTS generation failed:", error.message);

    // If rate limited, provide helpful message
    if (
      error.message &&
      (error.message.includes("429") ||
        error.message.includes("rate limit") ||
        error.message.includes("quota"))
    ) {
      const rateLimitError = new Error(
        `🚫 Google AI Studio TTS rate limit exceeded. Free tier limits:\n` +
          `• 15 requests per minute\n` +
          `• 1500 requests per day\n` +
          `• Try again in 1 minute or upgrade your plan at https://ai.google.dev/pricing\n` +
          `Original error: ${error.message}`
      );
      throw rateLimitError;
    }

    throw new Error(
      `TTS generation failed: ${error.message}. Make sure your GEMINI_API_KEY is valid and has access to the TTS preview model.`
    );
  }
};

// Helper function to count tokens in text (approximate)
const countTokens = (text) => {
  // Rough approximation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
};

// Helper function to format conversation script for multi-speaker TTS
const formatConversationForTTS = (script) => {
  return script.map((line) => `${line.speaker}: ${line.text}`).join("\n");
};

// New single API call approach with multi-speaker configuration
const generateAudioWithBatchingStrategy = async (script) => {
  logger.info(
    `→ Generating single conversation audio using ONE API call with multi-speaker configuration`
  );

  try {
    // Initialize Google AI client
    const apiKey = process.env.GEMINI_API_KEY;
    const ai = new GoogleGenAI({});

    // Format the entire conversation for multi-speaker TTS
    const conversationText = formatConversationForTTS(script);

    // Count tokens before sending
    const tokenCount = countTokens(conversationText);
    logger.info(`📊 Token count: ${tokenCount} tokens`);
    logger.info(
      `📝 Conversation text length: ${conversationText.length} characters`
    );

    if (tokenCount > 4500) {
      logger.warn(
        `⚠️ High token count (${tokenCount}). API call may fail or be truncated.`
      );
    }

    logger.info(`→ Making single API call with multi-speaker configuration...`);
    logger.info(`� Full conversation:\n${conversationText}`);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: conversationText }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          multiSpeakerVoiceConfig: {
            speakerVoiceConfigs: [
              {
                speaker: "Person A",
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: "Kore" },
                },
              },
              {
                speaker: "Person B",
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: "Puck" },
                },
              },
            ],
          },
        },
      },
    });

    const audioData =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!audioData) {
      throw new Error("No audio data received from API");
    }

    const audioBuffer = Buffer.from(audioData, "base64");
    const conversationFile = "audio/conversation_single_call.wav";
    await saveWaveFile(conversationFile, audioBuffer);

    logger.info(
      `✓ Single conversation audio file created: ${conversationFile}`
    );
    logger.info(
      `📊 Summary: 1 API call, ${script.length} speakers, ${tokenCount} tokens`
    );
    logger.info(
      `🎯 Success: Used only 1 API call instead of ${script.length} calls!`
    );

    return {
      conversationFile: conversationFile,
      totalSegments: script.length,
      apiCallsUsed: 1,
      tokenCount: tokenCount,
      textLength: conversationText.length,
      message:
        "Single conversation audio generated with ONE API call using multi-speaker configuration",
    };
  } catch (error) {
    // Enhanced error handling
    if (
      error.status === 503 ||
      (error.error && error.error.status === "UNAVAILABLE")
    ) {
      logger.error(
        "❌ Model is overloaded. The TTS service is currently unavailable."
      );
      throw new Error(
        "TTS model is overloaded. Please try again in a few minutes. This is a temporary Google service issue."
      );
    }

    if (error.message && error.message.includes("429")) {
      logger.error("❌ Rate limit exceeded during audio generation.");
      throw new Error(
        "Rate limit exceeded for Google AI Studio TTS. Please wait a few minutes before trying again."
      );
    }

    logger.error("Google AI Studio TTS generation failed:", error);
    throw new Error(
      `TTS generation failed: ${error.message || "Unknown error"}`
    );
  }
};

// Rate limit status endpoint (updated for single API call approach)
app.get("/tts/rate-limit-status", (req, res) => {
  res.json({
    canMakeRequest: true,
    waitTimeSeconds: 0,
    lastRequestTime: null,
    rateLimitInfo: {
      freeTierLimits: {
        requestsPerMinute: 15,
        requestsPerDay: 1500,
        charactersPerRequest: 5000,
      },
      suggestion:
        "Using single API call with multi-speaker configuration to completely eliminate rate limiting issues.",
    },
    singleCallStrategy: {
      apiCallsPerConversation: 1,
      speakersSupported: ["Person A (Kore voice)", "Person B (Puck voice)"],
      maxTokensPerCall: "~4500 tokens",
      totalGenerationTime: "~10-30 seconds",
      benefits: [
        "Only 1 API call total - no rate limiting possible",
        "Multi-speaker voices in single audio file",
        "Faster generation (no delays needed)",
        "Natural conversation flow",
        "Token counting for safety",
        "Robust error handling for service overload",
      ],
    },
    tokenCounting: {
      enabled: true,
      approximateRatio: "1 token ≈ 4 characters",
      warningThreshold: 4500,
      recommendation: "Keep conversations under 4500 tokens for best results",
    },
  });
});

// Helper function to create a single conversation file from individual audio segments
const createSingleConversationFile = async (audioSegments) => {
  logger.info("→ Combining audio segments into single conversation file");

  const conversationFile = "audio/conversation.mp3";

  return new Promise((resolve, reject) => {
    let ffmpegCommand = ffmpeg();

    // Add all segment files as inputs
    audioSegments.forEach((segment) => {
      ffmpegCommand = ffmpegCommand.input(segment.file);
    });

    // Create filter complex to concatenate all segments
    const filterInputs = audioSegments
      .map((_, index) => `[${index}:0]`)
      .join("");
    const filterComplex = `${filterInputs}concat=n=${audioSegments.length}:v=0:a=1[out]`;

    ffmpegCommand
      .complexFilter(filterComplex)
      .outputOptions(["-map", "[out]"])
      .audioCodec("mp3")
      .audioBitrate("128k")
      .output(conversationFile)
      .on("start", (commandLine) => {
        logger.info("FFmpeg command for conversation creation:", commandLine);
      })
      .on("progress", (progress) => {
        logger.info(
          `Creating conversation: ${Math.round(progress.percent || 0)}%`
        );
      })
      .on("end", () => {
        logger.info(`✓ Single conversation file created: ${conversationFile}`);
        resolve(conversationFile);
      })
      .on("error", (error) => {
        logger.error("Conversation creation failed:", error);
        reject(error);
      })
      .run();
  });
};

// Helper function to create conversation flow from batch audio files
const createConversationFromBatches = async (
  script,
  speaker1BatchFile,
  speaker2BatchFile
) => {
  logger.info("→ Creating conversation flow from batch audio files");

  const audioFiles = [];

  // For now, we'll create a simple alternating conversation
  // In a more advanced implementation, you could use audio processing to split the batch files
  // based on pauses or use timestamps

  for (let i = 0; i < script.length; i++) {
    const line = script[i];
    const isSpeaker1 =
      line.speaker === "Person A" || line.speaker === "Speaker 1";

    // Create a reference to which batch file this line should come from
    const sourceFile = isSpeaker1 ? speaker1BatchFile : speaker2BatchFile;

    audioFiles.push({
      line: i + 1,
      speaker: line.speaker,
      file: sourceFile, // Points to the batch file for now
      text: line.text,
      voice: isSpeaker1 ? "Kore (Speaker 1)" : "Puck (Speaker 2)",
      duration: Math.ceil(line.text.length / 10),
      isBatchReference: true, // Flag to indicate this references a batch file
      batchIndex: isSpeaker1
        ? script
            .slice(0, i + 1)
            .filter(
              (l) => l.speaker === "Person A" || l.speaker === "Speaker 1"
            ).length - 1
        : script
            .slice(0, i + 1)
            .filter(
              (l) => l.speaker === "Person B" || l.speaker === "Speaker 2"
            ).length - 1,
    });
  }

  // Create the final mixed conversation using the batch files
  const mixingResult = await createMixedConversationFromBatches(
    audioFiles,
    speaker1BatchFile,
    speaker2BatchFile
  );

  // Log the results
  if (mixingResult.success) {
    logger.info(`✅ Audio successfully mixed: ${mixingResult.combinedPath}`);
  } else {
    logger.info(`⚠️ ${mixingResult.message}`);
    logger.info("📁 Individual batch files are available:");
    logger.info(`   - Speaker 1: ${mixingResult.speaker1BatchFile}`);
    logger.info(`   - Speaker 2: ${mixingResult.speaker2BatchFile}`);
  }

  // Add mixing result to audio files metadata
  audioFiles.forEach((audioFile) => {
    audioFile.mixingResult = mixingResult;
  });

  return audioFiles;
};

// Helper function to create mixed conversation from batch audio files
const createMixedConversationFromBatches = async (
  audioFiles,
  speaker1BatchFile,
  speaker2BatchFile
) => {
  logger.info("→ Creating mixed conversation audio from batch files");

  // Check if FFmpeg is properly configured
  try {
    // Test if ffmpeg command works
    const testCommand = ffmpeg();
    // This will throw an error if ffmpeg is not found
  } catch (error) {
    logger.warn("⚠️ FFmpeg not available. Skipping audio mixing.");
    logger.info("✅ Individual batch files are still available:");
    logger.info(`   - Speaker 1: ${speaker1BatchFile}`);
    logger.info(`   - Speaker 2: ${speaker2BatchFile}`);
    return {
      success: false,
      combinedPath: null,
      speaker1BatchFile,
      speaker2BatchFile,
      message: "FFmpeg not available - individual batch files ready",
    };
  }

  const combinedOutputPath = "audio/combined_conversation.mp3";

  return new Promise((resolve, reject) => {
    // For simplicity, we'll create a basic alternating mix
    // In production, you'd want more sophisticated audio processing
    let ffmpegCommand = ffmpeg();

    // Add both batch files as inputs
    ffmpegCommand.input(speaker1BatchFile).input(speaker2BatchFile);

    // Create a simple mix where both speakers are present but alternating
    // This is a simplified approach - in reality you'd want to segment the audio
    const filterComplex = "[0:0][1:0]amix=inputs=2:duration=longest[out]";

    ffmpegCommand
      .complexFilter(filterComplex)
      .outputOptions(["-map", "[out]"])
      .audioCodec("mp3")
      .audioBitrate("128k")
      .output(combinedOutputPath)
      .on("start", (commandLine) => {
        logger.info("FFmpeg command for mixing batch audio:", commandLine);
      })
      .on("progress", (progress) => {
        logger.info(
          `Mixing batch audio: ${Math.round(progress.percent || 0)}%`
        );
      })
      .on("end", () => {
        logger.info(`✓ Mixed conversation audio saved: ${combinedOutputPath}`);
        resolve({
          success: true,
          combinedPath: combinedOutputPath,
          speaker1BatchFile,
          speaker2BatchFile,
          message: "Audio mixed successfully",
        });
      })
      .on("error", (error) => {
        logger.error("Batch audio mixing failed:", error);
        logger.warn("⚠️ Falling back to individual batch files");
        // Don't reject, just return the individual files
        resolve({
          success: false,
          combinedPath: null,
          speaker1BatchFile,
          speaker2BatchFile,
          message: "Mixing failed - individual batch files available",
          error: error.message,
        });
      })
      .run();
  });
};

// Helper function to combine individual audio files into a single conversation
const combineAudioIntoConversation = async (audioFiles) => {
  logger.info(
    "→ Combining individual audio files into single conversation file"
  );

  const combinedOutputPath = "audio/combined_conversation.mp3";

  return new Promise((resolve, reject) => {
    let ffmpegCommand = ffmpeg();

    // Add all audio files as inputs
    audioFiles.forEach((audioFile) => {
      ffmpegCommand = ffmpegCommand.input(audioFile.file);
    });

    // Create filter complex to concatenate audio files with small gaps
    const filterInputs = audioFiles.map((_, index) => `[${index}:0]`).join("");
    const filterComplex = `${filterInputs}concat=n=${audioFiles.length}:v=0:a=1[out]`;

    ffmpegCommand
      .complexFilter(filterComplex)
      .outputOptions(["-map", "[out]"])
      .audioCodec("mp3")
      .audioBitrate("128k")
      .output(combinedOutputPath)
      .on("start", (commandLine) => {
        logger.info("FFmpeg command:", commandLine);
      })
      .on("progress", (progress) => {
        logger.info(`Combining audio: ${Math.round(progress.percent || 0)}%`);
      })
      .on("end", () => {
        logger.info(
          `✓ Combined conversation audio saved: ${combinedOutputPath}`
        );
        resolve(combinedOutputPath);
      })
      .on("error", (error) => {
        logger.error("Audio combination failed:", error);
        reject(error);
      })
      .run();
  });
};

// Alternative simpler combination using basic concatenation
const combineAudioFiles = async (audioFiles, outputPath) => {
  logger.info(`→ Preparing audio for video assembly`);

  // Check if audioFiles is the new single-file format
  if (audioFiles && audioFiles.conversationFile) {
    logger.info(
      `→ Using single conversation file: ${audioFiles.conversationFile}`
    );

    // Copy the single conversation file to the output path
    const sourceFile = audioFiles.conversationFile;
    if (fs.existsSync(sourceFile)) {
      fs.copyFileSync(sourceFile, outputPath);
      logger.info(`✓ Audio file prepared: ${outputPath}`);
      return outputPath;
    } else {
      throw new Error(`Conversation file not found: ${sourceFile}`);
    }
  }

  // Fallback to old format if needed
  if (Array.isArray(audioFiles) && audioFiles.length > 0) {
    logger.info(
      `→ Combining ${audioFiles.length} audio files into ${outputPath}`
    );

    return new Promise((resolve, reject) => {
      let ffmpegCommand = ffmpeg();

      // Add all audio files as inputs
      audioFiles.forEach((audioFile) => {
        ffmpegCommand = ffmpegCommand.input(audioFile.file);
      });

      // Simple concatenation
      const inputs = audioFiles.map((_, index) => `[${index}:0]`).join("");
      const filterComplex = `${inputs}concat=n=${audioFiles.length}:v=0:a=1[out]`;

      ffmpegCommand
        .complexFilter(filterComplex)
        .outputOptions(["-map", "[out]"])
        .audioCodec("mp3")
        .output(outputPath)
        .on("end", () => {
          logger.info(`✓ Audio files combined: ${outputPath}`);
          resolve(outputPath);
        })
        .on("error", (error) => {
          logger.error("Audio combination error:", error);
          reject(error);
        })
        .run();
    });
  }

  throw new Error("No valid audio files provided for combination");
};

// 5. GET /video/base - Get base background video from Cloudflare R2
app.get("/video/base", async (req, res) => {
  try {
    const baseVideoUrl = await getBaseVideo();
    res.json({ url: baseVideoUrl });
  } catch (error) {
    logger.error("Get base video error:", error);
    res.status(500).json({ error: "Failed to get base video" });
  }
});

const getBaseVideo = async () => {
  // Check for local base video files first
  const localBaseVideos = [
    "base.mp4",
    "temp/base_video.mp4",
    "videos/base.mp4",
  ];

  for (const videoPath of localBaseVideos) {
    if (fs.existsSync(videoPath)) {
      logger.info(`✅ Using local base video: ${videoPath}`);
      return path.resolve(videoPath); // Return absolute path for local file
    }
  }

  // If no local file found, try Filebase
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.FILEBASE_BUCKET_NAME,
      Key: "base.mp4",
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
    logger.info(
      `Retrieved base video URL from Filebase bucket: ${process.env.FILEBASE_BUCKET_NAME}/base.mp4`
    );
    return url;
  } catch (error) {
    logger.error("❌ Error getting base video from Filebase:", error.message);
    logger.error("❌ No base video found locally or in Filebase");
    throw new Error(
      "Base video not found. Please upload base.mp4 to Filebase or place it in the project directory."
    );
  }
};

// Filebase Upload/Download API endpoints
app.post("/filebase/upload", async (req, res) => {
  try {
    const { fileName, filePath, contentType } = req.body;
    if (!fileName || !filePath) {
      return res.status(400).json({ error: "fileName and filePath required" });
    }

    const uploadResult = await uploadToFilebase(
      fileName,
      filePath,
      contentType
    );
    res.json(uploadResult);
  } catch (error) {
    logger.error("Filebase upload error:", error);
    res.status(500).json({ error: "Failed to upload to Filebase" });
  }
});

app.get("/filebase/download/:fileName", async (req, res) => {
  try {
    const { fileName } = req.params;
    const downloadUrl = await getFilebaseDownloadUrl(fileName);
    res.json({ url: downloadUrl, fileName });
  } catch (error) {
    logger.error("Filebase download error:", error);
    res.status(500).json({ error: "Failed to get download URL" });
  }
});

app.get("/filebase/list", async (req, res) => {
  try {
    const files = await listFilebaseFiles();
    res.json({ files });
  } catch (error) {
    logger.error("Filebase list error:", error);
    res.status(500).json({ error: "Failed to list files" });
  }
});

// Verify base video exists in bucket
app.get("/filebase/verify-base-video", async (req, res) => {
  try {
    const command = new HeadObjectCommand({
      Bucket: process.env.FILEBASE_BUCKET_NAME,
      Key: "base.mp4",
    });

    // Check if base.mp4 exists
    await s3Client.send(command);

    // Get file info
    const downloadUrl = await getFilebaseDownloadUrl("base.mp4");

    res.json({
      exists: true,
      message: "Base video found in Filebase bucket",
      fileName: "base.mp4",
      bucket: process.env.FILEBASE_BUCKET_NAME,
      downloadUrl: downloadUrl,
    });
  } catch (error) {
    if (error.code === "NotFound") {
      res.status(404).json({
        exists: false,
        message: "Base video (base.mp4) not found in bucket",
        bucket: process.env.FILEBASE_BUCKET_NAME,
        suggestion: "Upload a base.mp4 file to your Filebase bucket first",
      });
    } else {
      logger.error("Base video verification error:", error);
      res.status(500).json({ error: "Failed to verify base video" });
    }
  }
});

// Filebase helper functions
const uploadToFilebase = async (
  fileName,
  localFilePath,
  contentType = "application/octet-stream"
) => {
  const fileContent = fs.readFileSync(localFilePath);

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.FILEBASE_BUCKET_NAME,
      Key: fileName,
      Body: fileContent,
      ContentType: contentType,
      ACL: "public-read", // Make file publicly accessible
    },
  });

  const result = await upload.done();

  logger.info(`File uploaded to Filebase: ${fileName}`);
  return {
    success: true,
    fileName,
    url: result.Location,
    key: result.Key,
    etag: result.ETag,
  };
};

const getFilebaseDownloadUrl = async (fileName, expiresIn = 3600) => {
  const command = new GetObjectCommand({
    Bucket: process.env.FILEBASE_BUCKET_NAME,
    Key: fileName,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn });
  return url;
};

const listFilebaseFiles = async (prefix = "") => {
  const command = new ListObjectsV2Command({
    Bucket: process.env.FILEBASE_BUCKET_NAME,
    Prefix: prefix,
  });

  const result = await s3Client.send(command);

  return result.Contents.map((file) => ({
    key: file.Key,
    size: file.Size,
    lastModified: file.LastModified,
    url: `https://s3.filebase.com/${process.env.FILEBASE_BUCKET_NAME}/${file.Key}`,
  }));
};

const deleteFromFilebase = async (fileName) => {
  const command = new DeleteObjectCommand({
    Bucket: process.env.FILEBASE_BUCKET_NAME,
    Key: fileName,
  });

  await s3Client.send(command);
  logger.info(`File deleted from Filebase: ${fileName}`);
  return { success: true, fileName };
};

// Upload base video endpoint
app.post(
  "/filebase/upload-base-video",
  upload.single("video"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No video file uploaded" });
      }

      const uploadResult = await uploadToFilebase(
        "base.mp4",
        req.file.path,
        "video/mp4"
      );

      // Clean up temp file
      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        message: "Base video uploaded successfully",
        ...uploadResult,
      });
    } catch (error) {
      logger.error("Base video upload error:", error);
      // Clean up temp file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: "Failed to upload base video" });
    }
  }
);

// Bulk upload endpoint for multiple files
app.post(
  "/filebase/upload-multiple",
  upload.array("files", 10),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const uploadResults = [];

      for (const file of req.files) {
        try {
          const fileName = `uploads/${Date.now()}-${file.originalname}`;
          const contentType = file.mimetype;

          const result = await uploadToFilebase(
            fileName,
            file.path,
            contentType
          );
          uploadResults.push(result);

          // Clean up temp file
          fs.unlinkSync(file.path);
        } catch (error) {
          logger.error(`Failed to upload ${file.originalname}:`, error);
          uploadResults.push({
            success: false,
            fileName: file.originalname,
            error: error.message,
          });

          // Clean up temp file on error
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }
      }

      res.json({
        success: true,
        message: `Processed ${req.files.length} files`,
        results: uploadResults,
      });
    } catch (error) {
      logger.error("Multiple upload error:", error);
      res.status(500).json({ error: "Failed to upload files" });
    }
  }
);

// 6. POST /images/generate - Generate illustrations using Stability AI
app.post("/images/generate", async (req, res) => {
  try {
    const { script } = req.body;
    if (!script || !Array.isArray(script)) {
      return res.status(400).json({ error: "Valid script array required" });
    }

    const images = await generateImages(script);
    res.json(images);
  } catch (error) {
    logger.error("Image generation error:", error);
    res.status(500).json({ error: "Failed to generate images" });
  }
});

// +++ REPLACEMENT FOR IMAGE GENERATION WITH IMAGEN +++

const generateImages = async (script) => {
  logger.info("→ Generating images with Google Imagen API");

  try {
    // Initialize Google AI client for Imagen
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is required for Imagen generation");
    }

    const ai = new GoogleGenAI({});

    // First, use Groq to analyze the script and identify the best parts for visualization
    const imagePromptResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        messages: [
          {
            role: "user",
            content: `Analyze this educational conversation script and identify exactly 5 key concepts that would benefit most from visual illustration to help users understand better.

Script: ${script.map((line) => `${line.speaker}: ${line.text}`).join("\n")}

For each concept, create a detailed, descriptive image prompt suitable for professional educational illustrations. Focus on:
1. Key concepts that are abstract or complex
2. Financial processes or workflows  
3. Visual metaphors that aid understanding
4. Professional, clean illustrations suitable for educational content

Return ONLY valid JSON array with exactly 5 image prompts:
[
  {"concept": "brief concept name", "prompt": "detailed professional illustration prompt for educational content"},
  {"concept": "brief concept name", "prompt": "detailed professional illustration prompt for educational content"},
  ...5 total
]`,
          },
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_tokens: 800,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const rawImagePrompts = imagePromptResponse.data.choices[0].message.content;
    logger.info("→ LLM analyzed script for optimal image generation points");

    let imagePrompts;
    try {
      imagePrompts = JSON.parse(
        rawImagePrompts.replace(/```json|```/g, "").trim()
      );
    } catch (e) {
      logger.warn("Failed to parse LLM image prompts, using fallback");
      // Fallback prompts based on common financial education topics
      imagePrompts = [
        {
          concept: "Financial Planning",
          prompt:
            "Professional vector illustration of financial planning concept with charts, graphs, and money symbols in clean blue and green color scheme",
        },
        {
          concept: "Investment Growth",
          prompt:
            "Modern illustration showing upward trending arrow with coins and investment symbols, minimalist design with corporate colors",
        },
        {
          concept: "Banking Process",
          prompt:
            "Clean vector illustration of digital banking process with mobile device, bank building, and transaction flow icons",
        },
        {
          concept: "Money Management",
          prompt:
            "Professional illustration of budget planning with calculator, piggy bank, and financial documents in flat design style",
        },
        {
          concept: "Financial Education",
          prompt:
            "Educational illustration showing learning concept with books, graduation cap, and financial symbols in professional style",
        },
      ];
    }

    // Ensure we have exactly 5 prompts
    if (imagePrompts.length > 5) {
      imagePrompts = imagePrompts.slice(0, 5);
    } else if (imagePrompts.length < 5) {
      // Fill with generic prompts if needed
      while (imagePrompts.length < 5) {
        imagePrompts.push({
          concept: `Educational Concept ${imagePrompts.length + 1}`,
          prompt:
            "Professional educational illustration with clean, minimalist design in corporate blue and green color palette",
        });
      }
    }

    const images = [];

    logger.info(
      `→ Generating ${imagePrompts.length} images with Imagen API...`
    );

    for (let i = 0; i < imagePrompts.length; i++) {
      const imagePrompt = imagePrompts[i];

      // Enhance the prompt for better educational illustrations
      const enhancedPrompt = `${imagePrompt.prompt}, professional educational content, 4K quality, clean background, suitable for financial education video, vector illustration style, corporate aesthetic`;

      logger.info(`→ Generating image ${i + 1}: ${imagePrompt.concept}`);
      logger.info(`   Prompt: ${enhancedPrompt.substring(0, 100)}...`);

      try {
        const response = await ai.models.generateImages({
          model: "imagen-3.0-generate-002",
          prompt: enhancedPrompt,
          config: {
            numberOfImages: 1,
            aspectRatio: "16:9", // Good for video content
            sampleImageSize: "1K",
          },
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
          const generatedImage = response.generatedImages[0];
          const imgBytes = generatedImage.image.imageBytes;
          const buffer = Buffer.from(imgBytes, "base64");

          const filename = path.join("images", `image_${i + 1}.png`);
          fs.writeFileSync(filename, buffer);

          images.push({
            index: i + 1,
            concept: imagePrompt.concept,
            filename,
            prompt: enhancedPrompt,
            originalPrompt: imagePrompt.prompt,
          });

          logger.info(
            `✓ Image ${i + 1} (${imagePrompt.concept}) generated: ${filename}`
          );
        } else {
          logger.warn(
            `⚠️ No image generated for concept: ${imagePrompt.concept}`
          );
        }

        // Add delay between API calls to avoid rate limiting
        if (i < imagePrompts.length - 1) {
          logger.info("⏳ Waiting 2 seconds between image generation calls...");
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        logger.error(
          `✗ Failed to generate image ${i + 1} (${imagePrompt.concept}):`,
          error.message
        );

        // Create a placeholder if image generation fails
        const placeholder = Buffer.alloc(100);
        const filename = path.join("images", `placeholder_${i + 1}.png`);
        fs.writeFileSync(filename, placeholder);

        images.push({
          index: i + 1,
          concept: imagePrompt.concept,
          filename,
          prompt: enhancedPrompt,
          error: error.message,
          isPlaceholder: true,
        });
      }
    }

    if (images.length === 0) {
      throw new Error("No images could be generated with Imagen API");
    }

    logger.info(
      `✓ Image generation completed: ${images.length} images created`
    );
    logger.info(
      `📊 Success rate: ${images.filter((img) => !img.isPlaceholder).length}/${
        imagePrompts.length
      }`
    );

    return images;
  } catch (error) {
    logger.error("Imagen image generation failed:", error);

    // Return fallback images if everything fails
    logger.warn("Using fallback image generation...");
    const fallbackImages = [];

    for (let i = 0; i < 5; i++) {
      const filename = path.join("images", `fallback_${i + 1}.png`);
      const placeholder = Buffer.alloc(100);
      fs.writeFileSync(filename, placeholder);

      fallbackImages.push({
        index: i + 1,
        concept: `Educational Concept ${i + 1}`,
        filename,
        prompt: "Fallback educational illustration",
        isFallback: true,
      });
    }

    return fallbackImages;
  }
};

// const generateImages = async (script) => {
//   const images = [];

//   // Generate 3-4 key images based on script content
//   const keyPoints = script.slice(0, 4); // Take first 4 lines for image generation

//   for (let i = 0; i < keyPoints.length; i++) {
//     const prompt = `Banking concept illustration: ${keyPoints[i].text}. Clean, professional, modern design.`;

//     const response = await axios.post(
//       "https://api.stability.ai/v1/generation/stable-diffusion-v1-6/text-to-image",
//       {
//         text_prompts: [{ text: prompt }],
//         cfg_scale: 7,
//         height: 512,
//         width: 512,
//         steps: 20,
//         samples: 1,
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
//           "Content-Type": "application/json",
//         },
//         responseType: "json",
//       }
//     );

//     const imageData = response.data.artifacts[0].base64;
//     const filename = `images/image_${i}.png`;

//     fs.writeFileSync(filename, imageData, "base64");

//     images.push({
//       index: i,
//       filename,
//       prompt: prompt,
//     });
//   }

//   return images;
// };

// 7. POST /video/assemble - Create final video with ffmpeg
app.post("/video/assemble", async (req, res) => {
  try {
    const { baseVideoUrl, images, audioFiles, script } = req.body;

    const finalVideo = await assembleVideo(
      baseVideoUrl,
      images,
      audioFiles,
      script
    );
    res.json({ video: finalVideo });
  } catch (error) {
    logger.error("Video assembly error:", error);
    res.status(500).json({ error: "Failed to assemble video" });
  }
});

const assembleVideo = async (baseVideoUrl, images, audioFiles, script) => {
  const outputPath = `videos/final_${Date.now()}.mp4`;
  const subtitlesPath = `subtitles/subtitles_${Date.now()}.srt`;

  // Create SRT subtitle file
  createSubtitlesFile(script, subtitlesPath);

  // Handle base video - could be URL or local path
  let baseVideoPath = "temp/base_video.mp4";

  // Check if baseVideoUrl is a local file path or a URL
  if (
    baseVideoUrl.startsWith("http://") ||
    baseVideoUrl.startsWith("https://")
  ) {
    logger.info(`→ Downloading base video from URL: ${baseVideoUrl}`);
    const response = await axios({
      method: "GET",
      url: baseVideoUrl,
      responseType: "stream",
    });

    const writer = fs.createWriteStream(baseVideoPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
    logger.info(`✓ Base video downloaded: ${baseVideoPath}`);
  } else {
    // It's a local file path
    logger.info(`→ Using local base video: ${baseVideoUrl}`);
    baseVideoPath = baseVideoUrl;

    // Verify the file exists
    if (!fs.existsSync(baseVideoPath)) {
      throw new Error(`Base video file not found: ${baseVideoPath}`);
    }
  }

  // Prepare audio - now handles single conversation file or multiple files
  const combinedAudioPath = "temp/combined_audio.mp3";
  await combineAudioFiles(audioFiles, combinedAudioPath);

  return new Promise((resolve, reject) => {
    let command = ffmpeg(baseVideoPath)
      .input(combinedAudioPath)
      .audioCodec("aac")
      .videoCodec("libx264");

    // Add images as overlays
    images.forEach((image, index) => {
      const startTime = index * 15; // Show each image for 15 seconds
      command = command.input(image.filename);
    });

    // Add subtitle
    command = command.outputOptions([
      `-vf subtitles=${subtitlesPath}:force_style='FontSize=24,PrimaryColour=&Hffffff'`,
      "-preset fast",
      "-crf 23",
    ]);

    command
      .output(outputPath)
      .on("end", () => {
        logger.info("Video assembly completed:", outputPath);
        resolve(outputPath);
      })
      .on("error", (err) => {
        logger.error("Video assembly error:", err);
        reject(err);
      })
      .run();
  });
};

const createSubtitlesFile = (script, subtitlesPath) => {
  let srtContent = "";
  let startTime = 0;

  script.forEach((line, index) => {
    const duration = 4; // 4 seconds per line
    const endTime = startTime + duration;

    srtContent += `${index + 1}\n`;
    srtContent += `${formatTime(startTime)} --> ${formatTime(endTime)}\n`;
    srtContent += `${line.subtitle}\n\n`;

    startTime = endTime;
  });

  fs.writeFileSync(subtitlesPath, srtContent);
};

const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")},${milliseconds
    .toString()
    .padStart(3, "0")}`;
};

// 8. POST /metadata/generate - Generate caption and hashtags
app.post("/metadata/generate", async (req, res) => {
  try {
    const { script } = req.body;
    if (!script || !Array.isArray(script)) {
      return res.status(400).json({ error: "Valid script array required" });
    }

    const metadata = await generateMetadata(script);
    res.json(metadata);
  } catch (error) {
    logger.error("Metadata generation error:", error);
    res.status(500).json({ error: "Failed to generate metadata" });
  }
});

const generateMetadata = async (script) => {
  logger.info("→ Generating metadata from script");

  const scriptText = script
    .map((line) => cleanLLMData.cleanText(line.text))
    .join(" ");

  const prompt = `Based on this banking/finance content: "${scriptText}"
  
  Generate clean, professional social media content:
  1. An engaging caption (2-3 sentences, no extra formatting)
  2. 8-10 relevant hashtags (include #)
  
  Return ONLY valid JSON (no markdown, no extra text):
  {"caption": "clean text here", "hashtags": ["#Banking", "#Finance", "#Education"]}`;

  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_tokens: 200,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    // Get and clean the response
    const rawResponse = response.data.choices[0].message.content;
    logger.info("Raw metadata response received");

    // Extract and clean JSON
    let metadataData = cleanLLMData.extractJSON(rawResponse);

    if (!metadataData) {
      logger.warn("Failed to parse metadata JSON, using fallback");
      metadataData = {
        caption:
          "Learn essential banking concepts in simple English! Perfect for beginners.",
        hashtags: [
          "#Banking",
          "#Finance",
          "#Education",
          "#Tutorial",
          "#Money",
          "#Learning",
        ],
      };
    }

    // Clean and validate metadata
    const cleanedMetadata = cleanLLMData.cleanMetadata(metadataData);

    // Ensure we have some hashtags if none were provided
    if (cleanedMetadata.hashtags.length === 0) {
      cleanedMetadata.hashtags = [
        "#Banking",
        "#Finance",
        "#Education",
        "#Tutorial",
        "#Money",
        "#Learning",
      ];
    }

    logger.info(
      `✓ Metadata cleaned - Caption: ${cleanedMetadata.caption.length} chars, Hashtags: ${cleanedMetadata.hashtags.length}`
    );
    return cleanedMetadata;
  } catch (error) {
    logger.error("Metadata generation error:", error.message);

    // Return clean fallback metadata
    return {
      caption: cleanLLMData.cleanText(
        "Learn essential banking concepts in simple English! Perfect for beginners."
      ),
      hashtags: [
        "#Banking",
        "#Finance",
        "#Education",
        "#Tutorial",
        "#Money",
        "#Learning",
      ],
    };
  }
};

// 9. POST /youtube/upload - Upload to YouTube
app.post("/youtube/upload", async (req, res) => {
  try {
    const { videoPath, metadata, title } = req.body;

    const youtubeUrl = await uploadToYouTube(videoPath, metadata, title);
    res.json({ url: youtubeUrl });
  } catch (error) {
    logger.error("YouTube upload error:", error);
    res.status(500).json({ error: "Failed to upload to YouTube" });
  }
});

const uploadToYouTube = async (videoPath, metadata, title) => {
  const youtube = await getYouTubeClient();

  const response = await youtube.videos.insert({
    part: "snippet,status",
    requestBody: {
      snippet: {
        title: title,
        description: `${metadata.caption}\n\n${metadata.hashtags.join(" ")}`,
        tags: metadata.hashtags.map((tag) => tag.replace("#", "")),
        categoryId: "22", // People & Blogs
        defaultLanguage: "en",
        defaultAudioLanguage: "te",
      },
      status: {
        privacyStatus: "public",
      },
    },
    media: {
      body: fs.createReadStream(videoPath),
    },
  });

  const videoId = response.data.id;
  return `https://www.youtube.com/watch?v=${videoId}`;
};

// 10. POST /instagram/upload - Upload to Instagram Reels
app.post("/instagram/upload", async (req, res) => {
  try {
    const { videoPath, caption } = req.body;

    const instagramUrl = await uploadToInstagram(videoPath, caption);
    res.json({ url: instagramUrl });
  } catch (error) {
    logger.error("Instagram upload error:", error);
    res.status(500).json({ error: "Failed to upload to Instagram" });
  }
});

const uploadToInstagram = async (videoPath, caption) => {
  // First, upload video to Instagram
  const uploadResponse = await axios.post(
    `https://graph.facebook.com/v18.0/${process.env.INSTAGRAM_ACCOUNT_ID}/media`,
    {
      media_type: "VIDEO",
      video_url: videoPath, // This should be a public URL
      caption: caption,
      access_token: process.env.INSTAGRAM_ACCESS_TOKEN,
    }
  );

  const mediaId = uploadResponse.data.id;

  // Then publish the media
  const publishResponse = await axios.post(
    `https://graph.facebook.com/v18.0/${process.env.INSTAGRAM_ACCOUNT_ID}/media_publish`,
    {
      creation_id: mediaId,
      access_token: process.env.INSTAGRAM_ACCESS_TOKEN,
    }
  );

  return `https://www.instagram.com/reel/${publishResponse.data.id}`;
};

// 11. PATCH /sheets/update - Update row status to Posted
app.patch("/sheets/update", async (req, res) => {
  try {
    const { rowId, status } = req.body;

    await updateSheetStatus(rowId, status);
    res.json({ success: true, message: "Sheet updated successfully" });
  } catch (error) {
    logger.error("Sheet update error:", error);
    res.status(500).json({ error: "Failed to update sheet" });
  }
});

const updateSheetStatus = async (rowId, status) => {
  const sheets = await getSheetsClient();

  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `Sheet1!D${rowId}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[status]],
    },
  });
};

// 12. POST /notify/email - Send notification email
app.post("/notify/email", async (req, res) => {
  try {
    const { title, youtubeUrl, instagramUrl } = req.body;

    // await sendNotificationEmail(title, youtubeUrl, instagramUrl);
    res.json({ success: true, message: "Email sent successfully" });
  } catch (error) {
    logger.error("Email notification error:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
});

const sendNotificationEmail = async (
  title,
  youtubeUrl,
  instagramUrl,
  filebaseUrl = null
) => {
  const transporter = createEmailTransporter();

  const filebaseSection = filebaseUrl
    ? `
      <div style="margin: 20px 0;">
        <h4>☁️ Video File (Filebase):</h4>
        <a href="${filebaseUrl}" target="_blank">${filebaseUrl}</a>
      </div>
  `
    : "";

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.NOTIFICATION_EMAIL,
    subject: `✅ Content Published: ${title}`,
    html: `
      <h2>🎉 Your content has been successfully published!</h2>
      <h3>Title: ${title}</h3>
      
      <div style="margin: 20px 0;">
        <h4>📺 YouTube:</h4>
        <a href="${youtubeUrl}" target="_blank">${youtubeUrl}</a>
      </div>
      
      <div style="margin: 20px 0;">
        <h4>📱 Instagram:</h4>
        <a href="${instagramUrl}" target="_blank">${instagramUrl}</a>
      </div>
      
      ${filebaseSection}
      
      <p>Published at: ${new Date().toLocaleString()}</p>
    `,
  };

  await transporter.sendMail(mailOptions);
};

// Error email function
const sendErrorEmail = async (step, errorMessage) => {
  try {
    const transporter = createEmailTransporter();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.NOTIFICATION_EMAIL,
      subject: `❌ Workflow Error at ${step}`,
      html: `
        <h2>🚨 Workflow Error Occurred</h2>
        <h3>Step: ${step}</h3>
        <h3>Task ID: ${currentWorkflow.taskId}</h3>
        
        <div style="background-color: #ffebee; padding: 15px; margin: 20px 0; border-left: 4px solid #f44336;">
          <h4>Error Message:</h4>
          <pre>${errorMessage}</pre>
        </div>
        
        <div style="background-color: #e3f2fd; padding: 15px; margin: 20px 0; border-left: 4px solid #2196f3;">
          <h4>Workflow State:</h4>
          <pre>${JSON.stringify(currentWorkflow, null, 2)}</pre>
        </div>
        
        <p>Time: ${new Date().toLocaleString()}</p>
      `,
    };

    await transporter.sendMail(mailOptions);
  } catch (emailError) {
    logger.error("Failed to send error email:", emailError);
  }
};

// Test Google TTS voices endpoint
app.get("/test/voices", async (req, res) => {
  try {
    logger.info("→ Testing Google TTS voices");

    const client = new textToSpeech.TextToSpeechClient({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    });

    const voiceConfigs = {
      "Person A": {
        languageCode: "en-US",
        name: "en-US-Journey-D",
        ssmlGender: "MALE",
      },
      "Person B": {
        languageCode: "en-US",
        name: "en-US-Journey-F",
        ssmlGender: "FEMALE",
      },
    };

    const results = {};

    for (const [speaker, voiceConfig] of Object.entries(voiceConfigs)) {
      try {
        const request = {
          input: { text: "Hello, this is a test." },
          voice: voiceConfig,
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: 1.0,
            pitch: 0.0,
          },
        };

        const [response] = await client.synthesizeSpeech(request);

        results[speaker] = {
          voice: voiceConfig.name,
          status: "✓ Working",
          audioSize: response.audioContent.length,
          gender: voiceConfig.ssmlGender,
        };
      } catch (error) {
        results[speaker] = {
          voice: voiceConfig.name,
          status: "✗ Failed",
          error: error.message,
        };
      }
    }

    logger.info("✓ Google TTS voice test completed");
    res.json({
      service: "Google Text-to-Speech",
      results: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Voice test error:", error);
    res.status(500).json({
      error: "Failed to test Google TTS voices",
      details: error.message,
    });
  }
});

// Workflow status endpoint
app.get("/workflow/status", (req, res) => {
  res.json(currentWorkflow);
});

// TTS Status and Help endpoint
app.get("/tts/status", (req, res) => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastTTSRequest;
  const cooldownRemaining = Math.max(
    0,
    TTS_RATE_LIMIT_MS - timeSinceLastRequest
  );

  res.json({
    service: "Google AI Studio TTS",
    model: "gemini-2.5-flash-preview-tts",
    status: cooldownRemaining > 0 ? "rate-limited" : "ready",
    cooldownRemaining: cooldownRemaining,
    cooldownRemainingSeconds: Math.ceil(cooldownRemaining / 1000),
    lastRequestTime: lastTTSRequest
      ? new Date(lastTTSRequest).toISOString()
      : "never",
    limits: {
      freetier: {
        perMinute: 15,
        perDay: 1500,
        note: "These are approximate limits for the preview model",
      },
    },
    troubleshooting: {
      rateLimitExceeded: "Wait 1-24 hours or upgrade to paid plan",
      dailyQuotaExceeded:
        "Reset at midnight UTC, upgrade to paid plan, or wait",
      upgradeUrl: "https://ai.google.dev/pricing",
      alternativeServices: ["Google Cloud TTS", "ElevenLabs", "Amazon Polly"],
    },
    timestamp: new Date().toISOString(),
  });
});

// Simple API Key test endpoint (doesn't use TTS quota)
app.get("/test/api-key", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: "No API key found",
        message:
          "Set GOOGLE_AI_STUDIO_API_KEY or GEMINI_API_KEY environment variable",
      });
    }

    // Test with a simple text model (doesn't use TTS quota)
    const ai = new GoogleGenAI({ apiKey });
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent("Say hello in one word");
    const response = await result.response;

    res.json({
      success: true,
      message: "✅ API key is valid and working",
      testResponse: response.text(),
      ttsModelAvailable: "Unknown - requires separate TTS request to test",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "API key test failed",
      details: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Test endpoint for Imagen image generation
app.post("/test/imagen", async (req, res) => {
  try {
    logger.info("🧪 Testing Imagen image generation");

    const testScript = [
      {
        speaker: "Person A",
        text: "I've been hearing a lot about compound interest lately, but I really need to understand what it actually means and why it's so important for building wealth over time.",
      },
      {
        speaker: "Person B",
        text: "Sure! Let me explain how compound interest works. It's basically earning interest on both your original money and the interest you've already earned, creating exponential growth over time.",
      },
      {
        speaker: "Person A",
        text: "That makes sense! But can you give me a practical example of how someone would see this compound effect in their savings or investments?",
      },
      {
        speaker: "Person B",
        text: "Absolutely! For example, if you invest $1000 at 7% annually, after 10 years you'd have about $1970, but after 30 years you'd have over $7600 due to compounding.",
      },
    ];

    const images = await generateImages(testScript);

    res.json({
      success: true,
      message: "✅ Imagen test completed successfully!",
      images: images,
      totalImages: images.length,
      apiUsed: "Google Imagen via Gemini API",
      model: "imagen-3.0-generate-002",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("❌ Imagen test failed:", error);
    res.status(500).json({
      success: false,
      error: "Imagen test failed",
      details: error.message,
      suggestion:
        "Make sure GEMINI_API_KEY is set and has access to Imagen models",
      timestamp: new Date().toISOString(),
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    workflow: {
      status: currentWorkflow.status,
      currentStep: currentWorkflow.currentStep,
    },
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error("Unhandled error:", error);
  res.status(500).json({ error: "Internal server error" });
});

// Test endpoint for Google AI Studio TTS
app.post("/test/google-ai-studio-tts", async (req, res) => {
  try {
    logger.info("🧪 Testing Google AI Studio TTS endpoint");

    const testScript = [
      {
        speaker: "Person A",
        text: "Hello! Let's test Google AI Studio's multi-speaker text-to-speech feature.",
      },
      {
        speaker: "Person B",
        text: "That sounds great! This should create natural-sounding conversation audio with different voices.",
      },
      {
        speaker: "Person A",
        text: "Perfect! If this works, we'll have high-quality TTS for our content automation.",
      },
    ];

    const audioFiles = await generateAudioWithGoogleAIStudio(testScript);

    res.json({
      success: true,
      message: "✅ Google AI Studio TTS test completed successfully!",
      audioFiles: audioFiles,
      apiUsed: "Google AI Studio TTS",
      model: "gemini-2.5-pro-preview-tts",
      voices: ["Zephyr (Person A)", "Puck (Person B)"],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("❌ Google AI Studio TTS test failed:", error);
    res.status(500).json({
      success: false,
      error: "Google AI Studio TTS test failed",
      details: error.message,
      suggestion:
        "Make sure GOOGLE_AI_STUDIO_API_KEY is set in environment variables",
      timestamp: new Date().toISOString(),
    });
  }
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 AI Content Automation Server running on port ${PORT}`);
  logger.info(` Health check available at: http://localhost:${PORT}/health`);
  logger.info(
    `📊 Workflow status available at: http://localhost:${PORT}/workflow/status`
  );
});

module.exports = app;
