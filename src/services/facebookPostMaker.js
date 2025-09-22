const axios = require("axios");
const fs = require("fs");
const FormData = require("form-data");
const logger = require("../config/logger");

/**
 * Facebook Post Maker Service
 * Handles carousel post creation and uploading to Facebook
 *
 * Facebook Carousel Process:
 * 1. Create Individual Media Containers with published: false, temporary: true
 * 2. Create and Publish the Carousel Post using attached_media array
 */
class FacebookPostMaker {
  constructor() {
    this.baseUrl = "https://graph.facebook.com/v19.0"; // Updated to stable version
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
  async createCarouselPost(imageUrls, caption, headings = []) {
    try {
      logger.info("📘 Creating Facebook carousel post...");

      if (!this.accessToken || !this.pageId) {
        const error = new Error(
          "Facebook credentials not configured - check FACEBOOK_ACCESS_TOKEN and FACEBOOK_PAGE_ID environment variables"
        );
        logger.error("❌ Facebook config error:", error.message);
        throw error;
      }

      logger.info(
        `📘 Facebook config check: Token exists: ${!!this
          .accessToken}, Page ID: ${this.pageId}`
      );

      // Step 0: Get page access token for proper posting permissions
      logger.info("🔑 Getting page access token...");
      const pageAccessToken = await this.getPageAccessToken();

      // Step 1: Upload each photo as unpublished
      logger.info("📤 Step 1: Uploading photos as unpublished...");
      const photoIds = [];

      for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        logger.info(`📤 Uploading photo ${i + 1}/${imageUrls.length}...`);

        const photoId = await this.uploadUnpublishedPhoto(
          imageUrl,
          pageAccessToken
        );
        photoIds.push(photoId);
        logger.info(`✅ Photo ${i + 1} uploaded: ${photoId}`);
      }

      // Step 2: Create feed post with attached media
      logger.info("📘 Step 2: Creating feed post with attached media...");
      const postResult = await this.createFeedPostWithMedia(
        photoIds,
        caption,
        pageAccessToken
      );
      logger.info(`✅ Facebook carousel posted successfully: ${postResult.id}`);

      // Get proper Facebook URL using post ID extraction
      logger.info("🔗 Getting Facebook post URL...");
      const facebookUrl = this.getFacebookPostUrl(postResult.id);

      return {
        success: true,
        postId: postResult.id,
        url: facebookUrl,
        platform: "facebook",
        type: "carousel",
        imageCount: imageUrls.length,
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
   * @param {string} imageUrl - Public URL to image file or local path
   * @param {string} message - Image message/caption
   * @returns {Promise<string>} - Photo ID
   */
  async uploadImage(imageUrl, message = "") {
    try {
      // Check if it's a URL or local path
      const isUrl =
        imageUrl.startsWith("http://") || imageUrl.startsWith("https://");

      if (!isUrl && !fs.existsSync(imageUrl)) {
        throw new Error(`Image file not found: ${imageUrl}`);
      }

      const uploadUrl = `${this.baseUrl}/${this.pageId}/photos`;

      if (isUrl) {
        // For URLs, use the url parameter
        logger.info(`📤 Using public URL for Facebook upload: ${imageUrl}`);

        const response = await axios.post(uploadUrl, {
          url: imageUrl,
          message: message,
          access_token: this.accessToken,
        });

        if (!response.data.id) {
          throw new Error("No photo ID returned from Facebook API");
        }

        return response.data.id;
      } else {
        // For local files, use form data upload
        logger.info(`📤 Using local file for Facebook upload: ${imageUrl}`);

        const formData = new FormData();
        formData.append("source", fs.createReadStream(imageUrl));
        formData.append("message", message);
        formData.append("access_token", this.accessToken);

        const response = await axios.post(uploadUrl, formData, {
          headers: formData.getHeaders(),
          timeout: 30000, // 30 second timeout
        });

        if (!response.data.id) {
          throw new Error("No photo ID returned from Facebook API");
        }

        return response.data.id;
      }
    } catch (error) {
      logger.error("❌ Facebook image upload failed:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        imageUrl: imageUrl,
      });
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
      const facebookUrl = this.getFacebookPostUrl(
        response.data.post_id || response.data.id
      );
      return {
        success: true,
        postId: response.data.post_id || response.data.id,
        permalink: facebookUrl,
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
      const facebookUrl = this.getFacebookPostUrl(response.data.id);
      return {
        success: true,
        postId: response.data.id,
        permalink: facebookUrl,
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

  /**
   * Upload photo as unpublished (Step 1 of carousel process)
   * Creates individual media containers with published: false and temporary: true
   * @param {string} imageUrl - Public URL to image
   * @param {string} pageAccessToken - Page access token
   * @returns {Promise<string>} - Photo ID
   */
  async uploadUnpublishedPhoto(imageUrl, pageAccessToken) {
    try {
      const uploadUrl = `${this.baseUrl}/${this.pageId}/photos`;

      // Create media container as per Facebook Graph API specification
      const requestData = {
        url: imageUrl,
        published: false, // Don't publish immediately
        temporary: true, // Mark as temporary for carousel use
        access_token: pageAccessToken, // Use page access token
      };

      logger.info("📤 Creating unpublished photo container:", {
        url: uploadUrl,
        image_url: imageUrl,
        published: false,
        temporary: true,
      });

      const response = await axios.post(uploadUrl, requestData);

      if (!response.data.id) {
        throw new Error("No photo ID returned from Facebook API");
      }

      logger.info("✅ Unpublished photo container created:", response.data.id);
      return response.data.id;
    } catch (error) {
      logger.error("❌ Facebook unpublished photo upload failed:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        imageUrl: imageUrl,
      });
      throw error;
    }
  }

  /**
   * Get page access token for posting
   * @returns {Promise<string>} - Page access token
   */
  async getPageAccessToken() {
    try {
      const pageTokenUrl = `${this.baseUrl}/${this.pageId}?fields=access_token&access_token=${this.accessToken}`;
      const pageTokenResponse = await axios.get(pageTokenUrl);
      const pageAccessToken = pageTokenResponse.data.access_token;

      if (!pageAccessToken) {
        throw new Error(
          "Could not obtain page access token. Make sure you're a page admin."
        );
      }

      logger.info("🔑 Page access token obtained for posting");
      return pageAccessToken;
    } catch (error) {
      logger.error("❌ Failed to get page access token:", error.message);
      throw error;
    }
  }

  /**
   * Create feed post with attached media (Step 2 of carousel process)
   * Creates carousel post using attached_media array with media_fbid entries
   * @param {Array} photoIds - Array of photo IDs
   * @param {string} message - Post message
   * @param {string} pageAccessToken - Page access token
   * @returns {Promise<Object>} - Post result
   */
  async createFeedPostWithMedia(photoIds, message, pageAccessToken) {
    try {
      const feedUrl = `${this.baseUrl}/${this.pageId}/feed`;

      // Create attached_media array as per Facebook Graph API specification
      const attachedMedia = photoIds.map((photoId) => ({
        media_fbid: photoId,
      }));

      const requestData = {
        message: message,
        attached_media: attachedMedia,
        access_token: pageAccessToken, // Use page access token
      };

      logger.info("📘 Creating carousel feed post:", {
        url: feedUrl,
        message_length: message.length,
        attached_media_count: attachedMedia.length,
        photo_ids: photoIds,
      });

      const response = await axios.post(feedUrl, requestData);

      if (!response.data.id) {
        throw new Error("No post ID returned from Facebook API");
      }

      logger.info("✅ Carousel feed post created:", response.data.id);
      return response.data;
    } catch (error) {
      logger.error("❌ Facebook carousel feed post creation failed:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        photoIds: photoIds,
      });
      throw error;
    }
  }

  /**
   * Extract Facebook post URL from post ID
   * Facebook returns compound IDs in format {page-id}_{post-id}
   * @param {string} postId - Full post ID from Facebook API
   * @returns {string} - Proper Facebook post URL
   */
  getFacebookPostUrl(postId) {
    try {
      // Facebook post IDs are in format "page_id_post_id"
      // We need to extract the post_id part for the URL
      const parts = postId.split("_");
      if (parts.length >= 2) {
        const actualPostId = parts[1]; // Get the post ID part
        const url = `https://www.facebook.com/${actualPostId}`;
        logger.info(`🔗 Facebook URL constructed: ${url}`);
        return url;
      } else {
        // Fallback to original format if splitting doesn't work
        const url = `https://www.facebook.com/${this.pageId}/posts/${postId}`;
        logger.warn(`⚠️ Using fallback Facebook URL format: ${url}`);
        return url;
      }
    } catch (error) {
      logger.error(
        `❌ Error constructing Facebook URL for ${postId}:`,
        error.message
      );
      // Return fallback URL
      return `https://www.facebook.com/${this.pageId}/posts/${postId}`;
    }
  }
}

module.exports = FacebookPostMaker;
