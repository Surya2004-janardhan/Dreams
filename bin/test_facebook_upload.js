const { uploadToFacebook } = require("../src/services/socialMediaService");
const path = require("path");

async function testFacebookUpload() {
  try {
    console.log("🧪 Testing Facebook upload...");

    // Use a test video file (assuming one exists in videos folder)
    const testVideoPath = path.join("videos", "Base-vedio.mp4");

    // Check if test video exists
    const fs = require("fs");
    if (!fs.existsSync(testVideoPath)) {
      console.log("❌ Test video not found. Please create a test video first.");
      return;
    }

    const result = await uploadToFacebook(
      testVideoPath,
      "Test Facebook Upload - Educational Content",
      "This is a test upload to verify Facebook integration is working properly."
    );

    console.log("✅ Facebook upload test result:", result);
  } catch (error) {
    console.error("❌ Facebook upload test failed:", error.message);
  }
}

// Run the test
testFacebookUpload();
