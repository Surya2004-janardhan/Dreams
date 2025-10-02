const { getSheetsClient } = require("../config/google");
const logger = require("../config/logger");

/**
 * Get the first "Not Posted" row from Google Sheets
 * @param {string} sheetId - Optional sheet ID, defaults to GOOGLE_SHEET_ID
 */
const getNextTask = async (sheetId = null) => {
  const targetSheetId = sheetId || process.env.GOOGLE_SHEET_ID;

  try {
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: targetSheetId,
      range: "Sheet1!A:Z", // Get all columns
    });

    const rows = response.data.values;
    logger.info(`📊 Sheet data received: ${rows ? rows.length : 0} rows`);

    if (!rows || rows.length === 0) {
      throw new Error("No data found in spreadsheet");
    }

    if (rows.length < 2) {
      throw new Error("Spreadsheet has headers but no data rows");
    }

    // Find header row (assuming first row)
    const headers = rows[0];
    console.log("📋 SHEET HEADERS:", headers);

    // Find column indexes
    const snoIndex = headers.findIndex(
      (h) =>
        h &&
        (h.toLowerCase().includes("sno") ||
          h.toLowerCase().includes("s.no") ||
          h.toLowerCase().includes("serial"))
    );
    const ideaIndex = headers.findIndex(
      (h) =>
        h &&
        (h.toLowerCase().includes("idea") ||
          h.toLowerCase().includes("title") ||
          h.toLowerCase().includes("topic"))
    );
    const descriptionIndex = headers.findIndex(
      (h) => h && h.toLowerCase().includes("description")
    );
    const statusIndex = headers.findIndex(
      (h) => h && h.toLowerCase().includes("status")
    );
    const ytLinkIndex = headers.findIndex(
      (h) =>
        h &&
        (h.toLowerCase().includes("yt") || h.toLowerCase().includes("youtube"))
    );
    const instaLinkIndex = headers.findIndex(
      (h) =>
        h.toLowerCase().includes("insta") ||
        h.toLowerCase().includes("instagram")
    );
    const fbLinkIndex = headers.findIndex(
      (h) =>
        h.toLowerCase().includes("fb") || h.toLowerCase().includes("facebook")
    );
    const timestampIndex = headers.findIndex(
      (h) =>
        h &&
        (h.toLowerCase().includes("timestamp") ||
          h.toLowerCase().includes("date"))
    );

    console.log("📊 COLUMN INDEXES FOUND:");
    console.log(
      `SNO=${snoIndex}, Idea=${ideaIndex}, Description=${descriptionIndex}, Status=${statusIndex}`
    );

    // Loop through all data rows (skip header)
    logger.debug("🔍 Checking each row for 'NOT POSTED' status...");
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      if (!row || row.length === 0) {
        console.log(`Row ${i + 1}: EMPTY ROW, SKIPPING`);
        continue;
      }

      // Get status value safely
      const statusValue = row[statusIndex];
      const status = statusValue ? statusValue.toLowerCase().trim() : "";
      console.log(
        `Row ${i + 1} Status: "${statusValue}" -> normalized: "${status}"`
      );

      // Check if this row should be processed
      const shouldProcess =
        status === "not posted" ||
        status === "not_posted" ||
        status === "" ||
        status === "pending" ||
        status === "error" || // Allow retrying failed tasks
        !statusValue;

      console.log(`Row ${i + 1} Should Process: ${shouldProcess}`);

      if (shouldProcess) {
        console.log(`✅ FOUND PROCESSABLE TASK AT ROW ${i + 1}`);

        const taskData = {
          rowId: i + 1, // Google Sheets is 1-indexed
          sno: row[snoIndex] || "",
          idea: row[ideaIndex] || "", // This will now correctly get the title
          description: row[descriptionIndex] || "",
          status: row[statusIndex] || "Not Posted",
          ytLink: row[ytLinkIndex] || "",
          instaLink: row[instaLinkIndex] || "",
          fbLink: row[fbLinkIndex] || "",
          timestamp: row[timestampIndex] || "",
        };

        logger.info(`📋 Task data extracted for row ${i + 1}`);
        return taskData;
      }
    }

    console.log("❌ NO PROCESSABLE TASKS FOUND AFTER CHECKING ALL ROWS");
    throw new Error("No 'Not Posted' tasks found in spreadsheet");
  } catch (error) {
    console.error("❌ ERROR IN getNextTask:", error);
    logger.error("Error getting next task from sheets:", error);
    throw error;
  }
};

/**
 * Update sheet row status to "Posted" with links and timestamp
 * @param {number} rowId - Row ID to update
 * @param {string} status - New status
 * @param {string} ytLink - YouTube link
 * @param {string} instaLink - Instagram link
 * @param {string} fbLink - Facebook link
 * @param {string} sheetId - Optional sheet ID, defaults to GOOGLE_SHEET_ID
 */
