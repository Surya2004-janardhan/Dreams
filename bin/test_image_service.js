require("dotenv").config();
const path = require("path");
const fs = require("fs");
const logger = require("../src/config/logger");

// Import all image service functions
const {
  generateImages,
  parseSRTFile,
  createImageChunksFromSubtitles,
  createDynamicImageChunksFromTerms,
  extractTechnicalTerms,
  generateSimpleImagePrompts,
  generateImageWithGemini,
  generateImagePromptsWithGemini,
  generateTitleImage,
} = require("../src/services/imageService");

// Test configuration
const TEST_CONFIG = {
  // Sample content for testing
  sampleScript: `Artificial Intelligence is revolutionizing the way we work. Machine learning algorithms analyze vast datasets to identify patterns. Neural networks process information similar to human brains. Deep learning enables computers to recognize images and understand speech. Natural language processing helps computers understand human language.`,

  // Sample title for testing
  sampleTitle: "The Future of Artificial Intelligence in Business",

  // Test subtitle file (we'll create this)
  testSubtitleFile: path.join(__dirname, "../subtitles/test_subtitles.srt"),

  // Test prompts
  testPrompts: [
    "Generate a professional illustration of artificial intelligence and machine learning concepts",
    "Create a futuristic image showing neural networks and data processing",
    "Design a modern tech visualization of AI algorithms at work",
  ],
};

// Create sample subtitle file for testing
function createTestSubtitleFile() {
  const sampleSRT = `1
00:00:00,000 --> 00:00:05,000
Welcome to our AI discussion today

2
00:00:05,000 --> 00:00:10,000
We'll explore machine learning algorithms

3
00:00:10,000 --> 00:00:15,000
Neural networks are the foundation of AI

4
00:00:15,000 --> 00:00:20,000
Deep learning processes complex data patterns

5
00:00:20,000 --> 00:00:25,000
Natural language processing understands text

6
00:00:25,000 --> 00:00:30,000
Computer vision recognizes images and objects

7
00:00:30,000 --> 00:00:35,000
Thank you for joining our AI overview`;

  // Ensure subtitles directory exists
  const subtitlesDir = path.dirname(TEST_CONFIG.testSubtitleFile);
  if (!fs.existsSync(subtitlesDir)) {
    fs.mkdirSync(subtitlesDir, { recursive: true });
  }

  fs.writeFileSync(TEST_CONFIG.testSubtitleFile, sampleSRT);
  logger.info(`✅ Created test subtitle file: ${TEST_CONFIG.testSubtitleFile}`);
}

// Test 1: Parse SRT File
async function testParseSRTFile() {
  logger.info("\n🧪 TEST 1: Parse SRT File");
  logger.info("================================");

  try {
    createTestSubtitleFile();
    const parsedSubtitles = parseSRTFile(TEST_CONFIG.testSubtitleFile);

    logger.info(
      `✅ Successfully parsed ${parsedSubtitles.length} subtitle entries`
    );
    logger.info("📋 First few entries:");
    parsedSubtitles.slice(0, 3).forEach((entry, index) => {
      logger.info(
        `  ${index + 1}. [${entry.startTime}s - ${entry.endTime}s]: "${
          entry.text
        }"`
      );
    });

    return parsedSubtitles;
  } catch (error) {
    logger.error(`❌ Parse SRT test failed: ${error.message}`);
    return null;
  }
}

// Test 2: Extract Technical Terms
async function testExtractTechnicalTerms() {
  logger.info("\n🧪 TEST 2: Extract Technical Terms");
  logger.info("===================================");

  try {
    const technicalTerms = await extractTechnicalTerms(
      TEST_CONFIG.sampleScript
    );

    logger.info(`✅ Extracted ${technicalTerms.length} technical terms`);
    logger.info("🔬 Technical terms found:");
    technicalTerms.forEach((term, index) => {
      logger.info(`  ${index + 1}. ${term}`);
    });

    return technicalTerms;
  } catch (error) {
    logger.error(`❌ Extract technical terms test failed: ${error.message}`);
    return [];
  }
}

// Test 3: Generate Simple Image Prompts
async function testGenerateSimpleImagePrompts() {
  logger.info("\n🧪 TEST 3: Generate Simple Image Prompts");
  logger.info("=========================================");

  try {
    const sampleTerms = [
      "artificial intelligence",
      "machine learning",
      "neural networks",
    ];
    const prompts = await generateSimpleImagePrompts(sampleTerms);

    logger.info(`✅ Generated ${prompts.length} image prompts`);
    logger.info("🎨 Generated prompts:");
    prompts.forEach((prompt, index) => {
      logger.info(`  ${index + 1}. ${prompt}`);
    });

    return prompts;
  } catch (error) {
    logger.error(`❌ Generate simple prompts test failed: ${error.message}`);
    return [];
  }
}

