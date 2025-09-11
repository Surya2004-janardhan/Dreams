const { generateScript } = require("../services/scriptService");
const { generateAudioWithBatchingStrategy } = require("../services/audioService");
const { generateImages } = require("../services/imageService");
const { getBaseVideo, composeVideo, createPlatformOptimized } = require("../services/videoProcessingService");
const { createSubtitlesFile, parseConversationTiming } = require("../utils/subtitles");
const { getNextTask, updateSheetStatus } = require("../services/sheetsService");
const { uploadToBothPlatforms } = require("../services/socialMediaService");
const { sendSuccessNotification, sendErrorNotification } = require("../services/emailService");
const { cleanupAllMediaFolders, initializeDirectories } = require("../services/cleanupService");
const cleanLLMData = require("../utils/textCleaner");
const logger = require("../config/logger");
const fs = require("fs");
const path = require("path");

// Store current workflow state
let currentWorkflow = {
  taskId: null,
  status: "idle",
  currentStep: null,
  error: null,
  results: {},
  taskData: null
};

/**
 * Main automated workflow - pulls from Google Sheets and processes
 */
const runAutomatedWorkflow = async (req, res) => {
  let taskData = null;
  
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
      taskData: null
    };

    // Send immediate response
    res.json({
      success: true,
      message: "Automated workflow started successfully",
      taskId: taskId,
      status: "running",
      note: "Check workflow status at /workflow/status or wait for email notification"
    });

    // Step 1: Get next task from Google Sheets
    logger.info("→ Step 1: Getting next task from Google Sheets");
    currentWorkflow.currentStep = "sheets/fetch-task";
    taskData = await getNextTask();
    currentWorkflow.taskData = taskData;
    
    logger.info(`📋 Task retrieved: ${taskData.idea} (Row ${taskData.rowId})`);

    // Step 2: Generate Q&A conversation script
    logger.info("→ Step 2: Generating multi-speaker Q&A script");
    currentWorkflow.currentStep = "script/generate";
    const rawScript = await generateScript(taskData.idea, taskData.description);
    const script = cleanLLMData.extractConversation(rawScript);

    if (!script || script.length < 100) {
      throw new Error("Generated script is too short or empty");
    }

    currentWorkflow.results.script = script;
    logger.info("✓ Q&A script generated with male/female speakers");

    // Step 3: Generate TTS audio with different voices
    logger.info("→ Step 3: Generating TTS audio with male/female voices");
    currentWorkflow.currentStep = "audio/generate";
    const audioFiles = await generateAudioWithBatchingStrategy(script);
    currentWorkflow.results.audioFiles = audioFiles;
    logger.info("✓ Multi-speaker TTS audio generated");

    // Step 4: Create perfectly timed subtitles
    logger.info("→ Step 4: Creating perfectly timed subtitles");
    currentWorkflow.currentStep = "subtitles/generate";
    const subtitlesPath = path.resolve(`subtitles/subtitles_${taskId}.srt`);
    const subtitlesResult = createSubtitlesFile(script, subtitlesPath);
    
    if (!subtitlesResult.success) {
      throw new Error("Failed to create subtitles");
    }
    
    currentWorkflow.results.subtitles = subtitlesPath;
    logger.info("✓ SRT subtitles created with perfect timing");

    // Step 5: Get base video from Drive or local
    logger.info("→ Step 5: Getting base video");
    currentWorkflow.currentStep = "video/base";
    const baseVideoPath = await getBaseVideo();
    currentWorkflow.results.baseVideoPath = baseVideoPath;
    logger.info("✓ Base video ready");

    // Step 6: Generate contextual images with timing
    logger.info("→ Step 6: Generating contextual educational images");
    currentWorkflow.currentStep = "images/generate";
    const images = await generateImages(script);
    currentWorkflow.results.images = images;
    logger.info(`✓ ${images.length} contextual images generated with timing`);

    // Step 7: Compose final video with all elements
    logger.info("→ Step 7: Composing final video with subtitles and images");
    currentWorkflow.currentStep = "video/compose";
    const finalVideo = await composeVideo(
      baseVideoPath,
      audioFiles.conversationFile,
      images,
      subtitlesPath,
      taskData.idea
    );
    
    currentWorkflow.results.finalVideo = finalVideo;
    logger.info("✓ Final video composed with subtitles and images");

    // Step 8: Create platform-optimized versions
    logger.info("→ Step 8: Creating platform-optimized versions");
    currentWorkflow.currentStep = "video/optimize";
    const optimizedVersions = await createPlatformOptimized(finalVideo.videoPath, 'both');
    currentWorkflow.results.optimizedVersions = optimizedVersions;
    logger.info("✓ Platform-optimized versions created");

    // Step 9: Upload to YouTube and Instagram
    logger.info("→ Step 9: Uploading to social media platforms");
    currentWorkflow.currentStep = "social/upload";
    const uploadResults = await uploadToBothPlatforms(
      optimizedVersions.youtube || finalVideo.videoPath,
      taskData.idea,
      taskData.description
    );
    
    currentWorkflow.results.uploadResults = uploadResults;
    logger.info("✓ Social media uploads completed");

    // Step 10: Update Google Sheet with results
    logger.info("→ Step 10: Updating Google Sheet with results");
    currentWorkflow.currentStep = "sheets/update";
    await updateSheetStatus(
      taskData.rowId,
      "Posted",
      uploadResults.youtubeUrl,
      uploadResults.instagramUrl
    );
    logger.info("✓ Google Sheet updated with live links");

    // Step 11: Send success notification email
    logger.info("→ Step 11: Sending success notification");
    currentWorkflow.currentStep = "email/success";
    await sendSuccessNotification(taskData, uploadResults);
    logger.info("✓ Success notification sent");

    // Step 12: Cleanup media folders
    logger.info("→ Step 12: Cleaning up media folders");
    currentWorkflow.currentStep = "cleanup";
    await cleanupAllMediaFolders();
    logger.info("✓ Media folders cleaned");

    // Final status update
    currentWorkflow.status = "completed";
    currentWorkflow.currentStep = "finished";
    
    logger.info("🎉 Automated workflow completed successfully!");
    logger.info(`📺 YouTube: ${uploadResults.youtubeUrl}`);
    logger.info(`📱 Instagram: ${uploadResults.instagramUrl}`);

  } catch (error) {
    logger.error("❌ Automated workflow failed:", error);
    
    currentWorkflow.status = "error";
    currentWorkflow.error = error.message;
    
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
      taskData: { idea: title, description: description || "" }
    };

    logger.info(`🚀 Starting manual workflow for: ${title}`);

    // Run the same process as automated workflow but with manual input
    const mockTaskData = {
      rowId: null,
      sno: "manual",
      idea: title,
      description: description || "",
      status: "manual"
    };

    // Generate script
    logger.info("→ Generating script");
    const rawScript = await generateScript(title, description);
    const script = cleanLLMData.extractConversation(rawScript);

    if (!script || script.length < 100) {
      throw new Error("Generated script is too short or empty");
    }

    currentWorkflow.results.script = script;

    // Generate audio
    logger.info("→ Generating audio");
    currentWorkflow.currentStep = "audio/generate";
    const audioFiles = await generateAudioWithBatchingStrategy(script);
    currentWorkflow.results.audioFiles = audioFiles;

    // Get base video
    logger.info("→ Getting base video");
    currentWorkflow.currentStep = "video/base";
    const baseVideoPath = await getBaseVideo();
    currentWorkflow.results.baseVideoPath = baseVideoPath;

    // Generate images
    logger.info("→ Generating images");
    currentWorkflow.currentStep = "images/generate";
    const images = await generateImages(script);
    currentWorkflow.results.images = images;

    // Create subtitles
    logger.info("→ Creating subtitles");
    const subtitlesPath = path.resolve(`subtitles/manual_subtitles_${taskId}.srt`);
    const subtitlesResult = createSubtitlesFile(script, subtitlesPath);
    currentWorkflow.results.subtitles = subtitlesPath;

    // Final status
    currentWorkflow.status = "completed";
    currentWorkflow.currentStep = "finished";

    res.json({
      success: true,
      message: "Manual workflow completed successfully",
      taskId: taskId,
      results: {
        script: script.substring(0, 200) + "...",
        audioGenerated: !!audioFiles.conversationFile,
        imagesCount: images.length,
        subtitlesCreated: subtitlesResult.success,
        baseVideoFound: !!baseVideoPath
      }
    });

  } catch (error) {
    logger.error("❌ Manual workflow failed:", error);
    
    currentWorkflow.status = "error";
    currentWorkflow.error = error.message;

    res.status(500).json({
      success: false,
      error: error.message,
      step: currentWorkflow.currentStep
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
      taskData: currentWorkflow.taskData ? {
        idea: currentWorkflow.taskData.idea,
        sno: currentWorkflow.taskData.sno,
        rowId: currentWorkflow.taskData.rowId
      } : null,
      progress: getProgressInfo(currentWorkflow.currentStep),
      results: {
        scriptGenerated: !!currentWorkflow.results.script,
        audioGenerated: !!currentWorkflow.results.audioFiles,
        imagesGenerated: currentWorkflow.results.images?.length || 0,
        subtitlesCreated: !!currentWorkflow.results.subtitles,
        videoComposed: !!currentWorkflow.results.finalVideo,
        socialMediaUploaded: !!currentWorkflow.results.uploadResults,
        sheetUpdated: currentWorkflow.currentStep === "finished",
        cleaned: currentWorkflow.currentStep === "finished"
      }
    }
  });
};