const updateSheetStatus = async (
  rowId,
  status,
  ytLink = "",
  instaLink = "",
  fbLink = "",
  sheetId = null
) => {
  const targetSheetId = sheetId || process.env.GOOGLE_SHEET_ID;

  try {
    const sheets = await getSheetsClient();

    // Get current data to find column positions
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: targetSheetId,
      range: "Sheet1!A1:Z1",
    });

    const headers = response.data.values[0];
    const statusIndex = headers.findIndex((h) =>
      h.toLowerCase().includes("status")
    );
    const ytLinkIndex = headers.findIndex(
      (h) =>
        h.toLowerCase().includes("yt") || h.toLowerCase().includes("youtube")
    );
    const instaLinkIndex = headers.findIndex(
      (h) =>
        h.toLowerCase().includes("insta") ||
        h.toLowerCase().includes("instagram")
    );
    const fbLinkIndex = headers.findIndex(
      (h) =>
        h.toLowerCase().includes("fb") || h.toLowerCase().includes("facebook")
    );
    const timestampIndex = headers.findIndex(
      (h) =>
        h.toLowerCase().includes("timestamp") ||
        h.toLowerCase().includes("date")
    );

    const updates = [];

    // Update status
    if (statusIndex !== -1) {
      updates.push({
        range: `Sheet1!${getColumnLetter(statusIndex + 1)}${rowId}`,
        values: [[status]],
      });
    }

    // Update YouTube link
    if (ytLinkIndex !== -1 && ytLink) {
      updates.push({
        range: `Sheet1!${getColumnLetter(ytLinkIndex + 1)}${rowId}`,
        values: [[ytLink]],
      });
    }

    // Update Instagram link
    if (instaLinkIndex !== -1 && instaLink) {
      updates.push({
        range: `Sheet1!${getColumnLetter(instaLinkIndex + 1)}${rowId}`,
        values: [[instaLink]],
      });
    }

    // Update Facebook link
    if (fbLinkIndex !== -1 && fbLink) {
      updates.push({
        range: `Sheet1!${getColumnLetter(fbLinkIndex + 1)}${rowId}`,
        values: [[fbLink]],
      });
    }

    // Update timestamp
    if (timestampIndex !== -1) {
      updates.push({
        range: `Sheet1!${getColumnLetter(timestampIndex + 1)}${rowId}`,
        values: [[new Date().toISOString()]],
      });
    }

    // Batch update all changes
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: targetSheetId,
      resource: {
        data: updates,
        valueInputOption: "RAW",
      },
    });

    logger.info(`✓ Updated sheet row ${rowId} with status: ${status}`);
  } catch (error) {
    logger.error("Error updating sheet status:", error);
    throw error;
  }
};

/**
 * Helper function to convert column number to letter (A, B, C, etc.)
 */
const getColumnLetter = (columnNumber) => {
  let result = "";
  while (columnNumber > 0) {
    columnNumber--;
    result = String.fromCharCode(65 + (columnNumber % 26)) + result;
    columnNumber = Math.floor(columnNumber / 26);
  }
  return result;
};

/**
 * Get the next carousel task from Google Sheets with format: Title, Slide 1, Slide 2, Slide 3, Status, Insta Link, Yt Link, FaceBook Link, Time Stamp
 * @param {string} sheetId - Optional sheet ID, defaults to GOOGLE_SHEET_ID
 */
