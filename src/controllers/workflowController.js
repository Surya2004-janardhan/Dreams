const { generateScript } = require("../services/scriptService");
const {
  generateAudioWithBatchingStrategy,
} = require("../services/audioService");
const { generateImages } = require("../services/imageService");
const {
  getBaseVideo,
  composeVideo,
  createPlatformOptimized,
} = require("../services/videoProcessingService");
const {
  createSubtitlesFile,
  parseConversationTiming,
} = require("../utils/subtitles");
const { getNextTask, updateSheetStatus } = require("../services/sheetsService");
const { uploadToBothPlatforms } = require("../services/socialMediaService");
const {
  sendSuccessNotification,
  sendErrorNotification,
} = require("../services/emailService");
const {
  cleanupAllMediaFolders,
  initializeDirectories,
} = require("../services/cleanupService");
const cleanLLMData = require("../utils/textCleaner");
const logger = require("../config/logger");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");

// Store current workflow state
let currentWorkflow = {
  taskId: null,
  status: "idle",
  currentStep: null,
  error: null,
  results: {},
  taskData: null,
};

/**
 * Save workflow checkpoint to disk
 */
const saveCheckpoint = async (taskId, step, data, taskData) => {
  try {
    const checkpointDir = "temp/checkpoints";
    if (!fs.existsSync(checkpointDir)) {
      fs.mkdirSync(checkpointDir, { recursive: true });
    }

    const checkpoint = {
      taskId,
      timestamp: new Date().toISOString(),
      step,
      taskData,
      data,
      completedSteps: currentWorkflow.completedSteps || [],
    };

    const checkpointPath = path.join(
      checkpointDir,
      `checkpoint_${taskId}.json`
    );
    fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));

    logger.info(`💾 Checkpoint saved: ${step} (${checkpointPath})`);
    return checkpointPath;
  } catch (error) {
    logger.error("❌ Failed to save checkpoint:", error);
  }
};

/**
 * Load workflow checkpoint from disk
 */
const loadCheckpoint = (taskId) => {
  try {
    const checkpointPath = path.join(
      "temp/checkpoints",
      `checkpoint_${taskId}.json`
    );

    if (fs.existsSync(checkpointPath)) {
      const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
      logger.info(
        `📂 Loaded checkpoint: ${checkpoint.step} from ${checkpoint.timestamp}`
      );
      return checkpoint;
    }

    return null;
  } catch (error) {
    logger.error("❌ Failed to load checkpoint:", error);
    return null;
  }
};

/**
 * Find existing files for resuming workflow
 */
