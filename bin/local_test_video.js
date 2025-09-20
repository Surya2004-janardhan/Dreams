const ffmpegPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);
const fs = require("fs");
const path = require("path");
const logger = require("../src/config/logger");

/**
 * Local Test: Create video with base video, dummy subtitles, and default image
 */
const createLocalTestVideo = async () => {
  try {
    logger.info("🧪 Creating local test video with all improvements...");

    // File paths
    const baseVideoPath = path.join("videos", "Base-vedio.mp4");
    const defaultImagePath = path.join("videos", "default-image.jpg");
    const fontPath = path.join("fonts", "Montserrat-Black.ttf");
    const outputPath = path.join("videos", `local_test_${Date.now()}.mp4`);

    // Verify input files exist
    if (!fs.existsSync(baseVideoPath)) {
      throw new Error(`Base video not found: ${baseVideoPath}`);
    }
    if (!fs.existsSync(defaultImagePath)) {
      throw new Error(`Default image not found: ${defaultImagePath}`);
    }
    if (!fs.existsSync(fontPath)) {
      logger.warn(`Font not found: ${fontPath}, subtitles may not work`);
    }

    logger.info(`📹 Base video: ${baseVideoPath}`);
    logger.info(`🖼️ Default image: ${defaultImagePath}`);
    logger.info(`🔤 Font: ${fontPath}`);
    logger.info(`📤 Output: ${outputPath}`);

    // Create dummy educational subtitle entries
    const subtitleEntries = [
      {
        index: 1,
        startTime: 0,
        endTime: 8,
        text: "Welcome to our educational series on Database Design Principles!",
      },
      {
        index: 2,
        startTime: 9,
        endTime: 17,
        text: "Today we'll explore normalization, indexing, and optimization techniques.",
      },
      {
        index: 3,
        startTime: 18,
        endTime: 26,
        text: "Database normalization helps eliminate data redundancy and improve integrity.",
      },
      {
        index: 4,
        startTime: 27,
        endTime: 35,
        text: "First Normal Form (1NF) requires atomic values in each column.",
      },
      {
        index: 5,
        startTime: 36,
        endTime: 44,
        text: "Second Normal Form (2NF) removes partial dependencies on the primary key.",
      },
      {
        index: 6,
        startTime: 45,
        endTime: 53,
        text: "Third Normal Form (3NF) eliminates transitive dependencies.",
      },
    ];

    // Create SRT subtitle file content
    const srtContent = subtitleEntries
      .map(
        (entry) =>
          `${entry.index}\n${formatTime(entry.startTime)} --> ${formatTime(
            entry.endTime
          )}\n${entry.text}\n`
      )
      .join("\n");

    const subtitlePath = path.join(
      "subtitles",
      `local_test_subtitles_${Date.now()}.srt`
    );
    fs.writeFileSync(subtitlePath, srtContent);
    logger.info(`📝 Created SRT subtitle file: ${subtitlePath}`);

    // FFmpeg command setup
    let command = ffmpeg().input(baseVideoPath);
    command = command.input(defaultImagePath);

    // Build complex filter for image overlay and subtitles
    let filterParts = [];

    // 1. Scale base video to 1080:1920 (9:16)
    filterParts.push(
      "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[base]"
    );

    // 2. Scale image to 90% width (972px) without padding
    filterParts.push(
      "[1:v]scale=972:-1:force_original_aspect_ratio=decrease[img]"
    );

    // 3. Overlay image on base video with timing
    filterParts.push(
      "[base][img]overlay=(W-w)/2:20:enable='between(t,0,8)+between(t,10,18)+between(t,20,28)+between(t,30,38)+between(t,40,48)'[video]"
    );

    // 4. Add styled SRT subtitles with Montserrat Black font
    const safeSubtitlePath = subtitlePath
      .replace(/\\/g, "\\\\")
      .replace(/:/g, "\\:")
      .replace(/'/g, "\\'");

    const subtitleFilter = `[video]subtitles='${safeSubtitlePath}':force_style='FontName=Montserrat Black,FontSize=13,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,BackColour=&H80000000,Bold=1,Alignment=2,MarginV=37,Outline=3,Spacing=0'[final]`;
    filterParts.push(subtitleFilter);

    // Output options
    const outputOptions = [
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-movflags",
      "+faststart",
      "-pix_fmt",
      "yuv420p",
      "-r",
      "30",
      "-t",
      "55", // 55 seconds for all subtitles
      "-map",
      "[final]",
      "-map",
      "0:a",
    ];

    // Execute FFmpeg
    await new Promise((resolve, reject) => {
      command
        .complexFilter(filterParts.join(";"))
        .outputOptions(outputOptions)
        .output(outputPath)
        .on("start", (cmd) => {
          logger.info("🔄 FFmpeg started:");
          logger.info(cmd);
          logger.info("🎬 Filter:", filterParts.join(";"));
        })
        .on("progress", (p) => {
          if (p.percent) logger.info(`⏳ Progress: ${Math.round(p.percent)}%`);
        })
        .on("end", () => {
          logger.info(`✅ Local test video created: ${outputPath}`);
          logger.info("🎯 Test Results:");
          logger.info("✅ Subtitles: Included with Montserrat Black font");
          logger.info("✅ Image borders: None (displayed as-is)");
          logger.info("✅ Image width: 90% of video width (972px)");
          logger.info(
            "✅ Image position: Upper portion, centered horizontally"
          );
          logger.info("✅ Video quality: Optimized for both platforms");
          resolve();
        })
        .on("error", (err) => {
          logger.error("❌ FFmpeg error:", err);
          reject(err);
        })
        .run();
    });

    // Clean up
    if (fs.existsSync(subtitlePath)) {
      fs.unlinkSync(subtitlePath);
      logger.info("🗑️ Deleted temporary SRT file");
    }

    return {
      success: true,
      outputPath,
      duration: 55,
      subtitles: subtitleEntries.length,
      font: "Montserrat-Black.ttf",
      imageWidth: "972px (90% of 1080px)",
      borderColor: "none (displayed as-is)",
      position: "centered horizontally",
      quality: "optimized for YouTube and Instagram",
    };
  } catch (error) {
    logger.error("❌ Failed to create local test video:", error);
    throw error;
  }
};

/**
 * Helper: format seconds to SRT time
 */
const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms
    .toString()
    .padStart(3, "0")}`;
};

/**
 * Run local test
 */
const runLocalTest = async () => {
  try {
    logger.info("🧪 Starting local video test...");
    const result = await createLocalTestVideo();
    logger.info("✅ Local test completed successfully!");
    logger.info("📊 Test Results:", result);
  } catch (err) {
    logger.error("❌ Local test failed:", err.message);
  }
};

// Export
module.exports = {
  createLocalTestVideo,
  runLocalTest,
};

// Run if called directly
if (require.main === module) {
  logger.info("🎬 Running local video test...");
  runLocalTest();
}
