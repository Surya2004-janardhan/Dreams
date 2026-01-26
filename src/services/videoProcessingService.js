const ffmpegPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);
const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");
// Load FFmpeg configuration
require("../config/ffmpeg");
// const fontspath = require("../../fonts");

/**
 * Validate if a video file is readable and not corrupted
 */
const validateVideoFile = async (videoPath) => {
  return new Promise((resolve, reject) => {
    try {
      // Check if file exists
      if (!fs.existsSync(videoPath)) {
        reject(new Error(`Video file does not exist: ${videoPath}`));
        return;
      }

      // Check file size (must be > 0)
      const stats = fs.statSync(videoPath);
      if (stats.size === 0) {
        reject(new Error(`Video file is empty: ${videoPath}`));
        return;
      }

      // Check minimum file size (videos should be at least 1MB)
      const minSizeMB = 1;
      if (stats.size < minSizeMB * 1024 * 1024) {
        reject(
          new Error(
            `Video file is too small (${(stats.size / 1024 / 1024).toFixed(
              2,
            )} MB). Minimum required: ${minSizeMB} MB`,
          ),
        );
        return;
      }

      // Basic file header check (MP4 files start with specific bytes)
      const buffer = Buffer.alloc(12);
      const fd = fs.openSync(videoPath, "r");
      fs.readSync(fd, buffer, 0, 12, 0);
      fs.closeSync(fd);

      // Check for MP4 header (ftyp box)
      const header = buffer.toString("ascii", 4, 8);
      if (header !== "ftyp" && header !== "moov") {
        reject(
          new Error(
            `File does not appear to be a valid MP4 video: ${videoPath}`,
          ),
        );
        return;
      }

      logger.info(
        `✅ Video file validated: ${videoPath} (${(
          stats.size /
          1024 /
          1024
        ).toFixed(2)} MB)`,
      );
      resolve(true);
    } catch (error) {
      reject(new Error(`Error validating video file: ${error.message}`));
    }
  });
};

/**
 * Get base video from Google Drive or local videos folder
 */
const getBaseVideo = async () => {
  try {
    logger.info("📹 Looking for base video...");

    // Check if we're in CI environment
    const isCI =
      process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true";

    // Check local videos folder first
    const videosDir = "videos";
    if (fs.existsSync(videosDir)) {
      const videoFiles = fs
        .readdirSync(videosDir)
        .filter(
          (file) =>
            file.toLowerCase().includes("base") ||
            file.toLowerCase().includes("background") ||
            file.toLowerCase().includes("template"),
        );

      if (videoFiles.length > 0) {
        const localVideoPath = path.join(videosDir, videoFiles[0]);
        logger.info(`✅ Found local base video: ${localVideoPath}`);

        // In CI, wait a bit for LFS files to be fully downloaded
        if (isCI) {
          logger.info(
            "🔄 CI environment detected, waiting for LFS file download...",
          );
          await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds
        }

        // Validate the video file before using it
        try {
          await validateVideoFile(localVideoPath);
          return path.resolve(localVideoPath);
        } catch (validationError) {
          if (isCI) {
            logger.error(
              `❌ CI: Video file validation failed: ${validationError.message}`,
            );
            logger.info("🔄 CI: Attempting to pull LFS files...");
            // Try to pull LFS files in CI
            const { execSync } = require("child_process");
            try {
              execSync("git lfs pull", { stdio: "inherit" });
              logger.info("✅ LFS pull completed, re-validating...");
              await validateVideoFile(localVideoPath);
              return path.resolve(localVideoPath);
            } catch (lfsError) {
              logger.error(`❌ LFS pull failed: ${lfsError.message}`);
              throw new Error(
                `CI video file unavailable: ${validationError.message}`,
              );
            }
          } else {
            logger.warn(
              `⚠️ Local video file is invalid: ${validationError.message}`,
            );
            logger.info("🔄 Creating placeholder video as fallback...");
            return await createPlaceholderVideo();
          }
        }
      }
    }

    // No local base video found
    if (isCI) {
      throw new Error(
        "CI: No base video found in repository. Ensure video files are committed and LFS is working.",
      );
    } else {
      logger.warn(
        "⚠️ No base video found in videos folder, creating placeholder",
      );
      return await createPlaceholderVideo();
    }
  } catch (error) {
    logger.error("❌ Error getting base video:", error);
    if (process.env.CI === "true" || process.env.GITHUB_ACTIONS === "true") {
      throw error; // Fail in CI
    } else {
      logger.info("🔄 Creating placeholder video as final fallback");
      return await createPlaceholderVideo();
    }
  }
};

