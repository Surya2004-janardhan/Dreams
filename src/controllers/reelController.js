const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const { createSubtitlesFile } = require("../utils/subtitles");
const {
  getBaseVideo,
  composeReelVideo,
} = require("../services/videoProcessingService");
const logger = require("../config/logger");

// In-memory storage for active tasks (in production, use Redis/database)
const activeTasks = new Map();

// Helper to convert seconds to SRT timestamp format
const formatSRTTimestamp = (seconds) => {
  const date = new Date(0);
  date.setMilliseconds(seconds * 1000);
  const iso = date.toISOString();
  const timePart = iso.substr(11, 12).replace(".", ",");
  return timePart;
};

// Extract audio from base video for better transcription
const extractAudioFromBaseVideo = async (baseVideoPath) => {
  return new Promise((resolve, reject) => {
    const audioPath = path.join(
      __dirname,
      "../../temp",
      `audio_${Date.now()}.wav`,
    );

    ffmpeg(baseVideoPath)
      .audioCodec("pcm_s16le")
      .audioChannels(1)
      .audioFrequency(16000)
      .output(audioPath)
      .on("end", () => resolve(audioPath))
      .on("error", reject)
      .run();
  });
};

// Generate SRT from base video using Gemini
const generateSRTFromBaseVideo = async (apiKey) => {
  try {
    const baseVideoPath = path.join(__dirname, "../../videos/Base-vedio.mp4");

    if (!fs.existsSync(baseVideoPath)) {
      throw new Error("Base video not found");
    }

    // Extract audio for better transcription
    logger.info("Extracting audio from base video for transcription...");
    const audioPath = await extractAudioFromBaseVideo(baseVideoPath);

    // Read audio file
    const audioBuffer = fs.readFileSync(audioPath);
    const audioBase64 = audioBuffer.toString("base64");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent([
      "Transcribe this audio to SRT format with accurate timestamps. Include speaker identification if multiple speakers are detected.",
      {
        inlineData: {
          mimeType: "audio/wav",
          data: audioBase64,
        },
      },
    ]);

    const srtContent = result.response.text();

    // Cleanup temp audio file
    fs.unlinkSync(audioPath);

    return srtContent;
  } catch (error) {
    logger.error("Error generating SRT:", error);
    throw error;
  }
};

// Parse SRT content into structured data
const parseSRT = (srtText) => {
  const items = [];
  const blocks = srtText.trim().split("\n\n");

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length >= 3) {
      const id = parseInt(lines[0]);
      const timestampMatch = lines[1].match(
        /(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/,
      );
      if (timestampMatch) {
        const startTime = timestampMatch[1];
        const endTime = timestampMatch[2];
        const text = lines.slice(2).join(" ");

        items.push({
          id,
          startTime,
          endTime,
          text: text.trim(),
        });
      }
    }
  }

  return items;
};

// Generate reel content using Gemini
const generateReelContentAI = async (
  topic,
  srtData,
  apiKey,
  modelName = "gemini-1.5-flash",
) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model });

  const prompt = `Create an educational video animation that complements a single-narrator explanation about: "${topic}"

SRT SUBTITLE TRANSCRIPT (from the narrator's speech):
${srtData.map((item) => `${item.id}\n${item.startTime} --> ${item.endTime}\n${item.text}`).join("\n\n")}

VIDEO ANIMATION REQUIREMENTS:
1. Single-narrator educational format - visuals should support and enhance the spoken explanation
2. Dynamic background: Use day-based color schemes (check current day for appropriate colors)
3. Text overlays: Display subtitle text in sync with speech timing
4. Visual elements: Add relevant icons, diagrams, or animations that illustrate key concepts
5. Typography: Use Montserrat Bold font for professional Instagram appearance
6. Layout: Clean, modern design optimized for mobile viewing
7. Animations: Smooth GSAP animations that highlight important concepts
8. Flow: Visual progression that matches the educational narrative structure

TECHNICAL SPECS:
- HTML5 with embedded CSS and JavaScript
- GSAP animations for smooth transitions
- Responsive design for various screen sizes
- Black background with colored accents
- Professional educational aesthetic

Return ONLY valid HTML with embedded CSS and JavaScript. The animation should educate visually while the narrator explains verbally.`;

  const result = await model.generateContent(prompt);
  const htmlContent = result.response.text();

  return {
    html: htmlContent,
    srtData,
    topic,
  };
};

