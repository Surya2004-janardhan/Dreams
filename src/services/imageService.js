const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");

/**
 * STREAMLINED IMAGE SERVICE FOR SINGLE-IMAGE VIDEO WORKFLOW
 *
 * Purpose: Generate ONE title image per video for 59-second educational content
 * Font Requirements: 57px Arial Black titles for optimal readability
 * API Strategy: Separate keys for T2T (prompts) and T2I (image generation)
 * Fallback: Automatic default image if generation fails
 *
 * Workflow: Title → Enhanced Prompt (T2T API) → Generate Image (T2I API) → Fallback
 */

/**
 * Generate enhanced image prompt using Gemini T2T API
 * @param {string} title - Original title text for the video
 * @returns {Promise<string>} - Enhanced prompt for image generation
 */
const generateImagePrompt = async (title) => {
  try {
    const apiKey =
      process.env.GEMINI_API_KEY_FOR_T2T || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("No T2T API key available");
    }

    logger.info(`🤖 Generating enhanced prompt for title: "${title}"`);

    const prompt = `Create a detailed image generation prompt for a professional educational title card.

TITLE: "${title}"

REQUIREMENTS:
- 9:8 aspect ratio (portrait orientation for video overlay)
- Clean white or very light background
- Bold, readable typography (equivalent to 57px Arial Black style)
- Professional educational appearance
- Centered text layout for optimal video overlay positioning
- Minimal design - no complex graphics, logos, or decorative elements
- Perfect for 59-second educational video content
- Text should be clearly readable when overlaid on video

Generate a precise prompt for AI image generation:`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
      }
    );

    const enhancedPrompt = response.data.candidates[0].content.parts[0].text;
    logger.info(
      `✅ Enhanced prompt generated: ${enhancedPrompt.substring(0, 100)}...`
    );
    return enhancedPrompt;
  } catch (error) {
    logger.warn(`⚠️ Prompt enhancement failed: ${error.message}`);

    // Fallback to optimized prompt matching our 57px font standards
    const fallbackPrompt = `Create a clean, minimal image with white background. The image should be 9:8 aspect ratio. Display only the title text: "${title}". Use bold, professional typography equivalent to 57px Arial Black font for maximum readability. Center the text for optimal video overlay positioning. No diagrams, no logos, no decorative elements - just clean, bold text on white background. Perfect for educational video title card.`;
    logger.info(`🔄 Using optimized fallback prompt`);
    return fallbackPrompt;
  }
};

/**
 * Generate image using Gemini Image API
 * @param {string} prompt - Enhanced image generation prompt
 * @param {string} outputDir - Optional output directory
 * @returns {Promise<string>} - Path to generated image
 */
const generateImageWithGemini = async (prompt, outputDir = null) => {
  try {
    const apiKey =
      process.env.GEMINI_API_KEY_FOR_IMAGES_1 ||
      process.env.GEMINI_API_KEY_FOR_IMAGES_2 ||
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("No image generation API key available");
    }

    logger.info(`🎨 Generating image with Gemini...`);
    logger.info(`🔑 Using API key ending with: ...${apiKey.slice(-10)}`);
    logger.info(`📝 Prompt: ${prompt.substring(0, 100)}...`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        responseModalities: ["Text", "Image"],
      },
    });

    const response = await model.generateContent(prompt);

    for (const part of response.response.candidates[0].content.parts) {
      if (part.text) {
        logger.info(`📝 Gemini response: ${part.text}`);
      } else if (part.inlineData) {
        const imageData = part.inlineData.data;
        const buffer = Buffer.from(imageData, "base64");

        const timestamp = Date.now();
        const baseDir = outputDir || "images";
        const imagePath = path.resolve(
          `${baseDir}/title_image_${timestamp}.png`
        );

        // Ensure output directory exists
        const imageDir = path.dirname(imagePath);
        if (!fs.existsSync(imageDir)) {
          fs.mkdirSync(imageDir, { recursive: true });
        }

        fs.writeFileSync(imagePath, buffer);
        logger.info(`✅ Image saved successfully: ${imagePath}`);
        return imagePath;
      }
    }

    throw new Error("No image data received from Gemini");
  } catch (error) {
    logger.error(`❌ Gemini image generation failed:`, error.message || error);
    throw error;
  }
};

/**
 * Create fallback image from default
 * @param {string} title - Title for naming (not used in content)
 * @param {string} outputDir - Optional output directory
 * @returns {Promise<string>} - Path to fallback image
 */
const createFallbackImage = async (title, outputDir = null) => {
  try {
    logger.info("🔄 Creating fallback image...");

    const timestamp = Date.now();
    const baseDir = outputDir || "images";
    const fallbackPath = path.resolve(`${baseDir}/fallback_${timestamp}.jpg`);

    // Ensure output directory exists
    const imageDir = path.dirname(fallbackPath);
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }

    // Copy from default image
    const defaultImagePath = path.resolve("videos/default-image.jpg");
    if (fs.existsSync(defaultImagePath)) {
      fs.copyFileSync(defaultImagePath, fallbackPath);
      logger.info(`✅ Fallback image created: ${fallbackPath}`);
      return fallbackPath;
    }

    throw new Error("Default image not found");
  } catch (error) {
    logger.error(`❌ Fallback creation failed: ${error.message}`);
    throw error;
  }
};

/**
 * MAIN FUNCTION: Generate single title image for video workflow
 *
 * This is the primary function used by the video generation workflow
 * Optimized for 57px font equivalent readability and 9:8 aspect ratio
 *
 * @param {string} title - Video title text
 * @param {string} outputDir - Optional output directory (defaults to 'images')
 * @returns {Promise<Object>} - {success, imagePath, usedDefault, error}
 */
const generateTitleImage = async (title, outputDir = null) => {
  try {
    logger.info(`🎨 Starting title image generation for: "${title}"`);

    // Step 1: Generate enhanced prompt using T2T API
    const enhancedPrompt = await generateImagePrompt(title);

    // Step 2: Generate image using T2I API with enhanced prompt
    const imagePath = await generateImageWithGemini(enhancedPrompt, outputDir);
    logger.info(`✅ Title image generated successfully: ${imagePath}`);

    return {
      success: true,
      imagePath: imagePath,
      usedDefault: false,
      error: null,
    };
  } catch (error) {
    logger.error(`❌ Image generation failed: ${error.message}`);

    // Step 3: Automatic fallback to default image
    try {
      const fallbackPath = await createFallbackImage(title, outputDir);
      logger.info(`✅ Using fallback image: ${fallbackPath}`);

      return {
        success: true,
        imagePath: fallbackPath,
        usedDefault: true,
        error: null,
      };
    } catch (fallbackError) {
      logger.error(`❌ Fallback also failed: ${fallbackError.message}`);

      // Last resort: return default image path directly
      const defaultImagePath = path.resolve("videos/default-image.jpg");
      if (fs.existsSync(defaultImagePath)) {
        logger.info(`✅ Using default image directly: ${defaultImagePath}`);

        return {
          success: true,
          imagePath: defaultImagePath,
          usedDefault: true,
          error: null,
        };
      }

      return {
        success: false,
        imagePath: null,
        usedDefault: false,
        error: "All image generation and fallback options failed",
      };
    }
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

  // Utility functions
  validateImage,
  cleanupOldImages,

  // Internal functions (exported for testing)
  generateImagePrompt,
  generateImageWithGemini,
  createFallbackImage,
};
