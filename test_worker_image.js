const {
  generateImageWithGemini,
  generateTitleImage,
} = require("./src/services/imageService");
const logger = require("./src/config/logger");

/**
 * Test script for the Gemini image generation function
 */
async function testImageGeneration() {
  logger.info("=".repeat(60));
  logger.info("Testing Gemini Image Generation Function");
  logger.info("=".repeat(60));

  try {
    // Test 1: Test the core generateImageWithGemini function directly
    logger.info("\n📋 Test 1: Testing generateImageWithGemini() directly");
    logger.info("-".repeat(60));

    const testPrompt =
      "White background with black text in center saying 'Machine Learning'. Bold large text. Professional.";
    ("A futuristic cyberpunk robot, ultra realistic, 4k, professional lighting");
    logger.info(`📝 Using test prompt: "${testPrompt}"`);

    const imagePath1 = await generateImageWithGemini(testPrompt);
    logger.info(`✅ Test 1 PASSED - Image saved at: ${imagePath1}`);

    // Test 2: Test the main generateTitleImage function
    logger.info("\n📋 Test 2: Testing generateTitleImage() with title");
    logger.info("-".repeat(60));

    const testTitle = "Advanced AI Technologies";
    logger.info(`📝 Using test title: "${testTitle}"`);

    const result = await generateTitleImage(testTitle);
    logger.info(`✅ Test 2 Result:`, {
      success: result.success,
      imagePath: result.imagePath,
      usedDefault: result.usedDefault,
      error: result.error,
    });

    if (result.success) {
      logger.info(`✅ Test 2 PASSED - Title image generated successfully`);
    } else {
      logger.warn(`⚠️ Test 2 - Image generation failed, fell back to default`);
    }

    // Test 3: Another title test
    logger.info(
      "\n📋 Test 3: Testing generateTitleImage() with different title"
    );
    logger.info("-".repeat(60));

    const testTitle2 = "Machine Learning Basics";
    logger.info(`📝 Using test title: "${testTitle2}"`);

    const result2 = await generateTitleImage(testTitle2);
    logger.info(`✅ Test 3 Result:`, {
      success: result2.success,
      imagePath: result2.imagePath,
      usedDefault: result2.usedDefault,
    });

    logger.info("\n" + "=".repeat(60));
    logger.info("All tests completed successfully! ✅");
    logger.info("=".repeat(60));
  } catch (error) {
    logger.error("\n❌ Test failed with error:", error.message);
    logger.error("Full error:", error);
    process.exit(1);
  }
}

// Run the tests
testImageGeneration().catch((err) => {
  logger.error("Unhandled error:", err);
  process.exit(1);
});