const getNextCarouselTask = async (sheetId = null) => {
  try {
    const targetSheetId = sheetId || process.env.GOOGLE_SHEET_ID;
    const sheets = await getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: targetSheetId,
      range: "Sheet1!A:I", // Get columns A to I (Title to Time Stamp)
    });

    const rows = response.data.values;
    logger.info(
      `🎠 Carousel sheet data received: ${rows ? rows.length : 0} rows`
    );

    if (!rows || rows.length === 0) {
      throw new Error("No data found in spreadsheet");
    }

    if (rows.length < 2) {
      throw new Error("Spreadsheet has headers but no data rows");
    }

    // Find header row (assuming first row)
    const headers = rows[0];
    // console.log("📋 CAROUSEL SHEET HEADERS:", headers);

    // Expected columns: Title, Slide 1, Slide 2, Slide 3, Status, Insta Link, Yt Link, FaceBook Link, Time Stamp
    const titleIndex = headers.findIndex(
      (h) => h && h.toLowerCase().includes("title")
    );
    const slide1Index = headers.findIndex(
      (h) => h && h.toLowerCase().includes("slide 1")
    );
    const slide2Index = headers.findIndex(
      (h) => h && h.toLowerCase().includes("slide 2")
    );
    const slide3Index = headers.findIndex(
      (h) => h && h.toLowerCase().includes("slide 3")
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
    const fbLinkIndex = headers.findIndex(
      (h) =>
        h &&
        (h.toLowerCase().includes("fb") || h.toLowerCase().includes("facebook"))
    );
    const timestampIndex = headers.findIndex(
      (h) =>
        h &&
        (h.toLowerCase().includes("timestamp") ||
          h.toLowerCase().includes("time"))
    );

    console.log("📊 CAROUSEL COLUMN INDEXES FOUND:");
    // console.log(
    //   `Title=${titleIndex}, Slide1=${slide1Index}, Slide2=${slide2Index}, Slide3=${slide3Index}, Status=${statusIndex}`
    // );

    // Loop through all data rows (skip header)
    console.log("🔍 CHECKING EACH ROW FOR CAROUSEL TASK:");
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      // console.log(`Row ${i + 1}:`, row);

      if (!row || row.length === 0) {
        // console.log(`Row ${i + 1}: EMPTY ROW, SKIPPING`);
        continue;
      }

      // Get status value safely
      const statusValue = row[statusIndex];
      const status = statusValue ? statusValue.toLowerCase().trim() : "";
      // console.log(
      //   `Row ${i + 1} Status: "${statusValue}" -> normalized: "${status}"`
      // );

      // Check if this row should be processed (not posted)
      const shouldProcess = status !== "posted" && status !== "posted";

      // console.log(`Row ${i + 1} Should Process: ${shouldProcess}`);

      if (shouldProcess) {
        console.log(`✅ FOUND PROCESSABLE CAROUSEL TASK AT ROW ${i + 1}`);

        const taskData = {
          rowId: i + 1, // Google Sheets is 1-indexed
          title: row[titleIndex] || "",
          slide1: row[slide1Index] || "",
          slide2: row[slide2Index] || "",
          slide3: row[slide3Index] || "",
          status: row[statusIndex] || "",
          instaLink: row[instaLinkIndex] || "",
          ytLink: row[ytLinkIndex] || "",
          fbLink: row[fbLinkIndex] || "",
          timestamp: row[timestampIndex] || "",
        };

        logger.info(`📋 Carousel task data extracted for row ${i + 1}`);
        return taskData;
      }
    }

    console.log("❌ NO PROCESSABLE CAROUSEL TASKS FOUND");
    throw new Error("No unposted carousel tasks found in spreadsheet");
  } catch (error) {
    console.error("❌ ERROR IN getNextCarouselTask:", error);
    logger.error("Error getting next carousel task from sheets:", error);
    throw error;
  }
};

/**
 * Update carousel sheet row status to "Posted" with links and timestamp
 * @param {number} rowId - Row ID to update
 * @param {string} status - New status
 * @param {string} instaLink - Instagram link
 * @param {string} ytLink - YouTube link
 * @param {string} fbLink - Facebook link
 * @param {string} sheetId - Optional sheet ID
 */
const updateCarouselSheetStatus = async (
  rowId,
  status,
  instaLink = "",
  ytLink = "",
  fbLink = "",
  sheetId = null
) => {
  try {
    const targetSheetId = sheetId || process.env.GOOGLE_SHEET_ID;
    const sheets = await getSheetsClient();

    // Get current headers to find column positions
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: targetSheetId,
      range: "Sheet1!A1:I1",
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
    const fbLinkIndex = headers.findIndex(
      (h) =>
        h &&
        (h.toLowerCase().includes("fb") || h.toLowerCase().includes("facebook"))
    );
    const timestampIndex = headers.findIndex(
      (h) =>
        h &&
        (h.toLowerCase().includes("timestamp") ||
          h.toLowerCase().includes("time"))
    );

    const updates = [];

    // Update status
    if (statusIndex !== -1) {
      updates.push({
        range: `Sheet1!${getColumnLetter(statusIndex + 1)}${rowId}`,
        values: [[status]],
      });
    }

    // Update Instagram link
    if (instaLinkIndex !== -1 && instaLink) {
      updates.push({
        range: `Sheet1!${getColumnLetter(instaLinkIndex + 1)}${rowId}`,
        values: [[instaLink]],
      });
    }

    // Update YouTube link
    if (ytLinkIndex !== -1 && ytLink) {
      updates.push({
        range: `Sheet1!${getColumnLetter(ytLinkIndex + 1)}${rowId}`,
        values: [[ytLink]],
      });
    }

    // Update Facebook link
    if (fbLinkIndex !== -1 && fbLink) {
      updates.push({
        range: `Sheet1!${getColumnLetter(fbLinkIndex + 1)}${rowId}`,
        values: [[fbLink]],
      });
    }

    // Update timestamp
    if (timestampIndex !== -1) {
      updates.push({
        range: `Sheet1!${getColumnLetter(timestampIndex + 1)}${rowId}`,
        values: [[new Date().toISOString()]],
      });
    }

    // Batch update all changes
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: targetSheetId,
      resource: {
        data: updates,
        valueInputOption: "RAW",
      },
    });

    logger.info(`✓ Updated carousel sheet row ${rowId} with status: ${status}`);
  } catch (error) {
    logger.error("Error updating carousel sheet status:", error);
    throw error;
  }
};

module.exports = {
  getNextTask,
  updateSheetStatus,
  getNextCarouselTask,
  updateCarouselSheetStatus,
};
