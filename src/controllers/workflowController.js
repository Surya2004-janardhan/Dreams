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
  createSubtitlesFromAudio,
} = require("../utils/subtitles");
const { getNextTask, updateSheetStatus } = require("../services/sheetsService");
const {
  uploadToYouTube,
  uploadToInstagram,
  uploadToBothPlatforms,
  generateSocialMediaContent,
  uploadToYouTubeOAuth2,
} = require("../services/socialMediaService");
const {
  sendSuccessNotification,
  sendErrorNotification,
} = require("../services/emailService");
const {
  cleanupAllMediaFolders,
  initializeDirectories,
  cleanupRootDirectory,
} = require("../services/cleanupService");
const cleanLLMData = require("../utils/textCleaner");
const logger = require("../config/logger");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");

/**
 * Clean up all generated files on error
 */
const cleanupOnError = async () => {
  try {
    logger.info("🧹 Starting emergency cleanup due to error...");

    const folders = ["audio", "images", "subtitles", "temp", "scripts"];

    for (const folder of folders) {
      if (fs.existsSync(folder)) {
        const files = fs.readdirSync(folder);
        for (const file of files) {
          try {
            const filePath = path.join(folder, file);
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
              fs.unlinkSync(filePath);
              logger.info(`🗑️ Deleted: ${filePath}`);
            }
          } catch (error) {
            logger.error(`Failed to delete ${file}:`, error.message);
          }
        }
      }
    }

    // Clean videos folder but preserve base video
    if (fs.existsSync("videos")) {
      const files = fs.readdirSync("videos");
      for (const file of files) {
        if (!file.toLowerCase().includes("base")) {
          try {
            const filePath = path.join("videos", file);
            const stat = fs.statSync(filePath);
            if (stat.isFile()) {
              fs.unlinkSync(filePath);
              logger.info(`🗑️ Deleted: ${filePath}`);
            }
          } catch (error) {
            logger.error(`Failed to delete ${file}:`, error.message);
          }
        }
      }
    }

    // Clean root directory but preserve final video copies
    await cleanupRootDirectory();

    logger.info("✅ Emergency cleanup completed");
  } catch (error) {
    logger.error("❌ Emergency cleanup failed:", error);
  }
};

// Store current workflow state (no checkpoints)
let currentWorkflow = {
  taskId: null,
  status: "idle",
  currentStep: null,
  error: null,
  results: {},
  taskData: null,
};

/**
 * Run the complete workflow from start to finish
 */
const runCompleteWorkflow = async (taskData) => {
  const taskId = Date.now().toString();
  currentWorkflow = {
    taskId,
    status: "running",
    currentStep: "script/generate",
    error: null,
    results: {},
    taskData: taskData,
  };

  try {
    logger.info(`🚀 Starting complete workflow for: ${taskData.idea}`);

    // Step 1: Generate script
    logger.info("📝 Step 1: Generating script");
    currentWorkflow.currentStep = "script/generate";
    const rawScript = await generateScript(taskData.idea, taskData.description);
    const script = cleanLLMData.extractConversation(rawScript);
    currentWorkflow.results.script = script;

    // Save script to scripts folder
    const scriptFileName = `script_${taskId}.txt`;
    const scriptFilePath = path.join("scripts", scriptFileName);
    fs.writeFileSync(scriptFilePath, script);
    currentWorkflow.results.scriptFilePath = scriptFilePath;
    logger.info(`✓ Script generated and saved`);

    // Step 2: Generate audio
    logger.info("🎵 Step 2: Generating audio");
    currentWorkflow.currentStep = "audio/generate";
    const audioFiles = await generateAudioWithBatchingStrategy(script);
    currentWorkflow.results.audioFiles = audioFiles;
    logger.info("✓ Audio generated");

    // Step 3: Generate subtitles
    logger.info("📝 Step 3: Generating subtitles");
    currentWorkflow.currentStep = "subtitles/generate";
    const subtitlesResult = await createSubtitlesFromAudio(
      audioFiles.conversationFile
    );
    const subtitlesPath = subtitlesResult.subtitlesPath;
    currentWorkflow.results.subtitles = subtitlesPath;
    logger.info("✓ Subtitles generated");

    // Step 4: Generate image prompts
    logger.info("🤖 Step 4: Generating image prompts");
    currentWorkflow.currentStep = "images/prompts";

    // Step 5: Generate images
    logger.info("🖼️ Step 5: Generating images");
    currentWorkflow.currentStep = "images/generate";
    const images = await generateImages(subtitlesPath);
    currentWorkflow.results.images = images;
    logger.info(`✓ ${images.length} images generated`);

    // Step 6: Merge video
    logger.info("🎬 Step 6: Merging video");
    currentWorkflow.currentStep = "video/merge";

    // Get base video for merging
    const baseVideoPath = await getBaseVideo();
    currentWorkflow.results.baseVideoPath = baseVideoPath;

    const finalVideo = await composeVideo(
      baseVideoPath,
      audioFiles.conversationFile,
      images,
      subtitlesPath,
      taskData.idea
    );
    currentWorkflow.results.finalVideo = finalVideo.videoPath;
    currentWorkflow.results.rootCopyPath = finalVideo.rootCopyPath;
    logger.info("✓ Video merged successfully");
    logger.info(`📋 Root copy available at: ${finalVideo.rootCopyPath}`);

    // Step 7: Upload to platforms
    logger.info("📤 Step 7: Uploading to platforms");
    currentWorkflow.currentStep = "upload/platforms";
    const uploadResult = await uploadToBothPlatforms(
      finalVideo.videoPath,
      taskData.idea,
      script
    );
    currentWorkflow.results.uploadResult = uploadResult;

    // Check if upload was successful - if both fail, stop the workflow
    if (!uploadResult.success) {
      logger.error("❌ Upload to platforms failed:", uploadResult);
      currentWorkflow.status = "failed";
      currentWorkflow.error = "Upload to platforms failed";

      // Emergency cleanup on upload failure
      await cleanupOnError();

      // Send error notification for upload failure
      await sendErrorNotification(
        taskData,
        new Error("Upload to platforms failed"),
        currentWorkflow.currentStep
      );
      throw new Error("Upload to platforms failed");
    }

    logger.info("✓ Uploaded to platforms");

    // Step 8: Mark as posted and update sheets
    logger.info("📊 Step 8: Updating status and sheets");
    currentWorkflow.currentStep = "sheets/update";

    // Determine status based on upload success
    const status = uploadResult.success ? "Posted" : "Upload Failed";
    const youtubeUrl = uploadResult.youtubeUrl || "";
    const instagramUrl = uploadResult.instagramUrl || "";

    await updateSheetStatus(taskData.rowId, status, youtubeUrl, instagramUrl);
    logger.info(`✓ Marked as "${status}" in sheets with links`);

    // Step 9: Cleanup
    logger.info("🧹 Step 9: Cleaning up temporary files");
    await cleanupAllMediaFolders();
    logger.info("✓ Cleanup completed");

    // Step 10: Success notification (only if uploads succeeded)
    if (uploadResult.success) {
      logger.info("📧 Step 10: Sending success notification");
      await sendSuccessNotification(taskData, finalVideo.videoPath);
      logger.info("✅ Success notification email sent");
    } else {
      logger.warn("⚠️ Skipping success notification due to upload failures");
    }

    currentWorkflow.status = "completed";
    logger.info("🎉 Workflow completed successfully!");
  } catch (error) {
    logger.error("❌ Workflow failed:", {
      error: error.message,
      stack: error.stack,
      currentStep: currentWorkflow.currentStep,
      taskId: currentWorkflow.taskId,
      taskIdea: taskData?.idea,
      taskDescription: taskData?.description,
      timestamp: new Date().toISOString(),
    });
    currentWorkflow.status = "failed";
    currentWorkflow.error = error.message;

    // Emergency cleanup on error
    await cleanupOnError();

    // Send error notification with current step information
    await sendErrorNotification(taskData, error, currentWorkflow.currentStep);
    throw error;
  }
};

