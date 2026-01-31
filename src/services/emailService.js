const nodemailer = require("nodemailer");
const logger = require("../config/logger");
const fs = require("fs");
const path = require("path");

/**
 * Create email transporter
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });
};

const sendSuccessNotification = async (taskData, results) => {
  try {
    const transporter = createTransporter();

    const subject = `✅ Content Created Successfully: ${taskData.idea}`;

    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #28a745;">🎉 Content Creation Success!</h2>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Content Details:</h3>
        <p><strong>Title:</strong> ${taskData.idea}</p>
        <p><strong>Description:</strong> ${taskData.description}</p>
        <p><strong>Serial Number:</strong> ${taskData.sno}</p>
      </div>
      
      <div style="background: #e7f3ff; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>📺 Published Links:</h3>
        ${
          results.youtubeUrl
            ? `
        <p><strong>YouTube:</strong> 
          <a href="${results.youtubeUrl}" target="_blank" style="color: #dc3545;">${results.youtubeUrl}</a>
        </p>
        `
            : "<p><strong>YouTube:</strong> Upload failed</p>"
        }
        
        ${
          results.instagramUrl
            ? `
        <p><strong>Instagram:</strong> 
          <a href="${results.instagramUrl}" target="_blank" style="color: #e4405f;">${results.instagramUrl}</a>
        </p>
        `
            : "<p><strong>Instagram:</strong> Upload failed</p>"
        }
        
        ${
          results.facebookUrl
            ? `
        <p><strong>Facebook:</strong> 
          <a href="${results.facebookUrl}" target="_blank" style="color: #1877f2;">${results.facebookUrl}</a>
        </p>
        `
            : "<p><strong>Facebook:</strong> Upload failed</p>"
        }
      </div>
      
      <div style="background: #f0f8f0; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>📊 Process Summary:</h3>
        <ul>
          <li>✅ Script generated with Q&A format</li>
          <li>✅ Multi-speaker TTS audio created</li>
          <li>✅ Educational images generated</li>
          <li>✅ Video compiled with subtitles</li>
          <li>✅ Uploaded to social media platforms</li>
          <li>✅ Google Sheet updated with status</li>
          <li>✅ Media folders cleaned</li>
        </ul>
      </div>
      
      <div style="background: #d4edda; padding: 20px; border-radius: 5px; margin: 20px 0; color: #155724;">
        <h3>🤖 AI Optimization Suggestions:</h3>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li style="margin: 5px 0;">Monitor engagement metrics on YouTube and Instagram over the next 24-48 hours</li>
          <li style="margin: 5px 0;">Consider creating follow-up content based on viewer questions and comments</li>
          <li style="margin: 5px 0;">Analyze which topics perform best to guide future content creation</li>
          <li style="margin: 5px 0;">Schedule the next batch of content for optimal posting times</li>
          <li style="margin: 5px 0;">Review and update your content calendar with new educational topics</li>
        </ul>
      </div>
      
      <div style="text-align: center; margin: 30px 0; padding: 20px; background: #fff3cd; border-radius: 5px;">
        <p style="margin: 0; color: #856404;">
          <strong>🎯 Your automated content creation is complete!</strong><br>
          The content is now live and ready to engage your audience.
        </p>
      </div>
    </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.NOTIFICATION_EMAIL, // Send to chintalajanardhan2004
      subject: subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`✅ Success notification email sent for: ${taskData.idea}`);

    // Clear log files after successful workflow completion
    await clearLogFiles();
  } catch (error) {
    logger.error("Failed to send success notification:", error);
  }
};

/**
 * Send error notification email
 */
