const { generateScript } = require("../services/scriptService");
const {
  generateAudioWithBatchingStrategy,
} = require("../services/audioService");
const { generateTitleImage } = require("../services/imageService");
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
// const VideoPostingService = require("../services/videoPostingService");
const {
  sendSuccessNotification,
  sendErrorNotification,
  sendStatusUpdate,
} = require("../services/emailService");
const {
  cleanupAllMediaFolders,
  initializeDirectories,
  cleanupRootDirectory,
  cleanupOnError,
} = require("../services/cleanupService");
const cleanLLMData = require("../utils/textCleaner");
const logger = require("../config/logger");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
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

    // Step 5: Generate title image
    logger.info("🖼️ Step 5: Generating title image");
    currentWorkflow.currentStep = "images/generate";

    let images = [];
    try {
      // Generate single title image from the idea/title
      const titleImageResult = await generateTitleImage(taskData.idea);

      if (titleImageResult.success && titleImageResult.imagePath) {
        logger.info(
          `✓ Title image generated successfully: ${titleImageResult.imagePath}`
        );
        logger.info(`📝 Used fallback: ${titleImageResult.usedDefault}`);

        // Create image structure for video processing (single image, stays throughout video)
        images = [
          {
            index: 1,
            filename: titleImageResult.imagePath,
            concept: taskData.idea,
            timing: {
              startTime: 0, // Start from beginning
              endTime: 59, // Stay until end of video (59 seconds for Instagram limit)
            },
          },
        ];
      } else {
        throw new Error(titleImageResult.error || "Image generation failed");
      }
    } catch (error) {
      logger.warn(`⚠️ Title image generation failed: ${error.message}`);
      logger.info(
        "🔄 Trying to use an image from images folder as fallback..."
      );

      // Try to use any image from images folder
      const imagesDir = path.join(__dirname, "../../images");
      let fallbackImagePath = null;
      if (fs.existsSync(imagesDir)) {
        const imageFiles = fs
          .readdirSync(imagesDir)
          .filter((f) => f.match(/\.(jpg|jpeg|png)$/i));
        if (imageFiles.length > 0) {
          // Use the most recent image (by mtime)
          const sorted = imageFiles
            .map((f) => ({
              file: f,
              mtime: fs.statSync(path.join(imagesDir, f)).mtime.getTime(),
            }))
            .sort((a, b) => b.mtime - a.mtime);
          fallbackImagePath = path.join(imagesDir, sorted[0].file);
          logger.info(`✓ Using image from images folder: ${fallbackImagePath}`);
        }
      }
      if (fallbackImagePath && fs.existsSync(fallbackImagePath)) {
        images = [
          {
            index: 1,
            filename: fallbackImagePath,
            concept: taskData.idea,
            timing: {
              startTime: 0,
              endTime: 59,
            },
          },
        ];
        logger.info("✓ Fallback image from images folder set");
      } else {
        // Use default image as last resort
        const defaultImagePath = path.join("videos", "default-image.jpg");
        if (fs.existsSync(defaultImagePath)) {
          images = [
            {
              index: 1,
              filename: defaultImagePath,
              concept: taskData.idea,
              timing: {
                startTime: 0,
                endTime: 59,
              },
            },
          ];
          logger.info("✓ Default image set as fallback");
        } else {
          logger.warn("⚠️ No fallback image available");
          images = [];
        }
      }
    }

    currentWorkflow.results.images = images;
    logger.info(`📸 Using ${images.length} image(s) for video composition`);

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

    logger.info("✓ Video merged successfully");
    logger.info(`📁 Final video stored at: ${finalVideo.videoPath}`);

    // Step 7: Upload to platforms
    logger.info("📤 Step 7: Uploading to platforms");
    currentWorkflow.currentStep = "upload/platforms";

    // Use the video from final_video folder for uploads
    const uploadVideoPath = currentWorkflow.results.finalVideo;
    const uploadResult = await uploadToBothPlatforms(
      uploadVideoPath,
      taskData.idea,
      script
    );

    // Convert the result format to match expected structure
    const formattedUploadResult = {
      success:
        uploadResult.youtube?.success ||
        uploadResult.instagram?.success ||
        uploadResult.facebook?.success,
      successfulCount: [
        uploadResult.youtube,
        uploadResult.instagram,
        uploadResult.facebook,
      ].filter((r) => r?.success).length,
      totalCount: 3,
      youtube: uploadResult.youtube || {
        success: false,
        error: "Not attempted",
      },
      instagram: uploadResult.instagram || {
        success: false,
        error: "Not attempted",
      },
      facebook: uploadResult.facebook || {
        success: false,
        error: "Not attempted",
      },
      youtubeUrl: uploadResult.youtube?.url || "",
      instagramUrl: uploadResult.instagram?.url || "",
      facebookUrl: uploadResult.facebook?.url || "",
    };

    currentWorkflow.results.uploadResult = formattedUploadResult;

    // Check upload results and handle different scenarios
    const successfulUploads = uploadResult.successfulCount;
    const totalUploads = uploadResult.totalCount;

    logger.info(
      `📊 Upload Results: ${successfulUploads}/${totalUploads} platforms succeeded`
    );

    if (uploadResult.youtube.success) {
      logger.info(`📺 YouTube: ${uploadResult.youtubeUrl}`);
    } else {
      logger.warn(`📺 YouTube failed: ${uploadResult.youtube.error}`);
    }

    if (uploadResult.instagram.success) {
      logger.info(`📱 Instagram: ${uploadResult.instagramUrl}`);
    } else {
      logger.warn(`📱 Instagram failed: ${uploadResult.instagram.error}`);
    }

    if (uploadResult.facebook.success) {
      logger.info(`📘 Facebook: ${uploadResult.facebookUrl}`);
    } else {
      logger.warn(`📘 Facebook failed: ${uploadResult.facebook.error}`);
    }

    // Step 8: Mark as posted and update sheets (always attempt this)
    logger.info("📊 Step 8: Updating status and sheets");
    currentWorkflow.currentStep = "sheets/update";

    const updateTimestamp = new Date().toISOString();
    const youtubeUrl = uploadResult.youtubeUrl || "";
    const instagramUrl = uploadResult.instagramUrl || "";
    const facebookUrl = uploadResult.facebookUrl || "";

    // Always update sheets with whatever links we have (empty for failed uploads)
    await updateSheetStatus(
      taskData.rowId,
      "Posted",
      youtubeUrl,
      instagramUrl,
      facebookUrl
    );
    logger.info(
      `✓ Marked as "Posted" in sheets with ${successfulUploads} successful links and timestamp: ${updateTimestamp}`
    );

    // Handle different success scenarios
    if (uploadResult.success) {
      // ALL uploads succeeded - complete success
      logger.info(
        "🎉 COMPLETE SUCCESS: All 3 platforms uploaded successfully!"
      );
      currentWorkflow.status = "completed";

      // Step 9: Cleanup
      logger.info("🧹 Step 9: Cleaning up temporary files");
      await cleanupAllMediaFolders();
      logger.info("✓ Cleanup completed");

      // Step 10: Success notification
      logger.info("📧 Step 10: Sending success notification");
      await sendSuccessNotification(taskData, uploadResult);
      logger.info("✅ Success notification email sent");

      // Step 11: Clean final video folder
      logger.info("🧹 Step 11: Cleaning final video folder");
      const { cleanupFinalVideoFolder } = require("../services/cleanupService");
      await cleanupFinalVideoFolder();
      logger.info("✓ Final video folder cleanup completed");
    } else if (uploadResult.partialSuccess) {
      // PARTIAL success - some succeeded, some failed
      logger.info(
        `⚠️ PARTIAL SUCCESS: ${successfulUploads}/${totalUploads} platforms succeeded`
      );
      currentWorkflow.status = "partial_success";
      currentWorkflow.error = `Partial upload success: ${successfulUploads}/${totalUploads} platforms`;

      // Keep Supabase video for potential retry
      logger.info(
        "📁 Keeping Supabase video for potential retry of failed uploads"
      );

      // Send semi-success notification
      logger.info("📧 Sending semi-success notification");
      await sendErrorNotification(
        taskData,
        new Error(
          `PARTIAL SUCCESS: ${successfulUploads}/${totalUploads} uploads succeeded. YouTube: ${
            uploadResult.youtube.success
              ? "Success"
              : uploadResult.youtube.error
          }, Instagram: ${
            uploadResult.instagram.success
              ? "Success"
              : uploadResult.instagram.error
          }, Facebook: ${
            uploadResult.facebook.success
              ? "Success"
              : uploadResult.facebook.error
          }`
        ),
        currentWorkflow.currentStep
      );
      logger.info("✅ Semi-success notification sent");
    } else {
      // ALL uploads failed
      logger.error("❌ ALL UPLOADS FAILED: No platforms succeeded");
      currentWorkflow.status = "failed";
      currentWorkflow.error = "All uploads failed";

      // Keep Supabase video for retry
      logger.info("📁 Keeping Supabase video for retry of all failed uploads");

      // Emergency cleanup (but keep Supabase video)
      await cleanupOnError();

      // Send error notification
      await sendErrorNotification(
        taskData,
        new Error(
          `ALL FAILED: YouTube: ${uploadResult.youtube.error}, Instagram: ${uploadResult.instagram.error}, Facebook: ${uploadResult.facebook.error}`
        ),
        currentWorkflow.currentStep
      );
      throw new Error("All uploads failed");
    }
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

    // Note: Error notification is already sent by runCompleteWorkflow
    // No need to send duplicate notification here
    logger.info("ℹ️ Error notification already sent by runCompleteWorkflow");

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

    try {
      taskData = await getNextTask();
      logger.info(
        `📋 Task retrieved: ${taskData.idea} (Row ${taskData.rowId})`
      );
    } catch (taskError) {
      if (taskError.message.includes("No 'Not Posted' tasks found")) {
        logger.info("📋 No tasks available for processing");

        // Send immediate response
        res.json({
          success: true,
          message: "No tasks available for processing",
          status: "completed",
          note: "All tasks have been processed. Add new tasks to continue.",
        });

        // Send helpful status update
        await sendStatusUpdate(
          "No Tasks Available",
          "The automated workflow checked for tasks but found none marked as 'Not Posted'. All current tasks have been processed successfully.",
          {
            "Checked At": new Date().toLocaleString(),
            "Next Steps":
              "Add new content ideas to your Google Sheet with status 'Not Posted'",
          }
        );

        return; // Exit early
      } else {
        // Re-throw other errors
        throw taskError;
      }
    }

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
    } else {
      // Send error notification even without task data
      const fallbackTaskData = {
        idea: "Automated Workflow Error",
        description: "Error occurred before task retrieval",
        sno: "N/A",
        rowId: "N/A",
      };
      await sendErrorNotification(
        fallbackTaskData,
        error,
        "automated-workflow"
      );

      // Also send a status update notification
      await sendStatusUpdate(
        "No Tasks Available",
        "The automated workflow checked for tasks but found none marked as 'Not Posted'. Please add new tasks to the Google Sheet.",
        {
          "Checked At": new Date().toLocaleString(),
          Suggestion:
            "Add new content ideas to your Google Sheet with status 'Not Posted'",
        }
      );
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

    // Add improved subtitles with black background and yellow bold BalsamiqSans-Bold font
    const lastVideoOutput = `[v${images.length - 1}]`;
    const fontFilePath = path.resolve("fonts/BalsamiqSans-Bold.ttf");
    const safeFontPath = fontFilePath
      .replace(/\\/g, "\\\\")
      .replace(/:/g, "\\:");
    const safeSubtitlesPath = subtitlesPath
      .replace(/\\/g, "\\\\")
      .replace(/:/g, "\\:")
      .replace(/'/g, "\\'");
    filterComplex += `${lastVideoOutput}subtitles='${safeSubtitlesPath}':force_style='FontFile=${safeFontPath},FontSize=13,PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,BorderStyle=3,BackColour=&H80000000,Bold=1,Alignment=2,MarginV=125,Outline=3,Spacing=0'[vout]`;

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
