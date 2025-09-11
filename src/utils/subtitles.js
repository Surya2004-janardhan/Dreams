const fs = require("fs");

// Create subtitle file
const createSubtitlesFile = (script, outputPath) => {
  if (!script || !outputPath) return;

  const lines = script.split("\n").filter((line) => line.trim());
  let subtitleContent = "";
  let subtitleIndex = 1;
  let currentTime = 0;

  lines.forEach((line) => {
    if (line.includes(":")) {
      const cleanLine = line
        .replace(/^Speaker [AB]:\s*/, "")
        .replace(/\*\*/g, "")
        .trim();

      if (cleanLine) {
        const duration = Math.max(3, cleanLine.length * 0.1);
        const endTime = currentTime + duration;

        const startTimeStr = formatTime(currentTime);
        const endTimeStr = formatTime(endTime);

        subtitleContent += `${subtitleIndex}\n${startTimeStr} --> ${endTimeStr}\n${cleanLine}\n\n`;

        subtitleIndex++;
        currentTime = endTime + 0.5; // 0.5 second gap between subtitles
      }
    }
  });

  try {
    fs.writeFileSync(outputPath, subtitleContent);
    console.log(`✓ Subtitles created: ${outputPath}`);
  } catch (error) {
    console.error("Error creating subtitles:", error);
  }
};

// Format time for SRT format
const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")},${milliseconds
    .toString()
    .padStart(3, "0")}`;
};

module.exports = {
  createSubtitlesFile,
  formatTime,
};
