const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const express = require("express");
require("dotenv").config();

// Instagram Graph API configuration
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "videos";

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Upload file to Supabase and return public URL
async function uploadToSupabase(filePath, title) {
  try {
    console.log("☁️ Uploading video to Supabase...");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required"
      );
    }

    const fileName = `${title.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.mp4`;
    const fileContent = fs.readFileSync(filePath);
    const fileBuffer = Buffer.from(fileContent);

    console.log(`📁 Uploading file: ${fileName}`);
    const fileStats = fs.statSync(filePath);
    console.log(
      `📊 File size: ${(fileStats.size / (1024 * 1024)).toFixed(2)} MB`
    );

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(fileName, fileBuffer, {
        contentType: "video/mp4",
        upsert: false,
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    console.log(`✅ File uploaded to Supabase. Key: ${fileName}`);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;
    console.log(`🔗 Public URL: ${publicUrl}`);

    // Test if URL is accessible
    try {
      const testResponse = await axios.head(publicUrl, { timeout: 5000 });
      if (testResponse.status === 200) {
        console.log(`✅ Supabase URL is accessible`);
      } else {
        console.log(`⚠️ Supabase URL returned status ${testResponse.status}`);
      }
    } catch (error) {
      console.log(`⚠️ Supabase URL not accessible: ${error.message}`);
    }

    return {
      success: true,
      fileName: fileName,
      publicUrl: publicUrl,
      bucket: SUPABASE_BUCKET,
    };
  } catch (error) {
    console.error("❌ Supabase upload failed:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Supabase upload function
async function uploadToSupabaseAndGetLink(videoPath, title) {
  try {
    console.log("☁️ Uploading video to Supabase...");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required"
      );
    }

    const fileName = `${title.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.mp4`;
    const fileContent = fs.readFileSync(videoPath);
    const fileBuffer = Buffer.from(fileContent);
    const fileStats = fs.statSync(videoPath);

    console.log(`📁 Uploading file: ${fileName}`);
    console.log(
      `📊 File size: ${(fileStats.size / (1024 * 1024)).toFixed(2)} MB`
    );

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(fileName, fileBuffer, {
        contentType: "video/mp4",
        upsert: false,
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    console.log(`✅ File uploaded to Supabase. Key: ${fileName}`);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(fileName);

    const publicLink = urlData.publicUrl;
    console.log(`🔗 Public link: ${publicLink}`);

    return {
      success: true,
      fileName: fileName,
      publicLink: publicLink,
      bucket: SUPABASE_BUCKET,
    };
  } catch (error) {
    console.error("❌ Supabase upload failed:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Delete file from Supabase
async function deleteFromSupabase(fileName, bucket) {
  try {
    console.log(`🗑️ Deleting file from Supabase: ${fileName}`);

    const { data, error } = await supabase.storage
      .from(bucket)
      .remove([fileName]);

    if (error) {
      throw new Error(`Supabase delete failed: ${error.message}`);
    }

    console.log("✅ File deleted from Supabase");
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to delete from Supabase:", error.message);
    return { success: false, error: error.message };
  }
}

// Create a simple HTTP server to serve the video file
function startTempServer(videoPath, port = 8080) {
  return new Promise((resolve, reject) => {
    const app = express();

    // Serve the video file statically
    app.use("/video", express.static(path.dirname(videoPath)));

    // Get the filename for the URL
    const fileName = path.basename(videoPath);
    const videoUrl = `http://localhost:${port}/video/${fileName}`;

    const server = app.listen(port, () => {
      console.log(`🌐 Temporary HTTP server started on port ${port}`);
      console.log(`🎥 Video accessible at: ${videoUrl}`);
      resolve({ server, videoUrl });
    });

    server.on("error", (error) => {
      reject(error);
    });
  });
}

// Stop the temporary server
function stopTempServer(server) {
  return new Promise((resolve) => {
    server.close(() => {
      console.log("🛑 Temporary HTTP server stopped");
      resolve();
    });
  });
}

// Test function to upload video to Instagram using Reels Container API
async function uploadToInstagram(filePath, title, description) {
  let uploadedFileName = null; // Changed from filebaseFileName to be more descriptive

  try {
    console.log(`📱 Starting Instagram Reels upload for: ${filePath}`);
    console.log(`📹 Title: ${title}`);
    console.log(`📝 Description: ${description}`);

    if (!ACCESS_TOKEN || !ACCOUNT_ID) {
      throw new Error(
        "INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_ACCOUNT_ID environment variables are required"
      );
    }

    // Step 1: Upload to Supabase and get public link
    const supabaseResult = await uploadToSupabase(filePath, title);
    if (!supabaseResult.success) {
      throw new Error(`Supabase upload failed: ${supabaseResult.error}`);
    }

    uploadedFileName = supabaseResult.fileName;
    const publicVideoUrl = supabaseResult.publicUrl;

    console.log(`🔗 Using Supabase link for Instagram: ${publicVideoUrl}`);

    // Step 2: Create Reels Container using Instagram Graph API v23.0
    const containerUrl = `https://graph.facebook.com/v23.0/${ACCOUNT_ID}/media`;
    const containerParams = {
      media_type: "REELS",
      video_url: publicVideoUrl,
      caption: `${title}\n\n${description}\n\n#AI #Education #Technology #Shorts #Reels`,
      share_to_feed: false, // Set to false for Reels-only posts
      access_token: ACCESS_TOKEN,
    };

    console.log("📦 Creating Reels container...");
    const containerResponse = await axios.post(containerUrl, containerParams);
    const containerId = containerResponse.data.id;
    console.log(`✅ Reels container created. Container ID: ${containerId}`);

    // Step 3: Wait for Instagram to process the media
    console.log("⏳ Waiting for Instagram to process media (30 seconds)...");
    await new Promise((resolve) => setTimeout(resolve, 30000));

    // Step 4: Publish the Reels container
    const publishUrl = `https://graph.facebook.com/v23.0/${ACCOUNT_ID}/media_publish`;
    const publishParams = {
      creation_id: containerId,
      access_token: ACCESS_TOKEN,
    };

    let publishResponse;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        console.log(
          `🚀 Publishing Reels (attempt ${retryCount + 1}/${maxRetries})...`
        );
        publishResponse = await axios.post(publishUrl, publishParams);

        // Check if publish was successful
        if (publishResponse.data.id) {
          break; // Success, exit retry loop
        }
      } catch (publishError) {
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(
            `⚠️ Publish attempt ${retryCount} failed, retrying in 15 seconds...`
          );
          console.log(
            `Error: ${
              publishError.response?.data?.error?.message ||
              publishError.message
            }`
          );
          await new Promise((resolve) => setTimeout(resolve, 15000));
        } else {
          throw publishError; // Max retries reached, throw error
        }
      }
    }

    const postId = publishResponse.data.id;
    const instagramUrl = `https://instagram.com/reel/${postId}`;

    // Get the actual permalink from Instagram
    const permalink = await getInstagramPermalink(postId, ACCESS_TOKEN);
    const finalUrl = permalink || instagramUrl;

    console.log("✅ Instagram Reels upload successful!");
    console.log(`🎥 Post ID: ${postId}`);
    console.log(`🔗 Instagram URL: ${finalUrl}`);

    // Clean up Supabase file after successful Instagram upload
    if (uploadedFileName) {
      await deleteFromSupabase(uploadedFileName, SUPABASE_BUCKET);
    }

    return {
      success: true,
      postId: postId,
      url: finalUrl,
      containerId: containerId,
    };
  } catch (error) {
    console.error("❌ Instagram Reels upload failed:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error(
        "Response data:",
        JSON.stringify(error.response.data, null, 2)
      );
    }

    // Clean up Supabase file on error
    if (uploadedFileName) {
      console.log(
        "🧹 Cleaning up Supabase file due to Instagram upload failure..."
      );
      await deleteFromSupabase(uploadedFileName, SUPABASE_BUCKET);
    }

    throw error;
  }
}

// Test function to upload video to Instagram using a direct URL (for testing with HTTP server)
async function uploadToInstagramWithUrl(videoUrl, title, description) {
  try {
    console.log(`📱 Starting Instagram Reels upload with direct URL`);
    console.log(`🎥 Video URL: ${videoUrl}`);
    console.log(`📹 Title: ${title}`);
    console.log(`📝 Description: ${description}`);

    if (!ACCESS_TOKEN || !ACCOUNT_ID) {
      throw new Error(
        "INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_ACCOUNT_ID environment variables are required"
      );
    }

    console.log(`🔗 Using direct video URL for Instagram: ${videoUrl}`);

    // Step 1: Create Reels Container using Instagram Graph API v23.0
    const containerUrl = `https://graph.facebook.com/v23.0/${ACCOUNT_ID}/media`;
    const containerParams = {
      media_type: "REELS",
      video_url: videoUrl,
      caption: `${title}\n\n${description}\n\n#AI #Education #Technology #Shorts #Reels`,
      share_to_feed: false, // Set to false for Reels-only posts
      access_token: ACCESS_TOKEN,
    };

    console.log("📦 Creating Reels container...");
    const containerResponse = await axios.post(containerUrl, containerParams);
    const containerId = containerResponse.data.id;
    console.log(`✅ Reels container created. Container ID: ${containerId}`);

    // Step 2: Wait for Instagram to process the media
    console.log("⏳ Waiting for Instagram to process media (30 seconds)...");
    await new Promise((resolve) => setTimeout(resolve, 30000));

    // Step 3: Publish the Reels container
    const publishUrl = `https://graph.facebook.com/v23.0/${ACCOUNT_ID}/media_publish`;
    const publishParams = {
      creation_id: containerId,
      access_token: ACCESS_TOKEN,
    };

    let publishResponse;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        console.log(
          `🚀 Publishing Reels (attempt ${retryCount + 1}/${maxRetries})...`
        );
        publishResponse = await axios.post(publishUrl, publishParams);

        // Check if publish was successful
        if (publishResponse.data.id) {
          break; // Success, exit retry loop
        }
      } catch (publishError) {
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(
            `⚠️ Publish attempt ${retryCount} failed, retrying in 15 seconds...`
          );
          console.log(
            `Error: ${
              publishError.response?.data?.error?.message ||
              publishError.message
            }`
          );
          await new Promise((resolve) => setTimeout(resolve, 15000));
        } else {
          throw publishError; // Max retries reached, throw error
        }
      }
    }

    const postId = publishResponse.data.id;
    const instagramUrl = `https://instagram.com/reel/${postId}`;

    // Get the actual permalink from Instagram
    const permalink = await getInstagramPermalink(postId, ACCESS_TOKEN);
    const finalUrl = permalink || instagramUrl;

    console.log("✅ Instagram Reels upload successful!");
    console.log(`🎥 Post ID: ${postId}`);
    console.log(`🔗 Instagram URL: ${finalUrl}`);

    return {
      success: true,
      postId: postId,
      url: finalUrl,
      containerId: containerId,
    };
  } catch (error) {
    console.error("❌ Instagram Reels upload failed:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error(
        "Response data:",
        JSON.stringify(error.response.data, null, 2)
      );
    }

    // Note: No Supabase cleanup needed for direct URL uploads
    console.log("ℹ️ No Supabase cleanup needed for direct URL upload");

    throw error;
  }
}

