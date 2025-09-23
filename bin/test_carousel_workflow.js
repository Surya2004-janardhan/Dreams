require("dotenv").config();
const CarouselGeneratorService = require("../src/services/carouselGeneratorService");
const logger = require("../src/config/logger");

/**
 * Test script for carousel generation and posting workflow
 * Uses exact test_slide_generation logic for slide creation
 */
async function testCarouselWorkflow() {
  try {
    logger.info("🚀 Starting carousel generation and posting test...");

    const carouselService = new CarouselGeneratorService();

    // Execute the complete workflow
    const results = await carouselService.generateAndPost();

    if (results.success) {
      logger.info("✅ Carousel workflow completed successfully!");
      logger.info("📊 Results summary:", {
        task: results.task.title,
        slidesGenerated: results.slides.generated,
        slidesUploaded: results.slides.uploaded,
        instagramSuccess: results.posting.instagram?.success || false,
        facebookSuccess: results.posting.facebook?.success || false,
        instagramUrl: results.posting.instagram?.url || "N/A",
        facebookUrl: results.posting.facebook?.url || "N/A",
      });

      // Update Google Sheets status if posting was successful
      if (
        results.posting.instagram?.success ||
        results.posting.facebook?.success
      ) {
        logger.info("📝 Updating Google Sheets status...");
        await carouselService.updateSheetStatus(
          results.task.rowIndex,
          results.posting
        );
      }
    } else {
      logger.error("❌ Carousel workflow failed:", results.message);
      if (results.error) {
        logger.error("Error details:", results.error);
      }
    }
  } catch (error) {
    logger.error("❌ Test failed with error:", error.message);
    console.error(error);
  }
}

// Run the test
testCarouselWorkflow();
