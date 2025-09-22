require("dotenv").config();
const { uploadToFacebook } = require("../src/services/socialMediaService");
const path = require("path");

async function testFacebookProductionFunction() {
  try {
    console.log("🧪 Testing production Facebook upload function...");

    // Use the existing base video as dummy test video
    const dummyVideoPath = path.join("videos", "Base-vedio.mp4");

    // Check if dummy video exists
    const fs = require("fs");
    if (!fs.existsSync(dummyVideoPath)) {
      console.log(
        "❌ Dummy video not found. Please ensure Base-vedio.mp4 exists in videos folder."
      );
      return;
    }

    console.log("📹 Using existing base video for Facebook upload test");

    // Test the production uploadToFacebook function
    console.log("📘 Starting production Facebook upload test...");
    const result = await uploadToFacebook(
      dummyVideoPath,
      "🤖 TEST: Production Function Test - Educational Content Automation",
      "This is a test using the production uploadToFacebook function."
    );

    console.log(
      "✅ Production Facebook upload test result:",
      JSON.stringify(result, null, 2)
    );

    if (result.success) {
      console.log("🎉 SUCCESS: Facebook post created!");
      console.log(`🔗 Facebook Post URL: ${result.url}`);
      console.log(
        `📝 URL is complete: ${
          result.url.startsWith("http") ? "✅ YES" : "❌ NO"
        }`
      );
    } else {
      console.log("❌ FAILED: Facebook upload failed");
      console.log(`Error: ${result.error}`);
    }
  } catch (error) {
    console.error("❌ Production Facebook upload test failed:", error.message);
    console.error("Stack:", error.stack);
  }
}

// Run the test
if (require.main === module) {
  testFacebookProductionFunction();
}

module.exports = { testFacebookProductionFunction };
