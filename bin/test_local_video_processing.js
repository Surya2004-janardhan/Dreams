const { composeVideo } = require("../src/services/videoProcessingService");
const fs = require("fs");
const path = require("path");

/**
 * Test local video processing with dummy image and subtitles
 */
async function testLocalVideoProcessing() {
  try {
    console.log(
      "🎬 Testing local video processing with dummy image and subtitles..."
    );

    // Test files
    const baseVideoPath = path.join("videos", "Base-vedio.mp4");
    const audioPath = null; // No audio for this test
    const subtitlesPath = path.join("temp", "dummy_test_subtitles.srt");
    const title = "Local Video Processing Test";

    // Create dummy subtitles
    const dummySubtitles = `1
00:00:00,000 --> 00:00:05,000
Testing local video processing!

2
00:00:05,000 --> 00:00:10,000
With dummy image overlay.

3
00:00:10,000 --> 00:00:15,000
And custom subtitles.

4
00:00:15,000 --> 00:00:20,000
Using BalsamiqSans-Bold font.

5
00:00:20,000 --> 00:00:25,000
Yellow text color for visibility.

6
00:00:25,000 --> 00:00:30,000
Font size 13px optimized.`;

    // Ensure temp directory exists
    if (!fs.existsSync("temp")) {
      fs.mkdirSync("temp", { recursive: true });
    }

    fs.writeFileSync(subtitlesPath, dummySubtitles);
    console.log(`📝 Created dummy subtitles: ${subtitlesPath}`);

    // Use dummy image from videos folder
    const dummyImagePath = path.join("videos", "default-image.jpg");
    if (!fs.existsSync(dummyImagePath)) {
      console.log("⚠️ Dummy image not found, will test without image overlay");
      var testImages = [];
    } else {
      console.log(`🖼️ Using dummy image: ${dummyImagePath}`);
      var testImages = [
        {
          filename: dummyImagePath,
          timing: { startTime: 5, endTime: 15 },
        },
      ];
    }

    // Test video composition
    console.log("🔄 Starting video composition...");
    console.log(`📹 Base video: ${baseVideoPath}`);
    console.log(`🎵 Audio: ${audioPath || "None"}`);
    console.log(`🖼️ Images: ${testImages.length} overlay(s)`);
    console.log(`📝 Subtitles: ${subtitlesPath}`);
    console.log(`📋 Title: ${title}`);

    const result = await composeVideo(
      baseVideoPath,
      audioPath,
      testImages,
      subtitlesPath,
      title
    );

    console.log("✅ Local video processing test completed!");
    console.log("📁 Output file:", result.videoPath || result.outputPath);
    console.log(
      "📊 File size:",
      fs.existsSync(result.videoPath || result.outputPath)
        ? `${(
            fs.statSync(result.videoPath || result.outputPath).size /
            1024 /
            1024
          ).toFixed(2)} MB`
        : "Unknown"
    );

    // Clean up test subtitles
    if (fs.existsSync(subtitlesPath)) {
      fs.unlinkSync(subtitlesPath);
      console.log("🗑️ Cleaned up test subtitles");
    }

    return result;
  } catch (error) {
    console.error("❌ Local video processing test failed:", error.message);
    console.error("Stack:", error.stack);

    // Clean up on error
    const subtitlesPath = path.join("temp", "dummy_test_subtitles.srt");
    if (fs.existsSync(subtitlesPath)) {
      fs.unlinkSync(subtitlesPath);
      console.log("🗑️ Cleaned up test subtitles after error");
    }

    throw error;
  }
}

// Run test if called directly
if (require.main === module) {
  testLocalVideoProcessing()
    .then((result) => {
      console.log("🎉 Local video processing test completed successfully!");
      console.log("📊 Result:", result);
    })
    .catch((err) => {
      console.error("💥 Local video processing test failed:", err.message);
      process.exit(1);
    });
}

module.exports = { testLocalVideoProcessing };
