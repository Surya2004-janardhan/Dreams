const axios = require("axios");
require("dotenv").config();

// Instagram Graph API configuration
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;

// Test function to upload video to Instagram
async function uploadToInstagram(filePath, title, description) {
  try {
    console.log(`📱 Starting Instagram upload for: ${filePath}`);
    console.log(`📹 Title: ${title}`);
    console.log(`📝 Description: ${description}`);

    if (!ACCESS_TOKEN || !ACCOUNT_ID) {
      throw new Error("INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_ACCOUNT_ID environment variables are required");
    }

    // Step 1: Upload video to get media ID
    const uploadUrl = `https://graph.facebook.com/v18.0/${ACCOUNT_ID}/media`;
    const uploadParams = {
      media_type: "REELS",
      video_url: `file://${filePath}`, // Local file path
      caption: `${title}\n\n${description}\n\n#AI #Education #Technology #Shorts #Reels`,
      access_token: ACCESS_TOKEN,
    };

    console.log("📤 Uploading media to Instagram...");
    const uploadResponse = await axios.post(uploadUrl, uploadParams);
    const mediaId = uploadResponse.data.id;
    console.log(`✅ Media uploaded successfully. Media ID: ${mediaId}`);

    // Step 2: Publish the media
    console.log("🚀 Publishing media...");
    const publishUrl = `https://graph.facebook.com/v18.0/${ACCOUNT_ID}/media_publish`;
    const publishParams = {
      creation_id: mediaId,
      access_token: ACCESS_TOKEN,
    };

    const publishResponse = await axios.post(publishUrl, publishParams);
    const postId = publishResponse.data.id;

    const instagramUrl = `https://instagram.com/p/${postId}`;

    console.log("✅ Instagram upload successful!");
    console.log(`🎥 Post ID: ${postId}`);
    console.log(`🔗 Instagram URL: ${instagramUrl}`);

    return {
      success: true,
      postId: postId,
      url: instagramUrl,
      mediaId: mediaId
    };

  } catch (error) {
    console.error("❌ Instagram upload failed:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
    throw error;
  }
}

// Test function to upload the existing final video
async function testInstagramUpload() {
  const videoPath = "final_video_1758123737319.mp4";
  const title = "AI Generated Educational Content";
  const description = "Automatically generated educational video about technology and learning. Created using AI automation tools.";

  try {
    // Check if video file exists
    const fs = require("fs");
    if (!fs.existsSync(videoPath)) {
      console.error(`❌ Video file not found: ${videoPath}`);
      return;
    }

    console.log(`📁 Found video file: ${videoPath}`);
    const stats = fs.statSync(videoPath);
    console.log(`📊 File size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);

    const result = await uploadToInstagram(videoPath, title, description);
    console.log("🎉 Instagram test upload completed successfully!");
    console.log("Result:", result);
  } catch (error) {
    console.error("💥 Instagram test upload failed:", error.message);
  }
}

// Run the test
testInstagramUpload();