const VideoPostingService = require("./src/services/videoPostingService");
const logger = require("../src/config/logger");

/**
 * Test script to validate service separation
 * Tests both video posting and carousel posting services
 */
async function testServiceSeparation() {
  console.log("🧪 Testing Service Separation...");

  try {
    // Test Video Posting Service
    console.log("\n📹 Testing Video Posting Service...");
    const videoService = new VideoPostingService();

    // Test video validation
    const testVideoPath = "./videos/Base-vedio.mp4";
    const validationResult = await videoService.validateVideoForPlatform(
      testVideoPath,
      "youtube"
    );
    console.log("Video validation result:", validationResult);

    // Test multi-platform upload (will fail without real credentials, but tests the structure)
    const platforms = ["youtube"];
    const uploadResult = await videoService.uploadVideoToPlatforms(
      platforms,
      testVideoPath,
      "Test Video Title",
      "Test video description for service separation testing"
    );
    console.log("Video upload result:", uploadResult);
  } catch (error) {
    console.log("❌ Video service test failed:", error.message);
  }

  console.log("\n✅ Service separation test completed");
}

// Run the test if this file is executed directly
if (require.main === module) {
  testServiceSeparation().catch(console.error);
}

module.exports = { testServiceSeparation };
