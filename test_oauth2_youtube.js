const fs = require("fs");
const { google } = require("googleapis");
require("dotenv").config();

// Test the OAuth2 YouTube upload approach
async function testOAuth2YouTubeUpload() {
  try {
    console.log("🔧 Testing OAuth2 YouTube Upload...");

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    // Set refresh token
    oauth2Client.setCredentials({
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
    });

    // Test token refresh
    console.log("🔄 Testing token refresh...");
    const tokens = await oauth2Client.refreshAccessToken();
    console.log("✅ Token refresh successful!");

    // Create YouTube client
    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client,
    });

    // Test API call (get channel info)
    console.log("📺 Testing YouTube API...");
    const channelResponse = await youtube.channels.list({
      part: "snippet",
      mine: true,
    });

    console.log("✅ YouTube API working!");
    console.log(
      "📊 Channel Title:",
      channelResponse.data.items[0].snippet.title
    );
    console.log("🆔 Channel ID:", channelResponse.data.items[0].id);

    return true;
  } catch (error) {
    console.error("❌ OAuth2 test failed:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
    return false;
  }
}

// Test with existing video
async function testFullUpload() {
  const videoPath = "final_video_1758123737319.mp4";
  const title = "OAuth2 Test Upload #Shorts";
  const description =
    "Testing OAuth2 YouTube upload with refresh tokens. #AI #Automation #Test";

  try {
    console.log("🚀 Testing full upload process...");

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
    });

    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client,
    });

    const response = await youtube.videos.insert({
      part: "snippet,status",
      requestBody: {
        snippet: {
          title: title,
          description: description,
          tags: ["Test", "OAuth2", "Automation"],
          categoryId: "27",
        },
        status: {
          privacyStatus: "private", // Use private for test
        },
      },
      media: {
        body: fs.createReadStream(videoPath),
      },
    });

    console.log("✅ Test upload successful!");
    console.log("🆔 Video ID:", response.data.id);
    console.log(
      "🔗 Video URL:",
      `https://www.youtube.com/watch?v=${response.data.id}`
    );
  } catch (error) {
    console.error("❌ Test upload failed:", error.message);
  }
}

// Run tests
async function runTests() {
  console.log("🧪 Starting OAuth2 YouTube Tests...\n");

  const oauth2Works = await testOAuth2YouTubeUpload();
  if (oauth2Works) {
    console.log("\n📤 Testing full upload...");
    await testFullUpload();
  }

  console.log("\n🏁 Tests completed!");
}

// Export for use in other files
module.exports = { testOAuth2YouTubeUpload, testFullUpload };

// Run if called directly
if (require.main === module) {
  runTests();
}
