const ffmpegPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);
const fs = require("fs");
const path = require("path");
const logger = require("../src/config/logger");

/**
 * Test Video Creation Utilities
 *
 * This file provides functions to create test videos with Montserrat Black font and SRT subtitles.
 *
 * Usage:
 * - createTestVideoWithDefaultImage(): Basic test video with 6 subtitle segments
 * - createDetailedTestVideo(): Comprehensive test video with 8 detailed subtitle segments
 * - testVideoCreation(): Run basic test
 * - testDetailedVideoCreation(): Run detailed test
 *
 * Features:
 * ✅ Montserrat-Black.ttf font for bold, readable subtitles
 * ✅ Realistic educational content in subtitles
 * ✅ Proper SRT timing and formatting
 * ✅ 9:16 aspect ratio (1080x1920) for mobile optimization
 * ✅ Image overlays with timing
 * ✅ Automatic subtitle file cleanup
 */

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

    // Create realistic educational subtitle entries with proper timing
    // Using Montserrat Black font for bold, readable subtitles
    // Create 6 realistic educational subtitle entries (every 8 seconds)
    const subtitleEntries = [
      {
        index: 1,
        startTime: 0,
        endTime: 7,
        text: "Welcome to our educational series on React Hooks!",
      },
      {
        index: 2,
        startTime: 8,
        endTime: 15,
        text: "Today we'll explore advanced React Hooks patterns.",
      },
      {
        index: 3,
        startTime: 16,
        endTime: 23,
        text: "React Hooks revolutionized how we write React components.",
      },
      {
        index: 4,
        startTime: 24,
        endTime: 31,
        text: "Let's dive deep into useState and useEffect hooks.",
      },
      {
        index: 5,
        startTime: 32,
        endTime: 39,
        text: "Understanding the lifecycle of React components is crucial.",
      },
      {
        index: 6,
        startTime: 40,
        endTime: 47,
        text: "Thank you for watching! Don't forget to like and subscribe.",
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

    // 4. Add styled SRT subtitles with Montserrat Black font
    const safeSubtitlePath = subtitlePath
      .replace(/\\/g, "\\\\")
      .replace(/:/g, "\\:")
      .replace(/'/g, "\\'");

    // Enhanced subtitle styling with Montserrat Black font
    const subtitleFilter = `[video]subtitles='${safeSubtitlePath}':force_style='FontName=Montserrat Black,FontSize=13,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,BackColour=&H80000000,Bold=1,Alignment=2,MarginV=37,Outline=3,Spacing=0'[final]`;
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
      font: "Montserrat-Black.ttf",
      fontSize: 36,
      fontStyle:
        "Bold Black variant with white text, black outline, semi-transparent background",
      imagePosition: "Top 2.5%, Centered (x=90)",
      subtitlePosition: "Bottom-Center with 80px margin from bottom",
      subtitleFormat: "SRT with realistic educational content",
      resolution: "1080x1920 (9:16)",
      subtitleTiming: "8-second intervals with 1-second gaps",
      content: "Educational React Hooks tutorial subtitles",
    };
  } catch (error) {
    logger.error("❌ Failed to create video:", error);
    throw error;
  }
};

/**
 * Create a comprehensive test video with detailed educational subtitles
 */