const findExistingAssets = (taskId) => {
  const assets = {
    script: null,
    audio: null,
    subtitles: null,
    baseVideo: null,
    images: [],
    finalVideo: null,
  };

  try {
    // Look for script files
    const scriptPattern = [
      `temp/script_${taskId}.txt`,
      `temp/script_${taskId}.json`,
    ];
    for (const scriptPath of scriptPattern) {
      if (fs.existsSync(scriptPath)) {
        assets.script = {
          path: scriptPath,
          content: fs.readFileSync(scriptPath, "utf8"),
        };
        logger.info(`📜 Found existing script: ${scriptPath}`);
        break;
      }
    }

    // Look for audio files
    const audioDir = "audio";
    if (fs.existsSync(audioDir)) {
      const audioFiles = fs.readdirSync(audioDir);
      const taskAudio = audioFiles.find(
        (file) =>
          file.includes(`_${taskId}`) || file.startsWith("conversation_")
      );
      if (taskAudio) {
        assets.audio = {
          conversationFile: path.resolve(path.join(audioDir, taskAudio)),
          segments: [], // Could be loaded from checkpoint
        };
        logger.info(`🎵 Found existing audio: ${taskAudio}`);
      }
    }

    // Look for subtitle files
    const subtitlesDir = "subtitles";
    if (fs.existsSync(subtitlesDir)) {
      const subtitleFiles = fs.readdirSync(subtitlesDir);
      const taskSubtitles = subtitleFiles.find(
        (file) => file.includes(`_${taskId}`) || file.endsWith(".srt")
      );
      if (taskSubtitles) {
        assets.subtitles = path.resolve(path.join(subtitlesDir, taskSubtitles));
        logger.info(`📝 Found existing subtitles: ${taskSubtitles}`);
      }
    }

    // Look for base video
    const videosDir = "videos";
    if (fs.existsSync(videosDir)) {
      const videoFiles = fs.readdirSync(videosDir);
      const baseVideos = videoFiles.filter(
        (file) =>
          file.toLowerCase().includes("base") ||
          file.toLowerCase().includes("background") ||
          file.toLowerCase().includes("template")
      );
      if (baseVideos.length > 0) {
        assets.baseVideo = path.resolve(path.join(videosDir, baseVideos[0]));
        logger.info(`📹 Found existing base video: ${baseVideos[0]}`);
      }
    }

    // Look for generated images
    const imagesDir = "images";
    if (fs.existsSync(imagesDir)) {
      const imageFiles = fs.readdirSync(imagesDir);
      const taskImages = imageFiles.filter(
        (file) =>
          file.includes(`_${taskId}`) || file.startsWith("educational_image_")
      );

      taskImages.forEach((imageFile, index) => {
        assets.images.push({
          index: index + 1,
          filename: path.resolve(path.join(imagesDir, imageFile)),
          concept: `Existing image ${index + 1}`,
          timing: {
            startTime: index * 10, // Placeholder timing
            endTime: (index + 1) * 10,
            duration: 10,
          },
        });
      });

      if (assets.images.length > 0) {
        logger.info(`🖼️ Found ${assets.images.length} existing images`);
      }
    }

    // Look for final video
    if (fs.existsSync(videosDir)) {
      const videoFiles = fs.readdirSync(videosDir);
      const finalVideos = videoFiles.filter(
        (file) =>
          file.includes(`final_video_${taskId}`) ||
          file.includes("final_video_")
      );
      if (finalVideos.length > 0) {
        assets.finalVideo = {
          videoPath: path.resolve(path.join(videosDir, finalVideos[0])),
          success: true,
        };
        logger.info(`🎬 Found existing final video: ${finalVideos[0]}`);
      }
    }

    return assets;
  } catch (error) {
    logger.error("❌ Error finding existing assets:", error);
    return assets;
  }
};

/**
 * Resume workflow from checkpoint or existing assets
 */
