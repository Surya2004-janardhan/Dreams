const { getSheetsClient } = require("../config/google");
const logger = require("../config/logger");

/**
 * Posts Sheet Service
 * Handles Google Sheets operations for carousel posts
 * Uses a separate sheet from the main workflow sheet
 */

// Sheet ID for posts (different from main workflow sheet)
const POSTS_SHEET_ID = process.env.POSTS_SHEET_ID;

/**
 * Get the next unposted carousel task from posts sheet
 * Expected columns: Title, Slide1, Slide2, Slide3, Status, etc.
 */
const getNextCarouselTask = async () => {
  try {
    logger.info("📊 Fetching next carousel task from posts sheet...");
    const sheets = await getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: POSTS_SHEET_ID,
      range: "Sheet1!A:Z",
    });

    const rows = response.data.values;
    logger.info(`📋 Posts sheet data received: ${rows ? rows.length : 0} rows`);

    if (!rows || rows.length < 2) {
      logger.warn("⚠️ No data rows found in posts sheet");
      return null;
    }

    // Find header row
    const headers = rows[0];
    logger.info("📋 Posts sheet headers:", headers);
    logger.info("📋 Raw headers array:", JSON.stringify(headers));

    // Check if we have valid headers
    if (!headers || headers.length === 0) {
      throw new Error("No headers found in posts sheet");
    }

    // Find column indexes using exact matches first
    let titleIndex = headers.findIndex((h) => h === "Title");
    let slide1Index = headers.findIndex((h) => h === "Slide 1");
    let slide2Index = headers.findIndex((h) => h === "Slide 2");
    let slide3Index = headers.findIndex((h) => h === "Slide 3");
    let statusIndex = headers.findIndex((h) => h === "Status");
    let instaLinkIndex = headers.findIndex((h) => h === "Insta Link");
    let ytLinkIndex = headers.findIndex((h) => h === "Yt Link");
    let facebookLinkIndex = headers.findIndex((h) => h === "FaceBook Link");
    let timestampIndex = headers.findIndex((h) => h === "Time Stamp");

    // Log exact search results
    logger.info(
      `📋 Exact match results: Title=${titleIndex}, Slide1=${slide1Index}, Slide2=${slide2Index}, Slide3=${slide3Index}, Status=${statusIndex}`
    );

    // If exact matches fail, try flexible matching
    if (titleIndex === -1) {
      titleIndex = headers.findIndex(
        (h) => h && h.toLowerCase().includes("title")
      );
      logger.info(`📋 Flexible title search result: ${titleIndex}`);
    }
    if (slide1Index === -1) {
      slide1Index = headers.findIndex(
        (h) =>
          h &&
          h.toLowerCase().includes("slide") &&
          h.toLowerCase().includes("1")
      );
    }
    if (slide2Index === -1) {
      slide2Index = headers.findIndex(
        (h) =>
          h &&
          h.toLowerCase().includes("slide") &&
          h.toLowerCase().includes("2")
      );
    }
    if (slide3Index === -1) {
      slide3Index = headers.findIndex(
        (h) =>
          h &&
          h.toLowerCase().includes("slide") &&
          h.toLowerCase().includes("3")
      );
    }
    if (statusIndex === -1) {
      statusIndex = headers.findIndex(
        (h) => h && h.toLowerCase().includes("status")
      );
    }
    if (instaLinkIndex === -1) {
      instaLinkIndex = headers.findIndex(
        (h) =>
          h &&
          (h.toLowerCase().includes("insta") ||
            h.toLowerCase().includes("instagram"))
      );
    }
    if (ytLinkIndex === -1) {
      ytLinkIndex = headers.findIndex(
        (h) =>
          h &&
          (h.toLowerCase().includes("yt") ||
            h.toLowerCase().includes("youtube"))
      );
    }
    if (facebookLinkIndex === -1) {
      facebookLinkIndex = headers.findIndex(
        (h) => h && h.toLowerCase().includes("facebook")
      );
    }
    if (timestampIndex === -1) {
      timestampIndex = headers.findIndex(
        (h) =>
          h &&
          (h.toLowerCase().includes("time") ||
            h.toLowerCase().includes("timestamp"))
      );
    }

    logger.info(
      `Column indexes - Title: ${titleIndex}, Slide1: ${slide1Index}, Slide2: ${slide2Index}, Slide3: ${slide3Index}, Status: ${statusIndex}, Insta: ${instaLinkIndex}, YT: ${ytLinkIndex}, FB: ${facebookLinkIndex}, Timestamp: ${timestampIndex}`
    );

    // Validate that we found the essential columns
    if (
      titleIndex === -1 ||
      slide1Index === -1 ||
      slide2Index === -1 ||
      slide3Index === -1
    ) {
      throw new Error(
        `Missing essential columns. Found: Title=${titleIndex}, Slide1=${slide1Index}, Slide2=${slide2Index}, Slide3=${slide3Index}`
      );
    }

    // Find first unposted row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const status = statusIndex >= 0 ? row[statusIndex] : null;

      logger.info(
        `📝 Checking row ${i + 1}: Status="${status}", Title="${
          row[titleIndex] || ""
        }", HasSlides=${row[slide1Index] ? "Yes" : "No"}`
      );

      // Check if this row is not posted and has content
      if (!status || status.toLowerCase() !== "posted") {
        const title = titleIndex >= 0 ? (row[titleIndex] || "").trim() : "";
        const slide1 = slide1Index >= 0 ? (row[slide1Index] || "").trim() : "";
        const slide2 = slide2Index >= 0 ? (row[slide2Index] || "").trim() : "";
        const slide3 = slide3Index >= 0 ? (row[slide3Index] || "").trim() : "";

        // Skip rows with empty essential content
        if (!title || !slide1 || !slide2 || !slide3) {
          logger.warn(
            `⚠️ Skipping row ${
              i + 1
            }: Missing content (Title: "${title}", Slide1: "${slide1}", Slide2: "${slide2}", Slide3: "${slide3}")`
          );
          continue;
        }

        const taskData = {
          title,
          slide1,
          slide2,
          slide3,
          rowId: i + 1,
          rowIndex: i + 1,
        };

        logger.info(
          `✅ Found unposted carousel task: Row ${taskData.rowIndex}, Title: "${taskData.title}"`
        );
        return taskData;
      }
    }

    logger.info("ℹ️ No unposted carousel tasks found");
    return null;
  } catch (error) {
    logger.error("❌ Error fetching carousel task:", error.message);
    throw error;
  }
};

