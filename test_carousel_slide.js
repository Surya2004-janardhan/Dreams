require("dotenv").config();
const CarouselGeneratorService = require("./src/services/carouselGeneratorService");
const fs = require("fs");
const path = require("path");

/**
 * Dummy test for carousel slide generation
 * Generates a single slide and outputs the image
 */
async function testCarouselSlide() {
  const carouselService = new CarouselGeneratorService();

  try {
    console.log("🧪 Testing carousel slide generation...");

    // Dummy data
    const title = "Test Carousel Title";
    const content =
      "This is a test content for the carousel slide generation. It should create an image with the provided title and content.";

    console.log(`📝 Generating slide with title: "${title}"`);
    console.log(`📝 Content: "${content.substring(0, 50)}..."`);

    // Generate the slide
    const slidePath = await carouselService.generateSlide(title, content, 1);

    console.log(`✅ Slide generated at: ${slidePath}`);

    // Check if file exists
    if (fs.existsSync(slidePath)) {
      const stats = fs.statSync(slidePath);
      console.log(`📊 File size: ${stats.size} bytes`);

      // Read and output as base64 for "image output"
      const imageBuffer = fs.readFileSync(slidePath);
      const base64Image = imageBuffer.toString("base64");
      console.log(
        `🖼️  Image as base64: data:image/png;base64,${base64Image.substring(
          0,
          100
        )}...`
      );

      console.log("🎉 Test completed successfully!");
    } else {
      console.error("❌ Generated file not found");
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

// Run the test
testCarouselSlide();