const resumeWorkflow = async (taskId, taskData) => {
  logger.info(`🔄 Attempting to resume workflow for task ${taskId}...`);

  // Try to load checkpoint first
  const checkpoint = loadCheckpoint(taskId);
  if (checkpoint) {
    logger.info(`📂 Resuming from checkpoint: ${checkpoint.step}`);
    currentWorkflow.results = checkpoint.data;
    currentWorkflow.completedSteps = checkpoint.completedSteps || [];
    return {
      resumeFromStep: checkpoint.step,
      results: checkpoint.data,
      completedSteps: checkpoint.completedSteps || [],
    };
  }

  // If no checkpoint, look for existing assets
  logger.info("🔍 Checking for existing assets to resume from...");
  const existingAssets = findExistingAssets(taskId);

  const resumeData = {
    resumeFromStep: "sheets/fetch-task",
    results: {},
    completedSteps: [],
  };

  // Determine resume point based on existing assets
  if (existingAssets.finalVideo) {
    resumeData.resumeFromStep = "social/upload";
    resumeData.results.finalVideo = existingAssets.finalVideo;
    resumeData.completedSteps = [
      "script/generate",
      "audio/generate",
      "subtitles/generate",
      "video/base",
      "images/generate",
      "video/compose",
    ];
    logger.info("🎬 Found final video, resuming from social media upload");
  } else if (
    existingAssets.baseVideo &&
    existingAssets.audio &&
    existingAssets.subtitles &&
    existingAssets.images.length > 0
  ) {
    resumeData.resumeFromStep = "video/compose";
    resumeData.results.baseVideoPath = existingAssets.baseVideo;
    resumeData.results.audioFiles = existingAssets.audio;
    resumeData.results.subtitles = existingAssets.subtitles;
    resumeData.results.images = existingAssets.images;
    resumeData.completedSteps = [
      "script/generate",
      "audio/generate",
      "subtitles/generate",
      "video/base",
      "images/generate",
    ];
    logger.info("🎞️ Found all components, resuming from video composition");
  } else if (
    existingAssets.script &&
    existingAssets.audio &&
    existingAssets.subtitles
  ) {
    resumeData.resumeFromStep = "video/base";
    resumeData.results.script = existingAssets.script.content;
    resumeData.results.audioFiles = existingAssets.audio;
    resumeData.results.subtitles = existingAssets.subtitles;
    resumeData.completedSteps = [
      "script/generate",
      "audio/generate",
      "subtitles/generate",
    ];
    logger.info(
      "🎵 Found script, audio, and subtitles, resuming from base video"
    );
  } else if (existingAssets.script && existingAssets.audio) {
    resumeData.resumeFromStep = "subtitles/generate";
    resumeData.results.script = existingAssets.script.content;
    resumeData.results.audioFiles = existingAssets.audio;
    resumeData.completedSteps = ["script/generate", "audio/generate"];
    logger.info(
      "📜 Found script and audio, resuming from subtitles generation"
    );
  } else if (existingAssets.script) {
    resumeData.resumeFromStep = "audio/generate";
    resumeData.results.script = existingAssets.script.content;
    resumeData.completedSteps = ["script/generate"];
    logger.info("📝 Found script, resuming from audio generation");
  }

  // Save any found assets to results
  currentWorkflow.results = resumeData.results;
  currentWorkflow.completedSteps = resumeData.completedSteps;

  return resumeData;
};

/**
 * Main automated workflow - pulls from Google Sheets and processes with checkpoints
 */
