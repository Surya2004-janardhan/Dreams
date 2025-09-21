const axios = require("axios");
require("dotenv").config();

// Mock logger
const logger = {
  info: (msg) => console.log(`ℹ️ ${msg}`),
  warn: (msg) => console.log(`⚠️ ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
};

async function diagnoseFacebookSetup() {
  try {
    console.log("🔍 Diagnosing Facebook API setup...\n");

    // Check environment variables
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
    const pageId = process.env.FACEBOOK_PAGE_ID;

    console.log("📋 Environment Variables:");
    console.log(
      `   FACEBOOK_ACCESS_TOKEN: ${accessToken ? "✅ Set" : "❌ Missing"}`
    );
    console.log(`   FACEBOOK_PAGE_ID: ${pageId || "❌ Missing"}\n`);

    if (!accessToken || !pageId) {
      console.log(
        "❌ Missing required environment variables. Please check your .env file."
      );
      return;
    }

    // Test 1: Verify access token
    console.log("🧪 Test 1: Verifying Access Token...");
    try {
      const tokenDebugUrl = `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${accessToken}`;
      const tokenResponse = await axios.get(tokenDebugUrl);

      console.log("✅ Access token is valid");
      console.log(`   App ID: ${tokenResponse.data.data.app_id}`);
      console.log(`   User ID: ${tokenResponse.data.data.user_id}`);
      console.log(
        `   Expires: ${
          tokenResponse.data.data.expires_at
            ? new Date(
                tokenResponse.data.data.expires_at * 1000
              ).toLocaleString()
            : "Never"
        }\n`
      );
    } catch (error) {
      console.log("❌ Access token verification failed:");
      console.log(
        `   Error: ${error.response?.data?.error?.message || error.message}\n`
      );
      return;
    }

    // Test 2: Verify page access
    console.log("🧪 Test 2: Verifying Page Access...");
    try {
      const pageUrl = `https://graph.facebook.com/v23.0/${pageId}?fields=id,name,access_token&access_token=${accessToken}`;
      const pageResponse = await axios.get(pageUrl);

      console.log("✅ Page access verified");
      console.log(`   Page ID: ${pageResponse.data.id}`);
      console.log(`   Page Name: ${pageResponse.data.name}`);
      console.log(
        `   Has page access token: ${
          pageResponse.data.access_token ? "✅ Yes" : "❌ No"
        }\n`
      );
    } catch (error) {
      console.log("❌ Page access verification failed:");
      console.log(
        `   Error: ${error.response?.data?.error?.message || error.message}`
      );
      console.log("   This could mean:");
      console.log("   - The page ID is incorrect");
      console.log("   - You don't have admin access to this page");
      console.log(
        "   - The access token doesn't have pages_manage_posts permission\n"
      );
      return;
    }

    // Test 3: Check posting permissions
    console.log("🧪 Test 3: Testing Video Posting Permissions...");
    try {
      const testVideoUrl =
        "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4";
      const postUrl = `https://graph.facebook.com/v23.0/${pageId}/videos`;
      const postParams = {
        file_url: testVideoUrl,
        description:
          "🤖 TEST: Facebook API Diagnostic - This post will be deleted if successful",
        access_token: accessToken,
      };

      const postResponse = await axios.post(postUrl, postParams);
      const postId = postResponse.data.id;

      console.log("✅ Video posting successful!");
      console.log(`   Post ID: ${postId}`);

      // Clean up the test post
      console.log("🧹 Cleaning up test post...");
      const deleteUrl = `https://graph.facebook.com/v23.0/${postId}?access_token=${accessToken}`;
      await axios.delete(deleteUrl);
      console.log("✅ Test post deleted\n");

      console.log("🎉 SUCCESS: Facebook API setup is working correctly!");
      console.log("   You can now use the Facebook upload functionality.");
    } catch (error) {
      console.log("❌ Video posting test failed:");
      console.log(
        `   Error: ${error.response?.data?.error?.message || error.message}`
      );
      console.log("   Common solutions:");
      console.log(
        "   - Ensure your Facebook app has 'pages_manage_posts' permission"
      );
      console.log("   - Verify you're an admin/editor of the Facebook page");
      console.log(
        "   - Check that the page ID is correct (numeric ID, not page name)\n"
      );
    }
  } catch (error) {
    console.error("❌ Diagnostic failed:", error.message);
  }
}

// Run the diagnostic
if (require.main === module) {
  diagnoseFacebookSetup();
}

module.exports = { diagnoseFacebookSetup };
