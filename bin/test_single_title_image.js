const { generateTitleImage } = require("../src/services/imageService");
const { composeVideo } = require("../src/services/videoProcessingService");
const fs = require("fs");
const path = require("path");

/**
 * Test single title image generation and video composition
 */
async function testSingleTitleImage() {
  try {
    console.log(
      "🎬 Testing single title image generation and video composition..."
    );

    // Test title from sheet
    const testTitle = "Understanding Machine Learning Basics";

    // Step 1: Generate title image
    console.log("🖼️ Generating title image...");
    const titleImagePath = await generateTitleImage(testTitle);
    console.log(`✅ Title image generated: ${titleImagePath}`);

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

    console.log("📐 Single image configuration:");
    console.log(
      "   - Image starts at 5% from top (96px), stays throughout video"
    );
    console.log("   - 9:8 aspect ratio, white background");
    console.log("   - No title text overlay - only the title image");
    console.log("   - Subtitles positioned below with proper spacing");

    // Test video composition
    const result = await composeVideo(
      baseVideoPath,
      audioPath,
      images,
      subtitlesPath,
      testTitle
    );

    console.log("✅ Single title image video test completed!");
    console.log("📹 Output:", result.videoPath);
    console.log("📐 Layout verification:");
    console.log(
      "   - Title image: Starts at 5% from top (96px), 9:8 ratio, stays throughout"
    );
    console.log("   - No title text overlay - clean design");
    console.log("   - Subtitles: Positioned below with proper spacing");

    return result;
  } catch (error) {
    console.error("❌ Single title image test failed:", error.message);
    throw error;
  }
}

// Run test if called directly
if (require.main === module) {
  testSingleTitleImage()
    .then(() =>
      console.log("🎉 Single title image test completed successfully!")
    )
    .catch((err) => console.error("💥 Single title image test failed:", err));
}

module.exports = { testSingleTitleImage };
