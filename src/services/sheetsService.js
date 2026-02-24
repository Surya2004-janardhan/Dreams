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
        (h.toLowerCase() === "title" || 
         h.toLowerCase().includes("idea") ||
         h.toLowerCase().includes("topic"))
    );
    const descriptionIndex = headers.findIndex(
      (h) => h && h.toLowerCase().includes("description")
    );
    // Support for 2-column sheet: "scripts", "status"
    const scriptsColIndex = headers.findIndex(
      (h) => h && h.toLowerCase().includes("script")
    );
    const statusIndex = headers.findIndex(
      (h) => h && h.toLowerCase().includes("status")
    );
    // Unified Link Detection (Support both new and legacy schemas)
    const audioLinkIndex = headers.findIndex((h) => h && h.toLowerCase().includes("audio link"));
    const videoLinkIndex = headers.findIndex((h) => h && (h.toLowerCase().includes("vedio link") || h.toLowerCase().includes("video link")));
    const srtLinkIndex = headers.findIndex((h) => h && h.toLowerCase().includes("srt link"));
    
    const ytLinkIndex = headers.findIndex((h) => h && (h.toLowerCase().includes("yt") || h.toLowerCase().includes("youtube") || h.toLowerCase() === "links"));
    const instaLinkIndex = headers.findIndex((h) => h && (h.toLowerCase().includes("insta") || h.toLowerCase().includes("instagram")));
    const fbLinkIndex = headers.findIndex((h) => h && (h.toLowerCase().includes("fb") || h.toLowerCase().includes("facebook")));

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
          rowId: i + 1,
          sno: row[snoIndex] || "",
          idea: row[ideaIndex] || row[scriptsColIndex] || "",
          scripts: row[scriptsColIndex] || "",
          description: row[descriptionIndex] || "",
          status: row[statusIndex] || "Not Posted",
          // New Schema Aliases
          audioLink: row[audioLinkIndex] || row[instaLinkIndex] || "", 
          videoLink: row[videoLinkIndex] || row[ytLinkIndex] || "",
          srtLink: row[srtLinkIndex] || row[fbLinkIndex] || "",
          // Legacy Schema Aliases (for backward compatibility)
          ytLink: row[ytLinkIndex] || row[videoLinkIndex] || "",
          instaLink: row[instaLinkIndex] || row[audioLinkIndex] || "",
          fbLink: row[fbLinkIndex] || row[srtLinkIndex] || "",
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
  videoLink = "",
  audioLink = "",
  srtLink = "",
  sheetId = null
) => {
  const targetSheetId = sheetId || process.env.GOOGLE_SHEET_ID;

  try {
    const sheets = await getSheetsClient();

    // Get current timestamp
    const now = new Date();
    const timestamp = now.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    // Find column indexes for the row
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: targetSheetId,
      range: "Sheet1!A:Z",
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      throw new Error("No data found in spreadsheet for update");
    }

    const headers = rows[0];

    // Find column indexes
    const statusIndex = headers.findIndex(
      (h) => h && h.toLowerCase().includes("status")
    );
    const audioLinkIndex = headers.findIndex((h) => h && h.toLowerCase().includes("audio link"));
    const videoLinkIndex = headers.findIndex((h) => h && (h.toLowerCase().includes("vedio link") || h.toLowerCase().includes("video link")));
    const srtLinkIndex = headers.findIndex((h) => h && h.toLowerCase().includes("srt link"));
    
    const ytLinkIndex = headers.findIndex((h) => h && (h.toLowerCase().includes("yt") || h.toLowerCase().includes("youtube") || h.toLowerCase() === "links"));
    const instaLinkIndex = headers.findIndex((h) => h && (h.toLowerCase().includes("insta") || h.toLowerCase().includes("instagram")));
    const fbLinkIndex = headers.findIndex((h) => h && (h.toLowerCase().includes("fb") || h.toLowerCase().includes("facebook")));
    const timestampIndex = headers.findIndex(
      (h) =>
        h &&
        (h.toLowerCase().includes("timestamp") ||
          h.toLowerCase().includes("date"))
    );

    console.log("📊 UPDATE COLUMN INDEXES:");
    console.log(
      `Status=${statusIndex}, YT=${ytLinkIndex}, Insta=${instaLinkIndex}, FB=${fbLinkIndex}, Timestamp=${timestampIndex}`
    );

    // Prepare update data
    const updates = [];

    if (statusIndex !== -1) {
      updates.push({
        range: `Sheet1!${getColumnLetter(statusIndex + 1)}${rowId}`,
        values: [[status]],
      });
    }

    // Positional Logic: 
    // Argument 3: videoLink OR ytLink
    // Argument 4: audioLink OR instaLink
    // Argument 5: srtLink OR fbLink

    if (videoLink) {
      const idx = videoLinkIndex !== -1 ? videoLinkIndex : ytLinkIndex;
      if (idx !== -1) {
        updates.push({
          range: `Sheet1!${getColumnLetter(idx + 1)}${rowId}`,
          values: [[videoLink]],
        });
      }
    }
    
    if (audioLink) {
      const idx = audioLinkIndex !== -1 ? audioLinkIndex : instaLinkIndex;
      if (idx !== -1) {
        updates.push({
          range: `Sheet1!${getColumnLetter(idx + 1)}${rowId}`,
          values: [[audioLink]],
        });
      }
    }

    if (srtLink) {
      const idx = srtLinkIndex !== -1 ? srtLinkIndex : fbLinkIndex;
      if (idx !== -1) {
        updates.push({
          range: `Sheet1!${getColumnLetter(idx + 1)}${rowId}`,
          values: [[srtLink]],
        });
      }
    }

    if (timestampIndex !== -1) {
      updates.push({
        range: `Sheet1!${getColumnLetter(timestampIndex + 1)}${rowId}`,
        values: [[timestamp]],
      });
    }

    // Execute batch update
    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: targetSheetId,
        resource: {
          valueInputOption: "RAW",
          data: updates,
        },
      });

      logger.info(`✓ Updated sheet row ${rowId} with status: ${status}`);
    } else {
      logger.warn("No columns found to update in sheet");
    }
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

module.exports = {
  getNextTask,
  updateSheetStatus,
};