// Alternative approach: Use Instagram's resumable upload for Reels (with Supabase cleanup)
async function uploadToInstagramResumable(videoPath, title, description) {
  let uploadedFileName = null;

  try {
    console.log(
      `📱 Starting Instagram Reels resumable upload for: ${videoPath}`
    );
    console.log(`📹 Title: ${title}`);
    console.log(`📝 Description: ${description}`);

    if (!ACCESS_TOKEN || !ACCOUNT_ID) {
      throw new Error(
        "INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_ACCOUNT_ID environment variables are required"
      );
    }

    // Step 1: Upload to Supabase first (for backup and consistency)
    console.log("📤 First uploading to Supabase for backup...");
    const supabaseResult = await uploadToSupabase(videoPath, title);
    if (!supabaseResult.success) {
      console.log(
        "⚠️ Supabase upload failed, but continuing with resumable upload..."
      );
    } else {
      uploadedFileName = supabaseResult.fileName;
      console.log("✅ Backup uploaded to Supabase");
    }

    // Step 2: Initiate resumable upload session
    const initUrl = `https://graph.facebook.com/v23.0/${ACCOUNT_ID}/media`;
    const initParams = {
      media_type: "REELS",
      upload_type: "resumable",
      caption: `${title}\n\n${description}\n\n#AI #Education #Technology #Shorts #Reels`,
      share_to_feed: false,
      access_token: ACCESS_TOKEN,
    };

    console.log("📤 Initiating resumable upload session...");
    const initResponse = await axios.post(initUrl, initParams);
    const containerId = initResponse.data.id;
    const uploadUrl = initResponse.data.uri;

    console.log(`✅ Upload session created. Container ID: ${containerId}`);
    console.log(`🔗 Upload URL: ${uploadUrl}`);

    // Step 3: Upload video content directly to Instagram
    console.log("📤 Uploading video content...");
    const videoContent = fs.readFileSync(videoPath);
    const videoStats = fs.statSync(videoPath);

    const uploadHeaders = {
      Authorization: `OAuth ${ACCESS_TOKEN}`,
      "Content-Type": "video/mp4",
      "Content-Length": videoStats.size,
      Offset: "0",
    };

    const uploadResponse = await axios.post(uploadUrl, videoContent, {
      headers: uploadHeaders,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    console.log("✅ Video content uploaded successfully");

    // Step 4: Wait for Instagram to process the media
    console.log("⏳ Waiting for Instagram to process media (45 seconds)...");
    await new Promise((resolve) => setTimeout(resolve, 45000));

    // Step 5: Publish the Reels
    const publishUrl = `https://graph.facebook.com/v23.0/${ACCOUNT_ID}/media_publish`;
    const publishParams = {
      creation_id: containerId,
      access_token: ACCESS_TOKEN,
    };

    let publishResponse;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        console.log(
          `🚀 Publishing Reels (attempt ${retryCount + 1}/${maxRetries})...`
        );
        publishResponse = await axios.post(publishUrl, publishParams);

        if (publishResponse.data.id) {
          break;
        }
      } catch (publishError) {
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(
            `⚠️ Publish attempt ${retryCount} failed, retrying in 20 seconds...`
          );
          console.log(
            `Error: ${
              publishError.response?.data?.error?.message ||
              publishError.message
            }`
          );
          await new Promise((resolve) => setTimeout(resolve, 20000));
        } else {
          throw publishError;
        }
      }
    }

    const postId = publishResponse.data.id;
    const instagramUrl = `https://instagram.com/reel/${postId}`;

    // Get the actual permalink from Instagram
    const permalink = await getInstagramPermalink(postId, ACCESS_TOKEN);
    const finalUrl = permalink || instagramUrl;

    console.log("✅ Instagram Reels resumable upload successful!");
    console.log(`🎥 Post ID: ${postId}`);
    console.log(`🔗 Instagram URL: ${finalUrl}`);

    // Clean up Supabase file after successful Instagram upload
    if (uploadedFileName) {
      await deleteFromSupabase(uploadedFileName, SUPABASE_BUCKET);
    }

    return {
      success: true,
      postId: postId,
      url: finalUrl,
      containerId: containerId,
    };
  } catch (error) {
    console.error("❌ Instagram Reels resumable upload failed:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error(
        "Response data:",
        JSON.stringify(error.response.data, null, 2)
      );
    }

    // Clean up Supabase file on error
    if (uploadedFileName) {
      console.log(
        "🧹 Cleaning up Supabase backup file due to Instagram upload failure..."
      );
      await deleteFromSupabase(uploadedFileName, SUPABASE_BUCKET);
    }

    throw error;
  }
}