/**
 * Create a placeholder base video
 */
const createPlaceholderVideo = async () => {
  return new Promise((resolve, reject) => {
    const outputPath = path.resolve("videos/placeholder_base_video.mp4");

    logger.info("🎨 Creating placeholder base video...");

    ffmpeg()
      .input("color=c=0x1e3a8a:size=1080x1920:duration=60:rate=30") // Dark blue background, vertical format
      .inputFormat("lavfi")
      .outputOptions(["-c:v libx264", "-pix_fmt yuv420p", "-r 30"])
      .output(outputPath)
      .on("end", () => {
        logger.info(`✅ Placeholder base video created: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (error) => {
        logger.error("❌ Failed to create placeholder video:", error);
        reject(error);
      })
      .run();
  });
};

/**
 * Compose final video with base video, audio, images, and subtitles
 */
const composeVideo = async (
  baseVideoPath,
  audioPath,
  images,
  subtitlesPath,
  title,
) => {
  try {
    logger.info("🎬 Starting final video composition...");

    // Create final video directly in final_video folder
    const finalVideoFolder = "final_video";
    const timestamp = Date.now();
    const outputPath = path.resolve(
      path.join(finalVideoFolder, `final_video_${timestamp}.mp4`),
    );

    // Ensure final_video folder exists
    if (!fs.existsSync(finalVideoFolder)) {
      fs.mkdirSync(finalVideoFolder, { recursive: true });
    }

    logger.info(`📹 Base video: ${baseVideoPath}`);
    logger.info(`🎵 Audio: ${audioPath}`);
    logger.info(`🖼️ Images: ${images.length} files`);
    logger.info(`📝 Subtitles: ${subtitlesPath}`);
    logger.info(`📁 Output: ${outputPath}`);

    // Validate input files exist
    if (!fs.existsSync(baseVideoPath)) {
      throw new Error(`Base video file not found: ${baseVideoPath}`);
    }
    if (audioPath && !fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    // Validate base video file is actually a valid video
    try {
      await validateVideoFile(baseVideoPath);
    } catch (validationError) {
      throw new Error(`Invalid base video file: ${validationError.message}`);
    }

    return new Promise((resolve, reject) => {
      // FFmpeg is already configured with static path at module level
      let command = ffmpeg().input(baseVideoPath); // Input 0: base video

      // Add audio input if provided
      if (audioPath) {
        command = command.input(audioPath); // Input 1: audio
      }

      // Filter out images that don't exist and add valid image inputs
      const validImages = images.filter((image) =>
        fs.existsSync(image.filename),
      );

      // Add image inputs (inputs 2, 3, 4, 5, 6 for images)
      validImages.forEach((image) => {
        command = command.input(image.filename);
      });

      // Build filter for single title image overlay and subtitles
      let filterParts = [];

      // Scale base video to 1080:1920 with black padding
      filterParts.push(
        "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[base]",
      );

      // Handle single title image overlay (stays throughout video)
      let currentVideo = "[base]";
      if (validImages.length > 0) {
        // Single image - scale to 9:8 aspect ratio and place at 5% from top
        const inputIndex = audioPath ? 2 : 1; // Images start from input 2 if audio, input 1 if no audio

        // Scale to 9:8 aspect ratio (810x720 for 1080x1920 video)
        filterParts.push(
          `[${inputIndex}:v]scale=810:720:force_original_aspect_ratio=decrease[titleImg]`,
        );

        // Overlay title image at 5% from top (96px from top for 1920px height), stays throughout entire video
        filterParts.push(
          `${currentVideo}[titleImg]overlay=(W-w)/2:96[videoWithTitle]`,
        );
        currentVideo = "[videoWithTitle]";
      }

      // Handle subtitles based on whether we have overlays or not
      if (!fs.existsSync(subtitlesPath)) {
        // No subtitles, use base video or video with overlays
        filterParts.push(`${currentVideo}copy[final]`);
      } else {
        // Use working subtitles approach from test video with explicit font file
        const fontFilePath = path.resolve("fonts/BalsamiqSans-Bold.ttf");
        const safeFontPath = fontFilePath
          .replace(/\\/g, "\\\\")
          .replace(/:/g, "\\:");

        const safeSubtitlePath = subtitlesPath
          .replace(/\\/g, "\\\\")
          .replace(/:/g, "\\:")
          .replace(/'/g, "\\'");

        const subtitleFilter = `${currentVideo}subtitles='${safeSubtitlePath}':force_style='FontFile=${safeFontPath},FontSize=13,PrimaryColour=&H0000FFFF,OutlineColour=&H00000000,BorderStyle=3,BackColour=&H80000000,Bold=1,Alignment=2,MarginV=125,Outline=3,Spacing=0'[final]`;
        filterParts.push(subtitleFilter);
      }

      // Set up output options - optimized for both YouTube and Instagram
      const outputOptions = [
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "25", // Optimized for smaller file size while maintaining quality
        "-maxrate",
        "3500k", // Reduced bitrate for better compression
        "-bufsize",
        "7000k",
        "-movflags",
        "+faststart",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "30", // 30fps for compatibility
        "-t",
        "59", // Under both limits (YouTube 60s, Instagram 59s)
      ];

      // Map video stream
      outputOptions.push("-map", "[final]");

      // Map audio stream - use the provided audio if available, otherwise use base video audio
      if (audioPath) {
        outputOptions.push("-map", "1:a");
        outputOptions.push("-c:a", "aac");
        outputOptions.push("-b:a", "160k"); // Good audio quality
      } else {
        // Use audio from base video if no separate audio provided
        outputOptions.push("-map", "0:a");
        outputOptions.push("-c:a", "copy");
      }

      outputOptions.push("-shortest");

      command
        .complexFilter(filterParts.join(";"))
        .outputOptions(outputOptions)
        .output(outputPath)
        .on("start", (commandLine) => {
          logger.info("🔄 FFmpeg process started with command:");
          logger.info(commandLine);
          logger.info("🎬 Filter parts:", filterParts);
          logger.info("🎬 Complete filter:", filterParts.join(";"));
        })
        .on("progress", (progress) => {
          if (progress.percent) {
            logger.info(
              `⏳ Video composition progress: ${Math.round(progress.percent)}%`,
            );
          }
        })
        .on("end", async () => {
          logger.info(`✅ Final video composed successfully: ${outputPath}`);

          resolve({
            success: true,
            videoPath: outputPath,
            duration: null,
            format: "mp4",
            resolution: "1080x1920",
          });
        })
        .on("error", (error) => {
          logger.error("❌ Video composition failed:", error.message);
          reject(error);
        })
        .run();
    });
  } catch (error) {
    logger.error("❌ Video composition process failed:", error);
    throw error;
  }
};

/**
 * Get video metadata
 */
const getVideoMetadata = async (videoPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (error, metadata) => {
      if (error) {
        reject(error);
      } else {
        const videoStream = metadata.streams.find(
          (stream) => stream.codec_type === "video",
        );
        const audioStream = metadata.streams.find(
          (stream) => stream.codec_type === "audio",
        );

        resolve({
          duration: metadata.format.duration,
          size: metadata.format.size,
          bitrate: metadata.format.bit_rate,
          video: videoStream
            ? {
                codec: videoStream.codec_name,
                width: videoStream.width,
                height: videoStream.height,
                fps: eval(videoStream.r_frame_rate), // Convert fraction to decimal
              }
            : null,
          audio: audioStream
            ? {
                codec: audioStream.codec_name,
                sampleRate: audioStream.sample_rate,
                channels: audioStream.channels,
              }
            : null,
        });
      }
    });
  });
};

/**
 * Create optimized version for both platforms (single video)
 */
const createPlatformOptimized = async (videoPath, platform = "both") => {
  try {
    // Create a single optimized video that works for both YouTube and Instagram
    const optimizedOutputPath = videoPath.replace(".mp4", "_optimized.mp4");

    logger.info(
      `🎬 Creating single optimized video for both platforms: ${optimizedOutputPath}`,
    );

    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          "-c:v libx264",
          "-preset fast",
          "-crf 25", // Optimized for smaller file size while maintaining quality
          "-maxrate 3500k", // Reduced bitrate for better compression
          "-bufsize 7000k",
          "-c:a aac",
          "-b:a 160k", // Good audio quality
          "-movflags +faststart",
          "-vf scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2", // 9:16 aspect ratio
          "-t 59", // Under both limits (YouTube 60s, Instagram 59s)
          "-r 30", // 30fps for compatibility
        ])
        .output(optimizedOutputPath)
        .on("start", (commandLine) => {
          logger.info("🔄 Creating optimized video...");
        })
        .on("progress", (progress) => {
          if (progress.percent) {
            logger.info(
              `⏳ Optimization progress: ${Math.round(progress.percent)}%`,
            );
          }
        })
        .on("end", () => {
          logger.info(
            `✅ Single optimized video created: ${optimizedOutputPath}`,
          );
          resolve(optimizedOutputPath);
        })
        .on("error", (error) => {
          logger.error("❌ Video optimization failed:", error.message);
          reject(error);
        })
        .run();
    });

    return {
      youtube: optimizedOutputPath,
      instagram: optimizedOutputPath,
      singleVideo: true,
    };
  } catch (error) {
    logger.error("❌ Platform optimization failed:", error);
    throw error;
  }
};

/**
 * Convert HH:MM:SS.mmm time format to seconds
 */
const timeToSeconds = (timeString) => {
  const [hours, minutes, seconds] = timeString.split(":");
  const [sec, ms] = seconds.split(".");
  return (
    parseInt(hours) * 3600 +
    parseInt(minutes) * 60 +
    parseInt(sec) +
    parseInt(ms) / 1000
  );
};

/**
 * Get day-based color scheme for subtitles (7-day rotation)
 */
const getDayBasedColors = () => {
  const dayOfWeek = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.

  const colorSchemes = [
    // Sunday - Warm Orange Theme
    { textColor: "#FF6B35", bgColor: "#1a1a1a", name: "Warm Orange" },
    // Monday - Cool Blue Theme
    { textColor: "#4A90E2", bgColor: "#1a1a1a", name: "Cool Blue" },
    // Tuesday - Fresh Green Theme
    { textColor: "#50C878", bgColor: "#1a1a1a", name: "Fresh Green" },
    // Wednesday - Vibrant Purple Theme
    { textColor: "#9B59B6", bgColor: "#1a1a1a", name: "Vibrant Purple" },
    // Thursday - Energetic Red Theme
    { textColor: "#E74C3C", bgColor: "#1a1a1a", name: "Energetic Red" },
    // Friday - Golden Yellow Theme
    { textColor: "#F1C40F", bgColor: "#1a1a1a", name: "Golden Yellow" },
    // Saturday - Pink Theme
    { textColor: "#E91E63", bgColor: "#1a1a1a", name: "Pink" },
  ];

  return colorSchemes[dayOfWeek];
};

/**
 * Compose reel video with subtitles and background music
 */
const composeReelVideo = async (options) => {
  const {
    baseVideo,
    subtitles,
    backgroundMusic,
    outputPath,
    subtitleSettings = {
      fontSize: 32,
      fontFamily: "Inter",
      color: "#FFFFFF",
      bgColor: "rgba(0,0,0,0.8)",
      paddingX: 16,
      paddingY: 8,
    },
  } = options;

  try {
    logger.info("🎬 Starting reel video composition...");

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    logger.info(`📹 Base video: ${baseVideo}`);
    logger.info(`📝 Subtitles: ${subtitles}`);
    logger.info(`🎵 Background music: ${backgroundMusic || "none"}`);
    logger.info(`📁 Output: ${outputPath}`);

    // Validate input files exist
    if (!fs.existsSync(baseVideo)) {
      throw new Error(`Base video file not found: ${baseVideo}`);
    }
    if (subtitles && !fs.existsSync(subtitles)) {
      throw new Error(`Subtitles file not found: ${subtitles}`);
    }
    if (backgroundMusic && !fs.existsSync(backgroundMusic)) {
      throw new Error(`Background music file not found: ${backgroundMusic}`);
    }

    return new Promise((resolve, reject) => {
      let command = ffmpeg().input(baseVideo); // Input 0: base video

      // Add background music input if provided
      if (backgroundMusic) {
        command = command.input(backgroundMusic); // Input 1: background music
      }

      // Build filter for subtitles
      let filterParts = [];

      // Scale base video to 1080:1920 with black padding
      filterParts.push(
        "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[base]",
      );

      let currentVideo = "[base]";

      // Handle subtitles
      if (subtitles && fs.existsSync(subtitles)) {
        // Use Montserrat Bold for Instagram-optimized look
        const fontFilePath = path.resolve("fonts/Montserrat-Bold.ttf");
        const safeFontPath = fontFilePath
          .replace(/\\/g, "\\\\")
          .replace(/:/g, "\\:");

        const safeSubtitlePath = subtitles
          .replace(/\\/g, "\\\\")
          .replace(/:/g, "\\:")
          .replace(/'/g, "\\'");

        // Get day-based color scheme
        const dayColors = getDayBasedColors();
        const primaryColour = `&H${dayColors.textColor.slice(5, 7)}${dayColors.textColor.slice(3, 5)}${dayColors.textColor.slice(1, 3)}&`;

        logger.info(`🎨 Using ${dayColors.name} color scheme for subtitles`);

        const subtitleFilter = `${currentVideo}subtitles='${safeSubtitlePath}':force_style='FontFile=${safeFontPath},FontSize=${subtitleSettings.fontSize},PrimaryColour=${primaryColour},OutlineColour=&H00000000,BorderStyle=3,BackColour=&H80000000,Bold=1,Alignment=2,MarginV=125,Outline=3,Spacing=0'[final]`;
        filterParts.push(subtitleFilter);
      } else {
        filterParts.push(`${currentVideo}copy[final]`);
      }

      // Set up output options
      const outputOptions = [
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "25",
        "-maxrate",
        "3500k",
        "-bufsize",
        "7000k",
        "-movflags",
        "+faststart",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "30",
        "-t",
        "59", // Limit to 59 seconds
      ];

      // Map video stream
      outputOptions.push("-map", "[final]");

      // Map audio stream
      if (backgroundMusic) {
        outputOptions.push("-map", "1:a");
        outputOptions.push("-c:a", "aac");
        outputOptions.push("-b:a", "160k");
      } else {
        // Use audio from base video
        outputOptions.push("-map", "0:a");
        outputOptions.push("-c:a", "copy");
      }

      outputOptions.push("-shortest");

      command
        .complexFilter(filterParts.join(";"))
        .outputOptions(outputOptions)
        .output(outputPath)
        .on("start", (commandLine) => {
          logger.info("🔄 FFmpeg reel composition started");
          logger.info("Filter:", filterParts.join(";"));
        })
        .on("progress", (progress) => {
          if (progress.percent) {
            logger.info(
              `⏳ Reel composition progress: ${Math.round(progress.percent)}%`,
            );
          }
        })
        .on("end", () => {
          logger.info(`✅ Reel video composed successfully: ${outputPath}`);
          resolve({
            success: true,
            videoPath: outputPath,
            duration: null,
            format: "mp4",
            resolution: "1080x1920",
          });
        })
        .on("error", (error) => {
          logger.error("❌ Reel composition failed:", error.message);
          reject(error);
        })
        .run();
    });
  } catch (error) {
    logger.error("❌ Reel composition process failed:", error);
    throw error;
  }
};

module.exports = {
  getBaseVideo,
  composeVideo,
  composeReelVideo,
  getDayBasedColors,
  createPlaceholderVideo,
  getVideoMetadata,
  createPlatformOptimized,
  validateVideoFile,
};
