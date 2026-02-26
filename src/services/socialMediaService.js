const logger = require("../config/logger");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { google } = require("googleapis");
const { createClient } = require("@supabase/supabase-js");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Load environment variables
require("dotenv").config();

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

/**
 * Generate hashtags and captions for social media
 */
const generateSocialMediaContent = (title, description) => {
  // Generate relevant hashtags
  const baseHashtags = [
    "#education",
    "#learning",
    "#knowledge",
    "#facts",
    "#educational",
    "#shorts",
    "#viral",
    "#trending",
    "#india",
    "#informative",
  ];

  // Extract topic-specific hashtags from title and description
  const text = `${title} ${description}`.toLowerCase();
  const topicHashtags = [];

  // Add topic-specific hashtags based on content
  if (text.includes("science")) topicHashtags.push("#science", "#scientific");
  if (text.includes("tech")) topicHashtags.push("#technology", "#tech");
  if (text.includes("history")) topicHashtags.push("#history", "#historical");
  if (text.includes("space")) topicHashtags.push("#space", "#astronomy");
  if (text.includes("health")) topicHashtags.push("#health", "#wellness");

  const allHashtags = [...baseHashtags, ...topicHashtags].slice(0, 15);

  // For fallback, create a simple summary instead of using conversation
  const simpleSummary = `Learn about ${title.toLowerCase()} in this educational video. Discover key concepts, practical applications, and important insights that will help you understand this topic better. Perfect for students and anyone interested in expanding their knowledge.`;

  const youtubeDescription = `🚀 ${simpleSummary}

📌 What You'll Learn:
• ${title
    .toLowerCase()
    .split(" ")
    .slice(0, 3)
    .join(" ")} fundamentals and concepts
• Practical applications in real-world scenarios
• Step-by-step implementation guide
• Best practices and common pitfalls
• Advanced techniques and optimization tips

🎯 Key Benefits:
• Understand complex concepts simply
• Apply knowledge to your projects
• Stay updated with latest trends
• Learn from practical examples
• Get expert insights and tips

💡 Learning Outcomes:
• Master ${title.toLowerCase()} fundamentals
• Build confidence in implementation
• Solve real-world problems effectively
• Stay ahead in your field
• Create innovative solutions

🔥 Don't forget to:
👍 Like this video if you learned something new
🔔 Subscribe for more educational content
💬 Share your thoughts in the comments
🔗 Check out related videos in the description

${allHashtags.join(" ")}`;

  const instagramCaption = `${title}

📌 Key Takeaways:
• ${title.toLowerCase().split(" ").slice(0, 3).join(" ")} fundamentals explained
• Practical applications you can implement
• Important concepts for your projects
• Real-world use cases and examples
• Best practices and tips

🤔 What did you learn? Share in comments!

💡 Like & Share if you found this helpful!

${allHashtags.join(" ")}`;

  return {
    youtube: {
      title: title.length > 55 ? title.substring(0, 50) + "..." : title,
      description: youtubeDescription,
      tags: allHashtags.map((h) => h.replace("#", "")).slice(0, 10),
      hashtags: allHashtags.join(" "),
    },
    instagram: {
      caption: instagramCaption,
      hashtags: allHashtags.join(" "),
    },
  };
};

/**
 * Generate AI-powered social media content using Gemini
 */