/**
 * Main automated workflow - pulls from Google Sheets and processes with checkpoints
 */
const runAutomatedWorkflow = async (req, res) => {
  let taskData = null;

  try {
    logger.info("🚀 Starting automated content creation workflow...");

    // Initialize directories
    initializeDirectories();

    // Get next task from Google Sheets
    logger.info("📋 Getting next task from Google Sheets");
    taskData = await getNextTask();
    logger.info(`📋 Task retrieved: ${taskData.idea} (Row ${taskData.rowId})`);

    // Send immediate response
    res.json({
      success: true,
      message: "Automated workflow started successfully",
      taskId: Date.now().toString(),
      status: "running",
      note: "Check workflow status at /workflow/status or wait for email notification",
    });

    // Run the complete workflow
    await runCompleteWorkflow(taskData);
  } catch (error) {
    logger.error("❌ Automated workflow failed:", {
      error: error.message,
      stack: error.stack,
      taskId: taskData?.taskId,
      taskIdea: taskData?.idea,
      taskDescription: taskData?.description,
      timestamp: new Date().toISOString(),
    });

    // Emergency cleanup on error
    await cleanupOnError();

    // Send error notification if we have task data
    if (taskData) {
      await sendErrorNotification(taskData, error, "automated-workflow");
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
        (file) =>
          file.startsWith("conversation_") &&
          (file.endsWith(".wav") ||
            file.endsWith(".mp3") ||
            file.endsWith(".raw"))
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
      images = await generateImages(null, script);
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
    currentWorkflow.results.finalVideo = finalVideo.videoPath;
    currentWorkflow.results.rootCopyPath = finalVideo.rootCopyPath;
    logger.info("✓ Video assembled");
    logger.info(`📋 Root copy available at: ${finalVideo.rootCopyPath}`);

    // Complete workflow
    currentWorkflow.status = "completed";
    currentWorkflow.currentStep = "completed";
    logger.info(`🎉 Workflow completed successfully: ${finalVideo.videoPath}`);

    res.json({
      success: true,
      taskId,
      result: {
        script: script.substring(0, 200) + "...",
        audioGenerated: !!audioFiles.conversationFile,
        imagesCount: images.length,
        baseVideoFound: !!baseVideoPath,
        finalVideo: finalVideo.videoPath,
        rootCopyPath: finalVideo.rootCopyPath,
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

        // Save a copy to root directory
        const rootCopyPath = `final_video_${Date.now()}.mp4`;
        try {
          fs.copyFileSync(outputPath, rootCopyPath);
          logger.info(`📋 Root copy saved: ${rootCopyPath}`);
        } catch (copyError) {
          logger.error(`❌ Failed to save root copy:`, copyError.message);
        }

        resolve({
          videoPath: outputPath,
          rootCopyPath: rootCopyPath,
        });
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
  runCompleteWorkflow,
};