const runAutomatedWorkflow = async (req, res) => {
  let taskData = null;
  let resumeFromStep = null;
  let completedSteps = [];

  try {
    logger.info("🚀 Starting automated content creation workflow...");

    // Initialize directories
    initializeDirectories();

    const taskId = Date.now().toString();
    currentWorkflow = {
      taskId,
      status: "running",
      currentStep: "sheets/fetch-task",
      error: null,
      results: {},
      taskData: null,
      completedSteps: [],
    };

    // Send immediate response
    res.json({
      success: true,
      message: "Automated workflow started successfully",
      taskId: taskId,
      status: "running",
      note: "Check workflow status at /workflow/status or wait for email notification",
    });

    // Step 1: Get next task from Google Sheets
    if (!resumeFromStep || resumeFromStep === "sheets/fetch-task") {
      logger.info("→ Step 1: Getting next task from Google Sheets");
      currentWorkflow.currentStep = "sheets/fetch-task";
      taskData = await getNextTask();
      currentWorkflow.taskData = taskData;

      logger.info(
        `📋 Task retrieved: ${taskData.idea} (Row ${taskData.rowId})`
      );

      // Check if we can resume from existing assets
      const resumeInfo = await resumeWorkflow(taskId, taskData);
      resumeFromStep = resumeInfo.resumeFromStep;
      currentWorkflow.results = {
        ...currentWorkflow.results,
        ...resumeInfo.results,
      };
      completedSteps = resumeInfo.completedSteps;
      currentWorkflow.completedSteps = completedSteps;

      if (resumeFromStep !== "sheets/fetch-task") {
        logger.info(`🔄 Resuming workflow from step: ${resumeFromStep}`);
      }
    }

    // Step 2: Generate Q&A conversation script
    if (
      !completedSteps.includes("script/generate") &&
      (!resumeFromStep || resumeFromStep === "script/generate")
    ) {
      logger.info("→ Step 2: Generating multi-speaker Q&A script");
      currentWorkflow.currentStep = "script/generate";

      const rawScript = await generateScript(
        taskData.idea,
        taskData.description
      );
      const script = cleanLLMData.extractConversation(rawScript);

      if (!script || script.length < 100) {
        throw new Error("Generated script is too short or empty");
      }

      currentWorkflow.results.script = script;

      // Save script to file for future resume
      const scriptPath = path.resolve(`temp/script_${taskId}.txt`);
      if (!fs.existsSync("temp")) fs.mkdirSync("temp", { recursive: true });
      fs.writeFileSync(scriptPath, script);

      completedSteps.push("script/generate");
      currentWorkflow.completedSteps = completedSteps;

      // Save checkpoint
      await saveCheckpoint(
        taskId,
        "audio/generate",
        currentWorkflow.results,
        taskData
      );

      logger.info("✓ Q&A script generated with male/female speakers");
    } else if (completedSteps.includes("script/generate")) {
      logger.info("⏩ Script generation skipped (already completed)");
    }

    // Step 3: Generate TTS audio with different voices
    if (
      !completedSteps.includes("audio/generate") &&
      (!resumeFromStep ||
        ["script/generate", "audio/generate"].includes(resumeFromStep))
    ) {
      logger.info("→ Step 3: Generating TTS audio with male/female voices");
      currentWorkflow.currentStep = "audio/generate";

      const audioFiles = await generateAudioWithBatchingStrategy(
        currentWorkflow.results.script
      );
      currentWorkflow.results.audioFiles = audioFiles;

      completedSteps.push("audio/generate");
      currentWorkflow.completedSteps = completedSteps;

      // Save checkpoint
      await saveCheckpoint(
        taskId,
        "subtitles/generate",
        currentWorkflow.results,
        taskData
      );

      logger.info("✓ Multi-speaker TTS audio generated");
    } else if (completedSteps.includes("audio/generate")) {
      logger.info("⏩ Audio generation skipped (already completed)");
    }

    // Step 4: Create perfectly timed subtitles
    if (
      !completedSteps.includes("subtitles/generate") &&
      (!resumeFromStep ||
        ["audio/generate", "subtitles/generate"].includes(resumeFromStep))
    ) {
      logger.info("→ Step 4: Creating perfectly timed subtitles");
      currentWorkflow.currentStep = "subtitles/generate";

      const subtitlesPath = path.resolve(`subtitles/subtitles_${taskId}.srt`);
      const subtitlesResult = createSubtitlesFile(
        currentWorkflow.results.script,
        subtitlesPath
      );

      if (!subtitlesResult.success) {
        throw new Error("Failed to create subtitles");
      }

      currentWorkflow.results.subtitles = subtitlesPath;

      completedSteps.push("subtitles/generate");
      currentWorkflow.completedSteps = completedSteps;

      // Save checkpoint
      await saveCheckpoint(
        taskId,
        "video/base",
        currentWorkflow.results,
        taskData
      );

      logger.info("✓ SRT subtitles created with perfect timing");
    } else if (completedSteps.includes("subtitles/generate")) {
      logger.info("⏩ Subtitles generation skipped (already completed)");
    }

    // Step 5: Get base video from Drive or local
    if (
      !completedSteps.includes("video/base") &&
      (!resumeFromStep ||
        ["subtitles/generate", "video/base"].includes(resumeFromStep))
    ) {
      logger.info("→ Step 5: Getting base video");
      currentWorkflow.currentStep = "video/base";

      const baseVideoPath = await getBaseVideo();
      currentWorkflow.results.baseVideoPath = baseVideoPath;

      completedSteps.push("video/base");
      currentWorkflow.completedSteps = completedSteps;

      // Save checkpoint
      await saveCheckpoint(
        taskId,
        "images/generate",
        currentWorkflow.results,
        taskData
      );

      logger.info("✓ Base video ready");
    } else if (completedSteps.includes("video/base")) {
      logger.info("⏩ Base video step skipped (already completed)");
    }

    // Step 6: Generate contextual images with timing
    if (
      !completedSteps.includes("images/generate") &&
      (!resumeFromStep ||
        ["video/base", "images/generate"].includes(resumeFromStep))
    ) {
      logger.info("→ Step 6: Generating contextual educational images");
      currentWorkflow.currentStep = "images/generate";

      const images = await generateImages(currentWorkflow.results.script);
      currentWorkflow.results.images = images;

      completedSteps.push("images/generate");
      currentWorkflow.completedSteps = completedSteps;

      // Save checkpoint
      await saveCheckpoint(
        taskId,
        "video/compose",
        currentWorkflow.results,
        taskData
      );

      logger.info(`✓ ${images.length} contextual images generated with timing`);
    } else if (completedSteps.includes("images/generate")) {
      logger.info("⏩ Images generation skipped (already completed)");
    }

    // Step 7: Compose final video with all elements
    if (
      !completedSteps.includes("video/compose") &&
      (!resumeFromStep ||
        ["images/generate", "video/compose"].includes(resumeFromStep))
    ) {
      logger.info("→ Step 7: Composing final video with subtitles and images");
      currentWorkflow.currentStep = "video/compose";

      const finalVideo = await composeVideo(
        currentWorkflow.results.baseVideoPath,
        currentWorkflow.results.audioFiles.conversationFile,
        currentWorkflow.results.images,
        currentWorkflow.results.subtitles,
        taskData.idea
      );

      currentWorkflow.results.finalVideo = finalVideo;

      completedSteps.push("video/compose");
      currentWorkflow.completedSteps = completedSteps;

      // Save checkpoint
      await saveCheckpoint(
        taskId,
        "video/optimize",
        currentWorkflow.results,
        taskData
      );

      logger.info("✓ Final video composed with subtitles and images");
    } else if (completedSteps.includes("video/compose")) {
      logger.info("⏩ Video composition skipped (already completed)");
    }

    // Step 8: Create platform-optimized versions
    if (
      !completedSteps.includes("video/optimize") &&
      (!resumeFromStep ||
        ["video/compose", "video/optimize"].includes(resumeFromStep))
    ) {
      logger.info("→ Step 8: Creating platform-optimized versions");
      currentWorkflow.currentStep = "video/optimize";

      const optimizedVersions = await createPlatformOptimized(
        currentWorkflow.results.finalVideo.videoPath,
        "both"
      );
      currentWorkflow.results.optimizedVersions = optimizedVersions;

      completedSteps.push("video/optimize");
      currentWorkflow.completedSteps = completedSteps;

      // Save checkpoint
      await saveCheckpoint(
        taskId,
        "social/upload",
        currentWorkflow.results,
        taskData
      );

      logger.info("✓ Platform-optimized versions created");
    } else if (completedSteps.includes("video/optimize")) {
      logger.info("⏩ Video optimization skipped (already completed)");
    }

    // Step 9: Upload to YouTube and Instagram
    if (
      !completedSteps.includes("social/upload") &&
      (!resumeFromStep ||
        ["video/optimize", "social/upload"].includes(resumeFromStep))
    ) {
      logger.info("→ Step 9: Uploading to social media platforms");
      currentWorkflow.currentStep = "social/upload";

      const uploadResults = await uploadToBothPlatforms(
        currentWorkflow.results.optimizedVersions?.youtube ||
          currentWorkflow.results.finalVideo.videoPath,
        taskData.idea,
        taskData.description
      );

      currentWorkflow.results.uploadResults = uploadResults;

      completedSteps.push("social/upload");
      currentWorkflow.completedSteps = completedSteps;

      // Save checkpoint
      await saveCheckpoint(
        taskId,
        "sheets/update",
        currentWorkflow.results,
        taskData
      );

      logger.info("✓ Social media uploads completed");
    } else if (completedSteps.includes("social/upload")) {
      logger.info("⏩ Social media upload skipped (already completed)");
    }

    // Step 10: Update Google Sheet with results
    if (!completedSteps.includes("sheets/update")) {
      logger.info("→ Step 10: Updating Google Sheet with results");
      currentWorkflow.currentStep = "sheets/update";

      await updateSheetStatus(
        taskData.rowId,
        "Posted",
        currentWorkflow.results.uploadResults.youtubeUrl,
        currentWorkflow.results.uploadResults.instagramUrl
      );

      completedSteps.push("sheets/update");
      currentWorkflow.completedSteps = completedSteps;

      logger.info("✓ Google Sheet updated with live links");
    } else {
      logger.info("⏩ Sheet update skipped (already completed)");
    }

    // Step 11: Send success notification email
    logger.info("→ Step 11: Sending success notification");
    currentWorkflow.currentStep = "email/success";
    await sendSuccessNotification(
      taskData,
      currentWorkflow.results.uploadResults
    );
    logger.info("✓ Success notification sent");

    // Step 12: Cleanup media folders and checkpoints
    logger.info("→ Step 12: Cleaning up media folders and checkpoints");
    currentWorkflow.currentStep = "cleanup";
    await cleanupAllMediaFolders();

    // Remove checkpoint file after successful completion
    const checkpointPath = path.join(
      "temp/checkpoints",
      `checkpoint_${taskId}.json`
    );
    if (fs.existsSync(checkpointPath)) {
      fs.unlinkSync(checkpointPath);
      logger.info("✓ Checkpoint file removed");
    }

    logger.info("✓ Media folders cleaned");

    // Final status update
    currentWorkflow.status = "completed";
    currentWorkflow.currentStep = "finished";

    logger.info("🎉 Automated workflow completed successfully!");
    logger.info(
      `📺 YouTube: ${currentWorkflow.results.uploadResults.youtubeUrl}`
    );
    logger.info(
      `📱 Instagram: ${currentWorkflow.results.uploadResults.instagramUrl}`
    );
  } catch (error) {
    logger.error("❌ Automated workflow failed:", error);

    currentWorkflow.status = "error";
    currentWorkflow.error = error.message;

    // Save error checkpoint for potential debugging
    if (taskData && currentWorkflow.taskId) {
      await saveCheckpoint(
        currentWorkflow.taskId,
        currentWorkflow.currentStep + "_ERROR",
        {
          ...currentWorkflow.results,
          error: error.message,
          stack: error.stack,
        },
        taskData
      );
    }

    // Send error notification
    try {
      await sendErrorNotification(taskData, error, currentWorkflow.currentStep);
    } catch (emailError) {
      logger.error("Failed to send error notification:", emailError);
    }

    // If task data exists, update sheet with error status
    if (taskData) {
      try {
        await updateSheetStatus(taskData.rowId, "Error", "", "");
      } catch (sheetError) {
        logger.error("Failed to update sheet with error status:", sheetError);
      }
    }
  }
};