const generateAISocialMediaContent = async (
  title,
  description,
  scriptContent = ""
) => {
  try {
    // First, generate educational explanation about the topic
    const topicExplanation = await generateTopicExplanation(
      title,
      description,
      scriptContent
    );

    // Get topic-related emoji
    const topicEmoji = getTopicEmoji(title, description);

    // Generate platform-specific hashtags (minimum 10 each)
    const text = `${title} ${description}`.toLowerCase();

    // YouTube hashtags (educational focus)
    const youtubeHashtags = [
      "#education",
      "#learning",
      "#knowledge",
      "#educational",
      "#tutorial",
      "#howto",
      "#explained",
      "#guide",
      "#tips",
      "#facts",
    ];

    // Instagram hashtags (visual/social focus)
    const instagramHashtags = [
      "#instagram",
      "#instadaily",
      "#instavideo",
      "#reels",
      "#reel",
      "#viral",
      "#trending",
      "#fyp",
      "#explore",
      "#discover",
    ];

    // Facebook hashtags (community focus)
    const facebookHashtags = [
      "#facebook",
      "#community",
      "#share",
      "#learn",
      "#education",
      "#knowledge",
      "#tips",
      "#facts",
      "#viral",
      "#trending",
    ];

    // Add topic-specific hashtags
    if (text.includes("science")) {
      youtubeHashtags.push("#science", "#scientific");
      instagramHashtags.push("#science", "#stem");
      facebookHashtags.push("#science", "#research");
    }
    if (text.includes("tech")) {
      youtubeHashtags.push("#technology", "#tech");
      instagramHashtags.push("#tech", "#innovation");
      facebookHashtags.push("#technology", "#digital");
    }
    if (text.includes("ai")) {
      youtubeHashtags.push("#ai", "#artificialintelligence");
      instagramHashtags.push("#ai", "#machinelearning");
      facebookHashtags.push("#ai", "#future");
    }
    if (text.includes("data")) {
      youtubeHashtags.push("#datascience", "#analytics");
      instagramHashtags.push("#data", "#insights");
      facebookHashtags.push("#data", "#analytics");
    }

    const youtubeHashtagString = youtubeHashtags.slice(0, 10).join(" ");
    const instagramHashtagString = instagramHashtags.slice(0, 10).join(" ");
    const facebookHashtagString = facebookHashtags.slice(0, 10).join(" ");

    // Create YouTube description with comprehensive explanation
    const youtubeDescription = `${topicEmoji} ${title}

${topicExplanation}

🔥 Don't forget to:
👍 Like this video if you learned something new!
🔔 Subscribe for more educational content like this!
💬 Share your thoughts in the comments below!
🔗 Save this video to watch again later!

${youtubeHashtagString}`;

    // Create Instagram caption with title + explanation + calls-to-action
    const instagramCaption = `${topicEmoji} ${title}

${topicExplanation}

❤️ Like & Follow for more educational content!
🔄 Share this with friends who need to learn this!
💬 Drop your questions in the comments below!
📚 Save this post for future reference!

${instagramHashtagString}`;

    // Create Facebook caption with title + explanation + calls-to-action
    const facebookCaption = `${topicEmoji} ${title}

${topicExplanation}

👍 Like this post if you found it helpful!
🔄 Share this with your friends and family!
💬 What are your thoughts? Comment below!
👥 Tag someone who would benefit from this knowledge!

${facebookHashtagString}`;

    return {
      youtube: {
        title: title.length > 55 ? title.substring(0, 50) + "..." : title,
        description: youtubeDescription,
        tags: youtubeHashtags.map((h) => h.replace("#", "")).slice(0, 10),
        hashtags: youtubeHashtagString,
      },
      instagram: {
        caption: instagramCaption,
        hashtags: instagramHashtagString,
      },
      facebook: {
        caption: facebookCaption,
        hashtags: facebookHashtagString,
      },
    };
  } catch (error) {
    logger.error(
      "❌ AI content generation failed, using template:",
      error.message
    );
    return generateSocialMediaContent(title, description);
  }
};

/**
 * Upload video to YouTube
 */
