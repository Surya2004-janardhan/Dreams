const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");

/**
 * Clean up files in a directory while preserving certain files
 */
const cleanDirectory = async (dirPath, preserveFiles = []) => {
  try {
    if (!fs.existsSync(dirPath)) {
      logger.info(`Directory ${dirPath} does not exist, skipping cleanup`);
      return { success: true, filesDeleted: 0 };
    }

    const files = fs.readdirSync(dirPath);
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const shouldPreserve = preserveFiles.some((preserveFile) =>
        file.toLowerCase().includes(preserveFile.toLowerCase())
      );

      if (!shouldPreserve) {
        try {
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            fs.unlinkSync(filePath);
            deletedCount++;
            logger.info(`🗑️ Deleted: ${filePath}`);
          }
        } catch (error) {
          logger.error(`Failed to delete ${filePath}:`, error.message);
        }
      } else {
        logger.info(`📁 Preserved: ${filePath}`);
      }
    }

    return { success: true, filesDeleted: deletedCount };
  } catch (error) {
    logger.error(`Error cleaning directory ${dirPath}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Clean up all media folders after successful processing
 */
const cleanupAllMediaFolders = async () => {
  try {
    logger.info("🧹 Starting cleanup of all media folders...");

    const cleanupResults = {
      audio: { success: true, filesDeleted: 0 },
      images: { success: true, filesDeleted: 0 },
      temp: { success: true, filesDeleted: 0 },
      subtitles: { success: true, filesDeleted: 0 },
      videos: { success: true, filesDeleted: 0 },
    };

    // Clean audio folder (remove all generated audio files)
    cleanupResults.audio = await cleanDirectory("audio", []);

    // Clean images folder (remove all generated images)
    cleanupResults.images = await cleanDirectory("images", []);

    // Clean temp folder (remove all temporary files but preserve checkpoints)
    cleanupResults.temp = await cleanDirectory("temp", ["checkpoint"]);

    // Clean subtitles folder (remove all subtitle files)
    cleanupResults.subtitles = await cleanDirectory("subtitles", []);

    // Clean videos folder but preserve base videos
    cleanupResults.videos = await cleanDirectory("videos", [
      "base",
      "background",
      "template",
    ]);

    const totalFilesDeleted = Object.values(cleanupResults).reduce(
      (total, result) => total + (result.filesDeleted || 0),
      0
    );

    logger.info(`✅ Cleanup completed: ${totalFilesDeleted} files deleted`);

    return {
      success: true,
      totalFilesDeleted,
      results: cleanupResults,
    };
  } catch (error) {
    logger.error("❌ Cleanup failed:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Clean up files older than specified days
 */
const cleanupOldFiles = async (dirPath, maxAgeInDays = 7) => {
  try {
    if (!fs.existsSync(dirPath)) {
      return { success: true, filesDeleted: 0 };
    }

    const files = fs.readdirSync(dirPath);
    const cutoffTime = Date.now() - maxAgeInDays * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(dirPath, file);

      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile() && stat.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filePath);
          deletedCount++;
          logger.info(`🗑️ Deleted old file: ${filePath}`);
        }
      } catch (error) {
        logger.error(`Failed to delete ${filePath}:`, error.message);
      }
    }

    return { success: true, filesDeleted: deletedCount };
  } catch (error) {
    logger.error(`Error cleaning old files in ${dirPath}:`, error);
    return { success: false, error: error.message };
  }
};

/**
 * Get folder sizes for monitoring
 */
const getFolderSizes = async () => {
  const folders = ["audio", "images", "videos", "temp", "subtitles"];
  const sizes = {};

  for (const folder of folders) {
    try {
      if (fs.existsSync(folder)) {
        const files = fs.readdirSync(folder);
        let totalSize = 0;
        let fileCount = 0;

        for (const file of files) {
          const filePath = path.join(folder, file);
          const stat = fs.statSync(filePath);
          if (stat.isFile()) {
            totalSize += stat.size;
            fileCount++;
          }
        }

        sizes[folder] = {
          fileCount,
          totalSize,
          totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        };
      } else {
        sizes[folder] = { fileCount: 0, totalSize: 0, totalSizeMB: "0.00" };
      }
    } catch (error) {
      logger.error(`Error getting size for ${folder}:`, error);
      sizes[folder] = { error: error.message };
    }
  }

  return sizes;
};

/**
 * Ensure directory exists
 */
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    logger.info(`📁 Created directory: ${dirPath}`);
  }
};

/**
 * Initialize all required directories
 */
const initializeDirectories = () => {
  const requiredDirs = ["audio", "images", "videos", "temp", "subtitles"];

  requiredDirs.forEach((dir) => {
    ensureDirectoryExists(dir);
  });

  logger.info("📁 All required directories initialized");
};

module.exports = {
  cleanDirectory,
  cleanupAllMediaFolders,
  cleanupOldFiles,
  getFolderSizes,
  ensureDirectoryExists,
  initializeDirectories,
};
