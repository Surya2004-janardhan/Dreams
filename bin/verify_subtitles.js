const fs = require("fs");
const path = require("path");

/**
 * Verify that subtitles are properly created and formatted
 */
function verifySubtitles() {
  console.log("🔍 Verifying subtitle creation and formatting...");

  const subtitlesPath = path.join("subtitles", "dummy_test_subtitles.srt");

  if (fs.existsSync(subtitlesPath)) {
    const content = fs.readFileSync(subtitlesPath, "utf8");
    console.log("📝 Subtitle file content:");
    console.log("---");
    console.log(content);
    console.log("---");

    const lines = content.split("\n");
    console.log(`📊 Subtitle statistics:`);
    console.log(`   - Total lines: ${lines.length}`);
    console.log(`   - Subtitle entries: ${Math.floor(lines.length / 4)}`);

    // Check SRT format
    const hasTiming = content.includes("-->");
    const hasNumbers = /^\d+$/m.test(content);

    console.log(`✅ SRT format validation:`);
    console.log(`   - Has timing markers: ${hasTiming}`);
    console.log(`   - Has numbered entries: ${hasNumbers}`);

    if (hasTiming && hasNumbers) {
      console.log("🎉 Subtitles are properly formatted!");
    } else {
      console.log("⚠️ Subtitles may have formatting issues");
    }
  } else {
    console.log("❌ Subtitle file not found");
  }
}

// Run verification
verifySubtitles();