// Test function to upload the existing final video using main upload function
async function testInstagramUpload() {
  const videoPath = "final_video_1758123737319.mp4";
  const title = "AI Content Automation";
  const description =
    "Automatically generated educational video about technology and learning. Created using AI automation tools for content creation.";
  const scriptContent =
    "This video explores how artificial intelligence is revolutionizing content creation, from automated video generation to smart captioning and social media optimization.";

  try {
    // Check if video file exists
    if (!fs.existsSync(videoPath)) {
      console.error(`❌ Video file not found: ${videoPath}`);
      console.log("Available files in current directory:");
      const files = fs.readdirSync(".");
      files.forEach((file) => {
        if (file.endsWith(".mp4")) {
          console.log(`  - ${file}`);
        }
      });
      return;
    }

    console.log(`📁 Found video file: ${videoPath}`);
    const stats = fs.statSync(videoPath);
    console.log(`📊 File size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);

    // Generate AI-powered content
    console.log("🤖 Generating AI-powered social media content...");
    const socialContent = await generateAISocialMediaContent(
      title,
      description,
      scriptContent
    );
    console.log("✅ AI content generated successfully");

    console.log("🚀 Starting Instagram Reels upload process...");
    const result = await uploadToInstagram(
      videoPath,
      socialContent.instagram.caption,
      description
    );
    console.log("🎉 Instagram test upload completed successfully!");
    console.log("Result:", result);
  } catch (error) {
    console.error("💥 Instagram test upload failed:", error.message);
  }
}

// Test AI content generation
async function testAIContentGeneration() {
  console.log("🧪 Testing AI Content Generation...");

  const title = "The Future of AI Technology";
  const description =
    "Exploring how artificial intelligence is changing our world";
  const scriptContent =
    "AI is revolutionizing industries from healthcare to education, making processes more efficient and accessible to everyone.";

  try {
    const content = await generateAISocialMediaContent(
      title,
      description,
      scriptContent
    );

    console.log("✅ AI Content Generated Successfully!");
    console.log("📺 YouTube Title:", content.youtube.title);
    console.log(
      "📺 YouTube Description:",
      content.youtube.description.substring(0, 100) + "..."
    );
    console.log("📺 YouTube Tags:", content.youtube.tags);
    console.log(
      "📱 Instagram Caption:",
      content.instagram.caption.substring(0, 100) + "..."
    );
    console.log("🏷️ Hashtags:", content.instagram.hashtags);

    return content;
  } catch (error) {
    console.error("❌ AI Content Generation Failed:", error.message);
    return null;
  }
}

// Test Supabase connection
async function testSupabaseConnection() {
  console.log("🧪 Testing Supabase Connection...");

  try {
    const { data, error } = await supabase.storage.listBuckets();

    if (error) {
      throw error;
    }

    console.log("✅ Supabase Connection Successful!");
    console.log("📦 Available Buckets:", data.map((b) => b.name).join(", "));

    return true;
  } catch (error) {
    console.error("❌ Supabase Connection Failed:", error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  console.log("🚀 Running Complete System Tests...\n");

  // Test AI Content Generation
  await testAIContentGeneration();
  console.log("");

  // Test Supabase Connection
  await testSupabaseConnection();
  console.log("");

  // Test Instagram Upload (if video exists)
  const videoPath = "final_video_1758123737319.mp4";
  if (fs.existsSync(videoPath)) {
    console.log("🎥 Video file found, running Instagram upload test...");
    await testInstagramUpload();
  } else {
    console.log("⚠️ Video file not found, skipping Instagram upload test");
  }
}

// Export test functions
module.exports.testAIContentGeneration = testAIContentGeneration;
module.exports.testSupabaseConnection = testSupabaseConnection;
module.exports.runAllTests = runAllTests;

/**
 * Generate AI-powered social media content using Groq
 */
const generateAISocialMediaContent = async (
  title,
  description,
  scriptContent = ""
) => {
  try {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      console.warn(
        "⚠️ GROQ_API_KEY not found, falling back to template generation"
      );
      return generateSocialMediaContent(title, description);
    }

    console.log("🤖 Generating AI-powered social media content with Groq...");

    const prompt = `Generate engaging social media content for a short educational video.

Video Title: "${title}"
Video Description: "${description}"
${scriptContent ? `Script Content: "${scriptContent}"` : ""}

Please generate:
1. YouTube Title (max 100 chars, engaging and SEO-friendly)
2. YouTube Description (detailed, with emojis and call-to-action)
3. Instagram Caption (engaging, with emojis and hashtags)
4. Relevant hashtags for both platforms (15-20 hashtags total)

Make it educational, engaging, and optimized for social media algorithms.
Format your response as JSON with keys: youtubeTitle, youtubeDescription, instagramCaption, hashtags`;

    const groqResponse = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama3-8b-8192",
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      },
      {
        headers: {
          Authorization: `Bearer ${groqApiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    const aiContent = JSON.parse(groqResponse.data.choices[0].message.content);

    // Extract hashtags from the AI response
    const hashtags = aiContent.hashtags || [];
    const hashtagString = Array.isArray(hashtags)
      ? hashtags.join(" ")
      : hashtags;

    return {
      youtube: {
        title: aiContent.youtubeTitle || title,
        description: aiContent.youtubeDescription || description,
        tags: hashtags.slice(0, 10).map((h) => h.replace("#", "")),
        hashtags: hashtagString,
      },
      instagram: {
        caption: aiContent.instagramCaption || description,
        hashtags: hashtagString,
      },
    };
  } catch (error) {
    console.error(
      "❌ AI content generation failed, using template:",
      error.message
    );
    return generateSocialMediaContent(title, description);
  }
};

// Get Instagram permalink using media ID
async function getInstagramPermalink(mediaId, accessToken) {
  try {
    console.log(`🔗 Getting Instagram permalink for media ID: ${mediaId}`);

    const url = `https://graph.facebook.com/v18.0/${mediaId}?fields=permalink&access_token=${accessToken}`;
    const response = await axios.get(url);

    const permalink = response.data.permalink;
    console.log(`✅ Instagram permalink: ${permalink}`);

    return permalink;
  } catch (error) {
    console.error("❌ Failed to get Instagram permalink:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
    return null;
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testInstagramUpload();
}

module.exports = {
  uploadToSupabase,
  uploadToSupabaseAndGetLink,
  deleteFromSupabase,
  uploadToInstagram,
  uploadToInstagramWithUrl,
  uploadToInstagramResumable,
  startTempServer,
  stopTempServer,
  getInstagramPermalink,
  generateAISocialMediaContent,
};
