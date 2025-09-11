const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");

// Configure FFmpeg path
const ffmpegPath = "C:\\ffmpeg\\ffmpeg-8.0-essentials_build\\bin\\ffmpeg.exe";
const ffprobePath = "C:\\ffmpeg\\ffmpeg-8.0-essentials_build\\bin\\ffprobe.exe";

// Set FFmpeg paths for fluent-ffmpeg
if (fs.existsSync(ffmpegPath)) {
  ffmpeg.setFfmpegPath(ffmpegPath);
  ffmpeg.setFfprobePath(ffprobePath);
  console.log("✅ FFmpeg configured successfully");
} else {
  console.warn(
    "⚠️ FFmpeg not found at expected path. Some audio processing features may not work."
  );
  console.warn(
    "📝 Please ensure FFmpeg is installed at: C:\\ffmpeg\\ffmpeg-8.0-essentials_build\\bin\\"
  );
}

module.exports = {
  ffmpegPath,
  ffprobePath,
};
