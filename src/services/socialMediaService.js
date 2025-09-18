const logger = require("../config/logger");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { createClient } = require("@supabase/supabase-js");

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

  const youtubeCaption = `${title}

${description}

🎯 Learn something new every day! 
📚 Educational content in easy Q&A format
🔔 Subscribe for more educational shorts!

${allHashtags.join(" ")}"`;

  const instagramCaption = `${title} ✨

${description}

💡 Did you know this? 
📖 Educational content made simple!
❤️ Like & Share if you learned something new!

${allHashtags.join(" ")}`;

  return {
    youtube: {
      title: title.length > 100 ? title.substring(0, 97) + "..." : title,
      description: youtubeCaption,
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
      logger.warn(
        "⚠️ GROQ_API_KEY not found, falling back to template generation"
      );
      return generateSocialMediaContent(title, description);
    }

    logger.info("🤖 Generating AI-powered social media content with Groq...");

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

    const socialContent = await generateAISocialMediaContent(
      title,
      description
    );

    // Ensure #Shorts tag is included for proper short video recognition
    const tags = [...socialContent.youtube.tags];
    if (!tags.includes("Shorts")) {
      tags.push("Shorts");
    }

    // Add #Shorts to title if not present
    let finalTitle = socialContent.youtube.title;
    if (!finalTitle.includes("#Shorts")) {
      finalTitle = `${finalTitle} #Shorts`;
    }

    logger.info(`🏷️ Final tags: ${tags.join(", ")}`);
    logger.info(`📹 Final title: ${finalTitle}`);

    const response = await youtube.videos.insert({
      part: "snippet,status",
      requestBody: {
        snippet: {
          title: finalTitle,
          description: socialContent.youtube.description,
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
      title: finalTitle,
      caption: socialContent.youtube.description,
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

    const socialContent = await generateAISocialMediaContent(
      title,
      description
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
    const supabaseResult = await uploadToSupabaseAndGetLink(videoPath, title);
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
      caption: socialContent.instagram.caption,
      share_to_feed: false, // Set to false for Reels-only posts
      access_token: accessToken,
    };

    logger.info("📦 Creating Reels container...");
    const containerResponse = await axios.post(containerUrl, containerParams);
    const containerId = containerResponse.data.id;
    logger.info(`✅ Reels container created. Container ID: ${containerId}`);

    // Step 3: Wait for Instagram to process the media
    logger.info("⏳ Waiting for Instagram to process media (40 seconds)...");
    await new Promise((resolve) => setTimeout(resolve, 40000));

    // Step 4: Publish the Reels container
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

    const postId = publishResponse.data.id;
    const instagramUrl = `https://instagram.com/reel/${postId}`;

    // Get the actual permalink from Instagram
    const permalink = await getInstagramPermalink(postId, accessToken);
    const finalUrl = permalink || instagramUrl;

    logger.info(`✅ Instagram Reels upload successful: ${finalUrl}`);

    // Clean up Supabase file after successful Instagram upload
    if (uploadedFileName) {
      await deleteFromSupabase(uploadedFileName, SUPABASE_BUCKET);
    }

    return {
      success: true,
      url: finalUrl,
      postId: postId,
      containerId: containerId,
      caption: socialContent.instagram.caption,
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
 * Upload video to both platforms
 */
const uploadToBothPlatforms = async (
  videoPath,
  title,
  description,
  scriptContent = ""
) => {
  try {
    logger.info("🚀 Starting upload to both YouTube and Instagram...");

    // Generate AI-powered content for both platforms
    const socialContent = await generateAISocialMediaContent(
      title,
      description,
      scriptContent
    );
    logger.info("🤖 AI-generated content ready for upload");

    const results = {
      youtube: null,
      instagram: null,
    };

    // Upload to YouTube
    try {
      results.youtube = await uploadToYouTube(
        videoPath,
        socialContent.youtube.title,
        socialContent.youtube.description
      );
    } catch (error) {
      logger.error("YouTube upload failed:", error);
      results.youtube = { success: false, error: error.message };
    }

    // Upload to Instagram (this will handle Supabase upload internally)
    try {
      results.instagram = await uploadToInstagram(
        videoPath,
        socialContent.instagram.caption,
        description
      );
    } catch (error) {
      logger.error("Instagram upload failed:", error);
      results.instagram = { success: false, error: error.message };
    }

    const uploadSummary = {
      success: results.youtube.success && results.instagram.success, // Both must succeed
      youtube: results.youtube,
      instagram: results.instagram,
      youtubeUrl: results.youtube.success ? results.youtube.url : null,
      instagramUrl: results.instagram.success ? results.instagram.url : null,
    };

    logger.info("📊 Upload summary:", uploadSummary);

    return uploadSummary;
  } catch (error) {
    logger.error("❌ Social media upload failed:", error);
    throw error;
  }
};

/**
 * Upload video to YouTube using OAuth2 (reference implementation)
 */
const uploadToYouTubeOAuth2 = async (videoPath, title, description) => {
  try {
    logger.info("📺 Starting YouTube OAuth2 upload...");

    // Check if required environment variables are set
    if (
      !process.env.GOOGLE_CLIENT_ID ||
      !process.env.GOOGLE_CLIENT_SECRET ||
      !process.env.GOOGLE_REDIRECT_URI ||
      !process.env.YOUTUBE_REFRESH_TOKEN
    ) {
      throw new Error(
        "Missing YouTube OAuth2 environment variables. Please set: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, YOUTUBE_REFRESH_TOKEN"
      );
    }

    // Initialize OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Set credentials with refresh token
    oauth2Client.setCredentials({
      refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
    });

    // Create YouTube API client
    const youtube = google.youtube({
      version: "v3",
      auth: oauth2Client,
    });

    // Generate hashtags for the video
    const hashtags =
      "#Shorts #Education #Learning #Tech #AI #Automation #Tutorial #HowTo #Knowledge #Skills";

    // Prepare video metadata
    const videoMetadata = {
      snippet: {
        title: `${title} ${hashtags}`,
        description: `${description}\n\n${hashtags}`,
        categoryId: "27", // Education category
        tags: hashtags.replace(/#/g, "").split(" "),
      },
      status: {
        privacyStatus: "public",
      },
    };

    logger.info(`📹 Uploading video: ${videoPath}`);
    logger.info(`📝 Title: ${videoMetadata.snippet.title}`);

    // Upload the video
    const response = await youtube.videos.insert({
      part: "snippet,status",
      requestBody: videoMetadata,
      media: {
        body: fs.createReadStream(videoPath),
      },
    });

    const videoId = response.data.id;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    logger.info(`✅ YouTube OAuth2 upload successful: ${videoUrl}`);

    return {
      success: true,
      url: videoUrl,
      videoId: videoId,
      title: videoMetadata.snippet.title,
      description: videoMetadata.snippet.description,
    };
  } catch (error) {
    logger.error("❌ YouTube OAuth2 upload failed:", error.message);
    if (error.response) {
      logger.error("API Response:", error.response.data);
    }
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Upload video to Supabase and get public shareable link
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
    const fileContent = fs.readFileSync(videoPath);
    const fileBuffer = Buffer.from(fileContent);
    const fileStats = fs.statSync(videoPath);

    logger.info(`📁 Uploading file: ${fileName}`);
    logger.info(
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
const getInstagramPermalink = async (mediaId, accessToken) => {
  try {
    logger.info(`🔗 Getting Instagram permalink for media ID: ${mediaId}`);

    const url = `https://graph.facebook.com/v18.0/${mediaId}?fields=permalink&access_token=${accessToken}`;
    const response = await axios.get(url);

    const permalink = response.data.permalink;
    logger.info(`✅ Instagram permalink: ${permalink}`);

    return permalink;
  } catch (error) {
    logger.error("❌ Failed to get Instagram permalink:", error.message);
    if (error.response) {
      logger.error("Response data:", error.response.data);
    }
    return null;
  }
};

module.exports = {
  uploadToYouTube,
  uploadToInstagram,
  uploadToBothPlatforms,
  generateSocialMediaContent,
  uploadToYouTubeOAuth2,
  uploadToSupabaseAndGetLink,
  deleteFromSupabase,
  getInstagramPermalink,
  generateAISocialMediaContent,
};
