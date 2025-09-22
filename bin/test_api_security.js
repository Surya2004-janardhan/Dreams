const { generateTitleImage } = require("../src/services/imageService");
const { composeVideo } = require("../src/services/videoProcessingService");
const fs = require("fs");
const path = require("path");

/**
 * Test title image generation for "API Security Principles" and video composition
 */
async function testAPISecurityImageAndVideo() {
  try {
    console.log(
      "🧪 Testing API Security Principles image generation and video..."
    );

    // Test title
    const testTitle = "API Security Principles";

    // Step 1: Generate title image
    console.log(`🖼️ Generating title image for: "${testTitle}"`);
    const titleImagePath = await generateTitleImage(testTitle);
    console.log(`✅ Title image generated: ${titleImagePath}`);

    // Verify image exists
    if (fs.existsSync(titleImagePath)) {
      console.log(`📁 Image file confirmed: ${titleImagePath}`);
    } else {
      throw new Error(`Image file not found: ${titleImagePath}`);
    }

    // Step 2: Set up video composition
    const baseVideoPath = path.join("videos", "Base-vedio.mp4");
    const audioPath = null; // No audio for simple test
    const subtitlesPath = path.join("subtitles", "dummy_test_subtitles.srt");

    // Single image that stays throughout the video
    const images = [
      {
        index: 1,
        filename: titleImagePath,
        concept: testTitle,
        timing: {
          startTime: 0,
          endTime: 59, // Full video duration
        },
      },
    ];

    console.log("📐 Video layout configuration:");
    console.log("   - Title image: 9:8 aspect ratio, starts at 5% from top");
    console.log("   - Image stays throughout entire video");
    console.log("   - Subtitles positioned below image area");
    console.log("   - Clean design, no additional text overlays");

    // Test video composition
    const result = await composeVideo(
      baseVideoPath,
      audioPath,
      images,
      subtitlesPath,
      testTitle
    );

    console.log("✅ API Security video test completed!");
    console.log("📹 Output:", result.videoPath);
    console.log("🖼️ Title image used:", titleImagePath);
    console.log("📐 Final layout:");
    console.log("   - Title image: 5% from top, 9:8 ratio, full duration");
    console.log("   - Subtitles: Positioned below image area");
    console.log("   - Content: API Security Principles");

    return result;
  } catch (error) {
    console.error("❌ API Security test failed:", error.message);
    throw error;
  }
}

// Run test if called directly
if (require.main === module) {
  testAPISecurityImageAndVideo()
    .then(() => console.log("🎉 API Security test completed successfully!"))
    .catch((err) => console.error("💥 API Security test failed:", err));
}

module.exports = { testAPISecurityImageAndVideo };
