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
      scripts: { success: true, filesDeleted: 0 },
    };

    // Clean audio folder (remove all generated audio files)
    cleanupResults.audio = await cleanDirectory("audio", []);

    // Clean images folder (remove all generated images)
    cleanupResults.images = await cleanDirectory("images", []);

    // Clean temp folder (remove all temporary files but preserve checkpoints)
    cleanupResults.temp = await cleanDirectory("temp", ["checkpoint"]);

    // Clean subtitles folder (remove all subtitle files)
    cleanupResults.subtitles = await cleanDirectory("subtitles", []);

    // Clean scripts folder (remove all generated script files)
    cleanupResults.scripts = await cleanDirectory("scripts", []);

    // Clean videos folder but preserve base videos and default image
    cleanupResults.videos = await cleanDirectory("videos", [
      "base",
      "background",
      "template",
      "default-image",
    ]);

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
          // Preserve default image in videos folder
          if (path.basename(dirPath) === 'videos' && file.toLowerCase().includes('default-image')) {
            logger.info(`📁 Preserved default image: ${filePath}`);
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
 * Initialize all required directories
 */
const initializeDirectories = () => {
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
      // Preserve final video copies
      if (file.startsWith("final_video_") && file.endsWith(".mp4")) {
        logger.info(`📁 Preserved root copy: ${file}`);
        continue;
      }

      // Delete other video files in root (but not base videos)
      if (
        file.endsWith(".mp4") &&
        !file.toLowerCase().includes("base") &&
        !file.includes("final_video_")
      ) {
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
        // Preserve default image in videos folder
        const preserveFiles = path.basename(dir) === 'videos' ? ['default-image'] : [];
        const result = await cleanDirectory(dir, preserveFiles);
        if (result.success) {
          totalDeleted += result.filesDeleted;
          logger.info(
            `🗑️ Cleaned ${result.filesDeleted} files from ${path.basename(dir)}`
          );
        }
      } catch (error) {
        logger.error(`Failed to clean ${dir}:`, error.message);
      }
    }

    logger.info(
      `✅ Emergency cleanup completed. Deleted ${totalDeleted} files total`
    );
    return { success: true, filesDeleted: totalDeleted };
  } catch (error) {
    logger.error("❌ Emergency cleanup failed:", error);
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
};
