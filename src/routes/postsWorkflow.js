const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const ffmpeg = require("fluent-ffmpeg");

const SocialMediaPostingService = require("../services/socialMediaPostingService");
const {
  getNextCarouselTask,
  updateCarouselSheetStatus,
} = require("../services/postsSheetService");
const {
  sendSuccessNotification,
  sendErrorNotification,
  sendCarouselPostNotification,
} = require("../services/emailService");
const {
  uploadCarouselImages,
  cleanupCarouselImages,
} = require("../services/supabaseCarouselService");
const logger = require("../config/logger");

/**
 * POST /posts-workflow
 * Automated carousel posting workflow - reads from sheet and posts to all platforms
 */
router.post("/", async (req, res) => {
  const startTime = Date.now();
  let taskData = null;
  let slideImages = [];
  let supabaseStoragePaths = [];

  try {
    logger.info("🚀 Starting Automated Posts Workflow...");

    // Step 1: Get next unposted task from posts sheet
    taskData = await getNextCarouselTask();

    if (!taskData) {
      const message = "No unposted carousel tasks found in sheet";
      logger.info(`ℹ️ ${message}`);
      return res.status(200).json({
        success: true,
        message,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info(
      `📋 Processing carousel task: "${taskData.title}" (Row ${taskData.rowIndex})`
    );

    // Validate task data - stop if data is incomplete
    logger.info(
      `📋 Task data validation: Title="${taskData.title}", Slide1="${taskData.slide1}", Slide2="${taskData.slide2}", Slide3="${taskData.slide3}"`
    );

    if (
      !taskData.title ||
      !taskData.slide1 ||
      !taskData.slide2 ||
      !taskData.slide3
    ) {
      const error = new Error(
        `Incomplete task data - Title: "${taskData.title}", Slides: "${taskData.slide1}", "${taskData.slide2}", "${taskData.slide3}"`
      );
      error.step = "Data Validation";
      throw error;
    }

    // Step 2: Generate 3 slides with text overlays
    logger.info("🎨 Step 2: Generating carousel slides...");
    try {
      slideImages = await generateCarouselSlides(taskData);
      logger.info(`📸 Generated ${slideImages.length} slides successfully`);
    } catch (slideError) {
      slideError.step = "Slide Generation";
      logger.error("❌ Slide generation failed:", slideError.message);
      throw slideError;
    }

    // Step 3: Upload images to Supabase and get public URLs
    let publicImageUrls = [];
    try {
      logger.info("☁️ Step 3: Uploading slides to Supabase storage...");
      const uploadResult = await uploadCarouselImages(
        slideImages,
        taskData.title
      );
      publicImageUrls = uploadResult.publicUrls;
      supabaseStoragePaths = uploadResult.uploadedPaths;
      logger.info(
        `☁️ Successfully uploaded ${publicImageUrls.length} images to Supabase`
      );
    } catch (uploadError) {
      uploadError.step = "Supabase Upload";
      logger.error("❌ Supabase upload failed:", uploadError.message);
      throw uploadError;
    }

    // Step 4: Prepare caption and hashtags
    const relevantHashtags = [
      "#technology",
      "#programming",
      "#coding",
      "#webdev",
      "#developer",
      "#software",
      "#tech",
      "#innovation",
      "#digital",
      "#automation",
    ];

    // Use title only as caption with hashtags
    const caption = `${taskData.title}

${relevantHashtags.join(" ")}`;

    // Step 5: Post carousel to all platforms using public URLs
    logger.info("📱 Step 5: Posting to social media platforms...");
    const postingService = new SocialMediaPostingService();
    const postResult = await postingService.postCarousel({
      title: taskData.title,
      slides: [taskData.slide1, taskData.slide2, taskData.slide3],
      imagePaths: publicImageUrls, // Use public URLs instead of local paths
      caption: caption,
      hashtags: relevantHashtags,
    });

    // Step 6: Check for any errors - STOP workflow if any platform fails
    const successfulPosts = [];
    const failedPosts = [];

    if (postResult.instagram?.success) successfulPosts.push("Instagram");
    else failedPosts.push("Instagram");

    if (postResult.facebook?.success) successfulPosts.push("Facebook");
    else failedPosts.push("Facebook");

    logger.info(`📊 Results: ${successfulPosts.length}/2 platforms succeeded`);

    // CRITICAL: If ANY platform failed, stop workflow and DO NOT update sheet
    if (failedPosts.length > 0) {
      const failureError = new Error(
        `Platform posting failed: ${failedPosts.join(", ")}`
      );
      failureError.step = "Platform Posting";
      failureError.details = {
        successfulPosts,
        failedPosts,
        postResult,
      };
      throw failureError;
    }

    // Update sheet only if ALL platforms succeeded
    logger.info("📝 Step 6: Updating sheet with results...");
    await updateCarouselSheetStatus(
      taskData.rowIndex,
      "Posted",
      postResult.instagram?.url || "",
      postResult.facebook?.url || ""
    );
    logger.info("✅ Sheet updated successfully");

    // Step 7: Clean up Supabase images after posting
    logger.info("☁️ Step 7: Cleaning up Supabase images...");
    try {
      await cleanupCarouselImages(supabaseStoragePaths);
      logger.info("✅ Supabase images cleaned up successfully");
    } catch (cleanupError) {
      logger.error(
        "❌ Failed to cleanup Supabase images:",
        cleanupError.message
      );
    }

    // Step 8: Send success notification
    // Step 8: Send carousel post notification with platform links
    logger.info("📧 Step 8: Sending carousel post notification...");
    await sendCarouselPostNotification(
      taskData,
      postResult,
      postResult.instagram?.url || null,
      postResult.facebook?.url || null
    );

    // Step 9: Clean up local slides
    logger.info("🧹 Step 9: Cleaning up local slide files...");
    await cleanupSlides(slideImages);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`✅ Posts workflow completed successfully in ${duration}s`);

    res.status(200).json({
      success: true,
      message: "Carousel workflow completed - ALL platforms succeeded",
      task: taskData,
      results: {
        allPlatformsSucceeded: true,
        postResult,
      },
      duration: `${duration}s`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("❌ Posts workflow failed:", {
      message: error.message || "Unknown error",
      stack: error.stack || "No stack trace",
      step: error.step || "Unknown step",
      details: error.details || {},
    });

    // DO NOT UPDATE SHEET ON FAILURE - Leave as is per user request
    logger.warn(
      "⚠️ Workflow failed - NOT updating sheet status (leaving as is)"
    );

    // Clean up local slides on error
    if (slideImages.length > 0) {
      logger.info("🧹 Cleaning up local slides due to error...");
      await cleanupSlides(slideImages);
    }

    // Clean up Supabase images on error
    if (supabaseStoragePaths.length > 0) {
      logger.info("☁️ Cleaning up Supabase images due to error...");
      try {
        await cleanupCarouselImages(supabaseStoragePaths);
        logger.info("✅ Supabase images cleaned up successfully");
      } catch (cleanupError) {
        logger.error(
          "❌ Failed to cleanup Supabase images:",
          cleanupError.message
        );
      }
    }

    // Send error email
    const errorMessage = `
🚨 Carousel Post Workflow Failed!

${taskData ? `Title: ${taskData.title}` : "No task data"}
Error: ${error.message}
Step: ${error.step || "Unknown"}

${
  error.details?.failedPosts
    ? `Failed Platforms: ${error.details.failedPosts.join(", ")}`
    : ""
}
${
  error.details?.successfulPosts
    ? `Successful Platforms: ${error.details.successfulPosts.join(", ")}`
    : ""
}

⚠️ IMPORTANT: Sheet status was NOT updated (left as is)
Generated Slides: ${slideImages.length}
${taskData ? `Row: ${taskData.rowIndex}` : ""}
Timestamp: ${new Date().toISOString()}
    `.trim();

    try {
      await sendErrorNotification(
        taskData,
        error,
        error.step || "Posts Workflow"
      );
    } catch (emailError) {
      logger.error("❌ Error notification failed:", emailError.message);
    }

    res.status(500).json({
      success: false,
      error: error.message,
      step: error.step || "Unknown",
      sheetStatus: "NOT_UPDATED",
      task: taskData,
      details: error.details || {},
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Generate 3 carousel slides with optimized text overlays using exact test_slide_generation.js logic
 * @param {Object} taskData - Task data with title, slide1, slide2, slide3
 * @returns {Promise<Array>} - Array of generated image paths
 */
const generateCarouselSlides = async (taskData) => {
  const slidesDir = path.join(__dirname, "../../slides");

  logger.info(`🎨 Starting optimized slide generation for: ${taskData.title}`);
  logger.info(`📄 Using base image: Post-Base-Image.png from videos folder`);
  logger.info(`🎨 Title style: 57px Arial Black grey with 9% margins`);
  logger.info(
    `📝 Content style: 54px IBM Plex black with 9% margins and justification`
  );

  // Ensure slides directory exists
  if (!fs.existsSync(slidesDir)) {
    fs.mkdirSync(slidesDir, { recursive: true });
    logger.info("📁 Created slides directory");
  }

  const baseImagePath = path.join(
    __dirname,
    "../../videos/Post-Base-Image.png"
  );

  if (!fs.existsSync(baseImagePath)) {
    throw new Error(`Base image not found: ${baseImagePath}`);
  }

  const slidePaths = [];
  const timestamp = Date.now();

  // Font paths
  const ibmPlexFont = path.join(
    __dirname,
    "../../fonts/IBMPlexSerif-Regular.ttf"
  );

  // Check if fonts exist
  if (!fs.existsSync(ibmPlexFont)) {
    logger.warn(
      `⚠️ IBM Plex font not found: ${ibmPlexFont}, using default font`
    );
  }

  // Optimized text wrapping function from test_slide_generation.js
  function wrapText(text, fontSize, hasMargins = false) {
    // More precise character width calculation for exact margin usage
    const avgCharWidth = fontSize * 0.42; // Slightly adjusted for better justification

    // Calculate available width considering 9% margins
    const baseWidth = 1080; // Typical slide width
    const availableWidth = hasMargins
      ? baseWidth * 0.88 // 88% width (9% left + 3% right effective margin) - 1% less space on right
      : baseWidth * 0.82; // 82% width for title (9% left + 9% right margins) - same margins

    const maxCharsPerLine = Math.floor(availableWidth / avgCharWidth);
    const words = text.split(" ");
    const lines = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? currentLine + " " + word : word;

      // Check if adding this word would exceed the line width
      if (testLine.length <= maxCharsPerLine) {
        currentLine = testLine;
      } else {
        // Line would be too long, start a new line
        if (currentLine) {
          // For justification effect, try to balance the line length
          const targetLength = Math.floor(maxCharsPerLine * 0.85); // Target 85% of max length
          if (currentLine.length < targetLength && words.length > 0) {
            // Try to add one more word if line is too short
            const nextWord = word;
            if ((currentLine + " " + nextWord).length <= maxCharsPerLine) {
              currentLine = currentLine + " " + nextWord;
              // Skip this word in next iteration
              continue;
            }
          }
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }

    // Add the last line if it exists
    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  // Generate 3 slides
  for (let i = 1; i <= 3; i++) {
    try {
      const slideContent = taskData[`slide${i}`] || "";
      const outputPath = path.join(slidesDir, `slide_${timestamp}_${i}.jpg`);

      logger.info(`🎨 Generating slide ${i}/3...`);
      logger.info(
        `📝 Slide ${i} content: "${slideContent.substring(0, 50)}${
          slideContent.length > 50 ? "..." : ""
        }"`
      );

      // Clean and escape text for FFmpeg
      const cleanTitle = (taskData.title || "")
        .replace(/['"]/g, "")
        .replace(/:/g, " ");
      const cleanContent = (slideContent || "")
        .replace(/['"]/g, "")
        .replace(/:/g, " ");

      // Calculate text wrapping based on content area with borders
      // Title has 9% left/right margins, content has 9% left/right margins
      const titleLines = wrapText(cleanTitle, 57, false);
      const contentLines = wrapText(cleanContent, 54, true);

      logger.info(`Title lines: ${JSON.stringify(titleLines)}`);
      logger.info(`Content lines: ${JSON.stringify(contentLines)}`);
      logger.info(`Content length: ${cleanContent.length}`);

      let filters = [];

      // Title positioning (with 9% left/right margins, centered) - using FFmpeg built-in Arial Black font
      let yPosition = 100;
      titleLines.forEach((line, index) => {
        filters.push(
          `drawtext=text='${line}':fontsize=57:fontcolor=#808080:x=(w-text_w)/2:y=${
            yPosition + index * 71
          }:font='Arial Black'`
        );
      });

      // Content positioning with 9% margins (9% left/right/bottom, 17% top)
      // Start content after title with increased 5% top margin
      yPosition = titleLines.length * 71 + 204; // Increased spacing after title (+54px for 5% more top margin)

      contentLines.forEach((line, index) => {
        // Position content with 9% left margin - justified appearance through better wrapping
        if (fs.existsSync(ibmPlexFont)) {
          filters.push(
            `drawtext=fontfile='${ibmPlexFont}':text='${line}':fontsize=54:fontcolor=#000000:x=(w*0.09):y=${
              yPosition + index * 67
            }`
          );
        } else {
          // Fallback but log warning
          logger.warn("⚠️ IBM Plex font not found, using system font");
          filters.push(
            `drawtext=text='${line}':fontsize=54:fontcolor=#000000:x=(w*0.09):y=${
              yPosition + index * 67
            }`
          );
        }
      });

      const filterString = filters.join(",");

      await new Promise((resolve, reject) => {
        ffmpeg(baseImagePath)
          .videoFilters(filterString)
          .outputOptions("-frames:v 1")
          .save(outputPath)
          .on("end", () => {
            logger.info(
              `✅ Slide ${i} generated: ${path.basename(outputPath)}`
            );
            slidePaths.push(outputPath);
            resolve();
          })
          .on("error", (err) => {
            logger.error(`❌ Slide ${i} generation failed:`, err.message);
            reject(new Error(`Slide ${i} generation failed: ${err.message}`));
          });
      });
    } catch (slideGenError) {
      logger.error(`❌ Error generating slide ${i}:`, slideGenError.message);
      throw new Error(
        `Failed to generate slide ${i}: ${slideGenError.message}`
      );
    }
  }

  logger.info(`📸 Generated ${slidePaths.length} carousel slides successfully`);
  return slidePaths;
};

/**
 * Clean up generated slide images
 * @param {Array} slideImages - Array of slide image paths to delete
 */
const cleanupSlides = async (slideImages) => {
  try {
    for (const imagePath of slideImages) {
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        logger.info(`🗑️ Deleted slide: ${path.basename(imagePath)}`);
      }
    }
    logger.info(`🧹 Cleaned up ${slideImages.length} slide images`);
  } catch (error) {
    logger.error("❌ Error cleaning up slides:", error.message);
  }
};

module.exports = router;
