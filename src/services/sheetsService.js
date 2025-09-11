const { getSheetsClient } = require("../config/google");
const logger = require("../config/logger");

/**
 * Get the first "Not Posted" row from Google Sheets
 */
const getNextTask = async () => {
  try {
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: "Sheet1!A:Z", // Adjust range as needed
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      throw new Error("No data found in spreadsheet");
    }

    // Find header row (assuming first row)
    const headers = rows[0];

    // Find column indexes
    const snoIndex = headers.findIndex(
      (h) =>
        h.toLowerCase().includes("sno") ||
        h.toLowerCase().includes("s.no") ||
        h.toLowerCase().includes("serial")
    );
    const ideaIndex = headers.findIndex(
      (h) =>
        h.toLowerCase().includes("idea") || h.toLowerCase().includes("title")
    );
    const descriptionIndex = headers.findIndex((h) =>
      h.toLowerCase().includes("description")
    );
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
    const timestampIndex = headers.findIndex(
      (h) =>
        h.toLowerCase().includes("timestamp") ||
        h.toLowerCase().includes("date")
    );

    logger.info(
      `Found column indexes: SNO=${snoIndex}, Idea=${ideaIndex}, Description=${descriptionIndex}, Status=${statusIndex}`
    );

    // Find first "Not Posted" row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const status = row[statusIndex]?.toLowerCase() || "";

      if (status === "not posted" || status === "" || status === "pending") {
        return {
          rowId: i + 1, // Google Sheets is 1-indexed
          sno: row[snoIndex] || "",
          idea: row[ideaIndex] || "",
          description: row[descriptionIndex] || "",
          status: row[statusIndex] || "Not Posted",
          ytLink: row[ytLinkIndex] || "",
          instaLink: row[instaLinkIndex] || "",
          timestamp: row[timestampIndex] || "",
        };
      }
    }

    throw new Error("No 'Not Posted' tasks found in spreadsheet");
  } catch (error) {
    logger.error("Error getting next task from sheets:", error);
    throw error;
  }
};

/**
 * Update sheet row status to "Posted" with links and timestamp
 */
const updateSheetStatus = async (
  rowId,
  status,
  ytLink = "",
  instaLink = ""
) => {
  try {
    const sheets = await getSheetsClient();

    // Get current data to find column positions
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
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

    // Update timestamp
    if (timestampIndex !== -1) {
      updates.push({
        range: `Sheet1!${getColumnLetter(timestampIndex + 1)}${rowId}`,
        values: [[new Date().toISOString()]],
      });
    }

    // Batch update all changes
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
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

module.exports = {
  getNextTask,
  updateSheetStatus,
};
