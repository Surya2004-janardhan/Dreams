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

  try {
    logger.info("🚀 Starting Automated Posts Workflow...");

    // Get next unposted task from posts sheet
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

    // Generate 3 slides with text overlays on post-base-image.jpg
    logger.info("🎨 Starting slide generation...");
    const slideImages = await generateCarouselSlidesWithText(taskData);
    logger.info(`📸 Generated ${slideImages.length} slides:`, slideImages);

    if (!slideImages || slideImages.length === 0) {
      throw new Error("No slides were generated");
    }

    // Prepare caption with fixed format
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

${taskData.slide1}

Follow • Like • Share
${fixedHashtags.join(" ")}`;

    // Post carousel to all platforms
    const postingService = new SocialMediaPostingService();
    const postResult = await postingService.postCarousel({
      title: taskData.title,
      slides: [taskData.slide1, taskData.slide2, taskData.slide3],
      imagePaths: slideImages,
      caption: caption,
      hashtags: fixedHashtags,
    });

    // Update sheet status
    const updateTimestamp = new Date().toISOString();
    await updateCarouselSheetStatus(
      taskData.rowIndex,
      "Posted",
      postResult.instagram?.url || "",
      postResult.facebook?.url || "",
      postResult.youtube?.url || ""
    );

    // Send success email
    const successMessage = `
🎉 Carousel Post Success!

Title: ${taskData.title}
Posted to: ${
      Object.keys(postResult).filter((p) => postResult[p]?.success).length > 0
        ? Object.keys(postResult)
            .filter((p) => postResult[p]?.success)
            .join(", ")
        : "None"
    }

Instagram: ${postResult.instagram?.url || "Failed"}
Facebook: ${postResult.facebook?.url || "Failed"}
YouTube: ${postResult.youtube?.url || "Failed"}

Slide 1: ${taskData.slide1}
Slide 2: ${taskData.slide2}
Slide 3: ${taskData.slide3}

Images stored in: slides/ directory
Timestamp: ${updateTimestamp}
    `.trim();

    await sendSuccessNotification(
      {
        title: taskData.title,
        platforms: ["instagram", "facebook", "youtube"],
        result: postResult,
      },
      successMessage
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`✅ Posts workflow completed successfully in ${duration}s`);

    res.status(200).json({
      success: true,
      message: "Carousel posted successfully",
      task: taskData,
      results: postResult,
      duration: `${duration}s`,
      timestamp: updateTimestamp,
    });
  } catch (error) {
    logger.error("❌ Posts workflow failed:", error.message);

    // Update sheet status to failed if we have task data
    if (taskData) {
      try {
        await updateCarouselSheetStatus(
          taskData.rowIndex,
          "Failed",
          "",
          "",
          ""
        );
      } catch (sheetError) {
        logger.error("❌ Failed to update sheet status:", sheetError.message);
      }
    }

    // Send error email
    const errorMessage = `
🚨 Carousel Post Failed!

${taskData ? `Title: ${taskData.title}` : "No task data"}
Error: ${error.message}
Timestamp: ${new Date().toISOString()}

${taskData ? `Row: ${taskData.rowIndex}` : ""}
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
 * Parse custom content into carousel format
 */
function parseCustomContent(customContent, fallbackDescription) {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(customContent);
    if (parsed.slides && Array.isArray(parsed.slides)) {
      return {
        slides: parsed.slides,
        caption:
          parsed.caption ||
          `Check out this carousel about ${fallbackDescription}`,
        platform: "custom",
        generated: false,
      };
    }
  } catch (e) {
    // Not JSON, treat as plain text
  }

  // Fallback: split by lines or create single slide
  const lines = customContent.split("\n").filter((line) => line.trim());
  if (lines.length >= 3) {
    return {
      slides: lines.slice(0, 3).map((line, i) => ({
        heading: `Point ${i + 1}`,
        content: line.trim(),
      })),
      caption: `Carousel about ${fallbackDescription}`,
      platform: "custom",
      generated: false,
    };
  }

  // Single slide fallback
  return {
    slides: [
      {
        heading: fallbackDescription,
        content: customContent,
      },
    ],
    caption: `About ${fallbackDescription}`,
    platform: "custom",
    generated: false,
  };
}

/**
 * Generate email body for notifications
 */
function generateEmailBody(results, title) {
  let body = `Carousel posts have been created for "${title}"\n\n`;

  if (results.instagram?.success) {
    body += `📸 Instagram: ${results.instagram.permalink}\n`;
  } else if (results.instagram) {
    body += `📸 Instagram: Failed - ${results.instagram.error}\n`;
  }

  if (results.facebook?.success) {
    body += `📘 Facebook: ${results.facebook.permalink}\n`;
  } else if (results.facebook) {
    body += `📘 Facebook: Failed - ${results.facebook.error}\n`;
  }

  if (results.youtube?.success) {
    body += `📺 YouTube: ${results.youtube.permalink}\n`;
  } else if (results.youtube) {
    body += `📺 YouTube: Failed - ${results.youtube.error}\n`;
  }

  body += `\nContent Generated: ${results.content.generated ? "Yes" : "No"}\n`;
  body += `Images Used: ${results.images.length}\n\n`;

  if (results.content.slides) {
    body += "Slide Content:\n";
    results.content.slides.forEach((slide, i) => {
      body += `${i + 1}. ${slide.heading}\n   ${slide.content}\n`;
    });
  }

  return body;
}

