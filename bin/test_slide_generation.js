/**
 * Test Slide Generation
 *
 * This script pulls content from Google Sheets and generates real slides
 * using FFmpeg, just like the main workflow. This allows testing of
 * slide generation without running the full workflow.
 */

const fs = require("fs");
const path = require("path");
const ffmpeg = require(async function te/**
 * Test slide generation function
 */
async function testSlideGeneration() {
  try {
    logger.info("🔄 Starting test slide generation");

    // Try to fetch data from Google Sheets
    let sheetTasks;
    try {
      sheetTasks = await fetchSheetsData();
    } catch (error) {
      logger.warn(`⚠️ Error fetching from Google Sheets: ${error.message}`);
      sheetTasks = null;
    }

    // Tasks to process - use sheet data or fallback to sample data
    let tasks;

    if (sheetTasks && sheetTasks.length > 0) {
      logger.info("📊 Using data from Google Sheets");
      tasks = sheetTasks;
    } else {
      logger.info("📝 Falling back to sample test data");) {
  try {
    logger.info("🔄 Starting test slide generation");

    // Try to fetch data from Google Sheets
    let sheetTasks;
    try {
      sheetTasks = await fetchSheetsData();
    } catch (error) {
      logger.warn(`⚠️ Error fetching from Google Sheets: ${error.message}`);
      sheetTasks = null;
    }

    // Tasks to process - use sheet data or fallback to sample data
    let tasks;

    if (sheetTasks && sheetTasks.length > 0) {
      logger.info("📊 Using data from Google Sheets");
      tasks = sheetTasks;
    } else {
      logger.info("📝 Falling back to sample test data"););
const logger = require("../src/config/logger");

// Import Google config with error handling
let getSheetsClient;
try {
  const googleConfig = require("../src/config/google");
  getSheetsClient = googleConfig.getSheetsClient;
  logger.info("✅ Google Sheets client loaded successfully");
} catch (error) {
  logger.warn(`⚠️ Error loading Google Sheets client: ${error.message}`);
  getSheetsClient = async () => {
    throw new Error("Google Sheets client not available");
  };
}

// Set up paths
const slidesDir = path.join(__dirname, "../slides/test");
const baseImagePath = path.join(__dirname, "../videos/Post-Base-Image.png");
const montserratBlackFont = path.join(
  __dirname,
  "../fonts/Montserrat-Black.ttf"
);
const ibmPlexFont = path.join(__dirname, "../fonts/IBMPlexSerif-Regular.ttf");

// Create test slides directory if it doesn't exist
if (!fs.existsSync(slidesDir)) {
  fs.mkdirSync(slidesDir, { recursive: true });
  logger.info(`✅ Created test slides directory: ${slidesDir}`);
}

// Check if base image exists
if (!fs.existsSync(baseImagePath)) {
  logger.error(`❌ Base image not found: ${baseImagePath}`);
  process.exit(1);
}

// Check if fonts exist
if (!fs.existsSync(montserratBlackFont)) {
  logger.warn(`⚠️ Montserrat Black font not found: ${montserratBlackFont}`);
}
if (!fs.existsSync(ibmPlexFont)) {
  logger.warn(`⚠️ IBM Plex font not found: ${ibmPlexFont}`);
}

/**
 * Break text into wrapped lines based on font size
 */
function wrapText(text, fontSize = 36) {
  // Adjust max characters per line based on font size
  const maxCharsPerLine = Math.floor(1000 / fontSize);

  logger.info(
    `📏 Using ${maxCharsPerLine} characters per line with font size ${fontSize}`
  );

  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxCharsPerLine) {
      currentLine += (currentLine ? " " : "") + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Generate actual slide with FFmpeg using the same code as main workflow
 */
async function generateSlide(title, content, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      logger.info(`🎨 Generating slide for: "${title}"`);

      // Clean and escape text for FFmpeg
      const cleanTitle = (title || "").replace(/['"]/g, "").replace(/:/g, " ");

      const cleanContent = (content || "")
        .replace(/['"]/g, "")
        .replace(/:/g, " ");

      // Initialize FFmpeg command
      let ffmpegCommand = ffmpeg(baseImagePath);

      // Start with title filter
      const filters = [];

      // Process title with wrapping
      const titleFontSize = 44; // 2x original
      const titleLines = wrapText(cleanTitle, titleFontSize);
      logger.info(`📏 Title split into ${titleLines.length} lines`);

      // Add each title line
      titleLines.forEach((titleLine, tIndex) => {
        const titleYPos = 40 + tIndex * 60; // Space between title lines

        if (fs.existsSync(montserratBlackFont)) {
          filters.push(
            `drawtext=text='${titleLine}':fontfile='${montserratBlackFont}':fontsize=${titleFontSize}:fontcolor=0x808080:x=(w-text_w)/2:y=${titleYPos}:shadowcolor=black:shadowx=1:shadowy=1:line_spacing=10`
          );
        } else {
          // Fallback but still try to use Montserrat-Black
          logger.warn("⚠️ Montserrat-Black font not found, using system font");
          filters.push(
            `drawtext=text='${titleLine}':fontsize=${titleFontSize}:fontcolor=0x808080:x=(w-text_w)/2:y=${titleYPos}:shadowcolor=black:shadowx=1:shadowy=1:line_spacing=10`
          );
        }
      });

      // Calculate content start position based on title lines
      const titleHeight = 40 + titleLines.length * 60; // Title area height
      const contentStartY = titleHeight + 60; // Start content 60px below the last title line

      // Add content lines with IBM Plex font (2x original 18px)
      const contentLines = wrapText(cleanContent, 36);

      contentLines.forEach((line, index) => {
        const yPosition = contentStartY + index * 50; // Slightly reduced spacing between content lines
        if (fs.existsSync(ibmPlexFont)) {
          filters.push(
            `drawtext=text='${line}':fontfile='${ibmPlexFont}':fontsize=36:fontcolor=0x000000:x=50:y=${yPosition}:shadowcolor=0x808080:shadowx=1:shadowy=1:line_spacing=10`
          );
        } else {
          // Fallback but log warning
          logger.warn("⚠️ IBM Plex font not found, using system font");
          filters.push(
            `drawtext=text='${line}':fontsize=36:fontcolor=0x000000:x=50:y=${yPosition}:shadowcolor=0x808080:shadowx=1:shadowy=1:line_spacing=10`
          );
        }
      });

      // Apply filters and generate the slide
      ffmpegCommand.videoFilters(filters);

      ffmpegCommand
        .outputOptions(["-q:v", "2"])
        .output(outputPath)
        .on("end", () => {
          logger.info(`✅ Slide generated: ${path.basename(outputPath)}`);
          resolve(outputPath);
        })
        .on("error", (err) => {
          logger.error(`❌ Error generating slide: ${err.message}`);
          reject(err);
        })
        .run();
    } catch (error) {
      logger.error(`❌ Error in slide generation setup: ${error.message}`);
      reject(error);
    }
  });
}

/**
 * Fetch content from Google Sheets
 */
async function fetchSheetsData() {
  try {
    logger.info("📊 Fetching data from Google Sheets");

    // Check for environment variables in main config or .env file
    let POSTS_SHEET_ID;
    try {
      // Try to load from environment
      POSTS_SHEET_ID = process.env.POSTS_SHEET_ID;
      
      // If not found, try to load from config
      if (!POSTS_SHEET_ID) {
        const sheetsConfig = require("../src/config/google");
        POSTS_SHEET_ID = sheetsConfig.POSTS_SHEET_ID || sheetsConfig.postsSheetId;
        logger.info("✅ Loaded sheet ID from config");
      }
    } catch (error) {
      logger.warn(`⚠️ Error loading sheet ID from config: ${error.message}`);
    }

    if (!POSTS_SHEET_ID) {
      logger.warn(
        "⚠️ No POSTS_SHEET_ID found in environment or config, using sample data"
      );
      return null;
    }

    // Initialize sheets client
    const sheets = await getSheetsClient();

    // Fetch data from Google Sheets
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: POSTS_SHEET_ID,
      range: "Sheet1!A:Z", // Get all columns
    });

    const rows = response.data.values;
    logger.info(`📋 Sheet data received: ${rows ? rows.length : 0} rows`);

    if (!rows || rows.length < 2) {
      logger.warn("⚠️ No data rows found in sheet");
      return null;
    }

    // Find header row (assuming first row)
    const headers = rows[0];
    logger.info("📋 Sheet headers:", headers);

    // Find column indexes for title and slide content
    // Look for various common column names
    const findColumnIndex = (possibleNames) => {
      // First try exact match
      for (const name of possibleNames) {
        const index = headers.findIndex(h => h === name);
        if (index !== -1) return index;
      }
      
      // Then try case-insensitive match
      for (const name of possibleNames) {
        const index = headers.findIndex(h => h && h.toLowerCase() === name.toLowerCase());
        if (index !== -1) return index;
      }
      
      // Finally try partial match
      for (const name of possibleNames) {
        const index = headers.findIndex(h => h && h.toLowerCase().includes(name.toLowerCase()));
        if (index !== -1) return index;
      }
      
      return -1;
    };
    
    // Find title column - try various common names
    const titleIndex = findColumnIndex([
      "Title", "Post Title", "Content Title", "Heading"
    ]);
    
    // Find slide content columns - try various formats
    const slide1Index = findColumnIndex([
      "Slide 1", "Slide1", "Content 1", "Content1", "Slide Content 1"
    ]);
    
    const slide2Index = findColumnIndex([
      "Slide 2", "Slide2", "Content 2", "Content2", "Slide Content 2"
    ]);
    
    const slide3Index = findColumnIndex([
      "Slide 3", "Slide3", "Content 3", "Content3", "Slide Content 3"
    ]);

    // Check if we found the columns
    if (
      titleIndex === -1 ||
      slide1Index === -1 ||
      slide2Index === -1 ||
      slide3Index === -1
    ) {
      logger.warn("⚠️ Could not find required columns in sheet");
      return null;
    }

    // Parse data from rows - find first unposted row
    const tasks = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      // Skip if row is too short
      if (
        row.length <=
        Math.max(titleIndex, slide1Index, slide2Index, slide3Index)
      ) {
        continue;
      }

      // Get row data
      const title = row[titleIndex];
      const slide1 = row[slide1Index];
      const slide2 = row[slide2Index];
      const slide3 = row[slide3Index];

      // Skip rows with missing data
      if (!title || !slide1 || !slide2 || !slide3) {
        continue;
      }

      // Add task
      tasks.push({
        rowIndex: i + 1, // 1-based index for Google Sheets
        title,
        slide1,
        slide2,
        slide3,
      });

      // Only get first 3 tasks for testing
      if (tasks.length >= 3) {
        break;
      }
    }

    logger.info(`📋 Found ${tasks.length} content tasks in sheet`);
    return tasks;
  } catch (error) {
    logger.error(`❌ Error fetching sheet data: ${error.message}`);
    return null;
  }
}

/**
 * Test slide generation function
 */
async function testSlideGeneration() {
  try {
    logger.info("🔄 Starting test slide generation");

    // Try to fetch data from Google Sheets
    const sheetTasks = await fetchSheetsData();

    // Tasks to process - use sheet data or fallback to sample data
    let tasks;

    if (sheetTasks && sheetTasks.length > 0) {
      logger.info("� Using data from Google Sheets");
      tasks = sheetTasks;
    } else {
      logger.info("📝 Falling back to sample test data");

      // Sample test data (mimics content from Google Sheets)
      tasks = [
        {
          title: "Benefits of Daily Exercise",
          slide1:
            "Regular physical activity can improve your muscle strength and boost your endurance.",
          slide2: "Exercise delivers oxygen and nutrients to your tissues.",
          slide3:
            "Regular exercise can help prevent excess weight gain or help maintain weight loss.",
        },
        {
          title: "Healthy Eating Habits",
          slide1:
            "A balanced diet provides all the nutrients your body needs to work effectively.",
          slide2:
            "Without balanced nutrition, your body is more prone to disease, infection, fatigue, and poor performance.",
          slide3:
            "Eating a variety of foods and maintaining a healthy weight is essential for well-being.",
        },
        {
          title:
            "This Is a Very Long Title That Should Demonstrate Text Wrapping",
          slide1:
            "This is an example of content with a very long text that needs to be wrapped properly.",
          slide2:
            "The wrapping algorithm should ensure that text fits nicely on the slide without being cut off.",
          slide3:
            "Testing longer paragraphs helps ensure the formatting works correctly for all content types.",
        },
      ];
    }

    logger.info(`📋 Processing ${tasks.length} content tasks`);

    // Generate slides for each task
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      logger.info(`🔄 Processing task ${i + 1}/${tasks.length}: ${task.title}`);

      // Generate slides
      const timestamp = Date.now();
      const slidePaths = [];

      // Generate all 3 slides
      for (let j = 1; j <= 3; j++) {
        const slideContent = task[`slide${j}`];
        const outputPath = path.join(
          slidesDir,
          `test_slide_${i + 1}_${j}_${timestamp}.jpg`
        );

        // Generate the slide with FFmpeg
        logger.info(`🎨 Generating slide ${j}/3 for task ${i + 1}...`);
        await generateSlide(task.title, slideContent, outputPath);
        slidePaths.push(outputPath);
      }

      logger.info(`✅ Generated ${slidePaths.length} slides for task ${i + 1}`);
    }

    // Generate example with pulling data from the main workflow
    logger.info("🔄 Creating example of how to use this in the main workflow");
    const examplePath = path.join(slidesDir, "example_usage.txt");

    const exampleUsage = `
================ HOW TO USE IN MAIN WORKFLOW ================

// In postsWorkflow.js, add the following imports
const fs = require('fs');
const path = require('path');

// For each slide:
async function generateCarouselSlides(taskData) {
  try {
    // Current code from postsWorkflow.js...
    
    // Add this to debug the text wrapping:
    const debugDir = path.join(__dirname, '../../slides/debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    // Create a debug text file to see how text is being wrapped
    const debugPath = path.join(debugDir, \`debug_slide_\${taskData.id || Date.now()}.txt\`);
    const debugContent = \`
TITLE LINES:
\${wrapText(cleanTitle, 44).join('\\n')}

CONTENT LINES:
\${wrapText(cleanContent, 36).join('\\n')}
\`;
    fs.writeFileSync(debugPath, debugContent);
    logger.info(\`📝 Debug text wrapping saved to \${debugPath}\`);
    
    // Continue with FFmpeg slide generation
    // ...
  } catch (error) {
    logger.error(\`❌ Error generating carousel slides: \${error.message}\`);
    throw error;
  }
}
`;

    fs.writeFileSync(examplePath, exampleUsage);
    logger.info(`✅ Example usage saved to ${examplePath}`);

    logger.info("✅ Test slide generation completed successfully");
  } catch (error) {
    logger.error(`❌ Error in test slide generation: ${error.message}`, error);
  }
}

// Execute the test
testSlideGeneration()
  .then(() => {
    logger.info("📊 Test slide generation process completed");
  })
  .catch((error) => {
    logger.error(`❌ Test slide generation failed: ${error.message}`);
    process.exit(1);
  });
