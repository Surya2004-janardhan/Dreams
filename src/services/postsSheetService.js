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

    // Find column indexes - flexible header matching
    const titleIndex = headers.findIndex(
      (h) => h && h.toLowerCase().includes("title")
    );
    const slide1Index = headers.findIndex(
      (h) =>
        h && h.toLowerCase().includes("slide") && h.toLowerCase().includes("1")
    );
    const slide2Index = headers.findIndex(
      (h) =>
        h && h.toLowerCase().includes("slide") && h.toLowerCase().includes("2")
    );
    const slide3Index = headers.findIndex(
      (h) =>
        h && h.toLowerCase().includes("slide") && h.toLowerCase().includes("3")
    );
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

    logger.info(
      `Column indexes - Title: ${titleIndex}, Slide1: ${slide1Index}, Slide2: ${slide2Index}, Slide3: ${slide3Index}, Status: ${statusIndex}, Insta: ${instaLinkIndex}, YT: ${ytLinkIndex}, FB: ${facebookLinkIndex}, Timestamp: ${timestampIndex}`
    );

    // Find first unposted row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const status = statusIndex >= 0 ? row[statusIndex] : null;

      // Check if this row is not posted
      if (!status || status.toLowerCase() !== "posted") {
        const taskData = {
          title: titleIndex >= 0 ? row[titleIndex] : "",
          slide1: slide1Index >= 0 ? row[slide1Index] : "",
          slide2: slide2Index >= 0 ? row[slide2Index] : "",
          slide3: slide3Index >= 0 ? row[slide3Index] : "",
          rowId: i + 1, // Use row number as ID
          rowIndex: i + 1, // 1-based row index for sheet updates
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
