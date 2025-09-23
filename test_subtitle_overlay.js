const ffmpegPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);
const fs = require("fs");
const path = require("path");
const logger = require("./src/config/logger");

/**
 * Test subtitle overlay on base video
 */
const testSubtitleOverlay = async () => {
  try {
    logger.info("🧪 Testing subtitle overlay on base video...");

    // Create dummy subtitles file
    const dummySubtitlesPath = path.resolve("test_subtitles.srt");
    const dummySubtitles = `1
00:00:01,000 --> 00:00:04,000
MONTSERRAT-BLACK FONT TEST
This should look BOLD & CONDENSED

2
00:00:05,000 --> 00:00:08,000
If you see Arial-like text
Font loading FAILED

3
00:00:10,000 --> 00:00:13,000
Montserrat-Black is very BOLD
with DISTINCTIVE letter shapes

4
00:00:15,000 --> 00:00:18,000
ABCDEFGHIJKLMNOPQRSTUVWXYZ
1234567890
Check character shapes!`;

    fs.writeFileSync(dummySubtitlesPath, dummySubtitles);
    logger.info(`📝 Created dummy subtitles: ${dummySubtitlesPath}`);

    // Find base video
    const videosDir = "videos";
    let baseVideoPath = null;

    if (fs.existsSync(videosDir)) {
      const videoFiles = fs
        .readdirSync(videosDir)
        .filter(
          (file) =>
            file.toLowerCase().includes(".mp4") ||
            file.toLowerCase().includes("base") ||
            file.toLowerCase().includes("background")
        );

      if (videoFiles.length > 0) {
        baseVideoPath = path.join(videosDir, videoFiles[0]);
        logger.info(`✅ Found base video: ${baseVideoPath}`);
      }
    }

    if (!baseVideoPath) {
      throw new Error("No base video found in videos directory");
    }

    // Output path in root directory
    const outputPath = path.resolve(`subtitle_test_${Date.now()}.mp4`);
    logger.info(`📁 Output video: ${outputPath}`);

    return new Promise((resolve, reject) => {
      let command = ffmpeg().input(baseVideoPath);

      // Build filter for subtitle overlay
      let filterParts = [];

      // Scale base video to 1080:1920 with black padding
      filterParts.push(
        "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[base]"
      );

      // Use working subtitles approach from videoProcessingService.js with explicit font file
      const fontFilePath = path.resolve("fonts/Montserrat-Black.ttf");
      const safeFontPath = fontFilePath
        .replace(/\\/g, "\\\\")
        .replace(/:/g, "\\:");

      const safeSubtitlePath = dummySubtitlesPath
        .replace(/\\/g, "\\\\")
        .replace(/:/g, "\\:")
        .replace(/'/g, "\\'");

      // Try with FontFile parameter using our Montserrat-Black font (exact code from videoProcessingService.js)
      const subtitleFilter = `[base]subtitles='${safeSubtitlePath}':force_style='FontFile=${safeFontPath},FontSize=11,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,BackColour=&H80000000,Bold=1,Alignment=2,MarginV=37,Outline=3,Spacing=0'[final]`;
      filterParts.push(subtitleFilter);

      // Set up output options
      const outputOptions = [
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-maxrate",
        "4000k",
        "-bufsize",
        "8000k",
        "-movflags",
        "+faststart",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "30",
        "-t",
        "20", // 20 second test video
        "-map",
        "[final]",
        "-map",
        "0:a", // Use audio from base video
        "-c:a",
        "copy",
        "-shortest",
      ];

      command
        .complexFilter(filterParts.join(";"))
        .outputOptions(outputOptions)
        .output(outputPath)
        .on("start", (commandLine) => {
          logger.info("🔄 FFmpeg subtitle test started:");
          logger.info(commandLine);
          logger.info("🎬 Filter:", filterParts.join(";"));
        })
        .on("progress", (progress) => {
          if (progress.percent) {
            logger.info(
              `⏳ Subtitle test progress: ${Math.round(progress.percent)}%`
            );
          }
        })
        .on("end", () => {
          logger.info(`✅ Subtitle test video created: ${outputPath}`);

          // Clean up dummy subtitles
          if (fs.existsSync(dummySubtitlesPath)) {
            fs.unlinkSync(dummySubtitlesPath);
            logger.info("🧹 Cleaned up dummy subtitles file");
          }

          resolve({
            success: true,
            videoPath: outputPath,
            subtitlesPath: dummySubtitlesPath,
            message: "Subtitle overlay test completed successfully",
          });
        })
        .on("error", (error) => {
          logger.error("❌ Subtitle test failed:", error.message);

          // Clean up on error
          if (fs.existsSync(dummySubtitlesPath)) {
            fs.unlinkSync(dummySubtitlesPath);
          }

          reject(error);
        })
        .run();
    });
  } catch (error) {
    logger.error("❌ Subtitle overlay test failed:", error);
    throw error;
  }
};

// Run the test if this file is executed directly
if (require.main === module) {
  testSubtitleOverlay()
    .then((result) => {
      console.log("✅ Test completed successfully:", result);
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Test failed:", error);
      process.exit(1);
    });
}

module.exports = {
  testSubtitleOverlay,
};