/**
 * Legacy manual workflow - for backwards compatibility
 */
const runWorkflow = async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    // Initialize workflow
    const taskId = Date.now().toString();
    currentWorkflow = {
      taskId,
      status: "running",
      currentStep: "script/generate",
      error: null,
      results: {},
      taskData: { idea: title, description: description || "" },
    };

    logger.info(`🚀 Starting manual workflow for: ${title}`);

    // Step 1: Generate script
    logger.info("→ Step 1: Generating script");
    const rawScript = await generateScript(title, description);
    const script = cleanLLMData.extractConversation(rawScript);

    if (!script || script.length < 100) {
      throw new Error("Generated script is too short or empty");
    }

    currentWorkflow.results.script = script;
    logger.info("✓ Script generated");

    // Step 2: Check for existing audio files
    logger.info("→ Step 2: Checking for existing audio files");
    let audioFiles;
    const existingAudioFiles = [];

    // Check for conversation audio file
    const audioDir = "audio";
    if (fs.existsSync(audioDir)) {
      const audioFilesList = fs.readdirSync(audioDir);
      const conversationFiles = audioFilesList.filter(
        (file) => file.startsWith("conversation_") && file.endsWith(".wav")
      );

      if (conversationFiles.length > 0) {
        const latestAudio = conversationFiles.sort().pop();
        existingAudioFiles.push({
          conversationFile: path.resolve(path.join(audioDir, latestAudio)),
        });
      }
    }

    if (existingAudioFiles.length > 0) {
      logger.info("✅ Audio file already exists, skipping generation");
      audioFiles = existingAudioFiles[0];
    } else {
      logger.info("🎤 No existing audio found, generating new audio");
      currentWorkflow.currentStep = "audio/generate";
      audioFiles = await generateAudioWithBatchingStrategy(script);
    }

    currentWorkflow.results.audioFiles = audioFiles;
    logger.info("✓ Audio ready");

    // Step 3: Get base video
    logger.info("→ Step 3: Getting base video");
    currentWorkflow.currentStep = "video/base";
    const baseVideoPath = await getBaseVideo();
    currentWorkflow.results.baseVideoPath = baseVideoPath;
    logger.info("✓ Base video retrieved");

    // Step 4: Check for existing images
    logger.info("→ Step 4: Checking for existing images");
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

    // Step 5: Assemble video
    logger.info("→ Step 5: Assembling final video");
    currentWorkflow.currentStep = "video/assemble";
    const finalVideo = await assembleVideo(
      baseVideoPath,
      images,
      audioFiles,
      script
    );
    currentWorkflow.results.finalVideo = finalVideo;
    logger.info("✓ Video assembled");

    // Complete workflow
    currentWorkflow.status = "completed";
    currentWorkflow.currentStep = "completed";
    logger.info(`🎉 Workflow completed successfully: ${finalVideo}`);

    res.json({
      success: true,
      taskId,
      result: {
        script: script.substring(0, 200) + "...",
        audioGenerated: !!audioFiles.conversationFile,
        imagesCount: images.length,
        baseVideoFound: !!baseVideoPath,
        finalVideo: finalVideo,
      },
    });
  } catch (error) {
    logger.error("❌ Manual workflow failed:", error.message);
    currentWorkflow.status = "error";
    currentWorkflow.error = error.message;

    res.status(500).json({
      success: false,
      error: error.message,
      step: currentWorkflow.currentStep,
    });
  }
};

