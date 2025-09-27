const fs = require("fs");
const { google } = require("googleapis");
require("dotenv").config();

// Load OAuth2 client with your credentials
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

// Set the refresh token to enable token refresh automatically
oauth2Client.setCredentials({
  refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
});

// YouTube API client
const youtube = google.youtube({
  version: "v3",
  auth: oauth2Client,
});

// Upload function
async function uploadVideo(filePath, title, description) {
  try {
    console.log(`🚀 Starting YouTube upload for: ${filePath}`);
    console.log(`📹 Title: ${title}`);
    console.log(`📝 Description: ${description}`);

    const response = await youtube.videos.insert({
      part: "snippet,status",
      requestBody: {
        snippet: {
          title: title,
          description: description,
          tags: [
            "AI",
            "Automation",
            "Educational",
            "Shorts",
            "Technology",
            "Learning",
          ],
          categoryId: "27", // Education category
        },
        status: {
          privacyStatus: "public", // or 'private' / 'unlisted'
        },
      },
      media: {
        body: fs.createReadStream(filePath),
      },
    });

    console.log("✅ Upload successful! Video ID:", response.data.id);
    console.log(
      "🎥 Video URL:",
      `https://www.youtube.com/watch?v=${response.data.id}`
    );
    return response.data;
  } catch (error) {
    console.error("❌ Error uploading video:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
    throw error;
  }
}

// Test function to upload the existing final video
async function testUpload() {
  const videoPath = "videos/Base-vedio.mp4";
  const title = "AI Generated Educational Content #Shorts";
  const description =
    "Automatically generated educational video about technology and learning. Created using AI automation tools. #AI #Education #Technology #Shorts";

  try {
    // Check if video file exists
    if (!fs.existsSync(videoPath)) {
      console.error(`❌ Video file not found: ${videoPath}`);
      return;
    }

    console.log(`📁 Found video file: ${videoPath}`);
    const stats = fs.statSync(videoPath);
    console.log(`📊 File size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);

    const result = await uploadVideo(videoPath, title, description);
    console.log("🎉 Test upload completed successfully!");
    console.log("Result:", result);
  } catch (error) {
    console.error("💥 Test upload failed:", error.message);
  }
}

// Run the test
testUpload();