// Test 4: Generate Image Prompts with Gemini
async function testGenerateImagePromptsWithGemini() {
  logger.info("\n🧪 TEST 4: Generate Image Prompts with Gemini");
  logger.info("===============================================");

  try {
    const prompts = await generateImagePromptsWithGemini(
      TEST_CONFIG.sampleScript
    );

    logger.info(`✅ Generated ${prompts.length} Gemini-powered prompts`);
    logger.info("🤖 Gemini-generated prompts:");
    prompts.forEach((prompt, index) => {
      logger.info(`  ${index + 1}. ${prompt.substring(0, 100)}...`);
    });

    return prompts;
  } catch (error) {
    logger.error(`❌ Generate Gemini prompts test failed: ${error.message}`);
    return [];
  }
}

// Test 5: Create Image Chunks from Subtitles
async function testCreateImageChunksFromSubtitles() {
  logger.info("\n🧪 TEST 5: Create Image Chunks from Subtitles");
  logger.info("===============================================");

  try {
    const parsedSubtitles = parseSRTFile(TEST_CONFIG.testSubtitleFile);
    const chunks = createImageChunksFromSubtitles(parsedSubtitles, 10); // 10 second chunks

    logger.info(`✅ Created ${chunks.length} image chunks`);
    logger.info("📦 Chunk details:");
    chunks.forEach((chunk, index) => {
      logger.info(
        `  ${index + 1}. [${chunk.startTime}s - ${
          chunk.endTime
        }s]: "${chunk.text.substring(0, 50)}..."`
      );
    });

    return chunks;
  } catch (error) {
    logger.error(`❌ Create image chunks test failed: ${error.message}`);
    return [];
  }
}

// Test 6: Create Dynamic Image Chunks from Terms
async function testCreateDynamicImageChunksFromTerms() {
  logger.info("\n🧪 TEST 6: Create Dynamic Image Chunks from Terms");
  logger.info("==================================================");

  try {
    const sampleTerms = [
      "artificial intelligence",
      "machine learning",
      "neural networks",
    ];
    const parsedSubtitles = parseSRTFile(TEST_CONFIG.testSubtitleFile);
    const chunks = createDynamicImageChunksFromTerms(
      sampleTerms,
      parsedSubtitles,
      3
    );

    logger.info(`✅ Created ${chunks.length} dynamic chunks`);
    logger.info("🎯 Dynamic chunks:");
    chunks.forEach((chunk, index) => {
      logger.info(
        `  ${index + 1}. [${chunk.startTime}s - ${chunk.endTime}s]: Term "${
          chunk.term
        }" - "${chunk.text.substring(0, 50)}..."`
      );
    });

    return chunks;
  } catch (error) {
    logger.error(`❌ Create dynamic chunks test failed: ${error.message}`);
    return [];
  }
}

// Test 7: Generate Single Image with Gemini
async function testGenerateImageWithGemini() {
  logger.info("\n🧪 TEST 7: Generate Single Image with Gemini");
  logger.info("==============================================");

  try {
    // Test with the first available API key
    const apiKey =
      process.env.GEMINI_API_KEY_FOR_IMAGES_1 ||
      process.env.GEMINI_API_KEY_FOR_IMAGES_2 ||
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      logger.warn("⚠️ No Gemini API key found, skipping image generation test");
      return null;
    }

    const testPrompt =
      "Generate a simple, professional illustration of artificial intelligence with blue and white colors";
    const imagePath = await generateImageWithGemini(testPrompt, 1, apiKey);

    if (imagePath && fs.existsSync(imagePath)) {
      logger.info(`✅ Image generated successfully: ${imagePath}`);
      const stats = fs.statSync(imagePath);
      logger.info(`📁 File size: ${(stats.size / 1024).toFixed(2)} KB`);
      return imagePath;
    } else {
      logger.warn("⚠️ Image was not created or path is invalid");
      return null;
    }
  } catch (error) {
    logger.error(`❌ Generate image with Gemini test failed: ${error.message}`);
    return null;
  }
}

// Test 8: Generate Title Image
async function testGenerateTitleImage() {
  logger.info("\n🧪 TEST 8: Generate Title Image");
  logger.info("================================");

  try {
    const imagePath = await generateTitleImage(TEST_CONFIG.sampleTitle);

    if (imagePath && fs.existsSync(imagePath)) {
      logger.info(`✅ Title image generated: ${imagePath}`);
      const stats = fs.statSync(imagePath);
      logger.info(`📁 File size: ${(stats.size / 1024).toFixed(2)} KB`);
      return imagePath;
    } else {
      logger.info(
        "ℹ️ Title image generation used fallback (expected behavior)"
      );
      return imagePath; // May be fallback path
    }
  } catch (error) {
    logger.error(`❌ Generate title image test failed: ${error.message}`);
    return null;
  }
}