/**
 * Get current workflow status
 */
const getWorkflowStatus = async (req, res) => {
  res.json({
    success: true,
    workflow: {
      taskId: currentWorkflow.taskId,
      status: currentWorkflow.status,
      currentStep: currentWorkflow.currentStep,
      error: currentWorkflow.error,
      taskData: currentWorkflow.taskData
        ? {
            idea: currentWorkflow.taskData.idea,
            sno: currentWorkflow.taskData.sno,
            rowId: currentWorkflow.taskData.rowId,
          }
        : null,
      progress: getProgressInfo(currentWorkflow.currentStep),
      results: {
        scriptGenerated: !!currentWorkflow.results.script,
        audioGenerated: !!currentWorkflow.results.audioFiles,
        imagesGenerated: currentWorkflow.results.images?.length || 0,
        subtitlesCreated: !!currentWorkflow.results.subtitles,
        videoComposed: !!currentWorkflow.results.finalVideo,
        socialMediaUploaded: !!currentWorkflow.results.uploadResults,
        sheetUpdated: currentWorkflow.currentStep === "finished",
        cleaned: currentWorkflow.currentStep === "finished",
      },
    },
  });
};

/**
 * Get progress information based on current step
 */
const getProgressInfo = (currentStep) => {
  const steps = {
    "sheets/fetch-task": {
      step: 1,
      total: 12,
      description: "Fetching task from Google Sheets",
    },
    "script/generate": {
      step: 2,
      total: 12,
      description: "Generating Q&A conversation script",
    },
    "audio/generate": {
      step: 3,
      total: 12,
      description: "Generating multi-speaker TTS audio",
    },
    "subtitles/generate": {
      step: 4,
      total: 12,
      description: "Creating timed subtitles",
    },
    "video/base": { step: 5, total: 12, description: "Getting base video" },
    "images/generate": {
      step: 6,
      total: 12,
      description: "Generating contextual images",
    },
    "video/compose": {
      step: 7,
      total: 12,
      description: "Composing final video",
    },
    "video/optimize": {
      step: 8,
      total: 12,
      description: "Creating platform versions",
    },
    "social/upload": {
      step: 9,
      total: 12,
      description: "Uploading to social media",
    },
    "sheets/update": {
      step: 10,
      total: 12,
      description: "Updating Google Sheet",
    },
    "email/success": {
      step: 11,
      total: 12,
      description: "Sending notification",
    },
    cleanup: { step: 12, total: 12, description: "Cleaning up files" },
    finished: { step: 12, total: 12, description: "Workflow completed" },
    error: {
      step: -1,
      total: 12,
      description: "Workflow encountered an error",
    },
    completed: {
      step: 12,
      total: 12,
      description: "Workflow completed successfully",
    },
    "video/assemble": {
      step: 7,
      total: 12,
      description: "Assembling final video",
    },
  };

  return (
    steps[currentStep] || { step: 0, total: 12, description: "Unknown step" }
  );
};

