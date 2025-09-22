const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const logger = require("../config/logger");

/**
 * Facebook Post Maker Service
 * Handles carousel post creation and uploading to Facebook
 */
class FacebookPostMaker {
  constructor() {
    this.baseUrl = "https://graph.facebook.com/v21.0";
    this.accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
    this.pageId = process.env.FACEBOOK_PAGE_ID;
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
      logger.info("📘 Creating Facebook carousel post...");

      if (!this.accessToken || !this.pageId) {
        throw new Error("Facebook credentials not configured");
      }

      // Step 1: Upload each image and get photo IDs
      const photoIds = [];
      for (let i = 0; i < imagePaths.length; i++) {
        const imagePath = imagePaths[i];
        const heading = headings[i] || `Image ${i + 1}`;

        logger.info(
          `📤 Uploading image ${i + 1}/${imagePaths.length} to Facebook...`
        );

        const photoId = await this.uploadImage(imagePath, heading);
        photoIds.push(photoId);
      }

      // Step 2: Create carousel post
      logger.info("🎠 Creating Facebook carousel post...");
      const postResult = await this.publishCarouselPost(photoIds, caption);

      logger.info("✅ Facebook carousel post created successfully!");
      return {
        success: true,
        postId: postResult.id,
        permalink:
          postResult.permalink_url ||
          `https://www.facebook.com/${this.pageId}/posts/${postResult.id}`,
        platform: "facebook",
        type: "carousel",
        imageCount: imagePaths.length,
      };
    } catch (error) {
      logger.error("❌ Facebook carousel post failed:", error.message);
      return {
        success: false,
        error: error.message,
        platform: "facebook",
        type: "carousel",
      };
    }
  }

  /**
   * Upload single image to Facebook
   * @param {string} imagePath - Path to image file
   * @param {string} message - Image message/caption
   * @returns {Promise<string>} - Photo ID
   */
  async uploadImage(imagePath, message = "") {
    try {
      const formData = new FormData();
      formData.append("source", fs.createReadStream(imagePath));
      formData.append("message", message);
      formData.append("access_token", this.accessToken);

      const uploadUrl = `${this.baseUrl}/${this.pageId}/photos`;

      const response = await axios.post(uploadUrl, formData, {
        headers: formData.getHeaders(),
      });

      return response.data.id;
    } catch (error) {
      logger.error("❌ Facebook image upload failed:", error.message);
      throw error;
    }
  }

  /**
   * Publish carousel post with attached photos
   * @param {Array} photoIds - Array of photo IDs
   * @param {string} message - Post message
   * @returns {Promise<Object>} - Post result
   */
  async publishCarouselPost(photoIds, message) {
    try {
      const postUrl = `${this.baseUrl}/${this.pageId}/feed`;

      // Create post with attached photos
      const attachments = photoIds.map((id) => ({ media_fbid: id }));

      const response = await axios.post(postUrl, {
        message: message,
        attached_media: JSON.stringify(attachments),
        access_token: this.accessToken,
      });

      return response.data;
    } catch (error) {
      logger.error("❌ Facebook carousel post publish failed:", error.message);
      throw error;
    }
  }

  /**
   * Create single image post
   * @param {string} imagePath - Path to image file
   * @param {string} message - Post message
   * @returns {Promise<Object>} - Post result
   */
  async createSinglePost(imagePath, message) {
    try {
      logger.info("📘 Creating Facebook single post...");

      const formData = new FormData();
      formData.append("source", fs.createReadStream(imagePath));
      formData.append("message", message);
      formData.append("access_token", this.accessToken);

      const postUrl = `${this.baseUrl}/${this.pageId}/photos`;

      const response = await axios.post(postUrl, formData, {
        headers: formData.getHeaders(),
      });

      logger.info("✅ Facebook single post created successfully!");
      return {
        success: true,
        postId: response.data.post_id || response.data.id,
        permalink: `https://www.facebook.com/${this.pageId}/posts/${
          response.data.post_id || response.data.id
        }`,
        platform: "facebook",
        type: "single",
      };
    } catch (error) {
      logger.error("❌ Facebook single post failed:", error.message);
      return {
        success: false,
        error: error.message,
        platform: "facebook",
        type: "single",
      };
    }
  }

  /**
   * Create text-only post
   * @param {string} message - Post message
   * @returns {Promise<Object>} - Post result
   */
  async createTextPost(message) {
    try {
      logger.info("📝 Creating Facebook text post...");

      const postUrl = `${this.baseUrl}/${this.pageId}/feed`;

      const response = await axios.post(postUrl, {
        message: message,
        access_token: this.accessToken,
      });

      logger.info("✅ Facebook text post created successfully!");
      return {
        success: true,
        postId: response.data.id,
        permalink: `https://www.facebook.com/${this.pageId}/posts/${response.data.id}`,
        platform: "facebook",
        type: "text",
      };
    } catch (error) {
      logger.error("❌ Facebook text post failed:", error.message);
      return {
        success: false,
        error: error.message,
        platform: "facebook",
        type: "text",
      };
    }
  }
}

module.exports = FacebookPostMaker;
