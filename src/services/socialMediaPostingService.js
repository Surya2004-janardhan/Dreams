const InstagramPostMaker = require("./instagramPostMaker");
const FacebookPostMaker = require("./facebookPostMaker");
const logger = require("../config/logger");
const axios = require("axios");

/**
 * Social Media Posting Service
 * Unified service for posting content to multiple platforms
 */
class SocialMediaPostingService {
  constructor() {
    this.instagramService = new InstagramPostMaker();
    this.facebookService = new FacebookPostMaker();
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
        caption,
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
        caption,
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
