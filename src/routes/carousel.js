const express = require("express");
const path = require("path");
const CarouselGeneratorService = require("../services/carouselGeneratorService");
const logger = require("../config/logger");
const router = express.Router();

/**
 * POST /api/carousel/generate-and-post
 * Generate carousel slides and post to social media platforms
 */
router.post("/generate-and-post", async (req, res) => {
  try {
    logger.info("📱 API: Starting carousel generation and posting...");

    const carouselService = new CarouselGeneratorService();
    const results = await carouselService.generateAndPost();

    if (results.success) {
      // Update Google Sheets status if posting was successful
      if (
        results.posting.instagram?.success ||
        results.posting.facebook?.success
      ) {
        logger.info("📝 API: Updating Google Sheets status...");
        await carouselService.updateSheetStatus(
          results.task.rowIndex,
          results.posting
        );
      }

      res.status(200).json({
        success: true,
        message: results.message,
        data: {
          task: results.task,
          slides: results.slides,
          posting: {
            instagram: {
              success: results.posting.instagram?.success || false,
              url: results.posting.instagram?.url || null,
              error: results.posting.instagram?.error || null,
            },
            facebook: {
              success: results.posting.facebook?.success || false,
              url: results.posting.facebook?.url || null,
              error: results.posting.facebook?.error || null,
            },
          },
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: results.message,
        error: results.error || null,
      });
    }
  } catch (error) {
    logger.error("❌ API: Carousel generation failed:", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error during carousel generation",
      error: error.message,
    });
  }
});

/**
 * POST /api/carousel/generate-only
 * Generate carousel slides without posting (for testing)
 */
router.post("/generate-only", async (req, res) => {
  try {
    logger.info("🎨 API: Starting carousel slide generation only...");

    const carouselService = new CarouselGeneratorService();

    // Fetch task data
    const task = await carouselService.fetchNotPostedRow();
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "No pending tasks found",
      });
    }

    // Generate slides
    const slidePaths = await carouselService.generateAllSlides(task);

    res.status(200).json({
      success: true,
      message: `Generated ${slidePaths.length} slides successfully`,
      data: {
        task: {
          title: task.title,
          rowIndex: task.rowIndex,
        },
        slides: {
          generated: slidePaths.length,
          paths: slidePaths.map((p) => path.basename(p)),
        },
      },
    });
  } catch (error) {
    logger.error("❌ API: Slide generation failed:", error.message);
    res.status(500).json({
      success: false,
      message: "Internal server error during slide generation",
      error: error.message,
    });
  }
});

/**
 * GET /api/carousel/status
 * Get status of carousel generation system
 */
router.get("/status", async (req, res) => {
  try {
    const carouselService = new CarouselGeneratorService();

    // Check if there are pending tasks
    const task = await carouselService.fetchNotPostedRow();

    res.status(200).json({
      success: true,
      message: "Carousel system status",
      data: {
        hasPendingTasks: !!task,
        nextTask: task
          ? {
              title: task.title,
              hasSlides: !!(task.slide1 && task.slide2 && task.slide3),
            }
          : null,
        system: {
          ffmpegConfigured: true,
          slidesDirectory: "Available",
          baseImage: "Available",
        },
      },
    });
  } catch (error) {
    logger.error("❌ API: Status check failed:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to check system status",
      error: error.message,
    });
  }
});

module.exports = router;
