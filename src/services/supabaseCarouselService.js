const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "videos";

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Upload carousel images to Supabase storage and get public URLs
 * @param {Array} imagePaths - Array of local image file paths
 * @param {string} taskTitle - Title for organizing files
 * @returns {Promise<Array>} Array of public URLs
 */
const uploadCarouselImages = async (imagePaths, taskTitle) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required"
    );
  }

  const publicUrls = [];
  const uploadedPaths = []; // Keep track for cleanup

  try {
    logger.info(
      `📤 Uploading ${imagePaths.length} carousel images to Supabase...`
    );

    for (let i = 0; i < imagePaths.length; i++) {
      const localPath = imagePaths[i];

      if (!fs.existsSync(localPath)) {
        throw new Error(`Image file not found: ${localPath}`);
      }

      // Create unique filename
      const timestamp = Date.now();
      const sanitizedTitle = taskTitle
        .replace(/[^a-zA-Z0-9]/g, "_")
        .toLowerCase();
      const fileName = `carousel_${sanitizedTitle}_${timestamp}_${i + 1}.jpg`;
      const storagePath = `carousel_images/${fileName}`;

      logger.info(
        `📤 Uploading image ${i + 1}/${imagePaths.length}: ${fileName}`
      );

      // Read file content
      const fileContent = fs.readFileSync(localPath);

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .upload(storagePath, fileContent, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (error) {
        logger.error(`❌ Failed to upload image ${i + 1}:`, error.message);
        throw new Error(`Supabase upload failed: ${error.message}`);
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(storagePath);

      if (!publicUrlData.publicUrl) {
        throw new Error(`Failed to get public URL for ${storagePath}`);
      }

      publicUrls.push(publicUrlData.publicUrl);
      uploadedPaths.push(storagePath);

      logger.info(`✅ Image ${i + 1} uploaded: ${publicUrlData.publicUrl}`);
    }

    logger.info(
      `📤 Successfully uploaded ${publicUrls.length} carousel images to Supabase`
    );
    return { publicUrls, uploadedPaths };
  } catch (error) {
    logger.error(
      "❌ Failed to upload carousel images to Supabase:",
      error.message
    );

    // Cleanup any uploaded files on error
    if (uploadedPaths.length > 0) {
      logger.info(
        `🧹 Cleaning up ${uploadedPaths.length} uploaded files due to error...`
      );
      await cleanupCarouselImages(uploadedPaths);
    }

    throw error;
  }
};

/**
 * Clean up carousel images from Supabase storage
 * @param {Array} storagePaths - Array of storage paths to delete
 */
const cleanupCarouselImages = async (storagePaths) => {
  if (!storagePaths || storagePaths.length === 0) {
    return;
  }

  try {
    logger.info(
      `🧹 Cleaning up ${storagePaths.length} carousel images from Supabase...`
    );

    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .remove(storagePaths);

    if (error) {
      logger.error(
        "❌ Failed to cleanup carousel images from Supabase:",
        error.message
      );
    } else {
      logger.info(
        `✅ Cleaned up ${storagePaths.length} carousel images from Supabase`
      );
    }
  } catch (error) {
    logger.error("❌ Error during carousel image cleanup:", error.message);
  }
};

module.exports = {
  uploadCarouselImages,
  cleanupCarouselImages,
};
