const axios = require("axios");
const fs = require("fs");
const path = require("path");

async function testLocalEndpoint() {
  try {
    console.log("🧪 Testing local slide generation endpoint...");
    console.log("📋 Current Configuration:");
    console.log("   • Base Image: Post-Base-Image.png (1080x1080 RGBA)");
    console.log("   • Font: AlanSans-Bold.ttf");
    console.log("   • Title Size: 38px (increased by 2px)");
    console.log("   • Content Size: 18px (increased by 2px)");
    console.log("   • Left Margin: 15% (increased by 2%)");
    console.log("");

    const testData = {
      title: "Test Title - Alan Sans Bold",
      content:
        "This is test content for the slide generation with the new Post-Base-Image.png base and Alan Sans Bold font at 16px content size.",
    };

    const response = await axios.post(
      "http://127.0.0.1:5000/generate",
      testData,
      {
        responseType: "arraybuffer",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const outputPath = path.join(__dirname, "test_local_slide.png");
    fs.writeFileSync(outputPath, response.data);

    console.log("✅ Local slide generation successful!");
    console.log(`📁 Image saved to: ${outputPath}`);
    console.log(`📊 File size: ${(response.data.length / 1024).toFixed(2)} KB`);
  } catch (error) {
    console.error("❌ Local test failed:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
    }
  }
}

testLocalEndpoint();
