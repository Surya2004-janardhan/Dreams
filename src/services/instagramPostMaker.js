const axios = require("axios");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const logger = require("../config/logger");

/**
 * Instagram Post Maker Service
 * Handles carousel post creation and uploading to Instagram using v23.0 API
 *
 * Carousel Limitations:
 * - Limited to 10 images, videos, or a mix of the two
 * - All images are cropped based on the first image (default 1:1 aspect ratio)
 * - Accounts limited to 50 published posts within 24-hour period
 * - Publishing a carousel counts as a single post
 */
class InstagramPostMaker {
  constructor() {
    this.baseUrl = "https://graph.facebook.com"; // Using Facebook Graph API for better token handling
    this.apiVersion = "v23.0"; // Updated to latest version
    this.accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    this.accountId = process.env.INSTAGRAM_ACCOUNT_ID;
  }

  /**
   * Create carousel post with multiple images using Instagram's 3-step process
   * @param {Array} imageUrls - Array of public image URLs
   * @param {string} caption - Post caption
   * @param {Array} headings - Array of headings for each image
   * @returns {Promise<Object>} - Post result with ID and links
   */
  async createCarouselPost(imageUrls, caption, headings = []) {
    try {
      logger.info("📸 Creating Instagram carousel post...");

      // Validate Instagram carousel limitations
      if (!imageUrls || imageUrls.length === 0) {
        throw new Error("At least one image is required for carousel post");
      }

      if (imageUrls.length > 10) {
        throw new Error(
          `Carousel limited to 10 images, received ${imageUrls.length}`
        );
      }

      if (!this.accessToken || !this.accountId) {
        const error = new Error(
          "Instagram credentials not configured - check INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_ACCOUNT_ID environment variables"
        );
        logger.error("❌ Instagram config error:", error.message);
        throw error;
      }

      logger.info(
        `📸 Instagram config check: Token exists: ${!!this
          .accessToken}, Account ID: ${this.accountId}`
      );

      logger.info(
        `📸 Carousel validation: ${imageUrls.length}/10 images (within limits)`
      );

      // Step 1: Create item containers for each image
      logger.info("📤 Step 1: Creating item containers for each image...");
      const itemContainerIds = [];

      for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        logger.info(
          `📤 Creating container for image ${i + 1}/${imageUrls.length}...`
        );

        const containerId = await this.createItemContainer(imageUrl);
        itemContainerIds.push(containerId);
        logger.info(`✅ Item container ${i + 1} created: ${containerId}`);
      }

      // Step 2: Create main carousel container
      logger.info("🎠 Step 2: Creating main carousel container...");
      const mainContainerId = await this.createMainCarouselContainer(
        itemContainerIds,
        caption
      );
      logger.info(`✅ Main carousel container created: ${mainContainerId}`);

      // Step 2.5: Wait for Instagram to process the media containers
      logger.info(
        "⏳ Waiting for Instagram to process media containers (30 seconds)..."
      );
      await new Promise((resolve) => setTimeout(resolve, 30000));

      // Step 3: Publish the carousel with retry logic
      logger.info("🚀 Step 3: Publishing carousel...");
      const publishResult = await this.publishCarouselWithRetry(
        mainContainerId
      );
      logger.info(`✅ Carousel published successfully: ${publishResult.id}`);

      return {
        success: true,
        postId: publishResult.id,
        url: `https://www.instagram.com/p/${publishResult.id}/`,
        platform: "instagram",
        type: "carousel",
        imageCount: imageUrls.length,
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
   * Create item container for a single image (Step 1)
   * @param {string} imageUrl - Public URL to image
   * @returns {Promise<string>} - Item container ID
   */
  async createItemContainer(imageUrl) {
    try {
      const containerUrl = `${this.baseUrl}/${this.apiVersion}/${this.accountId}/media`;

      // Create container as per Instagram Graph API specification
      const requestData = {
        image_url: imageUrl,
        is_carousel_item: true,
        access_token: this.accessToken,
      };

      logger.info("📤 Creating item container:", {
        url: containerUrl,
        image_url: imageUrl,
        is_carousel_item: true,
      });

      const response = await axios.post(containerUrl, requestData, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      if (!response.data.id) {
        throw new Error("No container ID returned from Instagram API");
      }

      logger.info("✅ Item container created:", response.data.id);
      return response.data.id;
    } catch (error) {
      logger.error("❌ Instagram item container creation failed:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        imageUrl: imageUrl,
      });
      throw error;
    }
  }

  /**
   * Create main carousel container (Step 2)
   * @param {Array} itemContainerIds - Array of item container IDs
   * @param {string} caption - Post caption
   * @returns {Promise<string>} - Main container ID
   */
  async createMainCarouselContainer(itemContainerIds, caption) {
    try {
      const containerUrl = `${this.baseUrl}/${this.apiVersion}/${this.accountId}/media`;

      // Create carousel container as per Instagram Graph API v23.0 specification
      const requestData = {
        caption: caption,
        media_type: "CAROUSEL",
        children: itemContainerIds.join(","), // Comma-separated list of container IDs
        access_token: this.accessToken,
      };

      logger.info("🎠 Creating carousel container:", {
        url: containerUrl,
        media_type: requestData.media_type,
        children_count: itemContainerIds.length,
        children: requestData.children,
        caption_length: caption.length,
      });

      const response = await axios.post(containerUrl, requestData, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.data.id) {
        throw new Error("No main container ID returned from Instagram API");
      }

      logger.info("✅ Carousel container created:", response.data.id);
      return response.data.id;
    } catch (error) {
      logger.error("❌ Instagram main carousel container creation failed:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Upload single image to Instagram
   * @param {string} imageUrl - Public URL to image file
   * @param {string} caption - Image caption
   * @returns {Promise<string>} - Media ID
   */
  async uploadImage(imageUrl, caption = "") {
    try {
      // Check if it's a URL or local path
      const isUrl =
        imageUrl.startsWith("http://") || imageUrl.startsWith("https://");

      if (!isUrl && !fs.existsSync(imageUrl)) {
        throw new Error(`Image file not found: ${imageUrl}`);
      }

      const uploadUrl = `${this.baseUrl}/${this.apiVersion}/${this.accountId}/media`;

      let formData;

      if (isUrl) {
        // For URLs, use the image_url parameter instead of uploading file content
        logger.info(`📤 Using public URL for Instagram upload: ${imageUrl}`);

        const response = await axios.post(uploadUrl, {
          image_url: imageUrl,
          caption: caption,
          access_token: this.accessToken,
        });

        if (!response.data.id) {
          throw new Error("No media ID returned from Instagram API");
        }

        return response.data.id;
      } else {
        // For local files, use form data upload
        logger.info(`📤 Using local file for Instagram upload: ${imageUrl}`);

        formData = new FormData();
        formData.append("image", fs.createReadStream(imageUrl));
        formData.append("caption", caption);
        formData.append("access_token", this.accessToken);

        const response = await axios.post(uploadUrl, formData, {
          headers: {
            ...formData.getHeaders(),
          },
          timeout: 30000, // 30 second timeout
        });

        if (!response.data.id) {
          throw new Error("No media ID returned from Instagram API");
        }

        return response.data.id;
      }
    } catch (error) {
      logger.error("❌ Instagram image upload failed:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        imageUrl: imageUrl,
      });
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
      const containerUrl = `${this.baseUrl}/${this.apiVersion}/${this.accountId}/media`;

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
   * Publish carousel post with retry logic (Step 3)
   * @param {string} containerId - Carousel container ID
   * @returns {Promise<Object>} - Publish result
   */
  async publishCarouselWithRetry(containerId) {
    let publishResponse;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        logger.info(
          `🚀 Publishing Instagram carousel (attempt ${
            retryCount + 1
          }/${maxRetries})...`
        );

        const publishUrl = `${this.baseUrl}/${this.apiVersion}/${this.accountId}/media_publish`;
        publishResponse = await axios.post(publishUrl, {
          creation_id: containerId,
          access_token: this.accessToken,
        });

        // Check if publish was successful
        if (publishResponse.data.id) {
          logger.info("✅ Carousel published successfully:", {
            postId: publishResponse.data.id,
            containerId: containerId,
          });
          return publishResponse.data;
        }
      } catch (publishError) {
        retryCount++;
        if (retryCount < maxRetries) {
          logger.warn(
            `⚠️ Publish attempt ${retryCount} failed, retrying in 25 seconds...`
          );
          logger.warn(
            `Error: ${
              publishError.response?.data?.error?.message ||
              publishError.message
            }`
          );
          await new Promise((resolve) => setTimeout(resolve, 25000));
        } else {
          logger.error("❌ Instagram carousel publish failed:", {
            message: publishError.message,
            status: publishError.response?.status,
            data: publishError.response?.data,
            containerId: containerId,
          });
          throw publishError; // Max retries reached, throw error
        }
      }
    }
  }

  /**
   * Publish carousel post (Step 3) - Original method
   * @param {string} containerId - Carousel container ID
   * @returns {Promise<Object>} - Publish result
   */
  async publishCarousel(containerId) {
    try {
      const publishUrl = `${this.baseUrl}/${this.apiVersion}/${this.accountId}/media_publish`;

      const response = await axios.post(publishUrl, {
        creation_id: containerId,
        access_token: this.accessToken,
      });

      logger.info("✅ Carousel published successfully:", {
        postId: response.data.id,
        containerId: containerId,
      });

      return response.data;
    } catch (error) {
      logger.error("❌ Instagram carousel publish failed:", {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        containerId: containerId,
      });
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
      const publishUrl = `${this.baseUrl}/${this.apiVersion}/${this.accountId}/media_publish`;

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