/**
 * Generate error email body for failed posts
 */
function generateErrorEmailBody(results, title) {
  let body = `🚨 CAROUSEL POSTS ERROR ALERT 🚨\n\n`;
  body += `Title: ${title}\n\n`;
  body += `Some carousel posts failed to publish:\n\n`;

  if (results.instagram && !results.instagram.success) {
    body += `❌ Instagram: ${results.instagram.error}\n`;
  } else if (results.instagram) {
    body += `✅ Instagram: ${results.instagram.permalink}\n`;
  }

  if (results.facebook && !results.facebook.success) {
    body += `❌ Facebook: ${results.facebook.error}\n`;
  } else if (results.facebook) {
    body += `✅ Facebook: ${results.facebook.permalink}\n`;
  }

  if (results.youtube && !results.youtube.success) {
    body += `❌ YouTube: ${results.youtube.error}\n`;
  } else if (results.youtube) {
    body += `✅ YouTube: ${results.youtube.permalink}\n`;
  }

  body += `\nPlease check the logs and retry if necessary.\n`;
  body += `Content was generated from sheet data.\n`;

  return body;
}

/**
 * Generate success email body for successful posts
 */
function generateSuccessEmailBody(results, title) {
  let body = `✅ CAROUSEL POSTS SUCCESS ✅\n\n`;
  body += `Title: ${title}\n\n`;
  body += `All carousel posts published successfully:\n\n`;

  if (results.instagram?.success) {
    body += `📸 Instagram: ${results.instagram.permalink}\n`;
  }

  if (results.facebook?.success) {
    body += `📘 Facebook: ${results.facebook.permalink}\n`;
  }

  if (results.youtube?.success) {
    body += `📺 YouTube: ${results.youtube.permalink}\n`;
  }

  body += `\nContent was generated from sheet data.\n`;
  body += `Sheet has been updated with post links and timestamps.\n`;

  return body;
}

/**
 * Generate carousel images with text overlay using FFmpeg
 */
async function generateCarouselImagesWithTextOverlay(slides, title) {
  const imagePaths = [];
  const slidesDir = path.join(__dirname, "../../slides");

  if (!fs.existsSync(slidesDir)) {
    fs.mkdirSync(slidesDir, { recursive: true });
  }

  const baseImagePath = path.join(
    __dirname,
    "../../videos/Post-Base-Image.jpg"
  );

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const outputPath = path.join(slidesDir, `slide_${i + 1}_${Date.now()}.jpg`);

    await generateImageWithTextOverlay(
      baseImagePath,
      outputPath,
      title,
      slide.content,
      i + 1
    );
    imagePaths.push(outputPath);
  }

  logger.info(
    `✅ Generated ${imagePaths.length} carousel images in slides directory`
  );
  return imagePaths;
}

/**
 * Generate 3 carousel slides with text overlays on post-base-image.jpg
 * @param {Object} taskData - Task data with title, slide1, slide2, slide3
 * @returns {Promise<Array>} - Array of generated image paths
 */
const generateCarouselSlidesWithText = async (taskData) => {
  const slidesDir = path.join(__dirname, "../../slides");

  logger.info(`🎨 Starting slide generation for task: ${taskData.title}`);
  logger.info(`📁 Slides directory: ${slidesDir}`);

  // Ensure slides directory exists
  if (!fs.existsSync(slidesDir)) {
    fs.mkdirSync(slidesDir, { recursive: true });
    logger.info("📁 Created slides directory");
  }

  const baseImagePath = path.join(
    __dirname,
    "../../videos/Post-Base-Image.jpg"
  );
  logger.info(`🖼️ Base image path: ${baseImagePath}`);

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

  for (let i = 1; i <= 3; i++) {
    const slideNumber = i;
    const slideContent = taskData[`slide${slideNumber}`] || "";
    const outputPath = path.join(
      slidesDir,
      `slide_${timestamp}_${slideNumber}.jpg`
    );

    logger.info(`🎨 Generating slide ${slideNumber}...`);

    await new Promise((resolve, reject) => {
      ffmpeg(baseImagePath)
        .videoFilters(
          `drawtext=text='Test Title':fontsize=20:fontcolor=white:x=50:y=50`
        )
        .outputOptions(["-q:v", "2"])
        .output(outputPath)
        .on("end", () => {
          logger.info(`✅ Slide ${slideNumber} generated: ${outputPath}`);
          slidePaths.push(outputPath);
          resolve();
        })
        .on("error", (err) => {
          logger.error(
            `❌ Slide ${slideNumber} generation failed:`,
            err.message
          );
          reject(err);
        })
        .run();
    });
  }

  logger.info(`📸 Generated ${slidePaths.length} carousel slides`);
  logger.info(`📁 Slide paths:`, slidePaths);
  return slidePaths;
};

module.exports = router;
