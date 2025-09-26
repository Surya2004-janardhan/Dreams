const express = require("express");
const router = express.Router();
const { exec } = require("child_process");
const path = require("path");

router.post("/test-ffmpeg", (req, res) => {
  const inputPath = path.join(__dirname, "../../videos/Base-vedio.mp4");
  const outputPath = path.join(__dirname, "../../final_video/test_output.mp4");

  const cmd = `ffmpeg -y -i "${inputPath}" -vf "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black" -t 5 -c:v libx264 -preset veryfast -crf 28 "${outputPath}"`;

  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error("❌ FFmpeg test failed:", error.message);
      return res
        .status(500)
        .json({ success: false, error: error.message, stderr });
    }
    console.log("✅ FFmpeg test succeeded!");
    console.log("FFmpeg output:", stderr);
    return res
      .status(200)
      .json({ success: true, message: "FFmpeg test succeeded!", stderr });
  });
});

module.exports = router;