// Main reel generation endpoint
const generateReelContent = async (req, res) => {
  const {
    topic,
    apiKey,
    modelName = "gemini-1.5-flash",
    backgroundMusic,
    subtitleSettings,
  } = req.body;

  if (!topic) {
    return res.status(400).json({ error: "Topic is required" });
  }

  if (!apiKey) {
    return res.status(400).json({ error: "API key is required" });
  }

  const taskId = `reel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Initialize task
  activeTasks.set(taskId, {
    status: "processing",
    step: "initializing",
    progress: 0,
    result: null,
    error: null,
    createdAt: new Date(),
  });

  // Start processing asynchronously
  processReelGeneration(
    taskId,
    topic,
    apiKey,
    modelName,
    backgroundMusic,
    subtitleSettings,
  );

  res.json({
    taskId,
    status: "processing",
    message: "Reel generation started",
  });
};

// Async processing function
const processReelGeneration = async (
  taskId,
  topic,
  apiKey,
  modelName,
  backgroundMusic,
  subtitleSettings,
) => {
  try {
    const task = activeTasks.get(taskId);
    if (!task) return;

    // Step 1: Generate SRT from base video
    task.step = "generating_srt";
    task.progress = 10;
    logger.info(`[${taskId}] Generating SRT from base video...`);

    const srtText = await generateSRTFromBaseVideo(apiKey);
    const srtData = parseSRT(srtText);

    // Step 2: Generate content using AI
    task.step = "generating_content";
    task.progress = 30;
    logger.info(`[${taskId}] Generating AI content for topic: ${topic}`);

    const generatedContent = await generateReelContentAI(
      topic,
      srtData,
      apiKey,
      modelName,
    );

    // Step 3: Create subtitles file
    task.step = "creating_subtitles";
    task.progress = 50;
    logger.info(`[${taskId}] Creating subtitles file...`);

    const subtitlesPath = path.join(
      __dirname,
      "../../subtitles",
      `subtitles_${taskId}.srt`,
    );
    await createSubtitlesFile(srtData, subtitlesPath);

    // Step 4: Get base video
    task.step = "preparing_video";
    task.progress = 60;
    logger.info(`[${taskId}] Preparing base video...`);

    const baseVideoPath = await getBaseVideo();

    // Step 5: Compose final video
    task.step = "composing_video";
    task.progress = 80;
    logger.info(`[${taskId}] Composing final video...`);

    const outputPath = path.join(
      __dirname,
      "../../final_video",
      `reel_${taskId}.mp4`,
    );

    await composeReelVideo({
      baseVideo: baseVideoPath,
      subtitles: subtitlesPath,
      backgroundMusic: backgroundMusic,
      outputPath,
      subtitleSettings: subtitleSettings || {
        fontSize: 32,
        fontFamily: "Inter",
        color: "#FFFFFF",
        bgColor: "rgba(0,0,0,0.8)",
        paddingX: 16,
        paddingY: 8,
      },
    });

    // Step 6: Complete
    task.status = "completed";
    task.progress = 100;
    task.step = "completed";
    task.result = {
      videoPath: outputPath,
      srtData,
      generatedContent,
      downloadUrl: `/videos/reel_${taskId}.mp4`,
    };

    logger.info(`[${taskId}] Reel generation completed successfully`);
  } catch (error) {
    const task = activeTasks.get(taskId);
    if (task) {
      task.status = "failed";
      task.error = error.message;
    }
    logger.error(`[${taskId}] Reel generation failed:`, error);
  }
};

// Get task status
const getReelStatus = (req, res) => {
  const { taskId } = req.params;
  const task = activeTasks.get(taskId);

  if (!task) {
    return res.status(404).json({ error: "Task not found" });
  }

  res.json({
    taskId,
    status: task.status,
    step: task.step,
    progress: task.progress,
    result: task.result,
    error: task.error,
    createdAt: task.createdAt,
  });
};

// Download generated reel
const downloadReel = (req, res) => {
  const { taskId } = req.params;
  const task = activeTasks.get(taskId);

  if (!task || task.status !== "completed") {
    return res.status(404).json({ error: "Reel not found or not ready" });
  }

  const videoPath = task.result.videoPath;
  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: "Video file not found" });
  }

  res.download(videoPath, `reel_${taskId}.mp4`);
};

module.exports = {
  generateReelContent,
  getReelStatus,
  downloadReel,
};
