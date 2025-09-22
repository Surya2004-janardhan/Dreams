const { composeVideo } = require("../src/services/videoProcessingService");
const fs = require("fs");
const path = require("path");

/**
 * Test video composition with dummy layout:
 * - Images: Top 45% of video
 * - Subtitles: 50% to 60% of video height
 */
async function testDummyVideoProcessing() {
  try {
    console.log("🎬 Testing dummy video processing with new layout...");
    console.log("📐 Layout: Images (3-40%) | Subtitles (Large & Bold at 29%)");

    // Test files
    const baseVideoPath = path.join("videos", "Base-vedio.mp4");
    const audioPath = null; // No audio for simple test
    const subtitlesPath = path.join("subtitles", "dummy_test_subtitles.srt");
    const outputPath = path.join("final_video", `dummy_test_${Date.now()}.mp4`);

    // Create dummy subtitles positioned for 50-60% area (more subtitles for better testing)
    const dummySubtitles = `1
00:00:00,000 --> 00:00:05,000
Welcome to our technical tutorial!

2
00:00:05,000 --> 00:00:10,000
Learn about modern development practices.

3
00:00:10,000 --> 00:00:15,000
Explore cutting-edge technologies today.

4
00:00:15,000 --> 00:00:20,000
Master the fundamentals of coding.

5
00:00:20,000 --> 00:00:25,000
Build amazing applications with ease.

6
00:00:25,000 --> 00:00:30,000
Discover new programming concepts.

7
00:00:30,000 --> 00:00:35,000
Understand complex algorithms easily.

8
00:00:35,000 --> 00:00:40,000
Create innovative solutions now.

9
00:00:40,000 --> 00:00:45,000
Join the developer community.

10
00:00:45,000 --> 00:00:50,000
Stay updated with latest trends.

11
00:00:50,000 --> 00:00:55,000
Thank you for watching our tutorial!

12
00:00:55,000 --> 00:00:59,000
Subscribe for more educational content!`;

    // Ensure subtitles directory exists
    if (!fs.existsSync("subtitles")) {
      fs.mkdirSync("subtitles", { recursive: true });
    }

    fs.writeFileSync(subtitlesPath, dummySubtitles);
    console.log(`📝 Created dummy subtitles: ${subtitlesPath}`);

    // Create test images array with default image (top 45% area)
    const defaultImagePath = path.join("videos", "default-image.jpg");
    const testImages = [
      {
        filename: defaultImagePath,
        timing: { startTime: 2, endTime: 12 },
      },
      {
        filename: defaultImagePath,
        timing: { startTime: 15, endTime: 25 },
      },
      {
        filename: defaultImagePath,
        timing: { startTime: 28, endTime: 38 },
      },
      {
        filename: defaultImagePath,
        timing: { startTime: 41, endTime: 51 },
      },
    ];

    console.log(
      "🖼️ Images positioned between 3% to 40% of video (57px to 768px from top)"
    );
    console.log("📝 Subtitles positioned at 50% of video height");

    // Test video composition
    const result = await composeVideo(
      baseVideoPath,
      audioPath,
      testImages,
      subtitlesPath,
      "Dummy Test Video - Images 3-40%, Subtitles 50-60%"
    );

    console.log("✅ Dummy video processing test completed!");
    console.log("📹 Output:", result.videoPath);
    console.log("📐 Layout verification:");
    console.log("   - Images: 3% to 40% range (57-768px from top)");
    console.log("   - Subtitles: ~29% height (550px from top) - Large & Bold");

    // Keep subtitles for verification - don't clean up immediately
    console.log("📝 Subtitles file preserved for verification:", subtitlesPath);

    return result;
  } catch (error) {
    console.error("❌ Dummy video processing test failed:", error.message);
    throw error;
  }
}

// Run test if called directly
if (require.main === module) {
  testDummyVideoProcessing()
    .then(() => console.log("🎉 Dummy test completed successfully!"))
    .catch((err) => console.error("💥 Dummy test failed:", err));
}

module.exports = { testDummyVideoProcessing };
