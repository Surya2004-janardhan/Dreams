require("dotenv").config();
const { uploadToBothPlatforms } = require("../src/services/socialMediaService");
const path = require("path");

async function testOptimizedWorkflow() {
  try {
    console.log("🧪 Testing optimized workflow with shared Supabase upload...");

    // Use the existing base video as test video
    const testVideoPath = path.join("videos", "Base-vedio.mp4");

    // Check if test video exists
    const fs = require("fs");
    if (!fs.existsSync(testVideoPath)) {
      console.log(
        "❌ Test video not found. Please ensure Base-vedio.mp4 exists in videos folder."
      );
      return;
    }

    console.log("📹 Using existing base video for workflow test");

    // Test the optimized uploadToBothPlatforms function
    console.log("🚀 Starting optimized multi-platform upload test...");
    const result = await uploadToBothPlatforms(
      testVideoPath,
      "🤖 TEST: Optimized Workflow - Educational Content Automation",
      "This is a test of the optimized workflow that uploads to Supabase once and reuses the link for Instagram and Facebook.",
      "This is additional script content for testing."
    );

    console.log("✅ Optimized workflow test result:");
    console.log(`   Overall Success: ${result.success}`);
    console.log(
      `   YouTube: ${result.youtube?.success ? "✅" : "❌"} ${
        result.youtubeUrl || result.youtube?.error
      }`
    );
    console.log(
      `   Instagram: ${result.instagram?.success ? "✅" : "❌"} ${
        result.instagramUrl || result.instagram?.error
      }`
    );
    console.log(
      `   Facebook: ${result.facebook?.success ? "✅" : "❌"} ${
        result.facebookUrl || result.facebook?.error
      }`
    );

    if (result.success) {
      console.log("🎉 SUCCESS: All platforms uploaded successfully!");
      console.log("📊 Complete URLs:");
      if (result.youtubeUrl) console.log(`   YouTube: ${result.youtubeUrl}`);
      if (result.instagramUrl)
        console.log(`   Instagram: ${result.instagramUrl}`);
      if (result.facebookUrl) console.log(`   Facebook: ${result.facebookUrl}`);
    } else {
      console.log("⚠️ Partial success - some uploads failed");
    }
  } catch (error) {
    console.error("❌ Optimized workflow test failed:", error.message);
    console.error("Stack:", error.stack);
  }
}

// Run the test
if (require.main === module) {
  testOptimizedWorkflow();
}

module.exports = { testOptimizedWorkflow };
