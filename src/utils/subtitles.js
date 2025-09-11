const fs = require("fs");
const path = require("path");

/**
 * Calculate optimal subtitle duration based on text length and complexity
 */
const calculateDuration = (text) => {
  const words = text.split(" ").length;
  const avgReadingSpeed = 200; // words per minute
  const minDuration = 2; // minimum 2 seconds
  const maxDuration = 6; // maximum 6 seconds

  // Calculate duration based on reading speed
  const calculatedDuration = (words / avgReadingSpeed) * 60;

  // Apply constraints
  return Math.max(minDuration, Math.min(maxDuration, calculatedDuration));
};

/**
 * Split long text into multiple subtitle lines (max 2 lines)
 */
const splitTextIntoLines = (text, maxCharsPerLine = 40) => {
  if (text.length <= maxCharsPerLine) {
    return [text];
  }

  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    if ((currentLine + " " + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + " " + word).trim();
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Word is too long, force break
        lines.push(word.substring(0, maxCharsPerLine - 3) + "...");
        currentLine = word.substring(maxCharsPerLine - 3);
      }
    }

    // Limit to 2 lines max
    if (lines.length >= 1 && currentLine) {
      lines.push(currentLine);
      break;
    }
  }

  if (currentLine && lines.length === 0) {
    lines.push(currentLine);
  } else if (currentLine && lines.length === 1) {
    lines.push(currentLine);
  }

  return lines.slice(0, 2); // Ensure max 2 lines
};

/**
 * Create enhanced subtitle file with perfect timing
 */
const createSubtitlesFile = (script, outputPath) => {
  try {
    if (!script || !outputPath) {
      throw new Error("Script and output path are required");
    }

    // Ensure subtitles directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const lines = script.split("\n").filter((line) => line.trim());
    let subtitleContent = "";
    let subtitleIndex = 1;
    let currentTime = 0;
    const pauseBetweenSubtitles = 0.3; // 300ms pause between subtitles

    lines.forEach((line, index) => {
      if (line.includes(":")) {
        // Extract speaker and clean text
        let cleanLine = line
          .replace(/^Speaker [AB]:\s*/, "")
          .replace(/\*\*/g, "")
          .replace(/[*_~]/g, "")
          .trim();

        if (cleanLine) {
          // Split text into max 2 lines
          const textLines = splitTextIntoLines(cleanLine, 35);
          const displayText = textLines.join("\n");

          // Calculate duration based on text complexity
          const duration = calculateDuration(cleanLine);
          const endTime = currentTime + duration;

          const startTimeStr = formatTime(currentTime);
          const endTimeStr = formatTime(endTime);

          // Create subtitle entry
          subtitleContent += `${subtitleIndex}\n${startTimeStr} --> ${endTimeStr}\n${displayText}\n\n`;

          subtitleIndex++;
          currentTime = endTime + pauseBetweenSubtitles;
        }
      }
    });

    // Write subtitle file
    fs.writeFileSync(outputPath, subtitleContent);
    console.log(`✓ Enhanced subtitles created: ${outputPath}`);

    return {
      success: true,
      path: outputPath,
      totalSubtitles: subtitleIndex - 1,
      totalDuration: currentTime,
    };
  } catch (error) {
    console.error("Error creating subtitles:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Format time for SRT format (HH:MM:SS,mmm)
 */
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

/**
 * Parse conversation and extract timing information for each segment
 */
const parseConversationTiming = (script) => {
  const lines = script.split("\n").filter((line) => line.trim());
  const segments = [];
  let currentTime = 0;

  lines.forEach((line) => {
    if (line.includes(":")) {
      const speaker = line.includes("Speaker A:") ? "female" : "male";
      const cleanText = line
        .replace(/^Speaker [AB]:\s*/, "")
        .replace(/\*\*/g, "")
        .trim();

      if (cleanText) {
        const duration = calculateDuration(cleanText);

        segments.push({
          speaker: speaker,
          text: cleanText,
          startTime: currentTime,
          endTime: currentTime + duration,
          duration: duration,
        });

        currentTime += duration + 0.3; // 300ms pause
      }
    }
  });

  return segments;
};

/**
 * Create subtitle file with custom timing
 */
const createSubtitlesWithTiming = (segments, outputPath) => {
  try {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let subtitleContent = "";

    segments.forEach((segment, index) => {
      const textLines = splitTextIntoLines(segment.text, 35);
      const displayText = textLines.join("\n");

      const startTimeStr = formatTime(segment.startTime);
      const endTimeStr = formatTime(segment.endTime);

      subtitleContent += `${
        index + 1
      }\n${startTimeStr} --> ${endTimeStr}\n${displayText}\n\n`;
    });

    fs.writeFileSync(outputPath, subtitleContent);

    return {
      success: true,
      path: outputPath,
      totalSubtitles: segments.length,
      totalDuration: segments[segments.length - 1]?.endTime || 0,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  createSubtitlesFile,
  createSubtitlesWithTiming,
  parseConversationTiming,
  formatTime,
  calculateDuration,
  splitTextIntoLines,
};