const createDetailedTestVideo = async () => {
  try {
    logger.info(
      "🎬 Creating detailed test video with comprehensive subtitles..."
    );

    // File paths
    const baseVideoPath = path.join("videos", "Base-vedio.mp4");
    const defaultImagePath = path.join("videos", "default-image.jpg");
    const fontPath = path.join("fonts", "Montserrat-Black.ttf");
    const outputPath = path.join(
      "videos",
      `detailed_test_video_${Date.now()}.mp4`
    );

    // Verify input files exist
    [baseVideoPath, defaultImagePath, fontPath].forEach((file) => {
      if (!fs.existsSync(file)) {
        throw new Error(`File not found: ${file}`);
      }
    });

    // Create detailed educational subtitle entries
    const subtitleEntries = [
      {
        index: 1,
        startTime: 0,
        endTime: 6,
        text: "Welcome to our comprehensive guide on React Hooks!",
      },
      {
        index: 2,
        startTime: 7,
        endTime: 13,
        text: "React Hooks changed how we write React applications forever.",
      },
      {
        index: 3,
        startTime: 14,
        endTime: 20,
        text: "Let's explore the fundamental hooks: useState and useEffect.",
      },
      {
        index: 4,
        startTime: 21,
        endTime: 27,
        text: "useState allows us to add state to functional components.",
      },
      {
        index: 5,
        startTime: 28,
        endTime: 34,
        text: "useEffect handles side effects in our React components.",
      },
      {
        index: 6,
        startTime: 35,
        endTime: 41,
        text: "Understanding the dependency array is crucial for performance.",
      },
      {
        index: 7,
        startTime: 42,
        endTime: 48,
        text: "Custom hooks help us reuse logic across components.",
      },
      {
        index: 8,
        startTime: 49,
        endTime: 55,
        text: "Thank you for learning with us! Stay curious and keep coding.",
      },
    ];

    // Create SRT content
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
      `detailed_test_subtitles_${Date.now()}.srt`
    );
    fs.writeFileSync(subtitlePath, srtContent);
    logger.info(`📝 Created detailed SRT subtitle file: ${subtitlePath}`);

    // FFmpeg command setup
    let command = ffmpeg().input(baseVideoPath);
    command = command.input(defaultImagePath);

    // Build complex filter
    let filterParts = [];

    // Scale base video to 1080x1920
    filterParts.push(
      "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[base]"
    );

    // Scale image
    filterParts.push(
      "[1:v]scale=900:600:force_original_aspect_ratio=decrease,pad=900:600:(ow-iw)/2:(oh-ih)/2:black[img]"
    );

    // Overlay image with multiple timing segments
    filterParts.push(
      "[base][img]overlay=90:48:enable='between(t,0,13)+between(t,14,27)+between(t,28,41)+between(t,42,55)'[video]"
    );

    // Add styled subtitles with Montserrat Black
    const safeSubtitlePath = subtitlePath
      .replace(/\\/g, "\\\\")
      .replace(/:/g, "\\:")
      .replace(/'/g, "\\'");

    const subtitleFilter = `[video]subtitles='${safeSubtitlePath}':force_style='FontName=Montserrat Black,FontSize=32,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=4,BackColour=&H90000000,Bold=1,Alignment=2,MarginV=100,Outline=2.5,Spacing=0.5'[final]`;
    filterParts.push(subtitleFilter);

    // Output options for longer video
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
      "60", // 60 seconds for more content
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
          logger.info(`✅ Detailed video created: ${outputPath}`);
          resolve();
        })
        .on("error", (err) => {
          logger.error("❌ FFmpeg error:", err);
          reject(err);
        })
        .run();
    });

    // Clean up subtitle file
    if (fs.existsSync(subtitlePath)) {
      fs.unlinkSync(subtitlePath);
      logger.info("🗑️ Deleted temporary SRT file");
    }

    return {
      success: true,
      outputPath,
      duration: 60,
      subtitles: subtitleEntries.length,
      font: "Montserrat-Black.ttf",
      fontSize: 32,
      style: "Educational content with proper timing and spacing",
      content: "Comprehensive React Hooks tutorial with 8 subtitle segments",
    };
  } catch (error) {
    logger.error("❌ Failed to create detailed video:", error);
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

/**
 * Test function for detailed video
 */
const testDetailedVideoCreation = async () => {
  try {
    logger.info("🧪 Starting detailed video test...");
    const result = await createDetailedTestVideo();
    logger.info("✅ Detailed test completed!", result);
  } catch (err) {
    logger.error("❌ Detailed test failed:", err.message);
  }
};

// Export
module.exports = {
  createTestVideoWithDefaultImage,
  createDetailedTestVideo,
  testVideoCreation,
  testDetailedVideoCreation,
};

// Run if called directly
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes("--detailed")) {
    logger.info("🎬 Running detailed test video creation...");
    testDetailedVideoCreation();
  } else {
    logger.info("🎬 Running basic test video creation...");
    testVideoCreation();
  }
}
