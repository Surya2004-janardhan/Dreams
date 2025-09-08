const say = require("say");
const fs = require("fs");

console.log("Testing System TTS...");

// Test the say package
const testText =
  "Hello, this is a test of the system text to speech functionality.";
const outputFile = "test_tts.wav";

say.export(testText, null, 0.75, outputFile, (err) => {
  if (err) {
    console.error("❌ System TTS failed:", err.message);
    console.log("Note: System TTS may not be available on your system.");
    console.log("The workflow will create silent audio placeholders instead.");
  } else {
    console.log("✅ System TTS working! Audio saved to:", outputFile);
    console.log("Text:", testText);

    // Clean up test file after showing it works
    setTimeout(() => {
      try {
        fs.unlinkSync(outputFile);
        console.log("Test file cleaned up.");
      } catch (e) {
        // Ignore cleanup errors
      }
    }, 1000);
  }
});
