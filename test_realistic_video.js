const ffmpegPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Create a test video using the exact same processing as videoProcessingService.js
 */
async function createRealisticTestVideo() {
  return new Promise((resolve, reject) => {
    try {
      console.log("🎬 Creating realistic test video with real processing...");

      const baseVideoPath = path.join("videos", "Base-vedio.mp4");
      const dummyImagePath = path.join("videos", "default-image.jpg");
      const outputPath = path.join(
        "final_video",
        `realistic_test_${Date.now()}.mp4`
      );

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Check if files exist
      if (!fs.existsSync(baseVideoPath)) {
        throw new Error(`Base video not found: ${baseVideoPath}`);
      }
      if (!fs.existsSync(dummyImagePath)) {
        throw new Error(`Dummy image not found: ${dummyImagePath}`);
      }

      // Create dummy subtitle file with realistic content
      const subtitleContent = `1
00:00:00,000 --> 00:00:04,000
DUMMY CAPTION TEST - Educational Content

2
00:00:04,000 --> 00:00:08,000
Testing Video Processing Pipeline

3
00:00:08,000 --> 00:00:12,000
Like • Comment • Share • Subscribe

4
00:00:12,000 --> 00:00:16,000
Follow for more educational content!`;

      const subtitlePath = path.join("temp", "realistic_subtitles.srt");
      if (!fs.existsSync("temp")) {
        fs.mkdirSync("temp", { recursive: true });
      }
      fs.writeFileSync(subtitlePath, subtitleContent);

      console.log(`📹 Base video: ${baseVideoPath}`);
      console.log(`🖼️ Dummy image: ${dummyImagePath}`);
      console.log(`📝 Subtitles: ${subtitlePath}`);
      console.log(`📁 Output: ${outputPath}`);

      // Build the exact same filter chain as videoProcessingService.js
      const fontFilePath = path.resolve("fonts/Montserrat-Black.ttf");
      const safeFontPath = fontFilePath
        .replace(/\\/g, "\\\\")
        .replace(/:/g, "\\:");
      const safeSubtitlePath = subtitlePath
        .replace(/\\/g, "\\\\")
        .replace(/:/g, "\\:")
        .replace(/'/g, "\\'");

      // Complex filter chain (same as videoProcessingService.js)
      const filterComplex = [
        // Scale base video to 1080:1920 with black padding
        "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[base]",
        // Scale image to 810:720 (9:8 aspect ratio)
        "[1:v]scale=810:720:force_original_aspect_ratio=decrease[titleImg]",
        // Overlay image at 5% from top (96px from top for 1920px height)
        "[base][titleImg]overlay=(W-w)/2:96[videoWithTitle]",
        // Add subtitles with exact same styling as videoProcessingService.js
        `[videoWithTitle]subtitles='${safeSubtitlePath}':force_style='FontFile=${safeFontPath},FontSize=11,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,BackColour=&H80000000,Bold=1,Alignment=2,MarginV=125,Outline=3,Spacing=0'[final]`,
      ].join(";");

      ffmpeg(baseVideoPath)
        .input(dummyImagePath)
        .setDuration(16) // 16 seconds to show all subtitle segments
        .complexFilter(filterComplex)
        .outputOptions([
          "-map",
          "[final]", // Map the final filtered video
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
          "16",
        ])
        .output(outputPath)
        .on("start", (commandLine) => {
          console.log("🔧 FFmpeg command:", commandLine);
        })
        .on("progress", (progress) => {
          console.log(`📊 Progress: ${progress.percent || 0}% done`);
        })
        .on("end", () => {
          console.log("✅ Realistic test video created successfully!");
          console.log(`📁 Output file: ${outputPath}`);
          console.log(
            "🎯 Features: Image overlay + Subtitles + Mobile aspect ratio"
          );

          // Clean up temp subtitle file
          if (fs.existsSync(subtitlePath)) {
            fs.unlinkSync(subtitlePath);
          }

          resolve({
            success: true,
            outputPath: outputPath,
            duration: 16,
            imageOverlay: true,
            subtitles: true,
            aspectRatio: "9:16",
            font: "Montserrat-Black.ttf",
          });
        })
        .on("error", (err) => {
          console.error("❌ FFmpeg error:", err.message);
          reject(err);
        })
        .run();
    } catch (error) {
      console.error("❌ Error:", error.message);
      reject(error);
    }
  });
}

// Run the test
createRealisticTestVideo()
  .then((result) => {
    console.log("🎉 Realistic test completed successfully!");
    console.log("Result:", result);
  })
  .catch((error) => {
    console.error("💥 Test failed:", error.message);
  });
