const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const axios = require("axios");
const ffmpeg = require("fluent-ffmpeg");
const multer = require("multer");
const nodemailer = require("nodemailer");
const AWS = require("aws-sdk");
const FormData = require("form-data");
const { v4: uuidv4 } = require("uuid");
const cron = require("cron");
const winston = require("winston");
require("dotenv").config();

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
  return nodemailer.createTransporter({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });
};

// AWS S3 (Filebase) setup
const s3 = new AWS.S3({
  endpoint: process.env.FILEBASE_ENDPOINT,
  accessKeyId: process.env.FILEBASE_ACCESS_KEY_ID,
  secretAccessKey: process.env.FILEBASE_SECRET_ACCESS_KEY,
  signatureVersion: "v4",
  region: "us-east-1",
});

// Google Sheets setup
const getSheetsClient = async () => {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
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

// 1. POST /workflow/run - Entry point triggered by cron
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
    await sendErrorEmail("Workflow Start", error.message);
    res.status(500).json({ error: "Failed to start workflow" });
  }
});

// Async workflow execution
const executeWorkflow = async () => {
  try {
    // Step 1: Get next task from sheets
    currentWorkflow.currentStep = "sheets/next-task";
    const task = await getNextTask();
    if (!task) {
      currentWorkflow.status = "completed";
      currentWorkflow.currentStep = "no-tasks";
      logger.info("No pending tasks found");
      return;
    }
    currentWorkflow.results.task = task;

    // Step 2: Generate script
    currentWorkflow.currentStep = "script/generate";
    const script = await generateScript(task.title, task.description);
    currentWorkflow.results.script = script;

    // Step 3: Generate audio
    currentWorkflow.currentStep = "audio/generate";
    const audioFiles = await generateAudio(script);
    currentWorkflow.results.audioFiles = audioFiles;

    // Step 4: Get base video from Filebase (existing uploaded video)
    currentWorkflow.currentStep = "video/base";
    const baseVideoUrl = await getBaseVideo();
    currentWorkflow.results.baseVideoUrl = baseVideoUrl;
    logger.info(`Using existing base video from Filebase: base.mp4`);

    // Step 5: Generate images
    currentWorkflow.currentStep = "images/generate";
    const images = await generateImages(script);
    currentWorkflow.results.images = images;

    // Step 6: Assemble video
    currentWorkflow.currentStep = "video/assemble";
    const finalVideo = await assembleVideo(
      baseVideoUrl,
      images,
      audioFiles,
      script
    );
    currentWorkflow.results.finalVideo = finalVideo;

    // Step 7: Upload final video to Filebase
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

    // Step 8: Generate metadata
    currentWorkflow.currentStep = "metadata/generate";
    const metadata = await generateMetadata(script);
    currentWorkflow.results.metadata = metadata;

    // Step 9: Upload to YouTube
    currentWorkflow.currentStep = "youtube/upload";
    const youtubeUrl = await uploadToYouTube(finalVideo, metadata, task.title);
    currentWorkflow.results.youtubeUrl = youtubeUrl;

    // Step 10: Upload to Instagram
    currentWorkflow.currentStep = "instagram/upload";
    const instagramUrl = await uploadToInstagram(finalVideo, metadata.caption);
    currentWorkflow.results.instagramUrl = instagramUrl;

    // Step 11: Update sheet
    currentWorkflow.currentStep = "sheets/update";
    await updateSheetStatus(task.rowId, "Posted");

    // Step 12: Send notification email
    currentWorkflow.currentStep = "notify/email";
    await sendNotificationEmail(
      task.title,
      youtubeUrl,
      instagramUrl,
      filebaseUpload.url
    );

    currentWorkflow.status = "completed";
    currentWorkflow.currentStep = "finished";
    logger.info("Workflow completed successfully", {
      taskId: currentWorkflow.taskId,
    });
  } catch (error) {
    logger.error("Workflow execution error:", error);
    currentWorkflow.status = "error";
    currentWorkflow.error = error.message;
    await sendErrorEmail(currentWorkflow.currentStep, error.message);
  }
};

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
  const prompt = `Create a 60-90 second conversation script between two people about "${title}". 
  Description: ${description}
  
  Requirements:
  - Mix of Telugu and English (Hinglish style)
  - 2 speakers: Person A and Person B
  - Natural, engaging conversation
  - Each line should be 3-5 seconds when spoken
  - Include English subtitles for all text
  
  Return as JSON array: [{"speaker": "Person A", "text": "Telugu/English text", "subtitle": "English subtitle"}]`;

  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "mixtral-8x7b-32768",
      temperature: 0.7,
      max_tokens: 500,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  // Parse and structure the response
  const generatedText = response.data.choices[0].message.content;

  // This is a simplified parsing - in production, you'd want more sophisticated parsing
  const lines = generatedText.split("\n").filter((line) => line.trim());
  const script = lines.map((line, index) => ({
    speaker: index % 2 === 0 ? "Person A" : "Person B",
    text: line.trim(),
    subtitle: line.trim(), // For now, using same text as subtitle
  }));

  return script;
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