/**
 * Legacy video assembly function for manual workflow
 */
const assembleVideo = async (baseVideoPath, images, audioFiles, script) => {
  const outputPath = `videos/final_${Date.now()}.mp4`;
  const subtitlesPath = `subtitles/subtitles_${Date.now()}.srt`;

  // Create SRT subtitle file
  createSubtitlesFile(script, subtitlesPath);

  // Handle base video path
  if (!fs.existsSync(baseVideoPath)) {
    throw new Error(`Base video file not found: ${baseVideoPath}`);
  }

  // Prepare audio
  const combinedAudioPath = "temp/combined_audio.mp3";
  await combineAudioFiles(audioFiles, combinedAudioPath);

  return new Promise((resolve, reject) => {
    let command = ffmpeg(baseVideoPath)
      .input(combinedAudioPath)
      .audioCodec("aac")
      .videoCodec("libx264");

    // Add images as overlays with improved positioning and timing
    images.forEach((image, index) => {
      const startTime = index * 15; // Show each image for 15 seconds
      command = command.input(image.filename);
    });

    // Create filter complex for image overlays in upper portion
    let filterComplex = "";
    images.forEach((image, index) => {
      const inputIndex = index + 2; // +2 because input 0 is video, input 1 is audio
      const startTime = index * 15;
      const endTime = startTime + 15;

      if (index === 0) {
        filterComplex += `[0:v][${inputIndex}:v]overlay=W*0.1:H*0.1:enable='between(t,${startTime},${endTime})'[v${index}];`;
      } else {
        filterComplex += `[v${
          index - 1
        }][${inputIndex}:v]overlay=W*0.1:H*0.1:enable='between(t,${startTime},${endTime})'[v${index}];`;
      }
    });

    // Add improved subtitles with black background and white bold font
    const lastVideoOutput = `[v${images.length - 1}]`;
    filterComplex += `${lastVideoOutput}subtitles=${subtitlesPath}:force_style='FontName=Poppins-Bold,FontSize=20,PrimaryColour=&Hffffff,BackColour=&H80000000,Bold=1,Alignment=2'[vout]`;

    command = command
      .complexFilter(filterComplex)
      .outputOptions(["-map", "[vout]", "-map", "1:a"])
      .output(outputPath)
      .on("end", () => {
        logger.info(`✓ Final video created: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (error) => {
        logger.error("Video assembly error:", error);
        reject(error);
      })
      .run();
  });
};

/**
 * Combine audio files function for legacy workflow
 */
const combineAudioFiles = async (audioFiles, outputPath) => {
  logger.info("→ Preparing audio for video assembly");

  // Check if audioFiles is the new single-file format
  if (audioFiles && audioFiles.conversationFile) {
    logger.info(
      `→ Using single conversation file: ${audioFiles.conversationFile}`
    );

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

      audioFiles.forEach((audioFile) => {
        ffmpegCommand = ffmpegCommand.input(audioFile.file);
      });

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

module.exports = {
  runAutomatedWorkflow,
  runWorkflow,
  getWorkflowStatus,
};