const uploadToYouTube = async (videoPath, title, description) => {
  try {
    logger.info("📺 Starting YouTube upload...");
    logger.info(`📹 Video path: ${videoPath}`);
    logger.info(`📝 Title: ${title}`);

    // Create OAuth2 client directly
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    // Set refresh token for automatic token refresh
    oauth2Client.setCredentials({
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
    });

    // Create YouTube client
    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client,
    });

    // Generate unified caption for all platforms
    const unifiedContent = await generateUnifiedSocialMediaCaption(title);

    // For YouTube Shorts: use title + #shorts + unified caption (no separate description)
    const youtubeTitle =
      title.length > 55 ? title.substring(0, 50) + "..." : title;
    const youtubeDescription = `${unifiedContent.caption}\n\n#shorts`;

    // Extract hashtags for tags (remove # and limit to 10)
    const tags = unifiedContent.hashtags
      .split(" ")
      .filter((tag) => tag.startsWith("#"))
      .map((tag) => tag.substring(1))
      .slice(0, 10);

    logger.info(`🏷️ Final tags: ${tags.join(", ")}`);
    logger.info(`📹 Final title: ${youtubeTitle}`);
    logger.info(`📝 Description includes #shorts hashtag`);

    const response = await youtube.videos.insert({
      part: "snippet,status",
      requestBody: {
        snippet: {
          title: youtubeTitle,
          description: youtubeDescription,
          tags: tags,
          categoryId: "27", // Education category
        },
        status: {
          privacyStatus: "public",
        },
      },
      media: {
        body: fs.createReadStream(videoPath),
      },
    });

    const videoId = response.data.id;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    logger.info(`✅ YouTube upload successful: ${videoUrl}`);

    return {
      success: true,
      url: videoUrl,
      videoId: videoId,
      title: youtubeTitle,
      caption: unifiedContent.caption, // Use the unified caption for consistency
    };
  } catch (error) {
    logger.error("❌ YouTube upload failed:", error.message);
    if (error.response) {
      logger.error("Response data:", error.response.data);
    }
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Upload video to Instagram (using Instagram Graph API for reels)
 */
const uploadToInstagram = async (videoPath, title, description) => {
  let uploadedFileName = null; // Changed from filebaseFileName to be more descriptive

  try {
    logger.info("📱 Starting Instagram upload...");

    // Generate unified caption for all platforms
    const unifiedContent = await generateUnifiedSocialMediaCaption(title);
    const finalCaption = unifiedContent.caption;

    logger.info(
      `📝 Using unified caption for Instagram (${finalCaption.length} chars)`
    );

    // Required environment variables
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const accountId = process.env.INSTAGRAM_ACCOUNT_ID;

    if (!accessToken || !accountId) {
      throw new Error(
        "INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_ACCOUNT_ID environment variables are required"
      );
    }

    // Step 1: Upload to Supabase and get public link
    const supabaseResult = await uploadToSupabaseAndGetLink(
      videoPath,
      "Instagram Reel"
    );
    if (!supabaseResult.success) {
      throw new Error(`Supabase upload failed: ${supabaseResult.error}`);
    }

    uploadedFileName = supabaseResult.fileName;
    const publicVideoUrl = supabaseResult.publicLink;

    logger.info(`🔗 Using Supabase link for Instagram: ${publicVideoUrl}`);

    // Step 2: Create Reels Container using Instagram Graph API v23.0
    const containerUrl = `https://graph.facebook.com/v23.0/${accountId}/media`;
    const containerParams = {
      media_type: "REELS",
      video_url: publicVideoUrl,
      caption: finalCaption,
      access_token: accessToken,
    };

    logger.info("📦 Creating Reels container...");
    const containerResponse = await axios.post(containerUrl, containerParams);
    const containerId = containerResponse.data.id;
    logger.info(`✅ Reels container created. Container ID: ${containerId}`);

    // Step 2: Wait for Instagram to process the media
    logger.info("⏳ Waiting for Instagram to process media (50 seconds)...");
    await new Promise((resolve) => setTimeout(resolve, 50000));

    // Step 3: Publish the Reels container with retry logic
    const publishUrl = `https://graph.facebook.com/v23.0/${accountId}/media_publish`;
    const publishParams = {
      creation_id: containerId,
      access_token: accessToken,
    };

    let publishResponse;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        logger.info(
          `🚀 Publishing Instagram Reel (attempt ${
            retryCount + 1
          }/${maxRetries})...`
        );
        publishResponse = await axios.post(publishUrl, publishParams);

        // Check if publish was successful
        if (publishResponse.data.id) {
          break; // Success, exit retry loop
        }
      } catch (publishError) {
        retryCount++;
        if (retryCount < maxRetries) {
          logger.warn(
            `⚠️ Publish attempt ${retryCount} failed, retrying in 35 seconds...`
          );
          logger.warn(
            `Error: ${
              publishError.response?.data?.error?.message ||
              publishError.message
            }`
          );
          await new Promise((resolve) => setTimeout(resolve, 35000));
        } else {
          throw publishError; // Max retries reached, throw error
        }
      }
    }

    const mediaId = publishResponse.data.id;
    logger.info(`✅ Instagram Reel published. Media ID: ${mediaId}`);

    // Step 4: Construct Instagram URL (API permalink has token issues)
    const instagramUrl = `https://instagram.com/reel/${mediaId}`;

    // Try to get official permalink, but use constructed URL as fallback
    try {
      const permalink = await getInstagramPermalink(mediaId, accessToken);
      if (permalink) {
        logger.info(`✅ Instagram upload successful: ${permalink}`);
        return {
          success: true,
          url: permalink,
          mediaId: mediaId,
          caption: finalCaption,
        };
      }
    } catch (error) {
      logger.warn(
        `⚠️ Could not get official permalink, using constructed URL: ${error.message}`
      );
    }

    logger.info(`✅ Instagram upload successful: ${instagramUrl}`);

    // Clean up Supabase file after successful Instagram upload
    if (uploadedFileName) {
      await deleteFromSupabase(uploadedFileName, SUPABASE_BUCKET);
    }

    return {
      success: true,
      url: instagramUrl,
      mediaId: mediaId,
      caption: finalCaption,
    };
  } catch (error) {
    logger.error("❌ Instagram upload failed:", error.message);
    if (error.response) {
      logger.error("Response status:", error.response.status);
      logger.error("Response data:", error.response.data);
    }

    // Clean up Supabase file on error
    if (uploadedFileName) {
      logger.warn(
        "🧹 Cleaning up Supabase file due to Instagram upload failure..."
      );
      await deleteFromSupabase(uploadedFileName, SUPABASE_BUCKET);
    }

    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Upload video to Instagram using a pre-uploaded Supabase URL
 */
const uploadToInstagramWithUrl = async (videoUrl, title, description) => {
  try {
    logger.info("📱 Starting Instagram upload with provided URL...");

    // Generate unified caption for all platforms
    const unifiedContent = await generateUnifiedSocialMediaCaption(title);
    const finalCaption = unifiedContent.caption;

    logger.info(
      `📝 Using unified caption for Instagram (${finalCaption.length} chars)`
    );

    // Required environment variables
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const accountId = process.env.INSTAGRAM_ACCOUNT_ID;

    if (!accessToken || !accountId) {
      throw new Error(
        "INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_ACCOUNT_ID environment variables are required"
      );
    }

    logger.info(`🔗 Using provided video URL for Instagram: ${videoUrl}`);

    // Step 1: Create Reels Container using Instagram Graph API v23.0
    const containerUrl = `https://graph.facebook.com/v23.0/${accountId}/media`;
    const containerParams = {
      media_type: "REELS",
      video_url: videoUrl,
      caption: finalCaption,
      access_token: accessToken,
    };

    logger.info("🎬 Creating Instagram Reels container...");
    const containerResponse = await axios.post(containerUrl, containerParams);
    const containerId = containerResponse.data.id;

    logger.info(
      `✅ Instagram Reels container created. Container ID: ${containerId}`
    );

    // Step 2: Wait for Instagram to process the media
    logger.info("⏳ Waiting for Instagram to process media (40 seconds)...");
    await new Promise((resolve) => setTimeout(resolve, 40000));

    // Step 3: Publish the Reels container with retry logic
    const publishUrl = `https://graph.facebook.com/v23.0/${accountId}/media_publish`;
    const publishParams = {
      creation_id: containerId,
      access_token: accessToken,
    };

    let publishResponse;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        logger.info(
          `🚀 Publishing Instagram Reel (attempt ${
            retryCount + 1
          }/${maxRetries})...`
        );
        publishResponse = await axios.post(publishUrl, publishParams);

        // Check if publish was successful
        if (publishResponse.data.id) {
          break; // Success, exit retry loop
        }
      } catch (publishError) {
        retryCount++;
        if (retryCount < maxRetries) {
          logger.warn(
            `⚠️ Publish attempt ${retryCount} failed, retrying in 25 seconds...`
          );
          logger.warn(
            `Error: ${
              publishError.response?.data?.error?.message ||
              publishError.message
            }`
          );
          await new Promise((resolve) => setTimeout(resolve, 25000));
        } else {
          throw publishError; // Max retries reached, throw error
        }
      }
    }

    const mediaId = publishResponse.data.id;
    logger.info(`✅ Instagram Reel published. Media ID: ${mediaId}`);

    // Step 4: Construct Instagram URL (API permalink has token issues)
    const instagramUrl = `https://instagram.com/reel/${mediaId}`;

    // Try to get official permalink, but use constructed URL as fallback
    try {
      const permalink = await getInstagramPermalink(mediaId, accessToken);
      if (permalink) {
        logger.info(`✅ Instagram upload successful: ${permalink}`);
        return {
          success: true,
          url: permalink,
          mediaId: mediaId,
          caption: finalCaption,
        };
      }
    } catch (error) {
      logger.warn(
        `⚠️ Could not get official permalink, using constructed URL: ${error.message}`
      );
    }

    logger.info(`✅ Instagram upload successful: ${instagramUrl}`);

    return {
      success: true,
      url: instagramUrl,
      mediaId: mediaId,
      caption: finalCaption,
    };
  } catch (error) {
    logger.error("❌ Instagram upload failed:", error.message);
    if (error.response) {
      logger.error("Response status:", error.response.status);
      logger.error("Response data:", error.response.data);
    }

    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Upload video to Facebook page
 */
const uploadToFacebook = async (videoPath, title, description) => {
  let uploadedFileName = null;

  try {
    logger.info("📘 Starting Facebook upload...");

    // Generate unified caption for all platforms
    const unifiedContent = await generateUnifiedSocialMediaCaption(title);
    const finalCaption = unifiedContent.caption;

    logger.info(
      `📝 Using unified caption for Facebook (${finalCaption.length} chars)`
    );

    // Required environment variables
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
    const pageId = process.env.FACEBOOK_PAGE_ID;

    if (!accessToken || !pageId) {
      throw new Error(
        "FACEBOOK_ACCESS_TOKEN and FACEBOOK_PAGE_ID environment variables are required"
      );
    }

    // Step 1: Upload to Supabase and get public link
    const supabaseResult = await uploadToSupabaseAndGetLink(
      videoPath,
      "Facebook Video"
    );
    if (!supabaseResult.success) {
      throw new Error(`Supabase upload failed: ${supabaseResult.error}`);
    }

    uploadedFileName = supabaseResult.fileName;
    const publicVideoUrl = supabaseResult.publicLink;

    logger.info(`🔗 Using Supabase link for Facebook: ${publicVideoUrl}`);

    // Step 2: Get page access token for posting
    const pageTokenUrl = `https://graph.facebook.com/v23.0/${pageId}?fields=access_token&access_token=${accessToken}`;
    const pageTokenResponse = await axios.get(pageTokenUrl);
    const pageAccessToken = pageTokenResponse.data.access_token;

    if (!pageAccessToken) {
      throw new Error(
        "Could not obtain page access token. Make sure you're a page admin."
      );
    }

    logger.info("🔑 Page access token obtained for posting");

    // Step 3: Create video post using Facebook Graph API with PAGE access token
    const postUrl = `https://graph.facebook.com/v23.0/${pageId}/videos`;
    const postParams = {
      file_url: publicVideoUrl,
      description: finalCaption,
      access_token: pageAccessToken, // Use page access token for posting
    };

    logger.info("📹 Publishing video to Facebook page...");
    const postResponse = await axios.post(postUrl, postParams);
    const postId = postResponse.data.id;

    logger.info(`✅ Facebook video published. Post ID: ${postId}`);

    // Step 4: Get the permalink using page access token
    const permalinkUrl = `https://graph.facebook.com/v23.0/${postId}?fields=permalink_url&access_token=${pageAccessToken}`;
    const permalinkResponse = await axios.get(permalinkUrl);
    let facebookUrl = permalinkResponse.data.permalink_url;

    // Ensure we have a complete URL
    if (facebookUrl && !facebookUrl.startsWith("http")) {
      facebookUrl = `https://facebook.com${facebookUrl}`;
    } else if (!facebookUrl) {
      facebookUrl = `https://facebook.com/${postId}`;
    }

    logger.info(`✅ Facebook upload successful: ${facebookUrl}`);

    // Clean up Supabase file after successful Facebook upload
    if (uploadedFileName) {
      await deleteFromSupabase(uploadedFileName, SUPABASE_BUCKET);
    }

    return {
      success: true,
      url: facebookUrl,
      postId: postId,
      caption: finalCaption,
    };
  } catch (error) {
    logger.error("❌ Facebook upload failed:", error.message);
    if (error.response) {
      logger.error("Response status:", error.response.status);
      logger.error("Response data:", error.response.data);
    }

    // Clean up Supabase file on error
    if (uploadedFileName) {
      logger.warn(
        "🧹 Cleaning up Supabase file due to Facebook upload failure..."
      );
      await deleteFromSupabase(uploadedFileName, SUPABASE_BUCKET);
    }

    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Upload video to Facebook using a pre-uploaded Supabase URL
 */
const uploadToFacebookWithUrl = async (videoUrl, title, description) => {
  let uploadedFileName = null;

  try {
    logger.info("📘 Starting Facebook upload with provided URL...");

    // Generate unified caption for all platforms
    const unifiedContent = await generateUnifiedSocialMediaCaption(title);
    const finalCaption = unifiedContent.caption;

    logger.info(
      `📝 Using unified caption for Facebook (${finalCaption.length} chars)`
    );

    // Required environment variables
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
    const pageId = process.env.FACEBOOK_PAGE_ID;

    if (!accessToken || !pageId) {
      throw new Error(
        "FACEBOOK_ACCESS_TOKEN and FACEBOOK_PAGE_ID environment variables are required"
      );
    }

    logger.info(`🔗 Using provided video URL for Facebook: ${videoUrl}`);

    // Step 1: Get page access token for posting
    const pageTokenUrl = `https://graph.facebook.com/v23.0/${pageId}?fields=access_token&access_token=${accessToken}`;
    const pageTokenResponse = await axios.get(pageTokenUrl);
    const pageAccessToken = pageTokenResponse.data.access_token;

    if (!pageAccessToken) {
      throw new Error(
        "Could not obtain page access token. Make sure you're a page admin."
      );
    }

    logger.info("🔑 Page access token obtained for posting");

    // Step 2: Create video post using Facebook Graph API with PAGE access token
    const postUrl = `https://graph.facebook.com/v23.0/${pageId}/videos`;
    const postParams = {
      file_url: videoUrl,
      description: finalCaption,
      access_token: pageAccessToken, // Use page access token for posting
    };

    logger.info("📹 Publishing video to Facebook page...");
    const postResponse = await axios.post(postUrl, postParams);
    const postId = postResponse.data.id;

    logger.info(`✅ Facebook video published. Post ID: ${postId}`);

    // Step 3: Get the permalink using page access token
    const permalinkUrl = `https://graph.facebook.com/v23.0/${postId}?fields=permalink_url&access_token=${pageAccessToken}`;
    const permalinkResponse = await axios.get(permalinkUrl);
    let facebookUrl = permalinkResponse.data.permalink_url;

    // Ensure we have a complete URL
    if (facebookUrl && !facebookUrl.startsWith("http")) {
      facebookUrl = `https://facebook.com${facebookUrl}`;
    } else if (!facebookUrl) {
      facebookUrl = `https://facebook.com/${postId}`;
    }

    logger.info(`✅ Facebook upload successful: ${facebookUrl}`);

    return {
      success: true,
      url: facebookUrl,
      postId: postId,
      caption: finalCaption,
    };
  } catch (error) {
    logger.error("❌ Facebook upload failed:", error.message);
    if (error.response) {
      logger.error("Response status:", error.response.status);
      logger.error("Response data:", error.response.data);
    }

    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Upload video to both platforms
 */
const uploadToBothPlatforms = async (
  videoPath,
  title,
  description,
  scriptContent = ""
) => {
  let uploadedFileName = null;

  try {
    logger.info("🚀 Starting upload to YouTube, Instagram, and Facebook...");

    // Generate unified caption for all platforms using Groq
    const unifiedContent = await generateUnifiedSocialMediaCaption(title);
    logger.info("🤖 Unified Groq-generated caption ready for all platforms");

    // Step 1: Upload video to Supabase once (shared for Instagram and Facebook)
    logger.info(
      "☁️ Uploading video to Supabase (shared for Instagram & Facebook)..."
    );
    const supabaseResult = await uploadToSupabaseAndGetLink(
      videoPath,
      "Social Media Video"
    );
    if (!supabaseResult.success) {
      throw new Error(`Supabase upload failed: ${supabaseResult.error}`);
    }

    uploadedFileName = supabaseResult.fileName;
    const sharedVideoUrl = supabaseResult.publicLink;
    logger.info(`✅ Video uploaded to Supabase: ${sharedVideoUrl}`);

    const results = {
      youtube: null,
      instagram: null,
      facebook: null,
    };

    // Upload to YouTube
    try {
      results.youtube = await uploadToYouTube(videoPath, title, description);
    } catch (error) {
      logger.error("YouTube upload failed:", error);
      results.youtube = { success: false, error: error.message };
    }

    // Upload to Instagram using shared Supabase URL
    try {
      results.instagram = await uploadToInstagramWithUrl(
        sharedVideoUrl,
        title,
        description
      );
    } catch (error) {
      logger.error("Instagram upload failed:", error);
      results.instagram = { success: false, error: error.message };
    }

    // Upload to Facebook using shared Supabase URL
    try {
      results.facebook = await uploadToFacebookWithUrl(
        sharedVideoUrl,
        title,
        description
      );
    } catch (error) {
      logger.error("Facebook upload failed:", error);
      results.facebook = { success: false, error: error.message };
    }

    const uploadSummary = {
      success:
        results.youtube.success &&
        results.instagram.success &&
        results.facebook.success, // All three must succeed for "complete success"
      partialSuccess:
        (results.youtube.success ||
          results.instagram.success ||
          results.facebook.success) &&
        !(
          results.youtube.success &&
          results.instagram.success &&
          results.facebook.success
        ), // At least one succeeded but not all
      allFailed:
        !results.youtube.success &&
        !results.instagram.success &&
        !results.facebook.success, // All failed
      youtube: results.youtube,
      instagram: results.instagram,
      facebook: results.facebook,
      youtubeUrl: results.youtube.success ? results.youtube.url : null,
      instagramUrl: results.instagram.success ? results.instagram.url : null,
      facebookUrl: results.facebook.success ? results.facebook.url : null,
      successfulCount: [
        results.youtube.success,
        results.instagram.success,
        results.facebook.success,
      ].filter(Boolean).length,
      totalCount: 3,
    };

    logger.info("📊 Upload summary:", {
      success: uploadSummary.success,
      partialSuccess: uploadSummary.partialSuccess,
      allFailed: uploadSummary.allFailed,
      successfulCount: uploadSummary.successfulCount,
      youtube: results.youtube.success,
      instagram: results.instagram.success,
      facebook: results.facebook.success,
    });

    // Clean up Supabase file ONLY if ALL uploads succeeded
    if (uploadedFileName && uploadSummary.success) {
      logger.info("🧹 Cleaning up Supabase file after complete success...");
      await deleteFromSupabase(uploadedFileName, SUPABASE_BUCKET);
    } else if (
      uploadedFileName &&
      (uploadSummary.partialSuccess || uploadSummary.allFailed)
    ) {
      logger.info(
        "📁 Keeping Supabase file for potential retry (partial success or all failed)..."
      );
    }

    return uploadSummary;
  } catch (error) {
    logger.error("❌ Social media upload failed:", error);

    // Clean up Supabase file on error (if it was uploaded)
    if (uploadedFileName) {
      logger.warn("🧹 Cleaning up Supabase file due to upload failure...");
      await deleteFromSupabase(uploadedFileName, SUPABASE_BUCKET);
    }

    throw error;
  }
};

/**
 * Upload video to Supabase and get public link
 */
const uploadToSupabaseAndGetLink = async (videoPath, title) => {
  try {
    logger.info("☁️ Uploading video to Supabase...");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required"
      );
    }

    const fileName = `${title.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.mp4`;
    const fileBuffer = fs.readFileSync(videoPath);
    const fileStats = fs.statSync(videoPath);

    logger.info(`📁 Uploading file: ${fileName}`);
    logger.info(
      `📊 File size: ${(fileStats.size / (1024 * 1024)).toFixed(2)} MB`
    );

    // Check file size limit (Supabase free tier limit is ~50MB)
    const maxFileSizeMB = 50;
    if (fileStats.size > maxFileSizeMB * 1024 * 1024) {
      throw new Error(
        `File size ${(fileStats.size / (1024 * 1024)).toFixed(
          2
        )} MB exceeds Supabase limit of ${maxFileSizeMB} MB. ` +
          `Consider compressing the video or using a different storage solution.`
      );
    }

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(fileName, fileBuffer, {
        contentType: "video/mp4",
        upsert: false,
      });

    if (error) {
      logger.error(`❌ Supabase upload failed: ${error.message}`);
      logger.error("Error details:", JSON.stringify(error, null, 2));
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    logger.info(`✅ File uploaded to Supabase. Key: ${fileName}`);

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(fileName);

    const publicLink = urlData.publicUrl;
    logger.info(`🔗 Public link: ${publicLink}`);

    return {
      success: true,
      fileName: fileName,
      publicLink: publicLink,
      bucket: SUPABASE_BUCKET,
    };
  } catch (error) {
    logger.error("❌ Supabase upload failed:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Delete file from Supabase
 */
const deleteFromSupabase = async (fileName, bucket) => {
  try {
    logger.info(`🗑️ Deleting file from Supabase: ${fileName}`);

    const { data, error } = await supabase.storage
      .from(bucket)
      .remove([fileName]);

    if (error) {
      throw new Error(`Supabase delete failed: ${error.message}`);
    }

    logger.info("✅ File deleted from Supabase");
    return { success: true };
  } catch (error) {
    logger.error("❌ Failed to delete from Supabase:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Get Instagram permalink using media ID
 */
const getInstagramPermalink = async (mediaId, instagramAccessToken) => {
  try {
    logger.info(`🔗 Getting Instagram permalink for media ID: ${mediaId}`);

    // Use Facebook access token for permalink API (Instagram token doesn't work)
    const facebookAccessToken = process.env.FACEBOOK_ACCESS_TOKEN;
    if (!facebookAccessToken) {
      logger.warn(
        "⚠️ No Facebook access token available for permalink, using constructed URL"
      );
      return `https://instagram.com/reel/${mediaId}`;
    }

    const url = `https://graph.facebook.com/v18.0/${mediaId}?fields=permalink&access_token=${facebookAccessToken}`;
    const response = await axios.get(url);

    const permalink = response.data.permalink;
    logger.info(`✅ Instagram permalink: ${permalink}`);

    return permalink;
  } catch (error) {
    logger.error("❌ Failed to get Instagram permalink:", error.message);
    if (error.response) {
      logger.error("Response data:", error.response.data);
    }
    // Fallback to constructed URL
    logger.warn("⚠️ Using constructed URL as fallback");
    return `https://instagram.com/reel/${mediaId}`;
  }
};

/**
 * Get topic-related emoji based on title and description
 */
const getTopicEmoji = (title, description) => {
  const text = `${title} ${description}`.toLowerCase();

  const emojiMap = {
    tech: "💻",
    technology: "🔧",
    software: "🖥️",
    development: "⚙️",
    programming: "👨‍💻",
    code: "📝",
    data: "📊",
    database: "🗄️",
    ai: "🤖",
    artificial: "🧠",
    machine: "⚡",
    learning: "📚",
    science: "🔬",
    research: "🔍",
    health: "🏥",
    medical: "⚕️",
    business: "💼",
    finance: "💰",
    marketing: "📈",
    education: "🎓",
    history: "📜",
    space: "🚀",
    environment: "🌍",
    music: "🎵",
    art: "🎨",
    sports: "⚽",
    food: "🍽️",
    travel: "✈️",
    gaming: "🎮",
    social: "👥",
    security: "🔒",
    cloud: "☁️",
    mobile: "📱",
    web: "🌐",
    design: "🎯",
    innovation: "💡",
    future: "🔮",
    digital: "📱",
    automation: "🤖",
    system: "⚙️",
    process: "🔄",
    framework: "🏗️",
    api: "🔗",
    network: "🌐",
    algorithm: "🧮",
    analytics: "📊",
    blockchain: "⛓️",
    crypto: "₿",
    iot: "📡",
    vr: "🥽",
    ar: "📱",
    quantum: "⚛️",
    biotech: "🧬",
    robotics: "🤖",
    energy: "⚡",
    climate: "🌡️",
    sustainability: "♻️",
  };

  // Find matching emoji
  for (const [keyword, emoji] of Object.entries(emojiMap)) {
    if (text.includes(keyword)) {
      return emoji;
    }
  }

  // Default emoji
  return "📚";
};

/**
 * Generate educational explanation about the topic using AI
 */
const generateTopicExplanation = async (
  title,
  description,
  scriptContent = ""
) => {
  try {
    // Generate a comprehensive 70-word explanation of the topic (without repeating the title)
    const explanation = `This is a fascinating topic that explores the fundamental concepts and practical applications in this field. This educational video breaks down complex ideas into simple explanations, covering key principles, real-world examples, and important insights. Whether you're a student, professional, or simply curious about the subject, you'll discover valuable knowledge that can be applied in various contexts. Join us as we explore the essential aspects and emerging trends that make this topic both relevant and exciting in today's world.`;

    return explanation;
  } catch (error) {
    logger.error("❌ Failed to generate topic explanation:", error.message);
    return `This is an important topic that covers fundamental concepts and practical applications. This video provides clear explanations and valuable insights to help you learn and apply this knowledge effectively.`;
  }
};

/**
 * Generate unified social media caption using Groq LLM
 * Creates the same lengthy caption for all 3 platforms
 */
const generateUnifiedSocialMediaCaption = async (title) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("No Gemini API key available");
    }

const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Single consolidated prompt for all components
    const consolidatedPrompt = `Topic: ${title}
Task: Generate social media content components.

RULES:
- Respond in exactly this format with delimiters:
THEORY: [A simple 3-5 sentence explanation for students. Under 80 words. No icons. No bold.]
HASHTAGS: [#hashtag1 #hashtag2 ... #hashtag15 (exactly 15 trending hashtags)]
KEYWORDS: [word1, word2, word3, word4, word5 (exactly 5 raw defining keywords)]

- Use simple English.
- No introductory filler.`;

    const result = await model.generateContent(consolidatedPrompt);
    const responseText = result.response.text().trim();

    // Parse the consolidated response
    const theoryMatch = responseText.match(/THEORY:\s*(.*)/i);
    const hashtagsMatch = responseText.match(/HASHTAGS:\s*(.*)/i);
    const keywordsMatch = responseText.match(/KEYWORDS:\s*(.*)/i);

    const theory = theoryMatch ? theoryMatch[1].trim() : "Educational content about " + title;
    const hashtags = hashtagsMatch ? hashtagsMatch[1].trim() : "#education #learning #facts";
    const rawKeywords = keywordsMatch ? keywordsMatch[1].trim() : title;
    const bracketedKeywords = `[${rawKeywords.split(',').map(s => s.trim()).join(', ')}]`;

    // Create the unified caption
    const unifiedCaption = `${title}

${theory}

${hashtags}

${bracketedKeywords}

❤️ Like • 💬 Comment • 🔄 Share 
👥 Tag a friend who needs to learn this!
📚 Follow for more educational content!`;

    logger.info(`✅ Generated unified caption via Gemini (consolidated) for: ${title}`);
    logger.info(`📏 Caption length: ${unifiedCaption.length} characters`);

    return {
      caption: unifiedCaption,
      theory: theory,
      hashtags: hashtags,
      title: title,
    };
  } catch (error) {
    logger.error("❌ Failed to generate unified caption with Gemini:", error.message);

    // Fallback caption with dynamic content based on title
    const fallbackTheory = `This fascinating topic explores fundamental concepts and practical applications in this field. Discover key principles, real-world examples, and valuable insights that will help you understand and apply this knowledge effectively. Whether you're learning for education or professional development, this content provides clear explanations and actionable information.`;

    const fallbackHashtags =
      "#education #learning #knowledge #tutorial #educational #facts #tips #guide #explained #howto #viral #trending #fyp #explore #discover";

    const fallbackCaption = `${title}

${fallbackTheory}

${fallbackHashtags}

❤️ Like • 💬 Comment • 🔄 Share • 
👥 Tag a friend who needs to learn this!
📚 Follow for more educational content!`;

    return {
      caption: fallbackCaption,
      theory: fallbackTheory,
      hashtags: fallbackHashtags,
      title: title,
    };
  }
};

module.exports = {
  uploadToYouTube,
  uploadToInstagram,
  uploadToFacebook,
  uploadToBothPlatforms,
  uploadToInstagramWithUrl,
  uploadToFacebookWithUrl,
  generateSocialMediaContent,
  uploadToSupabaseAndGetLink,
  deleteFromSupabase,
  getInstagramPermalink,
  generateAISocialMediaContent,
  getTopicEmoji,
  generateTopicExplanation,
  generateUnifiedSocialMediaCaption,
};

