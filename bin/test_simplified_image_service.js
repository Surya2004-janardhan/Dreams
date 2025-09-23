require("dotenv").config();
const logger = require("../src/config/logger");
const {
  generateTitleImage,
  validateImage,
  cleanupOldImages,
} = require("../src/services/imageServiceSimplified");
const fs = require("fs");

/**
 * Test the simplified image service
 */
async function testSimplifiedImageService() {
  logger.info("🧪 TESTING SIMPLIFIED IMAGE SERVICE");
  logger.info("====================================");

  const testTitles = [
    "Understanding Machine Learning",
    "AI in Business Applications",
    "Future of Technology",
  ];

  let successCount = 0;
  let fallbackCount = 0;

  for (let i = 0; i < testTitles.length; i++) {
    const title = testTitles[i];
    logger.info(`\n📝 Test ${i + 1}/${testTitles.length}: "${title}"`);

    try {
      const imagePath = await generateTitleImage(title);

      if (validateImage(imagePath)) {
        logger.info(`✅ Image generated and validated: ${imagePath}`);

        // Check if it's a fallback or generated image
        if (
          imagePath.includes("fallback") ||
          imagePath.includes("default-image")
        ) {
          fallbackCount++;
          logger.info(`📋 Type: Fallback image`);
        } else {
          successCount++;
          logger.info(`📋 Type: AI-generated image`);
        }

        // Show file size
        const stats = fs.statSync(imagePath);
        logger.info(`📁 File size: ${(stats.size / 1024).toFixed(2)} KB`);
      } else {
        logger.error(`❌ Image validation failed: ${imagePath}`);
      }
    } catch (error) {
      logger.error(`❌ Test ${i + 1} failed: ${error.message}`);
    }

    // Small delay between tests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Test cleanup function
  logger.info(`\n🧹 Testing image cleanup...`);
  await cleanupOldImages(2); // Keep only 2 most recent images

  // Summary
  logger.info(`\n📊 TEST SUMMARY`);
  logger.info(`================`);
  logger.info(`✅ AI Generated: ${successCount}/${testTitles.length}`);
  logger.info(`🔄 Fallbacks Used: ${fallbackCount}/${testTitles.length}`);
  logger.info(
    `📈 Success Rate: ${(
      ((successCount + fallbackCount) / testTitles.length) *
      100
    ).toFixed(1)}%`
  );

  if (successCount + fallbackCount === testTitles.length) {
    logger.info("🎉 All tests completed successfully!");
    logger.info("✅ Simplified image service is working correctly!");
  } else {
    logger.warn("⚠️ Some tests failed - check configuration");
  }
}

// Run test if called directly
if (require.main === module) {
  testSimplifiedImageService()
    .then(() => {
      logger.info("\n🏁 Test completed!");
      process.exit(0);
    })
    .catch((error) => {
      logger.error(`💥 Test suite failed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = { testSimplifiedImageService };
