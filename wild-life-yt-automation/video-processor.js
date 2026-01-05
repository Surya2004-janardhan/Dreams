const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { google } = require("googleapis");
const readline = require("readline");

class VideoProcessor {
  constructor(googleSheetId = null) {
    this.googleSheetId = googleSheetId || process.env.GOOGLE_SHEET_ID;
    this.downloadDir = path.join(__dirname, "downloaded_videos");
    this.outputDir = path.join(__dirname, "processed_videos");

    // API Setup
    this.youtube = null;
    this.sheets = null;
    this.credentialsPath = path.join(__dirname, "credentials.json");
    this.tokenPath = path.join(__dirname, "token.json");

    // Configuration
    this.defaultDescription = "";
    this.defaultHashtags = [];
    this.autoCaption = true;

    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  // Initialize YouTube API
  async initializeYouTubeAPI() {
    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: this.credentialsPath,
        scopes: ["https://www.googleapis.com/auth/youtube.upload"],
      });

      this.youtube = google.youtube({
        version: "v3",
        auth: auth,
      });
      console.log("✓ YouTube API initialized");
    } catch (error) {
      console.error("Failed to initialize YouTube API:", error);
      throw error;
    }
  }

  // Initialize Google Sheets API
  async initializeSheetsAPI() {
    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: this.credentialsPath,
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
      });

      this.sheets = google.sheets({
        version: "v4",
        auth: auth,
      });
      console.log("✓ Google Sheets API initialized");
    } catch (error) {
      console.error("Failed to initialize Sheets API:", error);
      throw error;
    }
  }

  // Read data from Google Sheet
  async readFromGoogleSheet() {
    try {
      if (!this.googleSheetId) {
        throw new Error(
          "Google Sheet ID not provided. Set GOOGLE_SHEET_ID or pass it to constructor"
        );
      }

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.googleSheetId,
        range: "Sheet1!A:Z",
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        console.log("No data found in sheet");
        return [];
      }

      const headers = rows[0];
      const data = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const obj = {};
        headers.forEach((header, index) => {
          obj[header.trim()] = (row[index] || "").trim();
        });

        // Only process rows with "not posted" status
        if (obj.status && obj.status.toLowerCase() === "not posted") {
          data.push(obj);
        }
      }

      console.log(`✓ Read ${data.length} unprocessed videos from Google Sheet`);
      return data;
    } catch (error) {
      console.error("Error reading Google Sheet:", error);
      throw error;
    }
  }

  // Update status in Google Sheet
  async updateGoogleSheetStatus(sno, newStatus) {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.googleSheetId,
        range: "Sheet1!A:A",
      });

      const rows = response.data.values;
      const rowIndex = rows.findIndex((row) => row[0] === String(sno));

      if (rowIndex === -1) {
        console.log(`Could not find row with sno ${sno}`);
        return;
      }

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.googleSheetId,
        range: `Sheet1!A${rowIndex + 1}:Z${rowIndex + 1}`,
        valueInputOption: "RAW",
        resource: {
          values: [[sno, newStatus]],
        },
      });

      console.log(`✓ Updated row ${sno} status to "${newStatus}"`);
    } catch (error) {
      console.error("Error updating Google Sheet:", error);
    }
  }

  // Process video row (extract 2 long + 4 short videos)
  async processVideoRow(videoRow) {
    const {
      sno,
      long1_0_7m,
      long1_7_14m,
      long1_14_21m,
      long2_0_7m,
      long2_7_14m,
      long2_14_21m,
      short1_0_1m,
      short1_1_2m,
      short1_2_3m,
      short1_3_4m,
      short2_0_1m,
      short2_1_2m,
      short2_2_3m,
      short2_3_4m,
      short3_0_1m,
      short3_1_2m,
      short3_2_3m,
      short3_3_4m,
      short4_0_1m,
      short4_1_2m,
      short4_2_3m,
      short4_3_4m,
    } = videoRow;

    try {
      const videos = [];

      // Long-form video 1
      if (long1_0_7m) {
        videos.push({
          id: `${sno}_long1`,
          type: "long",
          title: `Part ${sno} - Long Form 1`,
          segments: [
            { name: "0-7m", timing: long1_0_7m },
            { name: "7-14m", timing: long1_7_14m },
            { name: "14-21m", timing: long1_14_21m },
          ],
        });
      }

      // Long-form video 2
      if (long2_0_7m) {
        videos.push({
          id: `${sno}_long2`,
          type: "long",
          title: `Part ${sno} - Long Form 2`,
          segments: [
            { name: "0-7m", timing: long2_0_7m },
            { name: "7-14m", timing: long2_7_14m },
            { name: "14-21m", timing: long2_14_21m },
          ],
        });
      }

      // Short-form videos 1-4
      for (let i = 1; i <= 4; i++) {
        const shortKey = `short${i}`;
        const timing0 = videoRow[`${shortKey}_0_1m`];

        if (timing0) {
          videos.push({
            id: `${sno}_${shortKey}`,
            type: "short",
            title: `Part ${sno} - Short Form ${i}`,
            segments: [
              { name: "0-1m", timing: videoRow[`${shortKey}_0_1m`] },
              { name: "1-2m", timing: videoRow[`${shortKey}_1_2m`] },
              { name: "2-3m", timing: videoRow[`${shortKey}_2_3m`] },
              { name: "3-4m", timing: videoRow[`${shortKey}_3_4m`] },
            ],
          });
        }
      }

      // Update sheet status
      await this.updateGoogleSheetStatus(sno, "posted");

      console.log(`✓ Row ${sno} processed: ${videos.length} videos extracted`);

      return {
        sno,
        videosCount: videos.length,
        videos: videos.map((v) => ({
          id: v.id,
          type: v.type,
          title: v.title,
          segments: v.segments,
          description: this.defaultDescription,
          hashtags: this.defaultHashtags,
          captions: this.autoCaption,
        })),
      };
    } catch (error) {
      console.error(`✗ Error processing row ${sno}:`, error);
      throw error;
    }
  }

  // Upload video to YouTube
  async uploadToYouTube(videoMetadata) {
    try {
      const { title, segments, description, hashtags } = videoMetadata;

      const finalDescription = `${description}\n\n${hashtags.join(" ")}`;

      const response = await this.youtube.videos.insert({
        part: "snippet,status,processingDetails",
        requestBody: {
          snippet: {
            title: title,
            description: finalDescription,
            tags: hashtags.map((tag) => tag.replace("#", "")),
            categoryId: "27",
          },
          status: {
            privacyStatus: "public",
            madeForKids: false,
          },
        },
      });

      console.log(`✓ Uploaded: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      console.error("Error uploading to YouTube:", error);
      return null;
    }
  }

  // Set configuration
  setConfig(description, hashtags) {
    this.defaultDescription = description;
    this.defaultHashtags = hashtags;
  }

  // Main processing workflow
  async processAllVideos(uploadToYT = false) {
    console.log("🎬 Wildlife YouTube Automation Started\n");

    try {
      // Initialize APIs
      await this.initializeSheetsAPI();
      if (uploadToYT) {
        await this.initializeYouTubeAPI();
      }

      // Read from Google Sheet
      const videosToProcess = await this.readFromGoogleSheet();

      if (videosToProcess.length === 0) {
        console.log("No videos to process");
        return [];
      }

      console.log(`Processing ${videosToProcess.length} rows...\n`);

      const results = [];
      for (const videoRow of videosToProcess) {
        try {
          const result = await this.processVideoRow(videoRow);
          results.push(result);

          if (uploadToYT) {
            console.log(
              `Uploading ${result.videosCount} videos from row ${result.sno}...`
            );
            for (const video of result.videos) {
              const videoId = await this.uploadToYouTube(video);
              if (videoId) {
                video.youtubeId = videoId;
              }
            }
          }
        } catch (error) {
          console.error(`Failed to process row:`, videoRow);
        }
      }

      return results;
    } catch (error) {
      console.error("Fatal error:", error);
      process.exit(1);
    }
  }
}

// Main execution
const GOOGLE_SHEET_ID =
  process.env.GOOGLE_SHEET_ID || "YOUR_GOOGLE_SHEET_ID_HERE";

const processor = new VideoProcessor(GOOGLE_SHEET_ID);

processor.setConfig(
  "Educational wildlife content - nature, animals, and conservation",
  ["#wildlife", "#education", "#nature", "#learning"]
);

// Run with YouTube upload: set second parameter to true
processor
  .processAllVideos(false)
  .then((results) => {
    console.log("\n✅ Processing Complete!");
    console.log(`Total rows processed: ${results.length}`);
    console.log(
      `Total videos: ${results.reduce((sum, r) => sum + r.videosCount, 0)}`
    );
    console.log("\nResults:", JSON.stringify(results, null, 2));
  })
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });

module.exports = VideoProcessor;
