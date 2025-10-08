require("dotenv").config();
const { google } = require("googleapis");
const logger = require("../config/logger");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const SocialMediaPostingService = require("./socialMediaPostingService");
const {
  uploadCarouselImages,
  cleanupCarouselImages,
} = require("./supabaseCarouselService");

/**
 * Carousel Generator Service
 * Generates slides using exact test_slide_generation logic and posts to social media
 */
class CarouselGeneratorService {
  constructor() {
    this.socialMediaService = new SocialMediaPostingService();
    this.slidesDir = path.join(__dirname, "../../slides");

    // Ensure slides directory exists
    if (!fs.existsSync(this.slidesDir)) {
      fs.mkdirSync(this.slidesDir, { recursive: true });
    }
  }

  /**
   * Fetch not posted row from Google Sheets
   * @returns {Promise<Object|null>} Task data or null
   */
  async fetchNotPostedRow() {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.POSTS_SHEET_ID;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "A:Z",
    });

    const rows = response.data.values;
    const headers = rows[0];

    logger.info(`Available headers: ${JSON.stringify(headers)}`);

    const titleCol = headers.findIndex((h) =>
      h?.toLowerCase().includes("title")
    );
    const slide1Col = headers.findIndex((h) =>
      h?.toLowerCase().includes("slide 1")
    );
    const slide2Col = headers.findIndex((h) =>
      h?.toLowerCase().includes("slide 2")
    );
    const slide3Col = headers.findIndex((h) =>
      h?.toLowerCase().includes("slide 3")
    );
    const statusCol = headers.findIndex((h) =>
      h?.toLowerCase().includes("status")
    );

    logger.info(
      `Column indices - Title: ${titleCol}, Slide1: ${slide1Col}, Slide2: ${slide2Col}, Slide3: ${slide3Col}, Status: ${statusCol}`
    );

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const status = row[statusCol]?.toLowerCase().trim();

      if (status === "not posted") {
        const result = {
          title: row[titleCol] || "",
          slide1: row[slide1Col] || "",
          slide2: row[slide2Col] || "",
          slide3: row[slide3Col] || "",
          rowIndex: i,
        };
        logger.info(`Found title: "${result.title}"`);
        logger.info(`Found slide1: "${result.slide1}"`);
        logger.info(`Found slide2: "${result.slide2}"`);
        logger.info(`Found slide3: "${result.slide3}"`);
        return result;
      }
    }
    return null;
  }

  /**
   * Generate slide with exact logic from test_slide_generation.js
   * @param {string} title - Slide title
   * @param {string} content - Slide content
   * @param {number} slideNumber - Slide number
   * @returns {Promise<string>} Path to generated slide
   */
  async generateSlide(title, content, slideNumber) {
    const outputPath = path.join(this.slidesDir, `slide_${slideNumber}.png`);

    try {
      logger.info(`Generating slide ${slideNumber} via API...`);
      logger.info(`Title: ${title}`);
      logger.info(`Content: ${content.substring(0, 100)}...`);

      // Call the external slide generation API
      const response = await axios.post(
        "https://slide-microservice.onrender.com/generate", // Replace with correct endpoint
        {
          title: title,
          content: content,
        },
        {
          responseType: "arraybuffer", // To handle binary image data
          timeout: 60000, // 60 second timeout
        }
      );

      // Save the image bytes to file
      fs.writeFileSync(outputPath, response.data);

      logger.info(`✅ Generated slide ${slideNumber}: ${outputPath}`);
      return outputPath;
    } catch (error) {
      logger.error(
        `❌ Error generating slide ${slideNumber} via API:`,
        error.message
      );
      if (error.response) {
        logger.error(`API Response Status: ${error.response.status}`);
        logger.error(`API Response Data:`, error.response.data);
      }
      throw new Error(
        `Failed to generate slide ${slideNumber}: ${error.message}`
      );
    }
  }

  /**
   * Generate all slides for a task
   * @param {Object} task - Task data with title and slide content
   * @returns {Promise<Array>} Array of slide file paths
   */
  async generateAllSlides(task) {
    const { title, slide1, slide2, slide3 } = task;
    const slideContents = [slide1, slide2, slide3];
    const slidePaths = [];

    logger.info(`🎨 Generating ${slideContents.length} slides for: "${title}"`);

    for (let i = 1; i <= 3; i++) {
      const slidePath = await this.generateSlide(
        title,
        slideContents[i - 1],
        i
      );
      slidePaths.push(slidePath);
    }

    logger.info(`✅ All ${slidePaths.length} slides generated successfully`);
    return slidePaths;
  }

  /**
   * Create carousel caption from task data
   * @param {Object} task - Task data
   * @returns {string} Formatted caption
   */
  createCarouselCaption(task) {
    const { title, slide1 } = task;

    // Create a professional caption
    const caption = `${title}

${slide1.substring(0, 100)}${slide1.length > 100 ? "..." : ""}

💡 Swipe to learn more!

#programming #coding #webdevelopment #tech #development #framework #javascript #react #nodejs #developer #coder #webdev #technology #tutorial #learntocode`;

    return caption;
  }

  /**
   * Generate carousel and post to social media
   * @returns {Promise<Object>} Results from posting
   */
  async generateAndPost() {
    try {
      logger.info("🚀 Starting carousel generation and posting workflow...");

      // Step 1: Fetch task data
      logger.info("📊 Fetching task data from Google Sheets...");
      const task = await this.fetchNotPostedRow();
      if (!task) {
        logger.info("📭 No not posted rows found");
        return { success: false, message: "No pending tasks found" };
      }

      logger.info(`📋 Found task: "${task.title}"`);

      // Step 2: Generate slides
      logger.info("🎨 Generating carousel slides...");
      const slidePaths = await this.generateAllSlides(task);

      // Step 3: Upload slides to Supabase for public URLs
      logger.info("📤 Uploading slides to Supabase storage...");
      const { publicUrls, uploadedPaths } = await uploadCarouselImages(
        slidePaths,
        task.title
      );

      // Step 4: Create caption
      const caption = this.createCarouselCaption(task);
      logger.info(`📝 Created caption (${caption.length} characters)`);

      // Step 5: Post to social media platforms
      logger.info("📱 Posting carousel to social media platforms...");
      const carouselData = {
        title: task.title,
        slides: [task.slide1, task.slide2, task.slide3],
        imagePaths: publicUrls, // Use public URLs instead of local paths
        caption: caption,
        hashtags: ["programming", "coding", "webdevelopment", "tech"],
      };

      const postingResults = await this.socialMediaService.postCarousel(
        carouselData
      );

      // Step 6: Cleanup local files
      logger.info("🧹 Cleaning up local slide files...");
      await this.cleanupLocalSlides(slidePaths);

      // Step 7: Optionally cleanup Supabase files after posting
      if (
        postingResults.instagram?.success ||
        postingResults.facebook?.success
      ) {
        logger.info(
          "✅ Posting successful - keeping Supabase files for reference"
        );
      } else {
        logger.info("❌ Posting failed - cleaning up Supabase files");
        await cleanupCarouselImages(uploadedPaths);
      }

      const successfulPosts = Object.values(postingResults).filter(
        (r) => r?.success
      ).length;
      logger.info(
        `🎉 Carousel workflow complete: ${successfulPosts}/2 platforms succeeded`
      );

      return {
        success: successfulPosts > 0,
        task: {
          title: task.title,
          rowIndex: task.rowIndex,
        },
        slides: {
          generated: slidePaths.length,
          uploaded: publicUrls.length,
        },
        posting: postingResults,
        message: `Successfully posted to ${successfulPosts}/2 platforms`,
      };
    } catch (error) {
      logger.error("❌ Carousel generation and posting failed:", error.message);
      return {
        success: false,
        error: error.message,
        message: "Carousel workflow failed",
      };
    }
  }

  /**
   * Cleanup local slide files
   * @param {Array} slidePaths - Array of local slide file paths
   */
  async cleanupLocalSlides(slidePaths) {
    for (const slidePath of slidePaths) {
      try {
        if (fs.existsSync(slidePath)) {
          fs.unlinkSync(slidePath);
          logger.info(`🧹 Deleted local file: ${path.basename(slidePath)}`);
        }
      } catch (error) {
        logger.error(`❌ Failed to delete ${slidePath}:`, error.message);
      }
    }
  }

  /**
   * Update Google Sheets status after posting
   * @param {number} rowIndex - Row index to update
   * @param {Object} results - Posting results
   */
  async updateSheetStatus(rowIndex, results) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      const sheets = google.sheets({ version: "v4", auth });
      const spreadsheetId = process.env.POSTS_SHEET_ID;

      // Update status column
      const statusRange = `E${rowIndex + 1}`; // Assuming status is in column E
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: statusRange,
        valueInputOption: "RAW",
        resource: {
          values: [["posted"]],
        },
      });

      // Update Instagram link if successful
      if (results.instagram?.success && results.instagram?.url) {
        const instaRange = `F${rowIndex + 1}`; // Assuming Instagram link is in column F
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: instaRange,
          valueInputOption: "RAW",
          resource: {
            values: [[results.instagram.url]],
          },
        });
      }

      // Update Facebook link if successful
      if (results.facebook?.success && results.facebook?.url) {
        const fbRange = `G${rowIndex + 1}`; // Assuming Facebook link is in column G
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: fbRange,
          valueInputOption: "RAW",
          resource: {
            values: [[results.facebook.url]],
          },
        });
      }

      logger.info(
        `✅ Updated Google Sheets row ${rowIndex + 1} with posting results`
      );
    } catch (error) {
      logger.error("❌ Failed to update Google Sheets:", error.message);
    }
  }
}

module.exports = CarouselGeneratorService;
