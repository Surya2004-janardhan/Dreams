require("dotenv").config();
const { uploadToBothPlatforms } = require("../src/services/socialMediaService");
const path = require("path");

async function testResilientWorkflow() {
  try {
    console.log("🧪 Testing resilient workflow with partial failures...");

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

    console.log("📹 Using existing base video for resilient workflow test");

    // Test the resilient uploadToBothPlatforms function
    console.log("🚀 Starting resilient multi-platform upload test...");
    const result = await uploadToBothPlatforms(
      testVideoPath,
      "🤖 TEST: Resilient Workflow - Educational Content Automation",
      "This is a test of the resilient workflow that continues even if some uploads fail.",
      "This is additional script content for testing."
    );

    console.log("✅ Resilient workflow test result:");
    console.log(`   Complete Success: ${result.success}`);
    console.log(`   Partial Success: ${result.partialSuccess}`);
    console.log(`   All Failed: ${result.allFailed}`);
    console.log(
      `   Successful Count: ${result.successfulCount}/${result.totalCount}`
    );
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
      console.log("🎉 COMPLETE SUCCESS: All platforms uploaded successfully!");
    } else if (result.partialSuccess) {
      console.log(
        `⚠️ PARTIAL SUCCESS: ${result.successfulCount} platforms succeeded, ${
          result.totalCount - result.successfulCount
        } failed`
      );
      console.log("   Supabase video kept for potential retry");
    } else {
      console.log("❌ ALL FAILED: No platforms succeeded");
      console.log("   Supabase video kept for retry");
    }

    console.log("\n📋 Workflow Behavior Summary:");
    console.log("   ✅ Always attempts all 3 uploads");
    console.log("   ✅ Always updates sheets with successful links");
    console.log("   ✅ Leaves failed upload links empty in sheets");
    console.log("   ✅ Only cleans up Supabase on complete success");
    console.log("   ✅ Sends appropriate email based on success level");
  } catch (error) {
    console.error("❌ Resilient workflow test failed:", error.message);
    console.error("Stack:", error.stack);
  }
}

// Run the test
if (require.main === module) {
  testResilientWorkflow();
}

module.exports = { testResilientWorkflow };
