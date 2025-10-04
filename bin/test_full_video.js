const ffmpegPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Create a comprehensive test video with dummy subtitles and images
 */
async function createFullTestVideo() {
  return new Promise((resolve, reject) => {
    try {
      console.log("🎬 Creating comprehensive test video with overlays...");

      const baseVideoPath = path.join("videos", "Base-vedio.mp4");
      const outputPath = path.join(
        "final_video",
        `full_test_video_${Date.now()}.mp4`
      );

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Check if base video exists
      if (!fs.existsSync(baseVideoPath)) {
        throw new Error(`Base video not found: ${baseVideoPath}`);
      }

      // Create dummy subtitle file
      const subtitleContent = `1
00:00:00,000 --> 00:00:05,000
This is a DUMMY CAPTION TEST
Educational content about technology

2
00:00:05,000 --> 00:00:10,000
DUMMY SUBTITLE OVERLAY
Testing video processing pipeline

3
00:00:10,000 --> 00:00:15,000
MORE DUMMY TEXT
Like • Share • Subscribe • Follow`;

      const subtitlePath = path.join("temp", "dummy_subtitles.srt");
      if (!fs.existsSync("temp")) {
        fs.mkdirSync("temp", { recursive: true });
      }
      fs.writeFileSync(subtitlePath, subtitleContent);

      console.log(`📹 Base video: ${baseVideoPath}`);
      console.log(`📝 Dummy subtitles: ${subtitlePath}`);
      console.log(`📁 Output: ${outputPath}`);

      // Use FFmpeg with subtitle overlay (similar to real processing)
      const fontPath = path.resolve("fonts/Montserrat-Black.ttf");

      ffmpeg(baseVideoPath)
        .setDuration(15) // 15 seconds for 3 subtitle segments
        .outputOptions([
          `-vf subtitles='${subtitlePath
            .replace(/\\/g, "\\\\")
            .replace(/'/g, "\\'")}':force_style='FontFile=${fontPath
            .replace(/\\/g, "\\\\")
            .replace(
              /:/g,
              "\\:"
            )},FontSize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,BackColour=&H80000000,Bold=1,Alignment=2,MarginV=150,Outline=3'`,
          "-c:v",
          "libx264",
          "-preset",
          "fast",
          "-crf",
          "23",
          "-movflags",
          "+faststart",
          "-pix_fmt",
          "yuv420p",
          "-r",
          "30",
        ])
        .output(outputPath)
        .on("start", (commandLine) => {
          console.log("🔧 FFmpeg command:", commandLine);
        })
        .on("progress", (progress) => {
          console.log(`📊 Progress: ${progress.percent || 0}% done`);
        })
        .on("end", () => {
          console.log(
            "✅ Full test video with subtitles created successfully!"
          );
          console.log(`📁 Output file: ${outputPath}`);

          // Clean up temp subtitle file
          if (fs.existsSync(subtitlePath)) {
            fs.unlinkSync(subtitlePath);
          }

          resolve({
            success: true,
            outputPath: outputPath,
            duration: 15,
            subtitles: true,
            font: fontPath,
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
createFullTestVideo()
  .then((result) => {
    console.log("🎉 Full test completed successfully!");
    console.log("Result:", result);
  })
  .catch((error) => {
    console.error("💥 Test failed:", error.message);
  });
