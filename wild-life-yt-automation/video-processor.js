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

    // Global variable: Store the downloaded video title (only 1 video)
    this.downloadedVideoTitle = null;

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

  // Download single video from hardcoded Drive link and extract title
  async downloadVideoFromDrive() {
    try {
      // HARDCODED DRIVE LINK - Replace with your actual Drive link
      const driveLink =
        process.env.DRIVE_LINK ||
        "https://drive.google.com/uc?id=YOUR_FILE_ID&export=download";

      console.log(`📥 Downloading video from Drive...`);

      // Download the video file
      const videoPath = await this.downloadFromDriveLink(driveLink);

      if (!videoPath) {
        console.warn(`Failed to download video from Drive`);
        return null;
      }

      // Extract title from downloaded video metadata
      const videoTitle = await this.extractVideoMetadata(videoPath);

      if (videoTitle) {
        // Store title as global class variable (single video, used for all formats)
        this.downloadedVideoTitle = videoTitle;
        console.log(
          `✓ Video downloaded and title stored globally: ${videoTitle}`
        );
        return videoTitle;
      }

      return null;
    } catch (error) {
      console.error(`Error downloading video from Drive:`, error);
      return null;
    }
  }

  // Download video from Google Drive link
  async downloadFromDriveLink(driveLink) {
    return new Promise((resolve) => {
      // TODO: Implement Google Drive download logic
      // This should download the file and save to this.downloadDir
      // Return the file path
      const filePath = path.join(this.downloadDir, `source-video.mp4`);

      console.log(`Downloading from: ${driveLink} -> ${filePath}`);

      // For now, return the expected path
      if (fs.existsSync(filePath)) {
        resolve(filePath);
      } else {
        console.warn(`Download incomplete: ${filePath}`);
        resolve(null);
      }
    });
  }

  // Extract title/metadata from video file using ffprobe
  async extractVideoMetadata(filePath) {
    return new Promise((resolve) => {
      // Use ffprobe to extract metadata including title
      const command = `ffprobe -v quiet -print_format json -show_format "${filePath}"`;

      exec(command, (error, stdout, stderr) => {
        try {
          if (error) {
            console.warn(`ffprobe error:`, error.message);
            resolve(null);
            return;
          }

          const metadata = JSON.parse(stdout);

          // Try to get title from metadata
          if (metadata.format && metadata.format.tags) {
            const title =
              metadata.format.tags.title || metadata.format.tags.Title || null;

            if (title) {
              console.log(`✓ Extracted title from video metadata: ${title}`);
              resolve(title);
              return;
            }
          }

          // If no title in metadata, extract from filename
          const filename = path.basename(filePath);
          const titleFromFile = filename
            .replace(/\.(mp4|mkv|avi|mov|webm)$/i, "")
            .replace(/^[0-9]+[-_]/, "")
            .replace(/[-_]/g, " ")
            .trim();

          console.log(`✓ Extracted title from filename: ${titleFromFile}`);
          resolve(titleFromFile);
        } catch (parseError) {
          console.warn(`Failed to parse ffprobe output:`, parseError.message);
          resolve(null);
        }
      });
    });
  }

  // Download video from Drive and store title in class variable
  async downloadVideoAndExtractTitle(driveLink, videoId) {
    try {
      console.log(`📥 Downloading video: ${videoId}`);

      // Download the video file
      const videoPath = await this.downloadFromDriveLink(driveLink, videoId);

      if (!videoPath) {
        console.warn(`Failed to download video: ${videoId}`);
        return null;
      }

      // Extract metadata/title from downloaded video file
      const videoTitle = await this.extractVideoMetadata(videoPath, videoId);

      if (videoTitle) {
        // Store title as global class variable for later use
        this.videoTitles[videoId] = videoTitle;
        console.log(`✓ Video title stored: ${videoId} -> ${videoTitle}`);
        return videoTitle;
      }

      return null;
    } catch (error) {
      console.error(
        `Error downloading/extracting title for ${videoId}:`,
        error
      );
      return null;
    }
  }

  // Download video from Google Drive link
  async downloadFromDriveLink(driveLink, videoId) {
    return new Promise((resolve) => {
      // TODO: Implement Google Drive download logic
      // This should download the file and save to this.downloadDir
      // Return the file path
      const filePath = path.join(this.downloadDir, `${videoId}.mp4`);

      console.log(`Downloading from: ${driveLink} -> ${filePath}`);

      // For now, return the expected path
      if (fs.existsSync(filePath)) {
        resolve(filePath);
      } else {
        console.warn(`Download incomplete: ${filePath}`);
        resolve(null);
      }
    });
  }

  // Extract title/metadata from video file using ffprobe
  async extractVideoMetadata(filePath, videoId) {
    return new Promise((resolve) => {
      // Use ffprobe to extract metadata including title
      const command = `ffprobe -v quiet -print_format json -show_format "${filePath}"`;

      exec(command, (error, stdout, stderr) => {
        try {
          if (error) {
            console.warn(`ffprobe error for ${videoId}:`, error.message);
            resolve(null);
            return;
          }

          const metadata = JSON.parse(stdout);

          // Try to get title from metadata
          if (metadata.format && metadata.format.tags) {
            const title =
              metadata.format.tags.title || metadata.format.tags.Title || null;

            if (title) {
              console.log(`✓ Extracted title from metadata: ${title}`);
              resolve(title);
              return;
            }
          }

          // If no title in metadata, extract from filename
          const filename = path.basename(filePath);
          const titleFromFile = filename
            .replace(/\.(mp4|mkv|avi|mov|webm)$/i, "")
            .replace(/^[0-9]+[-_]/, "")
            .replace(/[-_]/g, " ")
            .trim();

          console.log(`✓ Extracted title from filename: ${titleFromFile}`);
          resolve(titleFromFile);
        } catch (parseError) {
          console.warn(`Failed to parse ffprobe output:`, parseError.message);
          resolve(null);
        }
      });
    });
  }

  // Get video title from global variable
  getVideoTitle() {
    return this.downloadedVideoTitle;
  }

  // (Old methods removed - no longer needed for per-videoId storage)

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

      // Get the globally stored video title (downloaded once from Drive)
      const videoTitle = this.getVideoTitle() || "Wildlife Video";

      // Long-form video 1
      if (long1) {
        const timing = this.parseTimingToSeconds(long1);
        if (timing) {
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

  // Trim video based on timing (start and end minutes)
  async trimVideoByTiming(videoId, timing, outputDir) {
    return new Promise((resolve) => {
      try {
        // Source: RAW DOWNLOADED VIDEO (single video file)
        const inputPath = path.join(this.downloadDir, `source-video.mp4`);
        const outputPath = path.join(outputDir, `${videoId}_trimmed.mp4`);

        // Verify raw video exists
        if (!fs.existsSync(inputPath)) {
          console.error(`✗ Source video not found: ${inputPath}`);
          resolve(null);
          return;
        }

        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        // FFmpeg command to trim video from raw source
        // -ss: start time, -to: end time, -c copy: fast copying without re-encoding
        const command = `ffmpeg -i "${inputPath}" -ss ${timing.start} -to ${timing.end} -c copy "${outputPath}"`;

        console.log(
          `    🎬 Running: ffmpeg -ss ${timing.start} -to ${timing.end} -c copy`
        );

        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error(`    ✗ FFmpeg error: ${error.message}`);
            resolve(null);
            return;
          }

          if (!fs.existsSync(outputPath)) {
            console.error(`    ✗ Output file not created: ${outputPath}`);
            resolve(null);
            return;
          }

          const stats = fs.statSync(outputPath);
          console.log(
            `    ✓ Trimmed successfully (${(stats.size / 1024 / 1024).toFixed(
              2
            )} MB)`
          );
          resolve(outputPath);
        });
      } catch (error) {
        console.error(`Error trimming video ${videoId}:`, error);
        resolve(null);
      }
    });
  }

  // Process all videos: download -> trim based on timing -> prepare for upload
  async processAndTrimVideos(videosList) {
    console.log(`\n📊 Video Trimming Process:`);
    console.log(`   Total videos to trim: ${videosList.length}`);

    // Validate: should have exactly 2 long + 4 short = 6 videos
    const longVideos = videosList.filter((v) => v.type === "long");
    const shortVideos = videosList.filter((v) => v.type === "short");

    console.log(`   Long form videos: ${longVideos.length} (expected: 2)`);
    console.log(`   Short form videos: ${shortVideos.length} (expected: 4)`);

    if (longVideos.length !== 2 || shortVideos.length !== 4) {
      console.warn(
        `⚠️ WARNING: Expected 2 long + 4 short videos, but got ${longVideos.length} long + ${shortVideos.length} short`
      );
    }

    const processedVideos = [];
    let successCount = 0;
    let failureCount = 0;

    for (const video of videosList) {
      try {
        console.log(`\n  Trimming: ${video.id} (${video.type})`);
        console.log(`    Title: ${video.title}`);
        console.log(
          `    Timing: ${video.timing.display} (${video.timing.start} → ${video.timing.end})`
        );

        // Trim video based on timing values from raw downloaded video
        const trimmedPath = await this.trimVideoByTiming(
          video.id,
          video.timing,
          this.outputDir
        );

        if (trimmedPath) {
          processedVideos.push({
            ...video,
            filePath: trimmedPath,
            status: "trimmed",
          });
          successCount++;
        } else {
          console.warn(`❌ Failed to trim video: ${video.id}`);
          processedVideos.push({
            ...video,
            status: "trim_failed",
          });
          failureCount++;
        }
      } catch (error) {
        console.error(`Error processing video ${video.id}:`, error);
        failureCount++;
      }
    }

    console.log(
      `\n✓ Trimming complete: ${successCount} success, ${failureCount} failed`
    );
    return processedVideos;
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
      // Step 1: Download video from Drive and extract title
      console.log("Step 1: Downloading video from Drive...");
      await this.downloadVideoFromDrive();

      if (!this.downloadedVideoTitle) {
        console.error("Failed to download video or extract title. Exiting.");
        return [];
      }

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

          // Step 2: Trim videos based on timing from Google Sheet
          console.log(
            `\nStep 2: Trimming ${result.videosCount} videos for row ${result.sno}...`
          );
          const trimmedVideos = await this.processAndTrimVideos(result.videos);

          results.push({
            ...result,
            videos: trimmedVideos,
          });

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
              `\n▶️ Uploading ${result.videosCount} trimmed videos from row ${result.sno}...`
            );
            for (const video of result.videos) {
              // Only upload if video was successfully trimmed
              if (video.status === "trimmed") {
                console.log(`  Uploading: ${video.title}`);
                const videoId = await this.uploadToYouTube(video);
                if (videoId) {
                  video.youtubeId = videoId;
                  console.log(`  ✓ Uploaded with ID: ${videoId}`);
                } else {
                  console.error(`  ✗ Failed to upload: ${video.title}`);
                }
              } else {
                console.warn(`  ⊘ Skipping upload (trim failed): ${video.id}`);
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