/**
 * Update carousel sheet status and links
 * @param {number} rowIndex - Row index to update (1-based)
 * @param {string} status - New status
 * @param {string} instagramUrl - Instagram post URL
 * @param {string} facebookUrl - Facebook post URL
 * @param {string} youtubeUrl - YouTube post URL
 */
const updateCarouselSheetStatus = async (
  rowIndex,
  status,
  instagramUrl = "",
  facebookUrl = "",
  youtubeUrl = ""
) => {
  try {
    logger.info(
      `📝 Updating carousel sheet status for row ${rowIndex} to "${status}"`
    );
    const sheets = await getSheetsClient();

    // Get current headers to find column positions
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: POSTS_SHEET_ID,
      range: "Sheet1!1:1",
    });

    const headers = headerResponse.data.values[0];
    const statusIndex = headers.findIndex(
      (h) => h && h.toLowerCase().includes("status")
    );
    const instaLinkIndex = headers.findIndex(
      (h) =>
        h &&
        (h.toLowerCase().includes("insta") ||
          h.toLowerCase().includes("instagram"))
    );
    const ytLinkIndex = headers.findIndex(
      (h) =>
        h &&
        (h.toLowerCase().includes("yt") || h.toLowerCase().includes("youtube"))
    );
    const facebookLinkIndex = headers.findIndex(
      (h) => h && h.toLowerCase().includes("facebook")
    );
    const timestampIndex = headers.findIndex(
      (h) =>
        h &&
        (h.toLowerCase().includes("time") ||
          h.toLowerCase().includes("timestamp"))
    );

    // Prepare updates
    const updates = [];
    const timestamp = new Date().toISOString();

    if (statusIndex >= 0) {
      updates.push({
        range: `Sheet1!${String.fromCharCode(65 + statusIndex)}${rowIndex}`,
        values: [[status]],
      });
    }

    if (instaLinkIndex >= 0 && instagramUrl) {
      updates.push({
        range: `Sheet1!${String.fromCharCode(65 + instaLinkIndex)}${rowIndex}`,
        values: [[instagramUrl]],
      });
    }

    if (ytLinkIndex >= 0 && youtubeUrl) {
      updates.push({
        range: `Sheet1!${String.fromCharCode(65 + ytLinkIndex)}${rowIndex}`,
        values: [[youtubeUrl]],
      });
    }

    if (facebookLinkIndex >= 0 && facebookUrl) {
      updates.push({
        range: `Sheet1!${String.fromCharCode(
          65 + facebookLinkIndex
        )}${rowIndex}`,
        values: [[facebookUrl]],
      });
    }

    if (timestampIndex >= 0) {
      updates.push({
        range: `Sheet1!${String.fromCharCode(65 + timestampIndex)}${rowIndex}`,
        values: [[timestamp]],
      });
    }

    // Execute batch update
    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: POSTS_SHEET_ID,
        resource: {
          valueInputOption: "RAW",
          data: updates,
        },
      });
      logger.info(`✅ Carousel sheet updated successfully for row ${rowIndex}`);
    } else {
      logger.warn(`⚠️ No columns found to update in carousel sheet`);
    }
  } catch (error) {
    logger.error("❌ Error updating carousel sheet status:", error.message);
    throw error;
  }
};

module.exports = {
  getNextCarouselTask,
  updateCarouselSheetStatus,
};
