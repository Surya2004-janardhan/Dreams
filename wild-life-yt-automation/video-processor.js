const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { google } = require("googleapis");
const readline = require("readline");
const nodemailer = require("nodemailer");

class VideoProcessor {
  constructor(googleSheetId = null) {
    this.googleSheetId = "1UtcTTHV0ChwpXBIBjRsgpbZLq-QrsTCcJPg4O1gHPI8";
    this.downloadDir = path.join(__dirname, "downloaded_videos");
    this.outputDir = path.join(__dirname, "processed_videos");

    // API Setup
    this.youtube = null;
    this.sheets = null;
    this.credentialsPath = path.join(__dirname, "credentials.json");
    this.tokenPath = path.join(__dirname, "token.json");

    // Configuration - CONSTANT FOR ALL VIDEOS
    this.defaultDescription =
      "Educational wildlife content - nature, animals, and conservation";
    this.defaultHashtags = ["#wildlife", "#education", "#nature", "#learning"];
    this.autoCaption = true;

    // Email Configuration
    this.emailTransporter = null;
    this.recipientEmail = "";

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
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
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

        // Only process rows with empty "Posted Status" (not posted)
        if (
          !obj["Posted Status"] ||
          obj["Posted Status"].toString().trim() === ""
        ) {
          data.push({ ...obj, rowIndex: i + 1 });
        }
      }

