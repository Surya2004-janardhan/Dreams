const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");

// Google Sheets setup
const getSheetsClient = async () => {
  let credentials;
  if (!process.env.GOOGLE_CREDENTIALS) {
    console.error("❌ GOOGLE_CREDENTIALS environment variable is missing!");
    throw new Error("GOOGLE_CREDENTIALS secret is not configured in GitHub/Environment");
  }

  try {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  } catch (error) {
    console.error("❌ Failed to parse Google credentials JSON:", error.message);
    throw new Error("Invalid Google credentials format (Expected JSON string)");
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
};

// YouTube API setup
const getYouTubeClient = async () => {
  if (!process.env.GOOGLE_CREDENTIALS) {
    throw new Error("GOOGLE_CREDENTIALS environment variable is not set");
  }

  let credentials;
  try {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  } catch (e) {
    throw new Error("GOOGLE_CREDENTIALS is not valid JSON");
  }

  if (
    !credentials.client_id ||
    !credentials.client_secret ||
    !credentials.redirect_uris ||
    !credentials.redirect_uris[0]
  ) {
    throw new Error(
      "GOOGLE_CREDENTIALS is missing required fields (client_id, client_secret, redirect_uris)"
    );
  }

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

/**
 * Get YouTube client with service account authentication (for server-side operations)
 */
const getYouTubeClientServiceAccount = async () => {
  if (!process.env.GOOGLE_CREDENTIALS) {
    throw new Error("GOOGLE_CREDENTIALS environment variable is not set");
  }

  let credentials;
  try {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  } catch (e) {
    throw new Error("GOOGLE_CREDENTIALS is not valid JSON");
  }

  // Check if it's a service account (has private_key) or OAuth2 (has client_id)
  if (credentials.private_key) {
    // Service Account authentication
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/youtube.upload"],
    });
    return google.youtube({ version: "v3", auth });
  } else if (credentials.client_id) {
    // OAuth2 authentication
    const oauth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret,
      credentials.redirect_uris[0]
    );

    // Check if we have tokens
    if (credentials.access_token) {
      oauth2Client.setCredentials({
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token,
      });
    }

    return google.youtube({ version: "v3", auth: oauth2Client });
  } else {
    throw new Error("Invalid Google credentials format");
  }
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

// Google Drive API setup for uploads
const getGoogleDriveUploadClient = async () => {
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
          scopes: [
            "https://www.googleapis.com/auth/drive.file",
            "https://www.googleapis.com/auth/drive",
          ],
        });
        return google.drive({ version: "v3", auth });
      }
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive",
      ],
    });
    return google.drive({ version: "v3", auth });
  } catch (error) {
    console.error("Failed to setup Google Drive upload client:", error);
    throw new Error("Google Drive upload authentication failed");
  }
};

module.exports = {
  getSheetsClient,
  getYouTubeClient,
  getGoogleDriveClient,
  getYouTubeClientServiceAccount,
  getGoogleDriveUploadClient,
};