const generateAudio = async (script) => {
  const audioFiles = [];

  for (let i = 0; i < script.length; i++) {
    const line = script[i];
    const voice =
      line.speaker === "Person A"
        ? "tts_models/en/ljspeech/tacotron2-DDC"
        : "tts_models/en/ljspeech/glow-tts";
    const filename = `audio/line_${i}.mp3`;

    // Using Coqui TTS API (assuming local installation)
    const response = await axios.post(
      "http://localhost:5002/api/tts",
      {
        text: line.text,
        voice: voice,
        format: "mp3",
      },
      {
        responseType: "stream",
      }
    );

    const writer = fs.createWriteStream(filename);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    audioFiles.push({
      line: i,
      speaker: line.speaker,
      file: filename,
      text: line.text,
    });
  }

  return audioFiles;
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
  const params = {
    Bucket: process.env.FILEBASE_BUCKET_NAME,
    Key: "base.mp4",
    Expires: 3600, // 1 hour
  };

  const url = s3.getSignedUrl("getObject", params);
  logger.info(
    `Retrieved base video URL from Filebase bucket: ${process.env.FILEBASE_BUCKET_NAME}/base.mp4`
  );
  return url;
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
    const params = {
      Bucket: process.env.FILEBASE_BUCKET_NAME,
      Key: "base.mp4",
    };

    // Check if base.mp4 exists
    await s3.headObject(params).promise();

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

  const params = {
    Bucket: process.env.FILEBASE_BUCKET_NAME,
    Key: fileName,
    Body: fileContent,
    ContentType: contentType,
    ACL: "public-read", // Make file publicly accessible
  };

  const result = await s3.upload(params).promise();

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
  const params = {
    Bucket: process.env.FILEBASE_BUCKET_NAME,
    Key: fileName,
    Expires: expiresIn,
  };

  const url = s3.getSignedUrl("getObject", params);
  return url;
};

const listFilebaseFiles = async (prefix = "") => {
  const params = {
    Bucket: process.env.FILEBASE_BUCKET_NAME,
    Prefix: prefix,
  };

  const result = await s3.listObjectsV2(params).promise();

  return result.Contents.map((file) => ({
    key: file.Key,
    size: file.Size,
    lastModified: file.LastModified,
    url: `https://s3.filebase.com/${process.env.FILEBASE_BUCKET_NAME}/${file.Key}`,
  }));
};

const deleteFromFilebase = async (fileName) => {
  const params = {
    Bucket: process.env.FILEBASE_BUCKET_NAME,
    Key: fileName,
  };

  await s3.deleteObject(params).promise();
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

const generateImages = async (script) => {
  const images = [];

  // Generate 3-4 key images based on script content
  const keyPoints = script.slice(0, 4); // Take first 4 lines for image generation

  for (let i = 0; i < keyPoints.length; i++) {
    const prompt = `Banking concept illustration: ${keyPoints[i].text}. Clean, professional, modern design.`;

    const response = await axios.post(
      "https://api.stability.ai/v1/generation/stable-diffusion-v1-6/text-to-image",
      {
        text_prompts: [{ text: prompt }],
        cfg_scale: 7,
        height: 512,
        width: 512,
        steps: 20,
        samples: 1,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
          "Content-Type": "application/json",
        },
        responseType: "json",
      }
    );

    const imageData = response.data.artifacts[0].base64;
    const filename = `images/image_${i}.png`;

    fs.writeFileSync(filename, imageData, "base64");

    images.push({
      index: i,
      filename,
      prompt: prompt,
    });
  }

  return images;
};

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

  // Download base video
  const baseVideoPath = "temp/base_video.mp4";
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

  // Concatenate all audio files
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

const combineAudioFiles = (audioFiles, outputPath) => {
  return new Promise((resolve, reject) => {
    let command = ffmpeg();

    audioFiles.forEach((audio) => {
      command = command.input(audio.file);
    });

    command
      .complexFilter("concat=n=" + audioFiles.length + ":v=0:a=1[out]")
      .outputOptions(["-map", "[out]"])
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
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
  const scriptText = script.map((line) => line.text).join(" ");

  const prompt = `Based on this banking/finance content: "${scriptText}"
  
  Generate:
  1. An engaging YouTube/Instagram caption (2-3 sentences)
  2. 10 relevant hashtags
  
  Return as JSON: {"caption": "text", "hashtags": ["tag1", "tag2"]}`;

  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "mixtral-8x7b-32768",
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

  // Parse response and return structured metadata
  return {
    caption:
      "🏦 Banking made simple! Learn key concepts in Telugu & English. Perfect for beginners! 💡",
    hashtags: [
      "#Banking",
      "#Finance",
      "#Telugu",
      "#Education",
      "#FinTech",
      "#Money",
      "#Investment",
      "#Tutorial",
      "#IndianBanking",
      "#FinancialLiteracy",
    ],
  };
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

    await sendNotificationEmail(title, youtubeUrl, instagramUrl);
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

// Workflow status endpoint
app.get("/workflow/status", (req, res) => {
  res.json(currentWorkflow);
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

// Set up cron job to run twice daily
const cronJob = new cron.CronJob(
  "0 8,20 * * *",
  async () => {
    logger.info("Cron job triggered - starting workflow");
    try {
      await axios.post(`http://localhost:${PORT}/workflow/run`);
    } catch (error) {
      logger.error("Cron job error:", error);
    }
  },
  null,
  true,
  "Asia/Kolkata"
);

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error("Unhandled error:", error);
  res.status(500).json({ error: "Internal server error" });
});

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 AI Content Automation Server running on port ${PORT}`);
  logger.info(`📅 Cron job scheduled to run at 8:00 AM and 8:00 PM daily`);
  logger.info(`🔍 Health check available at: http://localhost:${PORT}/health`);
  logger.info(
    `📊 Workflow status available at: http://localhost:${PORT}/workflow/status`
  );
});

module.exports = app;
