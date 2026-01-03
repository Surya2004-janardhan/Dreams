const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");
const axios = require("axios");

/**
 * NEW IMAGE SERVICE - Using Worker API
 *
 * Purpose: Generate title images via Cloudflare Workers endpoint
 * Endpoint: https://quiet-scene-4d5f.chintalajanardhan2004.workers.dev/
 * Method: POST with JSON prompt
 * Response: Image file (PNG)
 */

/**
 * Generate image using Worker API - Simple fetch function
 * @param {string} prompt - Image generation prompt
 * @param {string} outputDir - Optional output directory
 * @returns {Promise<string>} - Path to generated image
 */
const generateImageFromWorker = async (prompt, outputDir = null) => {
  try {
    const workerUrl =
      "https://quiet-scene-4d5f.chintalajanardhan2004.workers.dev/";

    logger.info(`🎨 Generating image via Worker API...`);
    logger.info(`📝 Prompt: ${prompt.substring(0, 100)}...`);

    // Send POST request to worker endpoint
    const response = await axios.post(
      workerUrl,
      { prompt: prompt },
      {
        headers: {
          "Content-Type": "application/json",
        },
        responseType: "arraybuffer",
        timeout: 60000, // 60 second timeout
      }
    );

    // Save the image
    const timestamp = Date.now();
    const baseDir = outputDir || "images";
    const imagePath = path.resolve(`${baseDir}/title_image_${timestamp}.png`);

    // Ensure output directory exists
    const imageDir = path.dirname(imagePath);
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }

    fs.writeFileSync(imagePath, response.data);
    logger.info(`✅ Image saved successfully: ${imagePath}`);

    return imagePath;
  } catch (error) {
    logger.error(
      `❌ Worker API image generation failed:`,
      error.message || error
    );
    throw error;
  }
};

/**
 * MAIN FUNCTION: Generate title image using Worker API
 * @param {string} title - Video title text
 * @param {string} outputDir - Optional output directory (defaults to 'images')
 * @returns {Promise<Object>} - {success, imagePath, usedDefault, error}
 */
const generateTitleImage = async (title, outputDir = null) => {
  try {
    logger.info(`🎨 Starting title image generation for: "${title}"`);

    // Create a descriptive prompt from the title
    const prompt = `Create a professional title card image with 9:8 aspect ratio and clean white background.

MAIN ELEMENT: Display the text "${title}" in bold, professional typography equivalent to 57px Arial Black font, centered for optimal readability.

VISUAL ENHANCEMENT: Add 1-2 small, relevant visual elements based on the topic.

DESIGN: Keep visual elements small (10-15% of image), positioned around title without blocking text. Use modern color palette with professional appearance. Perfect for educational video overlay and social media platforms.`;

    // Generate image using Worker API
    const imagePath = await generateImageFromWorker(prompt, outputDir);
    logger.info(`✅ Title image generated successfully: ${imagePath}`);

    return {
      success: true,
      imagePath: imagePath,
      usedDefault: false,
      error: null,
    };
  } catch (error) {
    logger.error(`❌ Image generation failed: ${error.message}`);

    // Fallback to default image
    try {
      const defaultImagePath = path.resolve("videos/default-image.jpg");
      if (fs.existsSync(defaultImagePath)) {
        logger.info(`✅ Using fallback image: ${defaultImagePath}`);

        return {
          success: true,
          imagePath: defaultImagePath,
          usedDefault: true,
          error: null,
        };
      }
    } catch (fallbackError) {
      logger.error(`❌ Fallback also failed: ${fallbackError.message}`);
    }

    return {
      success: false,
      imagePath: null,
      usedDefault: false,
      error: "All image generation and fallback options failed",
    };
  }
};

/**
 * Validate if image file exists and is accessible
 * @param {string} imagePath - Path to image file
 * @returns {boolean} - True if valid image file
 */
const validateImage = (imagePath) => {
  try {
    if (!imagePath || !fs.existsSync(imagePath)) {
      return false;
    }

    const stats = fs.statSync(imagePath);
    return stats.isFile() && stats.size > 0;
  } catch (error) {
    logger.warn(`⚠️ Image validation failed: ${error.message}`);
    return false;
  }
};

/**
 * Clean up old generated images to prevent disk space issues
 * @param {number} maxAge - Maximum age in milliseconds (default: 24 hours)
 */
const cleanupOldImages = async (maxAge = 24 * 60 * 60 * 1000) => {
  try {
    const imageDir = path.resolve("images");
    if (!fs.existsSync(imageDir)) {
      return;
    }

    const files = fs.readdirSync(imageDir);
    const now = Date.now();
    let cleanedCount = 0;

    for (const file of files) {
      if (file.startsWith("title_image_") || file.startsWith("fallback_")) {
        const filePath = path.join(imageDir, file);
        const stats = fs.statSync(filePath);

        if (now - stats.birthtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      }
    }

    if (cleanedCount > 0) {
      logger.info(`🧹 Cleaned up ${cleanedCount} old images`);
    }
  } catch (error) {
    logger.warn(`⚠️ Image cleanup failed: ${error.message}`);
  }
};

module.exports = {
  // Primary workflow function
  generateTitleImage,

  // Core image generation function
  generateImageFromWorker,

  // Utility functions
  validateImage,
  cleanupOldImages,
};

/*
=====================================================
ARCHIVED FUNCTIONS - KEPT FOR REFERENCE
=====================================================

// Old Gemini functions commented out
// const generateImagePrompt = async (title) => { ... }
// const generateImageWithGemini = async (prompt, outputDir = null) => { ... }
// const createFallbackImage = async (title, outputDir = null) => { ... }

These functions have been replaced with the simpler Worker API approach.
*/
