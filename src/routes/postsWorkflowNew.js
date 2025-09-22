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
} = require("../services/emailService");
const logger = require("../config/logger");

/**
 * POST /posts-workflow
 * Automated carousel posting workflow - reads from sheet and posts to all platforms
 */
router.post("/", async (req, res) => {
  const startTime = Date.now();
  let taskData = null;
  let slideImages = [];

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

    // Step 2: Generate 3 slides with text overlays
    logger.info("🎨 Step 2: Generating carousel slides...");
    slideImages = await generateCarouselSlides(taskData);
    logger.info(`📸 Generated ${slideImages.length} slides successfully`);

    // Step 3: Prepare caption and hashtags
    const fixedHashtags = [
      "#education",
      "#learning",
      "#knowledge",
      "#motivation",
      "#inspiration",
      "#success",
      "#growth",
      "#wisdom",
      "#mindset",
      "#achievement",
    ];

    const caption = `${taskData.title}

Follow • Like • Share
${fixedHashtags.join(" ")}`;

    // Step 4: Post carousel to all platforms
    logger.info("📱 Step 4: Posting to social media platforms...");
    const postingService = new SocialMediaPostingService();
    const postResult = await postingService.postCarousel({
      title: taskData.title,
      slides: [taskData.slide1, taskData.slide2, taskData.slide3],
      imagePaths: slideImages,
      caption: caption,
      hashtags: fixedHashtags,
    });

    // Step 5: Check results and update sheet accordingly
    const successfulPosts = [];
    const failedPosts = [];

    if (postResult.instagram?.success) successfulPosts.push("Instagram");
    else failedPosts.push("Instagram");

    if (postResult.facebook?.success) successfulPosts.push("Facebook");
    else failedPosts.push("Facebook");

    if (postResult.youtube?.success) successfulPosts.push("YouTube");
    else failedPosts.push("YouTube");

    logger.info(`📊 Results: ${successfulPosts.length}/3 platforms succeeded`);

    // Update sheet only if at least one platform succeeded
    if (successfulPosts.length > 0) {
      logger.info("📝 Step 5: Updating sheet with results...");
      await updateCarouselSheetStatus(
        taskData.rowIndex,
        "Posted",
        postResult.instagram?.url || "",
        postResult.facebook?.url || "",
        postResult.youtube?.url || ""
      );
      logger.info("✅ Sheet updated successfully");
    } else {
      logger.warn("⚠️ All platforms failed - not updating sheet status");
    }

    // Step 6: Send success notification
    const successMessage = `
🎉 Carousel Post Workflow Complete!

Title: ${taskData.title}
Successful Posts: ${successfulPosts.join(", ") || "None"}
Failed Posts: ${failedPosts.join(", ") || "None"}

Platform Results:
• Instagram: ${postResult.instagram?.success ? "✅ Success" : "❌ Failed"}
• Facebook: ${postResult.facebook?.success ? "✅ Success" : "❌ Failed"}  
• YouTube: ${postResult.youtube?.success ? "✅ Success" : "❌ Failed"}

Generated ${slideImages.length} slides successfully.
Timestamp: ${new Date().toISOString()}
    `.trim();

    await sendSuccessNotification(
      {
        title: taskData.title,
        platforms: ["instagram", "facebook", "youtube"],
        result: postResult,
      },
      successMessage
    );

    // Step 7: Clean up slides
    logger.info("🧹 Step 7: Cleaning up generated slides...");
    await cleanupSlides(slideImages);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`✅ Posts workflow completed successfully in ${duration}s`);

    res.status(200).json({
      success: true,
      message: "Carousel workflow completed",
      task: taskData,
      results: {
        successful: successfulPosts,
        failed: failedPosts,
        postResult,
      },
      duration: `${duration}s`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("❌ Posts workflow failed:", error.message);

    // Clean up slides on error
    if (slideImages.length > 0) {
      logger.info("🧹 Cleaning up slides due to error...");
      await cleanupSlides(slideImages);
    }

    // Send error email
    const errorMessage = `
🚨 Carousel Post Workflow Failed!

${taskData ? `Title: ${taskData.title}` : "No task data"}
Error: ${error.message}
Step: ${error.step || "Unknown"}
Timestamp: ${new Date().toISOString()}

${taskData ? `Row: ${taskData.rowIndex}` : ""}
Generated Slides: ${slideImages.length}
    `.trim();

    try {
      await sendErrorNotification({
        title: taskData?.title || "Posts Workflow Error",
        error: error.message,
        taskData,
      });
    } catch (emailError) {
      logger.error("❌ Error notification failed:", emailError.message);
    }

    res.status(500).json({
      success: false,
      error: error.message,
      task: taskData,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Generate 3 carousel slides with text overlays on Post-Base-Image.jpg
 * @param {Object} taskData - Task data with title, slide1, slide2, slide3
 * @returns {Promise<Array>} - Array of generated image paths
 */
const generateCarouselSlides = async (taskData) => {
  const slidesDir = path.join(__dirname, "../../slides");

  logger.info(`🎨 Starting slide generation for: ${taskData.title}`);

  // Ensure slides directory exists
  if (!fs.existsSync(slidesDir)) {
    fs.mkdirSync(slidesDir, { recursive: true });
    logger.info("📁 Created slides directory");
  }

  const baseImagePath = path.join(
    __dirname,
    "../../videos/Post-Base-Image.jpg"
  );

  if (!fs.existsSync(baseImagePath)) {
    throw new Error(`Base image not found: ${baseImagePath}`);
  }

  const slidePaths = [];
  const timestamp = Date.now();

  // Font paths
  const montserratBlackFont = path.join(
    __dirname,
    "../../fonts/Montserrat-Black.ttf"
  );
  const ibmPlexFont = path.join(
    __dirname,
    "../../fonts/IBMPlexSerif-Regular.ttf"
  );

  // Check if fonts exist
  if (!fs.existsSync(montserratBlackFont)) {
    throw new Error(`Montserrat Black font not found: ${montserratBlackFont}`);
  }
  if (!fs.existsSync(ibmPlexFont)) {
    throw new Error(`IBM Plex font not found: ${ibmPlexFont}`);
  }

  // Generate 3 slides
  for (let i = 1; i <= 3; i++) {
    const slideContent = taskData[`slide${i}`] || "";
    const outputPath = path.join(slidesDir, `slide_${timestamp}_${i}.jpg`);

    logger.info(`🎨 Generating slide ${i}/3...`);

    // Escape text for FFmpeg
    const escapedTitle = taskData.title
      .replace(/'/g, "\\'")
      .replace(/:/g, "\\:");
    const escapedContent = slideContent
      .replace(/'/g, "\\'")
      .replace(/:/g, "\\:");

    await new Promise((resolve, reject) => {
      ffmpeg(baseImagePath)
        .videoFilters([
          `drawtext=text='${escapedTitle}':fontfile='${montserratBlackFont}':fontsize=12:fontcolor=black:x=(w-text_w)/2:y=50`,
          `drawtext=text='${escapedContent}':fontfile='${ibmPlexFont}':fontsize=10:fontcolor=black:x=(w-text_w)/2:y=100:text_w=w-100`,
        ])
        .outputOptions(["-q:v", "2"])
        .output(outputPath)
        .on("end", () => {
          logger.info(`✅ Slide ${i} generated: ${path.basename(outputPath)}`);
          slidePaths.push(outputPath);
          resolve();
        })
        .on("error", (err) => {
          logger.error(`❌ Slide ${i} generation failed:`, err.message);
          reject(new Error(`Slide generation failed: ${err.message}`));
        })
        .run();
    });
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
