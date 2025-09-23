require("dotenv").config();
const { google } = require("googleapis");
const logger = require("../src/config/logger");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");

// Configure FFmpeg
const ffmpegPath = require("ffmpeg-static");
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
  logger.info("✅ FFmpeg configured successfully");
} else {
  logger.warn("⚠️ ffmpeg-static not found, using system FFmpeg");
}

async function fetchNotPostedRow() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = process.env.POSTS_SHEET_ID;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "A:Z",
  });

  const rows = response.data.values;
  const headers = rows[0];

  logger.info(`Available headers: ${JSON.stringify(headers)}`);

  const titleCol = headers.findIndex((h) => h?.toLowerCase().includes("title"));
  const slide1Col = headers.findIndex((h) =>
    h?.toLowerCase().includes("slide 1")
  );
  const slide2Col = headers.findIndex((h) =>
    h?.toLowerCase().includes("slide 2")
  );
  const slide3Col = headers.findIndex((h) =>
    h?.toLowerCase().includes("slide 3")
  );
  const statusCol = headers.findIndex((h) =>
    h?.toLowerCase().includes("status")
  );

  logger.info(
    `Column indices - Title: ${titleCol}, Slide1: ${slide1Col}, Slide2: ${slide2Col}, Slide3: ${slide3Col}, Status: ${statusCol}`
  );

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const status = row[statusCol]?.toLowerCase().trim();

    if (status === "not posted") {
      const result = {
        title: row[titleCol] || "",
        slide1: row[slide1Col] || "",
        slide2: row[slide2Col] || "",
        slide3: row[slide3Col] || "",
      };
      logger.info(`Found title: "${result.title}"`);
      logger.info(`Found slide1: "${result.slide1}"`);
      logger.info(`Found slide2: "${result.slide2}"`);
      logger.info(`Found slide3: "${result.slide3}"`);
      return result;
    }
  }
  return null;
}

function wrapText(text, fontSize, hasMargins = false) {
  // More precise character width calculation for exact margin usage
  const avgCharWidth = fontSize * 0.42; // Slightly adjusted for better justification

  // Calculate available width considering 3% left/right margins for both title and content
  const baseWidth = 1080; // Typical slide width
  const availableWidth = baseWidth * 0.94; // 94% width (3% left + 3% right margins)

  const maxCharsPerLine = Math.floor(availableWidth / avgCharWidth);
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? currentLine + " " + word : word;

    // Check if adding this word would exceed the line width
    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      // Line would be too long, start a new line
      if (currentLine) {
        // For justification effect, try to balance the line length
        const targetLength = Math.floor(maxCharsPerLine * 0.85); // Target 85% of max length
        if (currentLine.length < targetLength && words.length > 0) {
          // Try to add one more word if line is too short
          const nextWord = word;
          if ((currentLine + " " + nextWord).length <= maxCharsPerLine) {
            currentLine = currentLine + " " + nextWord;
            // Skip this word in next iteration
            continue;
          }
        }
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  // Add the last line if it exists
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

async function generateSlide(title, content, slideNumber) {
  const baseImagePath = path.join(__dirname, "../videos/Post-Base-Image.png");
  const outputPath = path.join(
    __dirname,
    "../slides/slide_" + slideNumber + ".png"
  );
  const contentFont = path.join(__dirname, "../fonts/IBMPlexSerif-Regular.ttf");

  // Calculate text wrapping based on 3% left/right margins for both title and content
  const titleLines = wrapText(title, 57, true);
  const contentLines = wrapText(content, 54, true);

  logger.info(`Title lines: ${JSON.stringify(titleLines)}`);
  logger.info(`Content lines: ${JSON.stringify(contentLines)}`);
  logger.info(`Content length: ${content.length}`);

  let filters = [];

  // Helper to sanitize text for FFmpeg drawtext (escape single quotes)
  function sanitizeFFmpegText(str) {
    return str.replace(/'/g, "\\'");
  }

  // Title positioning (with 3% left margin, left-aligned) - use fontfile for reliability
  let yPosition = 100;
  titleLines.forEach((line, index) => {
    if (line && line.trim()) {
      filters.push(
        `drawtext=fontfile='${contentFont}':text='${sanitizeFFmpegText(
          line
        )}':fontsize=57:fontcolor=#808080:x=(w*0.03):y=${
          yPosition + index * 71
        }`
      );
    }
  });

  // Content positioning with 3% left margin
  yPosition = titleLines.length * 71 + 204; // Spacing after title

  contentLines.forEach((line, index) => {
    if (line && line.trim()) {
      filters.push(
        `drawtext=fontfile='${contentFont}':text='${sanitizeFFmpegText(
          line
        )}':fontsize=54:fontcolor=#000000:x=(w*0.03):y=${
          yPosition + index * 67
        }`
      );
    }
  });

  const filterString = filters.join(",");

  return new Promise((resolve, reject) => {
    ffmpeg(baseImagePath)
      .videoFilters(filterString)
      .outputOptions("-frames:v 1")
      .save(outputPath)
      .on("end", () => {
        logger.info(`Generated slide ${slideNumber}: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        logger.error(`Error generating slide ${slideNumber}: ${err.message}`);
        reject(err);
      });
  });
}

async function main() {
  try {
    logger.info("Starting slide generation test");

    const task = await fetchNotPostedRow();
    if (!task) {
      logger.info("No not posted rows found");
      return;
    }

    logger.info(`Found task: ${task.title}`);

    const slideContents = [task.slide1, task.slide2, task.slide3];

    for (let i = 1; i <= 3; i++) {
      await generateSlide(task.title, slideContents[i - 1], i);
    }

    logger.info("All slides generated successfully");
  } catch (error) {
    logger.error(`Error: ${error.message}`);
  }
}

main();