const sendErrorNotification = async (taskData, error, step) => {
  try {
    // Partial success links
    let hasPartial = false;
    let partialLinksHtml = "";
    let youtubeUrl =
      error?.youtubeUrl ||
      error?.results?.youtubeUrl ||
      (error?.details?.youtubeUrl ?? null);
    let instagramUrl =
      error?.instagramUrl ||
      error?.results?.instagramUrl ||
      (error?.details?.instagramUrl ?? null);
    let facebookUrl =
      error?.facebookUrl ||
      error?.results?.facebookUrl ||
      (error?.details?.facebookUrl ?? null);

    if (youtubeUrl || instagramUrl || facebookUrl) {
      hasPartial = true;
      partialLinksHtml = `<div style="background: #e7f3ff; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>⚠️ Partial Success: Uploaded Platform Links</h3>
        ${
          youtubeUrl
            ? `<p><strong>YouTube:</strong> <a href='${youtubeUrl}' target='_blank' style='color: #dc3545;'>${youtubeUrl}</a></p>`
            : "<p><strong>YouTube:</strong> Upload failed</p>"
        }
        ${
          instagramUrl
            ? `<p><strong>Instagram:</strong> <a href='${instagramUrl}' target='_blank' style='color: #e4405f;'>${instagramUrl}</a></p>`
            : "<p><strong>Instagram:</strong> Upload failed</p>"
        }
        ${
          facebookUrl
            ? `<p><strong>Facebook:</strong> <a href='${facebookUrl}' target='_blank' style='color: #1877f2;'>${facebookUrl}</a></p>`
            : "<p><strong>Facebook:</strong> Upload failed</p>"
        }
      </div>`;
    }

    const transporter = createTransporter();
    const errorAnalysis = analyzeError(error, step);
    const subject = `❌ Content Creation Failed: ${
      taskData?.idea || "Unknown Task"
    }`;

    const htmlContent = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc3545;">❌ Content Creation Failed${
        hasPartial ? " (Partial Success)" : ""
      }</h2>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Task Details:</h3>
        <p><strong>Title:</strong> ${taskData?.idea || "Unknown"}</p>
        <p><strong>Description:</strong> ${taskData?.description || "N/A"}</p>
        <p><strong>Serial Number:</strong> ${taskData?.sno || "N/A"}</p>
        <p><strong>Failed Step:</strong> ${step || "Unknown"}</p>
      </div>
  ${hasPartial ? partialLinksHtml : ""}
      <div style="background: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; color: #856404;">
        <h3>🤖 AI Error Analysis:</h3>
        <p><strong>Summary:</strong> ${errorAnalysis.summary}</p>
        <p><strong>Suggested Solutions:</strong></p>
        <ul style="margin: 10px 0; padding-left: 20px;">
          ${errorAnalysis.solutions
            .map((solution) => `<li style='margin: 5px 0;'>${solution}</li>`)
            .join("")}
        </ul>
      </div>
      <div style="background: #f8d7da; padding: 20px; border-radius: 5px; margin: 20px 0; color: #721c24;">
        <h3>Error Details:</h3>
  <pre style="white-space: pre-wrap; background: white; padding: 15px; border-radius: 3px; overflow-x: auto;">${
    error.message || error.toString()
  }</pre>
  ${
    error.stack
      ? `<details style='margin-top: 15px;'><summary style='cursor: pointer; font-weight: bold;'>Stack Trace</summary><pre style='white-space: pre-wrap; background: white; padding: 15px; border-radius: 3px; margin-top: 10px; font-size: 12px; overflow-x: auto;'>${error.stack}</pre></details>`
      : ""
  }
      </div>
      <div style="background: #d1ecf1; padding: 20px; border-radius: 5px; margin: 20px 0; color: #0c5460;">
        <h3>🔧 Additional Troubleshooting:</h3>
        <ol>
          <li>Check the server logs for more details</li>
          <li>Verify API keys and credentials are correct</li>
          <li>Ensure all required environment variables are set</li>
          <li>Check internet connectivity and API rate limits</li>
          <li>Restart the workflow manually if needed</li>
        </ol>
      </div>
      <div style="text-align: center; margin: 30px 0;">
        <p style="color: #6c757d;">
          <em>Automated notification from AI Content Automation System</em>
        </p>
      </div>
    </div>`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.NOTIFICATION_EMAIL,
      subject: subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`✅ Error notification email sent for failed task`);
  } catch (emailError) {
    logger.error("Failed to send error notification:", emailError);
  }
};

/**
 * Send status update email
 */
const sendStatusUpdate = async (status, details, aiSuggestions) => {
  try {
    const transporter = createTransporter();

    const subject = `📊 Workflow Status Update: ${status}`;

    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #17a2b8;">📊 Workflow Status Update</h2>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Status: ${status}</h3>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      </div>
      
      ${
        Object.keys(details).length > 0
          ? `
      <div style="background: #e7f3ff; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Additional Details:</h3>
        <ul>
          ${Object.entries(details)
            .map(([key, value]) => `<li><strong>${key}:</strong> ${value}</li>`)
            .join("")}
        </ul>
      </div>
      `
          : ""
      }
      
      ${
        aiSuggestions.length > 0
          ? `
      <div style="background: #d4edda; padding: 20px; border-radius: 5px; margin: 20px 0; color: #155724;">
        <h3>🤖 AI Suggestions:</h3>
        <ul style="margin: 10px 0; padding-left: 20px;">
          ${aiSuggestions
            .map(
              (suggestion) => `<li style="margin: 5px 0;">${suggestion}</li>`,
            )
            .join("")}
        </ul>
      </div>
      `
          : ""
      }
      
      <div style="text-align: center; margin: 30px 0;">
        <p style="color: #6c757d;">
          <em>Automated status update from AI Content Automation System</em>
        </p>
      </div>
    </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.NOTIFICATION_EMAIL || process.env.EMAIL_USER,
      subject: subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`✅ Status update email sent: ${status}`);
  } catch (error) {
    logger.error("Failed to send status update:", error);
  }
};

/**
 * Analyze error and provide AI-powered summary and solutions
 */
const analyzeError = (error, step) => {
  const errorMessage = error.message || error.toString();
  const errorStack = error.stack || "";

  let summary = "";
  let solutions = [];

  // Analyze based on error patterns
  if (errorMessage.includes("ffmpeg")) {
    summary = "FFmpeg processing error occurred during video composition";
    solutions = [
      "Check FFmpeg installation and ensure all codecs are available",
      "Verify input video/audio files are not corrupted",
      "Ensure sufficient disk space for video processing",
      "Try reducing video resolution or quality settings",
    ];
  } else if (
    errorMessage.includes("Google Sheets") ||
    errorMessage.includes("spreadsheet")
  ) {
    summary =
      "Google Sheets API error - unable to access or modify spreadsheet data";
    solutions = [
      "Verify Google Sheets API credentials are valid",
      "Check spreadsheet permissions and sharing settings",
      "Ensure the spreadsheet ID in environment variables is correct",
      "Confirm internet connectivity to Google APIs",
    ];
  } else if (
    errorMessage.includes("YouTube") ||
    errorMessage.includes("upload")
  ) {
    summary = "Social media upload error - failed to publish content";
    solutions = [
      "Verify YouTube/Instagram API credentials and permissions",
      "Check video file format and size limits",
      "Ensure account has necessary upload permissions",
      "Try uploading manually to verify account status",
    ];
  } else if (errorMessage.includes("API") || errorMessage.includes("token")) {
    summary = "API authentication or rate limiting error";
    solutions = [
      "Verify API keys and tokens are valid and not expired",
      "Check API rate limits and implement retry logic",
      "Ensure proper authentication headers are being sent",
      "Review API documentation for any recent changes",
    ];
  } else if (errorMessage.includes("file") || errorMessage.includes("path")) {
    summary = "File system error - unable to access or process files";
    solutions = [
      "Verify all required directories exist and have proper permissions",
      "Check file paths and ensure files are not locked by other processes",
      "Ensure sufficient disk space is available",
      "Validate file formats match expected types",
    ];
  } else if (
    errorMessage.includes("No tasks found") ||
    errorMessage.includes("Not Posted")
  ) {
    summary = "No available tasks found in the workflow queue";
    solutions = [
      "Add new content ideas to the Google Sheet",
      'Ensure tasks are marked with status "Not Posted"',
      "Verify spreadsheet structure matches expected format",
      "Check if all previous tasks have been processed",
    ];
  } else if (
    errorMessage.includes("timeout") ||
    errorMessage.includes("network")
  ) {
    summary = "Network or timeout error during processing";
    solutions = [
      "Check internet connectivity and stability",
      "Implement retry logic with exponential backoff",
      "Verify API endpoints are accessible",
      "Consider increasing timeout values for long operations",
    ];
  } else {
    summary = `Unexpected error in ${step || "workflow"}: ${
      errorMessage.split(".")[0]
    }`;
    solutions = [
      "Review application logs for additional context",
      "Check system resources (CPU, memory, disk space)",
      "Verify all environment variables are properly configured",
      "Consider restarting the application",
      "Contact support if the issue persists",
    ];
  }

  return { summary, solutions };
};

/**
 * Clear log files after workflow completion
 */
const clearLogFiles = async () => {
  try {
    const logFiles = [
      path.join(process.cwd(), "combined.log"),
      path.join(process.cwd(), "error.log"),
    ];

    for (const logFile of logFiles) {
      if (fs.existsSync(logFile)) {
        // Clear the file by writing empty content
        fs.writeFileSync(logFile, "", "utf8");
        logger.info(`🧹 Cleared log file: ${path.basename(logFile)}`);
      } else {
        logger.info(
          `📝 Log file not found (skipping): ${path.basename(logFile)}`,
        );
      }
    }

    logger.info("✅ Log files cleared successfully after workflow completion");
  } catch (error) {
    logger.error("❌ Failed to clear log files:", error.message);
    // Don't throw error here as log clearing failure shouldn't break the workflow
  }
};

/**
 * Send carousel post success notification with platform links
 * @param {Object} taskData - Carousel task data
 * @param {Object} postResults - Results from both platforms
 * @param {string} instagramUrl - Instagram post URL
 * @param {string} facebookUrl - Facebook post URL
 */
const sendCarouselPostNotification = async (
  taskData,
  postResults,
  instagramUrl,
  facebookUrl,
) => {
  try {
    const transporter = createTransporter();

    // Check if this is an error notification
    const hasError =
      postResults && (postResults.error || postResults.partialResults);
    const errorMessage = hasError ? postResults.error : null;
    const partialResults = hasError ? postResults.partialResults : postResults;

    const subject = hasError
      ? `⚠️ Carousel Post Issue: ${taskData.title}`
      : `🎠 Carousel Post Published Successfully: ${taskData.title}`;

    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: ${hasError ? "#dc3545" : "#28a745"};">${
        hasError ? "⚠️ Carousel Post Issue" : "🎉 Carousel Post Success!"
      }</h2>
      
       <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
         <h3>📋 Carousel Details:</h3>
         <p><strong>Title:</strong> ${taskData.title}</p>
         <p><strong>Slide 1:</strong> ${taskData.slide1}</p>
         <p><strong>Slide 2:</strong> ${taskData.slide2}</p>
         <p><strong>Slide 3:</strong> ${taskData.slide3}</p>
         <p><strong>Row:</strong> ${taskData.rowIndex}</p>
         <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
       </div>
      
      ${
        hasError
          ? `
      <div style="background: #f8d7da; padding: 20px; border-radius: 5px; margin: 20px 0; color: #721c24;">
        <h3>❌ Error Details:</h3>
        <p><strong>Error:</strong> ${errorMessage}</p>
        <p style="font-size: 12px; margin-top: 10px;">Please check the server logs for more details and try again if needed.</p>
      </div>
      `
          : ""
      }
      
      <div style="background: #e7f3ff; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>🔗 Platform Status:</h3>
        
        ${
          instagramUrl
            ? `
        <div style="background: #fff; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #e4405f;">
          <p style="margin: 0;"><strong>📸 Instagram:</strong></p>
          <a href="${instagramUrl}" target="_blank" style="color: #e4405f; text-decoration: none; font-weight: bold;">
            ${instagramUrl}
          </a>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">✅ Carousel posted successfully</p>
        </div>
        `
            : `
        <div style="background: #fff; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #dc3545;">
          <p style="margin: 0; color: #dc3545;"><strong>📸 Instagram:</strong> ❌ Failed to post</p>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">Error: ${
            partialResults?.instagram?.error || "Unknown error"
          }</p>
        </div>
        `
        }
        
        ${
          facebookUrl
            ? `
        <div style="background: #fff; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #1877f2;">
          <p style="margin: 0;"><strong>📘 Facebook:</strong></p>
          <a href="${facebookUrl}" target="_blank" style="color: #1877f2; text-decoration: none; font-weight: bold;">
            ${facebookUrl}
          </a>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">✅ Carousel posted successfully</p>
        </div>
        `
            : `
        <div style="background: #fff; padding: 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #dc3545;">
          <p style="margin: 0; color: #dc3545;"><strong>📘 Facebook:</strong> ❌ Failed to post</p>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #666;">Error: ${
            partialResults?.facebook?.error || "Unknown error"
          }</p>
        </div>
        `
        }
      </div>
      
      <div style="background: ${
        hasError ? "#f8d7da" : "#f0f8f0"
      }; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>📊 Carousel Process Summary:</h3>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li style="margin: 5px 0;">✅ Read task from Google Sheets</li>
          <li style="margin: 5px 0;">✅ Generated 3 text overlay slides</li>
          <li style="margin: 5px 0;">✅ Uploaded images to Supabase for public URLs</li>
          <li style="margin: 5px 0;">${
            hasError ? "❌" : "✅"
          } Posted carousel to ${
            instagramUrl && facebookUrl
              ? "both platforms"
              : instagramUrl
                ? "Instagram only"
                : facebookUrl
                  ? "Facebook only"
                  : "no platforms (failed)"
          }</li>
          <li style="margin: 5px 0;">${
            hasError ? "❌" : "✅"
          } Updated Google Sheets with "${
            hasError ? "Error" : "Posted"
          }" status</li>
          <li style="margin: 5px 0;">✅ Cleaned up all temporary files</li>
        </ul>
      </div>
      
      ${
        hasError
          ? `
      <div style="background: #d1ecf1; padding: 20px; border-radius: 5px; margin: 20px 0; color: #0c5460;">
        <h3>🔧 Troubleshooting Steps:</h3>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li style="margin: 5px 0;">Check the server logs for detailed error information</li>
          <li style="margin: 5px 0;">Verify API keys and credentials are still valid</li>
          <li style="margin: 5px 0;">Check internet connectivity and API rate limits</li>
          <li style="margin: 5px 0;">Try running the workflow again manually</li>
          <li style="margin: 5px 0;">Contact support if the issue persists</li>
        </ul>
      </div>
      `
          : `
      <div style="background: #d4edda; padding: 20px; border-radius: 5px; margin: 20px 0; color: #155724;">
        <h3>🎯 Next Steps & Engagement Tips:</h3>
        <ul style="margin: 10px 0; padding-left: 20px;">
          <li style="margin: 5px 0;">📊 Monitor engagement metrics over the next 24 hours</li>
          <li style="margin: 5px 0;">💬 Respond to comments and engage with your audience</li>
          <li style="margin: 5px 0;">📱 Share to your stories for additional reach</li>
          <li style="margin: 5px 0;">🔄 Consider creating similar carousel content on trending topics</li>
          <li style="margin: 5px 0;">📈 Track which slides get the most engagement for future optimization</li>
        </ul>
      </div>
      `
      }
      
      <div style="text-align: center; margin: 30px 0; padding: 20px; background: ${
        hasError ? "#f8d7da" : "#fff3cd"
      }; border-radius: 5px;">
        <p style="margin: 0; color: ${hasError ? "#721c24" : "#856404"};">
          <strong>${
            hasError
              ? "⚠️ Issue occurred during carousel posting"
              : "🎠 Your carousel post is now live!"
          }</strong><br>
          ${
            hasError
              ? "Check the error details above and try again."
              : "Check the links above to view your posts on each platform."
          }
        </p>
      </div>
    </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.NOTIFICATION_EMAIL,
      subject: subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    logger.info(
      `✅ Carousel post notification email sent for: ${taskData.title}`,
    );
  } catch (error) {
    logger.error(
      "❌ Failed to send carousel post notification:",
      error.message,
    );
    // Don't throw error to prevent workflow failure
  }
};

module.exports = {
  sendSuccessNotification,
  sendErrorNotification,
  sendStatusUpdate,
  analyzeError,
  clearLogFiles,
};
