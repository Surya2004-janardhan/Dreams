const axios = require("axios");
const fs = require("fs");
const path = require("path");

/**
 * Test the deployed slide generation endpoint
 */
async function testSlideGenerationEndpoint() {
  try {
    console.log("🧪 Testing deployed slide generation endpoint...");

    // Test data
    const testData = {
      title: "Test Slide Title",
      content:
        "This is a test content for the slide generation endpoint. It should render properly with the new image and Playfair Display font.",
    };

    // Make request to the endpoint
    const response = await axios.post(
      "https://slide-microservice.onrender.com/generate",
      testData,
      {
        responseType: "arraybuffer",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    // Save the generated image (or error response)
    const outputPath = path.join(__dirname, "..", "test_slide_output.png");
    fs.writeFileSync(outputPath, response.data);

    console.log("✅ Slide generation test successful!");
    console.log(`📁 Generated image saved to: ${outputPath}`);
    console.log(
      `📊 Image size: ${(response.data.length / 1024).toFixed(2)} KB`
    );
    console.log(`📋 Response headers:`, response.headers);
  } catch (error) {
    console.error("❌ Slide generation test failed:", error.message);

    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response headers:", error.response.headers);

      // Save error response for debugging
      const errorPath = path.join(__dirname, "..", "test_slide_error.html");
      fs.writeFileSync(errorPath, error.response.data);
      console.error(`📁 Error response saved to: ${errorPath}`);
      console.error(
        `📊 Error response size: ${(error.response.data.length / 1024).toFixed(
          2
        )} KB`
      );
    }
  }
}

/**
 * Test font status endpoint
 */
async function testFontStatusEndpoint() {
  try {
    console.log("🔤 Testing font status endpoint...");

    const response = await axios.get(
      "https://slide-microservice.onrender.com/font-status"
    );

    console.log("✅ Font status retrieved successfully!");
    console.log("📋 Font status:", JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error("❌ Font status test failed:", error.message);
  }
}

/**
 * Test home endpoint
 */
async function testHomeEndpoint() {
  try {
    console.log("🏠 Testing home endpoint...");

    const response = await axios.get("http://localhost:5000/");

    console.log("✅ Home endpoint test successful!");
    console.log("📝 Response:", response.data);
  } catch (error) {
    console.error("❌ Home endpoint test failed:", error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log("🚀 Starting slide generation endpoint tests...\n");

  await testHomeEndpoint();
  console.log("");

  await testFontStatusEndpoint();
  console.log("");

  await testSlideGenerationEndpoint();
  console.log("");

  console.log("🎉 All tests completed!");
}

// Check if this script is run directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testSlideGenerationEndpoint,
  testFontStatusEndpoint,
  testHomeEndpoint,
  runAllTests,
};
