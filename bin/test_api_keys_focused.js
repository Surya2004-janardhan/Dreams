require("dotenv").config();
const logger = require("../src/config/logger");
const { generateImageWithGemini } = require("../src/services/imageService");

async function testSpecificAPIKey() {
  logger.info("🔍 FOCUSED API KEY TEST");
  logger.info("=======================");

  const apiKeys = {
    main: process.env.GEMINI_API_KEY,
    images1: process.env.GEMINI_API_KEY_FOR_IMAGES_1,
    images2: process.env.GEMINI_API_KEY_FOR_IMAGES_2,
  };

  logger.info("🔑 Testing each API key individually...");

  for (const [keyName, keyValue] of Object.entries(apiKeys)) {
    if (!keyValue) {
      logger.warn(`⚠️ ${keyName}: Not configured`);
      continue;
    }

    logger.info(`\n🧪 Testing ${keyName}: ...${keyValue.slice(-10)}`);

    try {
      const imagePath = await generateImageWithGemini(
        "Generate a simple blue circle on white background",
        `test_${keyName}`,
        keyValue
      );

      if (imagePath) {
        logger.info(`✅ ${keyName}: SUCCESS - Image generated`);
      } else {
        logger.warn(`⚠️ ${keyName}: PARTIAL - Used fallback`);
      }
    } catch (error) {
      if (error.message.includes("API key expired")) {
        logger.error(`❌ ${keyName}: EXPIRED - ${error.message}`);
      } else if (error.message.includes("fetch failed")) {
        logger.warn(`⚠️ ${keyName}: NETWORK ISSUE - ${error.message}`);
      } else {
        logger.error(`❌ ${keyName}: ERROR - ${error.message}`);
      }
    }
  }
}

// Run the focused test
testSpecificAPIKey()
  .then(() => {
    logger.info("\n🎯 Focused API key test completed!");
  })
  .catch((error) => {
    logger.error(`💥 Test failed: ${error.message}`);
  });
