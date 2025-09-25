const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");

/**
 * Clean up files in a directory while preserving certain files
 */
const cleanDirectory = async (dirPath) => {
  try {
    const files = fs.existsSync(dirPath) ? fs.readdirSync(dirPath) : [];
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      // Always preserve 'z' file
      if (file === "z" || file === "z.json") {
        logger.info(`📁 Preserved: ${filePath}`);
        continue;
      }
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
      scripts: { success: true, filesDeleted: 0 },
    };

    // Clean audio folder (remove all generated audio files)
    cleanupResults.audio = await cleanDirectory("audio");
    cleanupResults.images = await cleanDirectory("images");
    cleanupResults.temp = await cleanDirectory("temp");
    cleanupResults.subtitles = await cleanDirectory("subtitles");
    cleanupResults.scripts = await cleanDirectory("scripts");
    cleanupResults.videos = await cleanDirectory("videos");

    // Clean root directory but preserve final video copies
    cleanupResults.root = await cleanupRootDirectory();

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
          // Preserve essential files in videos folder
          if (
            path.basename(dirPath) === "videos" &&
            (file.toLowerCase().includes("default-image") ||
              file.toLowerCase().includes("base-vedio") ||
              file.toLowerCase().includes("base") ||
              file.toLowerCase().includes("background") ||
              file.toLowerCase().includes("template"))
          ) {
            logger.info(`📁 Preserved essential video file: ${filePath}`);
            continue;
          }

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
  const folders = ["audio", "images", "videos", "temp", "subtitles", "scripts"];
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
 * Initialize all required directories and ensure essential files
 */
const initializeDirectories = async () => {
  const requiredDirs = [
    "audio",
    "images",
    "videos",
    "temp",
    "subtitles",
    "scripts",
  ];

  requiredDirs.forEach((dir) => {
    ensureDirectoryExists(dir);
  });

  logger.info("📁 All required directories initialized");

  // Ensure essential video files are present
  const essentialCheck = await ensureEssentialVideoFiles();
  if (!essentialCheck.success) {
    logger.error("❌ Essential video files check failed:", essentialCheck);
  }

  return essentialCheck;
};

/**
 * Clean up root directory while preserving final video copies
 */
const cleanupRootDirectory = async () => {
  try {
    logger.info("🧹 Cleaning root directory...");

    if (!fs.existsSync(".")) {
      return { success: true, filesDeleted: 0 };
    }

    const files = fs.readdirSync(".");
    let deletedCount = 0;

    for (const file of files) {
      // Delete all video files in root (no longer preserving final_video copies)
      if (file.endsWith(".mp4")) {
        try {
          fs.unlinkSync(file);
          deletedCount++;
          logger.info(`🗑️ Deleted root file: ${file}`);
        } catch (error) {
          logger.error(`Failed to delete root file ${file}:`, error.message);
        }
      }
    }

    return { success: true, filesDeleted: deletedCount };
  } catch (error) {
    logger.error("Error cleaning root directory:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Emergency cleanup on error - removes all temporary files and folders
 */
const cleanupOnError = async () => {
  try {
    logger.info("🚨 Emergency cleanup initiated due to error");

    const directoriesToClean = [
      path.join(__dirname, "../../audio"),
      path.join(__dirname, "../../images"),
      path.join(__dirname, "../../scripts"),
      path.join(__dirname, "../../subtitles"),
      path.join(__dirname, "../../temp"),
      path.join(__dirname, "../../videos"),
      path.join(__dirname, "../../final_video"),
    ];

    let totalDeleted = 0;

    for (const dir of directoriesToClean) {
      try {
        // Preserve essential files in videos folder
        const preserveFiles =
          path.basename(dir) === "videos"
            ? ["default-image", "Base-vedio", "base", "background", "template"]
            : [];
        const result = await cleanDirectory(dir, preserveFiles);
        if (result.success) {
          totalDeleted += result.filesDeleted;
        }
      } catch (error) {
        logger.error(`Error cleaning directory ${dir}:`, error);
      }
    }

    logger.info(
      `✅ Emergency cleanup completed: ${totalDeleted} files deleted`
    );
    return { success: true, filesDeleted: totalDeleted };
  } catch (error) {
    logger.error("❌ Emergency cleanup failed:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Ensure videos folder has essential files
 */
const ensureEssentialVideoFiles = async () => {
  try {
    const videosDir = "videos";
    ensureDirectoryExists(videosDir);

    const essentialFiles = {
      "Base-vedio.mp4": "Base video file for video composition",
      "default-image.jpg": "Default image for fallback scenarios",
    };

    let missingFiles = [];

    for (const [fileName, description] of Object.entries(essentialFiles)) {
      const filePath = path.join(videosDir, fileName);
      if (!fs.existsSync(filePath)) {
        missingFiles.push(fileName);
        logger.warn(`⚠️ Essential file missing: ${fileName} (${description})`);
      } else {
        logger.info(`✅ Essential file present: ${fileName}`);
      }
    }

    if (missingFiles.length > 0) {
      logger.error(`❌ Missing essential files: ${missingFiles.join(", ")}`);
      logger.error("🚨 Please ensure these files exist in the videos folder:");
      missingFiles.forEach((file) => {
        logger.error(`   - ${file}`);
      });
      return { success: false, missingFiles };
    }

    logger.info("✅ All essential video files are present");
    return { success: true, missingFiles: [] };
  } catch (error) {
    logger.error("❌ Error checking essential video files:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Clean up final video folder after successful upload
 */
const cleanupFinalVideoFolder = async () => {
  try {
    logger.info("🧹 Cleaning final_video folder after successful upload...");

    const finalVideoFolder = "final_video";
    if (!fs.existsSync(finalVideoFolder)) {
      logger.info("Final video folder does not exist, skipping cleanup");
      return { success: true, filesDeleted: 0 };
    }

    const files = fs.readdirSync(finalVideoFolder);
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(finalVideoFolder, file);

      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile() && file.endsWith(".mp4")) {
          fs.unlinkSync(filePath);
          deletedCount++;
          logger.info(`🗑️ Deleted final video: ${filePath}`);
        }
      } catch (error) {
        logger.error(`Failed to delete ${filePath}:`, error.message);
      }
    }

    logger.info(
      `✅ Final video folder cleanup completed: ${deletedCount} files deleted`
    );
    return { success: true, filesDeleted: deletedCount };
  } catch (error) {
    logger.error("Error cleaning final video folder:", error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  cleanDirectory,
  cleanupAllMediaFolders,
  cleanupOldFiles,
  getFolderSizes,
  ensureDirectoryExists,
  initializeDirectories,
  cleanupRootDirectory,
  cleanupOnError,
  ensureEssentialVideoFiles,
  cleanupFinalVideoFolder,
};
