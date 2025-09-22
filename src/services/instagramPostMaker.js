const axios = require("axios");
const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");

/**
 * Instagram Post Maker Service
 * Handles carousel post creation and uploading to Instagram
 */
class InstagramPostMaker {
  constructor() {
    this.baseUrl = "https://graph.instagram.com";
    this.accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    this.accountId = process.env.INSTAGRAM_ACCOUNT_ID;
  }

  /**
   * Create carousel post with multiple images
   * @param {Array} imagePaths - Array of image file paths
   * @param {string} caption - Post caption
   * @param {Array} headings - Array of headings for each image
   * @returns {Promise<Object>} - Post result with ID and links
   */
  async createCarouselPost(imagePaths, caption, headings = []) {
    try {
      logger.info("📸 Creating Instagram carousel post...");

      if (!this.accessToken || !this.accountId) {
        throw new Error("Instagram credentials not configured");
      }

      // Step 1: Upload each image and get media IDs
      const mediaIds = [];
      for (let i = 0; i < imagePaths.length; i++) {
        const imagePath = imagePaths[i];
        const heading = headings[i] || `Image ${i + 1}`;

        logger.info(
          `📤 Uploading image ${i + 1}/${imagePaths.length} to Instagram...`
        );

        const mediaId = await this.uploadImage(imagePath, heading);
        mediaIds.push(mediaId);
      }

      // Step 2: Create carousel container
      logger.info("🎠 Creating carousel container...");
      const carouselContainerId = await this.createCarouselContainer(
        mediaIds,
        caption
      );

      // Step 3: Publish the carousel
      logger.info("🚀 Publishing carousel post...");
      const postResult = await this.publishCarousel(carouselContainerId);

      logger.info("✅ Instagram carousel post created successfully!");
      return {
        success: true,
        postId: postResult.id,
        permalink: `https://www.instagram.com/p/${postResult.code}/`,
        platform: "instagram",
        type: "carousel",
        imageCount: imagePaths.length,
      };
    } catch (error) {
      logger.error("❌ Instagram carousel post failed:", error.message);
      return {
        success: false,
        error: error.message,
        platform: "instagram",
        type: "carousel",
      };
    }
  }

  /**
   * Upload single image to Instagram
   * @param {string} imagePath - Path to image file
   * @param {string} caption - Image caption
   * @returns {Promise<string>} - Media ID
   */
  async uploadImage(imagePath, caption = "") {
    try {
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString("base64");

      const uploadUrl = `${this.baseUrl}/v21.0/${this.accountId}/media`;

      const response = await axios.post(uploadUrl, {
        image_url: `data:image/jpeg;base64,${base64Image}`,
        caption: caption,
        access_token: this.accessToken,
      });

      return response.data.id;
    } catch (error) {
      logger.error("❌ Instagram image upload failed:", error.message);
      throw error;
    }
  }

  /**
   * Create carousel container
   * @param {Array} mediaIds - Array of media IDs
   * @param {string} caption - Post caption
   * @returns {Promise<string>} - Container ID
   */
  async createCarouselContainer(mediaIds, caption) {
    try {
      const containerUrl = `${this.baseUrl}/v21.0/${this.accountId}/media`;

      const response = await axios.post(containerUrl, {
        media_type: "CAROUSEL",
        children: mediaIds,
        caption: caption,
        access_token: this.accessToken,
      });

      return response.data.id;
    } catch (error) {
      logger.error(
        "❌ Instagram carousel container creation failed:",
        error.message
      );
      throw error;
    }
  }

  /**
   * Publish carousel post
   * @param {string} containerId - Carousel container ID
   * @returns {Promise<Object>} - Publish result
   */
  async publishCarousel(containerId) {
    try {
      const publishUrl = `${this.baseUrl}/v21.0/${this.accountId}/media_publish`;

      const response = await axios.post(publishUrl, {
        creation_id: containerId,
        access_token: this.accessToken,
      });

      return response.data;
    } catch (error) {
      logger.error("❌ Instagram carousel publish failed:", error.message);
      throw error;
    }
  }

  /**
   * Create single image post
   * @param {string} imagePath - Path to image file
   * @param {string} caption - Post caption
   * @returns {Promise<Object>} - Post result
   */
  async createSinglePost(imagePath, caption) {
    try {
      logger.info("📸 Creating Instagram single post...");

      // Upload image
      const mediaId = await this.uploadImage(imagePath, caption);

      // Publish post
      const publishUrl = `${this.baseUrl}/v21.0/${this.accountId}/media_publish`;

      const response = await axios.post(publishUrl, {
        creation_id: mediaId,
        access_token: this.accessToken,
      });

      logger.info("✅ Instagram single post created successfully!");
      return {
        success: true,
        postId: response.data.id,
        permalink: `https://www.instagram.com/p/${response.data.code}/`,
        platform: "instagram",
        type: "single",
      };
    } catch (error) {
      logger.error("❌ Instagram single post failed:", error.message);
      return {
        success: false,
        error: error.message,
        platform: "instagram",
        type: "single",
      };
    }
  }
}

module.exports = InstagramPostMaker;