// Test 9: Full Image Generation Workflow
async function testFullImageGeneration() {
  logger.info("\n🧪 TEST 9: Full Image Generation Workflow");
  logger.info("==========================================");

  try {
    const imagePaths = await generateImages(
      TEST_CONFIG.testSubtitleFile,
      TEST_CONFIG.sampleScript
    );

    logger.info(`✅ Full workflow generated ${imagePaths.length} images`);
    logger.info("🖼️ Generated images:");
    imagePaths.forEach((imagePath, index) => {
      if (fs.existsSync(imagePath)) {
        const stats = fs.statSync(imagePath);
        logger.info(
          `  ${index + 1}. ${path.basename(imagePath)} (${(
            stats.size / 1024
          ).toFixed(2)} KB)`
        );
      } else {
        logger.info(
          `  ${index + 1}. ${path.basename(imagePath)} (fallback/not found)`
        );
      }
    });

    return imagePaths;
  } catch (error) {
    logger.error(`❌ Full image generation test failed: ${error.message}`);
    return [];
  }
}

// Test 10: API Key Validation
async function testAPIKeyValidation() {
  logger.info("\n🧪 TEST 10: API Key Validation");
  logger.info("===============================");

  const apiKeys = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_API_KEY_FOR_IMAGES_1: process.env.GEMINI_API_KEY_FOR_IMAGES_1,
    GEMINI_API_KEY_FOR_IMAGES_2: process.env.GEMINI_API_KEY_FOR_IMAGES_2,
  };

  logger.info("🔑 API Key Status:");
  for (const [keyName, keyValue] of Object.entries(apiKeys)) {
    if (keyValue) {
      logger.info(
        `  ✅ ${keyName}: ...${keyValue.slice(-10)} (${keyValue.length} chars)`
      );
    } else {
      logger.warn(`  ❌ ${keyName}: Not set`);
    }
  }

  // Test a simple API call to validate keys
  const validKeys = [];
  for (const [keyName, keyValue] of Object.entries(apiKeys)) {
    if (keyValue) {
      try {
        // Quick test with minimal prompt
        const testResult = await generateImageWithGemini("test", 999, keyValue);
        validKeys.push(keyName);
        logger.info(`  ✅ ${keyName}: Valid (test successful)`);
      } catch (error) {
        logger.error(`  ❌ ${keyName}: Invalid or expired - ${error.message}`);
      }
    }
  }

  return validKeys;
}

// Main test runner
async function runAllTests() {
  logger.info("🚀 Starting Image Service Tests");
  logger.info("================================");

  const results = {};

  try {
    // Ensure images directory exists
    const imagesDir = path.join(__dirname, "../images");
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
      logger.info("📁 Created images directory");
    }

    // Run all tests
    results.parseSRT = await testParseSRTFile();
    results.extractTerms = await testExtractTechnicalTerms();
    results.simplePrompts = await testGenerateSimpleImagePrompts();
    results.geminiPrompts = await testGenerateImagePromptsWithGemini();
    results.imageChunks = await testCreateImageChunksFromSubtitles();
    results.dynamicChunks = await testCreateDynamicImageChunksFromTerms();
    results.apiKeyValidation = await testAPIKeyValidation();
    results.singleImage = await testGenerateImageWithGemini();
    results.titleImage = await testGenerateTitleImage();
    results.fullWorkflow = await testFullImageGeneration();

    // Summary
    logger.info("\n📊 TEST SUMMARY");
    logger.info("================");

    const testCount = Object.keys(results).length;
    const successCount = Object.values(results).filter(
      (result) =>
        result !== null &&
        result !== undefined &&
        (Array.isArray(result) ? result.length > 0 : true)
    ).length;

    logger.info(`✅ ${successCount}/${testCount} tests completed successfully`);

    if (results.apiKeyValidation && results.apiKeyValidation.length > 0) {
      logger.info(`🔑 ${results.apiKeyValidation.length} valid API keys found`);
    } else {
      logger.warn(
        "⚠️ No valid API keys found - image generation will use fallbacks"
      );
    }

    return results;
  } catch (error) {
    logger.error(`❌ Test suite failed: ${error.message}`);
    return results;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests()
    .then((results) => {
      logger.info("\n🎉 All tests completed!");
      process.exit(0);
    })
    .catch((error) => {
      logger.error(`💥 Test suite crashed: ${error.message}`);
      process.exit(1);
    });
}

module.exports = {
  runAllTests,
  testParseSRTFile,
  testExtractTechnicalTerms,
  testGenerateSimpleImagePrompts,
  testGenerateImagePromptsWithGemini,
  testCreateImageChunksFromSubtitles,
  testCreateDynamicImageChunksFromTerms,
  testGenerateImageWithGemini,
  testGenerateTitleImage,
  testFullImageGeneration,
  testAPIKeyValidation,
  TEST_CONFIG,
};
