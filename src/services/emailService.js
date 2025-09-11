const nodemailer = require("nodemailer");
const logger = require("../config/logger");

/**
 * Create email transporter
 */
const createTransporter = () => {
  return nodemailer.createTransporter({
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
        ${results.youtubeUrl ? `
        <p><strong>YouTube:</strong> 
          <a href="${results.youtubeUrl}" target="_blank" style="color: #dc3545;">${results.youtubeUrl}</a>
        </p>
        ` : '<p><strong>YouTube:</strong> Upload failed</p>'}
        
        ${results.instagramUrl ? `
        <p><strong>Instagram:</strong> 
          <a href="${results.instagramUrl}" target="_blank" style="color: #e4405f;">${results.instagramUrl}</a>
        </p>
        ` : '<p><strong>Instagram:</strong> Upload failed</p>'}
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
      to: process.env.EMAIL_USER, // Send to self
      subject: subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`✅ Success notification email sent for: ${taskData.idea}`);
    
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
    
    const subject = `❌ Content Creation Failed: ${taskData?.idea || 'Unknown Task'}`;
    
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #dc3545;">❌ Content Creation Failed</h2>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Task Details:</h3>
        <p><strong>Title:</strong> ${taskData?.idea || 'Unknown'}</p>
        <p><strong>Description:</strong> ${taskData?.description || 'N/A'}</p>
        <p><strong>Serial Number:</strong> ${taskData?.sno || 'N/A'}</p>
        <p><strong>Failed Step:</strong> ${step || 'Unknown'}</p>
      </div>
      
      <div style="background: #f8d7da; padding: 20px; border-radius: 5px; margin: 20px 0; color: #721c24;">
        <h3>Error Details:</h3>
        <pre style="white-space: pre-wrap; background: white; padding: 15px; border-radius: 3px; overflow-x: auto;">
${error.message || error.toString()}
        </pre>
        
        ${error.stack ? `
        <details style="margin-top: 15px;">
          <summary style="cursor: pointer; font-weight: bold;">Stack Trace</summary>
          <pre style="white-space: pre-wrap; background: white; padding: 15px; border-radius: 3px; margin-top: 10px; font-size: 12px; overflow-x: auto;">
${error.stack}
          </pre>
        </details>
        ` : ''}
      </div>
      
      <div style="background: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; color: #856404;">
        <h3>🔧 What to do:</h3>
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
      to: process.env.EMAIL_USER, // Send to self
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
 * Send workflow status update email
 */
const sendStatusUpdate = async (status, message, details = {}) => {
  try {
    const transporter = createTransporter();
    
    const subject = `📊 Workflow Status: ${status}`;
    
    const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #17a2b8;">📊 Workflow Status Update</h2>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Status: ${status}</h3>
        <p>${message}</p>
        <p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
      </div>
      
      ${Object.keys(details).length > 0 ? `
      <div style="background: #e7f3ff; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3>Additional Details:</h3>
        <ul>
          ${Object.entries(details).map(([key, value]) => 
            `<li><strong>${key}:</strong> ${value}</li>`
          ).join('')}
        </ul>
      </div>
      ` : ''}
    </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    logger.info(`✅ Status update email sent: ${status}`);
    
  } catch (error) {
    logger.error("Failed to send status update:", error);
  }
};

module.exports = {
  sendSuccessNotification,
  sendErrorNotification,
  sendStatusUpdate
};
