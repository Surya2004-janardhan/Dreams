const InstagramPostMaker = require("./instagramPostMaker");
const FacebookPostMaker = require("./facebookPostMaker");
const logger = require("../config/logger");
const axios = require("axios");

/**
 * Social Media Posting Service
 * Unified service for posting carousel content to multiple platforms
 */
class SocialMediaPostingService {
  constructor() {
    this.instagramService = new InstagramPostMaker();
    this.facebookService = new FacebookPostMaker();
  }

  /**
   * Post carousel to multiple platforms
   * @param {Object} carouselData - Carousel data
   * @param {string} carouselData.title - Post title
   * @param {Array} carouselData.slides - Array of slide content
   * @param {Array} carouselData.imagePaths - Array of image file paths
   * @param {string} carouselData.caption - Post caption
   * @param {Array} carouselData.hashtags - Array of hashtags
   * @returns {Promise<Object>} - Results from all platforms
   */
  async postCarousel(carouselData) {
    const { title, slides, imagePaths, caption, hashtags } = carouselData;
    const results = {
      instagram: null,
      facebook: null,
    };

    logger.info("📱 Starting carousel posting to Instagram and Facebook...");

    // Post to Instagram
    try {
      logger.info("📸 Posting carousel to Instagram...");
      const instagramResult = await this.instagramService.createCarouselPost(
        imagePaths,
        caption
      );
      results.instagram = {
        success: instagramResult.success,
        url: instagramResult.url || "",
        error: instagramResult.error || null,
      };
      logger.info(
        `📸 Instagram result: ${
          results.instagram.success ? "Success" : "Failed"
        }`
      );
    } catch (error) {
      logger.error("❌ Instagram carousel posting failed:", error.message);
      results.instagram = { success: false, error: error.message };
    }

    // Post to Facebook
    try {
      logger.info("📘 Posting carousel to Facebook...");
      const facebookResult = await this.facebookService.createCarouselPost(
        imagePaths,
        caption
      );
      results.facebook = {
        success: facebookResult.success,
        url: facebookResult.url || "",
        error: facebookResult.error || null,
      };
      logger.info(
        `📘 Facebook result: ${results.facebook.success ? "Success" : "Failed"}`
      );
    } catch (error) {
      logger.error("❌ Facebook carousel posting failed:", error.message);
      results.facebook = { success: false, error: error.message };
    }

    const successfulPosts = Object.values(results).filter(
      (r) => r?.success
    ).length;
    logger.info(
      `📊 Carousel posting complete: ${successfulPosts}/2 platforms succeeded`
    );

    return results;
  }

  /**
   * Post single image to platforms
   * @param {string} imagePath - Path to image file
   * @param {string} caption - Post caption
   * @param {Array} hashtags - Array of hashtags
   * @returns {Promise<Object>} - Results from platforms
   */
  async postSingleImage(imagePath, caption, hashtags = []) {
    const results = {
      instagram: null,
      facebook: null,
    };

    // Instagram single image
    try {
      const instagramResult = await this.instagramService.createPost(
        imagePath,
        caption
      );
      results.instagram = {
        success: instagramResult.success,
        url: instagramResult.url || "",
        error: instagramResult.error || null,
      };
    } catch (error) {
      results.instagram = { success: false, error: error.message };
    }

    // Facebook single image
    try {
      const facebookResult = await this.facebookService.createPost(
        imagePath,
        caption
      );
      results.facebook = {
        success: facebookResult.success,
        url: facebookResult.url || "",
        error: facebookResult.error || null,
      };
    } catch (error) {
      results.facebook = { success: false, error: error.message };
    }

    return results;
  }

  /**
   * Post text content to platforms
   * @param {string} content - Text content
   * @param {Array} hashtags - Array of hashtags
   * @returns {Promise<Object>} - Results from platforms
   */
  async postTextContent(content, hashtags = []) {
    const results = {
      facebook: null,
    };

    // Facebook text post
    try {
      const facebookResult = await this.facebookService.createTextPost(content);
      results.facebook = {
        success: facebookResult.success,
        url: facebookResult.url || "",
        error: facebookResult.error || null,
      };
    } catch (error) {
      results.facebook = { success: false, error: error.message };
    }

    return results;
  }
}

module.exports = SocialMediaPostingService;
