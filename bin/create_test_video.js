const ffmpegPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);
const fs = require("fs");
const path = require("path");
const logger = require("../src/config/logger");

/**
 * Create a test video with default image overlay and styled subtitles
 */
const createTestVideoWithDefaultImage = async () => {
  try {
    logger.info("🎬 Creating test video with default image overlay...");

    // File paths
    const baseVideoPath = path.join("videos", "Base-vedio.mp4");
    const defaultImagePath = path.join("videos", "default-image.jpg");
    const fontPath = path.join("fonts", "Montserrat-Black.ttf");
    const outputPath = path.join("videos", `test_video_${Date.now()}.mp4`);

    // Verify input files exist
    [baseVideoPath, defaultImagePath, fontPath].forEach((file) => {
      if (!fs.existsSync(file)) {
        throw new Error(`File not found: ${file}`);
      }
    });

    logger.info(`📹 Base video: ${baseVideoPath}`);
    logger.info(`🖼️ Default image: ${defaultImagePath}`);
    logger.info(`🔤 Font: ${fontPath}`);
    logger.info(`📤 Output: ${outputPath}`);

    // Create 5 dummy subtitle entries (every 10 seconds)
    const subtitleEntries = [];
    for (let i = 0; i < 5; i++) {
      const startTime = i * 10;
      const endTime = startTime + 8; // 8s duration
      subtitleEntries.push({
        index: i + 1,
        startTime,
        endTime,
        text: `Test Subtitle ${i + 1}: Educational Content Example`,
      });
    }

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
      `test_subtitles_${Date.now()}.srt`
    );
    fs.writeFileSync(subtitlePath, srtContent);
    logger.info(`📝 Created SRT subtitle file: ${subtitlePath}`);

    // FFmpeg command setup
    let command = ffmpeg().input(baseVideoPath);
    command = command.input(defaultImagePath);

    // Build complex filter for image overlay and subtitles
    let filterParts = [];

    // 1. Scale base video to 1080x1920 (9:16)
    filterParts.push(
      "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[base]"
    );

    // 2. Scale image to fit upper portion
    filterParts.push(
      "[1:v]scale=900:600:force_original_aspect_ratio=decrease,pad=900:600:(ow-iw)/2:(oh-ih)/2:black[img]"
    );

    // 3. Overlay image on base video
    filterParts.push(
      "[base][img]overlay=90:48:enable='between(t,0,8)+between(t,10,18)+between(t,20,28)+between(t,30,38)+between(t,40,48)'[video]"
    );

    // 4. Add styled SRT subtitles
    const safeSubtitlePath = subtitlePath
      .replace(/\\/g, "\\\\")
      .replace(/:/g, "\\:")
      .replace(/'/g, "\\'");
    // const subtitleFilter = `[video]subtitles='${safeSubtitlePath}':force_style='FontName=Montserrat Black,FontSize=13,PrimaryColour=&H00FFFFFF,OutlineColour=&H000000,BorderStyle=3,BackColour=&H80000080,Alignment=2'[final]`;
    // const subtitleFilter = `[video]subtitles='${safeSubtitlePath}':force_style='FontName=Montserrat Black,FontSize=13,PrimaryColour=&H0000FFFF,OutlineColour=&H000000,BorderStyle=3,BackColour=&H80000080,Bold=1,Alignment=2'[final]`;
    const subtitleFilter = `[video]subtitles='${safeSubtitlePath}':force_style='FontName=Impact ,FontSize=12,PrimaryColour=&H0000FFFF,OutlineColour=&H000000,BorderStyle=3,BackColour=&H80000080,Bold=1,Alignment=2,MarginV=28,Outline=2,Spacing=1'[final]`;
    const safeFontPath = fontPath.replace(/\\/g, "/");

    // const subtitleFilter = `[video]drawtext=fontfile=${safeFontPath}:text='Test Subtitle 1':fontsize=74:fontcolor=yellow:borderw=20:box=1:spacing=1:boxcolor=black@0.7:x=(w-text_w)/2:y=h-304[final]`;

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
      "50", // 50 seconds total
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
        .on("start", (cmd) => logger.info("🔄 FFmpeg started: " + cmd))
        .on("progress", (p) => {
          if (p.percent) logger.info(`⏳ Progress: ${Math.round(p.percent)}%`);
        })
        .on("end", () => {
          logger.info(`✅ Video created: ${outputPath}`);
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
      duration: 50,
      subtitles: subtitleEntries.length,
      font: "Montserrat Black (SRT)",
      fontSize: 36,
      imagePosition: "Top 2.5%, Centered (x=90)",
      subtitlePosition: "Bottom-Center",
      subtitleFormat: "SRT",
      resolution: "1080x1920",
    };
  } catch (error) {
    logger.error("❌ Failed to create video:", error);
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
 * Test function
 */
const testVideoCreation = async () => {
  try {
    logger.info("🧪 Starting video test...");
    const result = await createTestVideoWithDefaultImage();
    logger.info("✅ Test completed!", result);
  } catch (err) {
    logger.error("❌ Test failed:", err.message);
  }
};

// Export
module.exports = { createTestVideoWithDefaultImage, testVideoCreation };

// Run if called directly
if (require.main === module) {
  testVideoCreation();
}