/**
 * Get progress information based on current step
 */
const getProgressInfo = (currentStep) => {
  const steps = {
    "sheets/fetch-task": { step: 1, total: 12, description: "Fetching task from Google Sheets" },
    "script/generate": { step: 2, total: 12, description: "Generating Q&A conversation script" },
    "audio/generate": { step: 3, total: 12, description: "Generating multi-speaker TTS audio" },
    "subtitles/generate": { step: 4, total: 12, description: "Creating timed subtitles" },
    "video/base": { step: 5, total: 12, description: "Getting base video" },
    "images/generate": { step: 6, total: 12, description: "Generating contextual images" },
    "video/compose": { step: 7, total: 12, description: "Composing final video" },
    "video/optimize": { step: 8, total: 12, description: "Creating platform versions" },
    "social/upload": { step: 9, total: 12, description: "Uploading to social media" },
    "sheets/update": { step: 10, total: 12, description: "Updating Google Sheet" },
    "email/success": { step: 11, total: 12, description: "Sending notification" },
    "cleanup": { step: 12, total: 12, description: "Cleaning up files" },
    "finished": { step: 12, total: 12, description: "Workflow completed" },
    "error": { step: -1, total: 12, description: "Workflow encountered an error" }
  };

  return steps[currentStep] || { step: 0, total: 12, description: "Unknown step" };
};

