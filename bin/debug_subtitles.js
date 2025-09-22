const fs = require("fs");
const path = require("path");

/**
 * Debug subtitle visibility issues
 */
function debugSubtitles() {
  console.log("🔍 Debugging subtitle visibility...");

  const videoPath = path.join("final_video", "final_video_1758538148638.mp4");
  const subtitlePath = path.join("subtitles", "dummy_test_subtitles.srt");

  console.log("📹 Video file:", videoPath);
  console.log("📝 Subtitle file:", subtitlePath);

  // Check if files exist
  const videoExists = fs.existsSync(videoPath);
  const subtitleExists = fs.existsSync(subtitlePath);

  console.log("✅ Video exists:", videoExists);
  console.log("✅ Subtitle file exists:", subtitleExists);

  if (subtitleExists) {
    const subtitleContent = fs.readFileSync(subtitlePath, "utf8");
    const lines = subtitleContent.split("\n");
    console.log("📊 Subtitle statistics:");
    console.log("   - Total lines:", lines.length);
    console.log(
      "   - Estimated subtitle entries:",
      Math.floor(lines.length / 4)
    );

    // Show first few subtitle entries
    console.log("📝 First few subtitle entries:");
    const firstEntries = lines.slice(0, 12);
    firstEntries.forEach((line, index) => {
      console.log(`   ${index + 1}: ${line}`);
    });
  }

  // Check video file size
  if (videoExists) {
    const stats = fs.statSync(videoPath);
    console.log(
      "📏 Video file size:",
      (stats.size / 1024 / 1024).toFixed(2),
      "MB"
    );
  }

  console.log("\n🔧 Troubleshooting tips:");
  console.log("1. Try opening the video in VLC Media Player");
  console.log("2. Check if video brightness/contrast is too high");
  console.log(
    "3. Try zooming in on the video (subtitles are at ~31% from top)"
  );
  console.log("4. Font size is 60px - should be very visible");
  console.log(
    "5. Subtitles are 'burned in' - always visible, no tracks to enable"
  );

  console.log("\n🎯 Expected subtitle appearance:");
  console.log("   - White text with black borders");
  console.log("   - Semi-transparent black background");
  console.log("   - Centered horizontally");
  console.log("   - Positioned at ~600px from top of 1920px video");
}

// Run debug
debugSubtitles();
