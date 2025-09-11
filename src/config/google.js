const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");

// Google Sheets setup
const getSheetsClient = async () => {
  let credentials;
  try {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  } catch (error) {
    console.error("Failed to parse Google credentials:", error);
    throw new Error(
      "Invalid Google credentials format in environment variables"
    );
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
};

// YouTube API setup
const getYouTubeClient = async () => {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  const oauth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    credentials.redirect_uris[0]
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
  });

  return google.youtube({ version: "v3", auth: oauth2Client });
};

// Google Drive API setup
const getGoogleDriveClient = async () => {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || "{}");
    if (!credentials || !credentials.client_email) {
      // Fallback to service account file
      const serviceAccountPath = path.join(
        process.cwd(),
        "seismic-rarity-468405-j1-a83f924d9fbc.json"
      );
      if (fs.existsSync(serviceAccountPath)) {
        const auth = new google.auth.GoogleAuth({
          keyFile: serviceAccountPath,
          scopes: ["https://www.googleapis.com/auth/drive.readonly"],
        });
        return google.drive({ version: "v3", auth });
      }
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    return google.drive({ version: "v3", auth });
  } catch (error) {
    console.error("Failed to setup Google Drive client:", error);
    throw new Error("Google Drive authentication failed");
  }
};

module.exports = {
  getSheetsClient,
  getYouTubeClient,
  getGoogleDriveClient,
};
