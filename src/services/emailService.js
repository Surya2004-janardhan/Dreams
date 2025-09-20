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

/**
 * Send success notification email
 */
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
    const transporter = createTransporter();

    // Get AI-powered error analysis
    const errorAnalysis = analyzeError(error, step);

    const subject = `❌ Content Creation Failed: ${
      taskData?.idea || "Unknown Task"
    }`;

    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc3545;">❌ Content Creation Failed</h2>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Task Details:</h3>
        <p><strong>Title:</strong> ${taskData?.idea || "Unknown"}</p>
        <p><strong>Description:</strong> ${taskData?.description || "N/A"}</p>
        <p><strong>Serial Number:</strong> ${taskData?.sno || "N/A"}</p>
        <p><strong>Failed Step:</strong> ${step || "Unknown"}</p>
      </div>
      
      <div style="background: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; color: #856404;">
        <h3>🤖 AI Error Analysis:</h3>
        <p><strong>Summary:</strong> ${errorAnalysis.summary}</p>
        <p><strong>Suggested Solutions:</strong></p>
        <ul style="margin: 10px 0; padding-left: 20px;">
          ${errorAnalysis.solutions
            .map((solution) => `<li style="margin: 5px 0;">${solution}</li>`)
            .join("")}
        </ul>
      </div>
      
      <div style="background: #f8d7da; padding: 20px; border-radius: 5px; margin: 20px 0; color: #721c24;">
        <h3>Error Details:</h3>
        <pre style="white-space: pre-wrap; background: white; padding: 15px; border-radius: 3px; overflow-x: auto;">
${error.message || error.toString()}
        </pre>
        
        ${
          error.stack
            ? `
        <details style="margin-top: 15px;">
          <summary style="cursor: pointer; font-weight: bold;">Stack Trace</summary>
          <pre style="white-space: pre-wrap; background: white; padding: 15px; border-radius: 3px; margin-top: 10px; font-size: 12px; overflow-x: auto;">
${error.stack}
          </pre>
        </details>
        `
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
    </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.NOTIFICATION_EMAIL,
      subject: subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`✅ Error notification email sent for failed task`);

    // Clear log files after error notification is sent
    await clearLogFiles();
  } catch (emailError) {
    logger.error("Failed to send error notification:", emailError);
  }
};

/**
 * Send workflow status update email
 */
const sendStatusUpdate = async (status, message, details = {}) => {
  try {
    const transporter = createTransporter();

    // Add AI suggestions for status updates
    let aiSuggestions = [];
    if (status === "No Tasks Available") {
      aiSuggestions = [
        "Add new educational topics to your Google Sheet",
        "Review and update existing task statuses",
        "Check spreadsheet formatting and column headers",
        "Consider scheduling regular content batches",
      ];
    } else if (status.includes("Success") || status.includes("Complete")) {
      aiSuggestions = [
        "Review published content performance",
        "Plan next batch of educational topics",
        "Update content calendar and strategy",
        "Analyze engagement metrics for optimization",
      ];
    }

    const subject = `📊 Workflow Status: ${status}`;

    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #17a2b8;">📊 Workflow Status Update</h2>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Status: ${status}</h3>
        <p>${message}</p>
        <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
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
              (suggestion) => `<li style="margin: 5px 0;">${suggestion}</li>`
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
          `📝 Log file not found (skipping): ${path.basename(logFile)}`
        );
      }
    }

    logger.info("✅ Log files cleared successfully after workflow completion");
  } catch (error) {
    logger.error("❌ Failed to clear log files:", error.message);
    // Don't throw error here as log clearing failure shouldn't break the workflow
  }
};

module.exports = {
  sendSuccessNotification,
  sendErrorNotification,
  sendStatusUpdate,
  analyzeError,
  clearLogFiles,
};