      console.log(`✓ Read ${data.length} unprocessed videos from Google Sheet`);
      return data;
    } catch (error) {
      console.error("Error reading Google Sheet:", error);
      throw error;
    }
  }

  // Update status and timestamp in Google Sheet
  async updateGoogleSheetStatus(sno, rowIndex) {
    try {
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

      // Update Posted Status (column B) with timestamp
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.googleSheetId,
        range: `Sheet1!B${rowIndex}`,
        valueInputOption: "RAW",
        resource: {
          values: [[timestamp]],
        },
      });

      // Update Time Posted Completion (last column) with timestamp
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.googleSheetId,
        range: `Sheet1!I${rowIndex}`,
        valueInputOption: "RAW",
        resource: {
          values: [[timestamp]],
        },
      });

      console.log(
        `✓ Updated row ${sno} - Status: "Posted" | Timestamp: ${timestamp}`
      );
    } catch (error) {
      console.error("Error updating Google Sheet:", error);
    }
  }

  // Get downloaded video title from file
  getDownloadedVideoTitle(videoId) {
    try {
      // Look for video files in downloaded_videos directory
      const files = fs.readdirSync(this.downloadDir);

      // Find file that matches the videoId pattern
      const videoFile = files.find(
        (file) => file.includes(videoId) || file.startsWith(videoId)
      );

      if (videoFile) {
        // Extract title from filename (remove extension and ID prefix)
        let title = videoFile
          .replace(/\.(mp4|mkv|avi|mov|webm)$/i, "") // Remove extension
          .replace(/^[0-9]+[-_]/, "") // Remove leading numbers and separators
          .replace(/[-_]/g, " ") // Replace separators with spaces
          .trim();

        return title;
      }

      return null;
    } catch (error) {
      console.warn(`Could not extract title for ${videoId}:`, error.message);
      return null;
    }
  }

  // Parse timing from format "1 - 7 min" or "1-7 min" to seconds
  parseTimingToSeconds(timingStr) {
    if (!timingStr) return null;

    // Extract numbers from format like "1 - 7 min", "1-7 min", "14 - 21 min"
    const match = timingStr.match(/(\d+)\s*-\s*(\d+)\s*min/i);
    if (match) {
      const startMin = parseInt(match[1]);
      const endMin = parseInt(match[2]);
      return {
        start: `${startMin}:00`,
        end: `${endMin}:00`,
        display: timingStr,
      };
    }
    return null;
  }

  // Process video row (extract 2 long + 4 short videos)
  async processVideoRow(videoRow) {
    const {
      Sno,
      "Long Form 1": long1,
      "Long Form 2": long2,
      "Short 1": short1,
      "Short 2": short2,
      "Short 3": short3,
      "Short 4": short4,
      rowIndex,
    } = videoRow;

    try {
      const videos = [];

      // Long-form video 1
      if (long1) {
        const timing = this.parseTimingToSeconds(long1);
        if (timing) {
          // Get actual downloaded video title
          const videoTitle =
            this.getDownloadedVideoTitle(`${Sno}_long1`) || "Long Form Video 1";

          videos.push({
            id: `${Sno}_long1`,
            type: "long",
            title: `Part - ${Sno} - ${videoTitle}`,
            timing: timing,
          });
        }
      }

      // Long-form video 2
      if (long2) {
        const timing = this.parseTimingToSeconds(long2);
        if (timing) {
          // Get actual downloaded video title
          const videoTitle =
            this.getDownloadedVideoTitle(`${Sno}_long2`) || "Long Form Video 2";

          videos.push({
            id: `${Sno}_long2`,
            type: "long",
            title: `Part - ${Sno} - ${videoTitle}`,
            timing: timing,
          });
        }
      }

      // Short-form videos 1-4
      for (let i = 1; i <= 4; i++) {
        const shortKey = `Short ${i}`;
        const shortTiming = videoRow[shortKey];

        if (shortTiming) {
          const timing = this.parseTimingToSeconds(shortTiming);
          if (timing) {
            // Get actual downloaded video title
            const videoTitle =
              this.getDownloadedVideoTitle(`${Sno}_short${i}`) ||
              `Short Form Video ${i}`;

            videos.push({
              id: `${Sno}_short${i}`,
              type: "short",
              title: `Part - ${Sno} - ${videoTitle}`,
              timing: timing,
            });
          }
        }
      }

      // Update sheet status and timestamp
      await this.updateGoogleSheetStatus(Sno, rowIndex);

      console.log(`✓ Row ${Sno} processed: ${videos.length} videos extracted`);

      return {
        sno: Sno,
        videosCount: videos.length,
        videos: videos.map((v) => ({
          id: v.id,
          type: v.type,
          title: v.title,
          timing: v.timing,
          description: this.defaultDescription,
          hashtags: this.defaultHashtags,
          captions: this.autoCaption,
        })),
      };
    } catch (error) {
      console.error(`✗ Error processing row ${Sno}:`, error);
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

  // Initialize Email Service
  async initializeEmailService(emailConfig) {
    try {
      this.emailTransporter = nodemailer.createTransport({
        service: emailConfig.service || "gmail",
        auth: {
          user: emailConfig.email,
          pass: emailConfig.appPassword,
        },
      });

      // Test connection
      await this.emailTransporter.verify();
      this.recipientEmail = emailConfig.recipientEmail || emailConfig.email;
      console.log("✓ Email service initialized");
    } catch (error) {
      console.error("Failed to initialize email service:", error);
      throw error;
    }
  }

  // Send email notification
  async sendEmailNotification(subject, htmlContent) {
    try {
      if (!this.emailTransporter) {
        console.warn(
          "Email service not initialized. Skipping email notification."
        );
        return;
      }

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: this.recipientEmail,
        subject: subject,
        html: htmlContent,
      };

      const info = await this.emailTransporter.sendMail(mailOptions);
      console.log(`✓ Email sent: ${info.messageId}`);
      return info;
    } catch (error) {
      console.error("Error sending email:", error);
    }
  }

  // Format email for successful processing
  formatSuccessEmail(rowData, videosCount, timestamp) {
    return `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
            <h2 style="color: #27ae60;">✓ Video Processing Successful</h2>
            <p><strong>Row Number:</strong> ${rowData.Sno}</p>
            <p><strong>Videos Processed:</strong> ${videosCount}</p>
            <p><strong>Long Form 1:</strong> ${
              rowData["Long Form 1"] || "N/A"
            }</p>
            <p><strong>Long Form 2:</strong> ${
              rowData["Long Form 2"] || "N/A"
            }</p>
            <p><strong>Short Form Videos:</strong> 4 videos</p>
            <p><strong>Completion Time:</strong> ${timestamp}</p>
            <p style="color: #7f8c8d; font-size: 12px; margin-top: 20px;">Status updated in Google Sheet</p>
          </div>
        </body>
      </html>
    `;
  }

  // Format email for failed processing
  formatFailureEmail(rowData, errorMessage, timestamp) {
    return `
      <html>
        <body style="font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e74c3c; border-radius: 8px;">
            <h2 style="color: #e74c3c;">✗ Video Processing Failed</h2>
            <p><strong>Row Number:</strong> ${rowData.Sno}</p>
            <p><strong>Error:</strong> ${errorMessage}</p>
            <p><strong>Failed At:</strong> ${timestamp}</p>
            <p style="color: #7f8c8d; font-size: 12px; margin-top: 20px;">Please check the logs for more details</p>
          </div>
        </body>
      </html>
    `;
  }

  // Main processing workflow
  async processAllVideos(uploadToYT = true) {
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

          // Send success email
          if (this.emailTransporter) {
            const timestamp = new Date().toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
            });
            const successEmail = this.formatSuccessEmail(
              videoRow,
              result.videosCount,
              timestamp
            );
            await this.sendEmailNotification(
              `✓ Video Processing Complete - Row ${videoRow.Sno}`,
              successEmail
            );
          }

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

          // Send failure email
          if (this.emailTransporter) {
            const timestamp = new Date().toLocaleString("en-IN", {
              timeZone: "Asia/Kolkata",
            });
            const failureEmail = this.formatFailureEmail(
              videoRow,
              error.message,
              timestamp
            );
            await this.sendEmailNotification(
              `✗ Video Processing Failed - Row ${videoRow.Sno}`,
              failureEmail
            );
          }
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
  process.env.GOOGLE_SHEET_ID || "1UtcTTHV0ChwpXBIBjRsgpbZLq-QrsTCcJPg4O1gHPI8";

const processor = new VideoProcessor(GOOGLE_SHEET_ID);

// Email configuration
const emailConfig = {
  email: process.env.EMAIL_USER || "your-email@gmail.com",
  appPassword: process.env.EMAIL_PASS || "your-app-password",
  recipientEmail: process.env.RECIPIENT_EMAIL || "recipient@example.com",
  service: "gmail",
};

processor
  .initializeEmailService(emailConfig)
  .then(() => {
    // Run with YouTube upload: set second parameter to true
    return processor.processAllVideos(false);
  })
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