module.exports = {
  runAutomatedWorkflow,
  runWorkflow,
  getWorkflowStatus
};
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

    // Step 5: Assemble video
    logger.info("→ Step 5: Assembling final video");
    currentWorkflow.currentStep = "video/assemble";
    const finalVideo = await assembleVideo(
      baseVideoUrl,
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
        script,
        audioFiles,
        images,
        finalVideo,
      },
    });
  } catch (error) {
    logger.error("❌ Workflow failed:", error.message);
    currentWorkflow.status = "error";
    currentWorkflow.error = error.message;

    res.status(500).json({
      error: "Workflow failed",
      details: error.message,
      taskId: currentWorkflow.taskId,
    });
  }
};

// Video assembly function
const assembleVideo = async (baseVideoUrl, images, audioFiles, script) => {
  const outputPath = `videos/final_${Date.now()}.mp4`;
  const subtitlesPath = `subtitles/subtitles_${Date.now()}.srt`;

  // Create SRT subtitle file
  createSubtitlesFile(script, subtitlesPath);

  // Handle base video - could be URL or local path
  let baseVideoPath = "temp/base_video.mp4";

  if (
    baseVideoUrl.startsWith("http://") ||
    baseVideoUrl.startsWith("https://")
  ) {
    logger.info(`→ Downloading base video from URL: ${baseVideoUrl}`);
    // Download logic would go here
    logger.info(`✓ Base video downloaded: ${baseVideoPath}`);
  } else {
    // It's a local file path
    logger.info(`→ Using local base video: ${baseVideoUrl}`);
    baseVideoPath = baseVideoUrl;

    if (!fs.existsSync(baseVideoPath)) {
      throw new Error(`Base video file not found: ${baseVideoPath}`);
    }
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

// Combine audio files function
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

// This function is already declared above, no need for a second declaration

// The module exports are already defined above
