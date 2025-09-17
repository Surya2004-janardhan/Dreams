const { getYouTubeClient } = require("../config/google");
const logger = require("../config/logger");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

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

${allHashtags.join(" ")}`;

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
 * Upload video to YouTube
 */
const uploadToYouTube = async (videoPath, title, description) => {
  try {
    logger.info("📺 Starting YouTube upload...");

    const socialContent = generateSocialMediaContent(title, description);
    const youtube = await getYouTubeClient();

    const videoMetadata = {
      snippet: {
        title: socialContent.youtube.title,
        description: socialContent.youtube.description,
        tags: socialContent.youtube.tags,
        categoryId: "27", // Education category
        defaultLanguage: "en",
        defaultAudioLanguage: "en-IN",
      },
      status: {
        privacyStatus: "public",
        selfDeclaredMadeForKids: false,
      },
    };

    const media = {
      mimeType: "video/mp4",
      body: fs.createReadStream(videoPath),
    };

    const response = await youtube.videos.insert({
      part: ["snippet", "status"],
      resource: videoMetadata,
      media: media,
    });

    const videoId = response.data.id;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    logger.info(`✅ YouTube upload successful: ${videoUrl}`);

    return {
      success: true,
      url: videoUrl,
      videoId: videoId,
      title: socialContent.youtube.title,
      caption: socialContent.youtube.description,
    };
  } catch (error) {
    logger.error("❌ YouTube upload failed:", error);
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
  try {
    logger.info("📱 Starting Instagram upload...");

    const socialContent = generateSocialMediaContent(title, description);

    // Required environment variables
    const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    const accountId = process.env.INSTAGRAM_ACCOUNT_ID;

    if (!accessToken || !accountId) {
      throw new Error(
        "INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_ACCOUNT_ID environment variables are required"
      );
    }

    // Step 1: Upload video to get media ID
    const uploadUrl = `https://graph.facebook.com/v18.0/${accountId}/media`;
    const uploadParams = {
      media_type: "REELS",
      video_url: `file://${videoPath}`, // Local file path
      caption: socialContent.caption,
      access_token: accessToken,
    };

    const uploadResponse = await axios.post(uploadUrl, uploadParams);
    const mediaId = uploadResponse.data.id;

    // Step 2: Publish the media
    const publishUrl = `https://graph.facebook.com/v18.0/${accountId}/media_publish`;
    const publishParams = {
      creation_id: mediaId,
      access_token: accessToken,
    };

    const publishResponse = await axios.post(publishUrl, publishParams);
    const postId = publishResponse.data.id;

    const instagramUrl = `https://instagram.com/p/${postId}`;

    logger.info(`✅ Instagram upload successful: ${instagramUrl}`);

    return {
      success: true,
      url: instagramUrl,
      postId: postId,
      caption: socialContent.caption,
    };
  } catch (error) {
    logger.error("❌ Instagram upload failed:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Upload video to both platforms
 */
const uploadToBothPlatforms = async (videoPath, title, description) => {
  try {
    logger.info("🚀 Starting upload to both YouTube and Instagram...");

    const results = {
      youtube: null,
      instagram: null,
    };

    // Upload to YouTube
    try {
      results.youtube = await uploadToYouTube(videoPath, title, description);
    } catch (error) {
      logger.error("YouTube upload failed:", error);
      results.youtube = { success: false, error: error.message };
    }

    // Upload to Instagram
    try {
      results.instagram = await uploadToInstagram(
        videoPath,
        title,
        description
      );
    } catch (error) {
      logger.error("Instagram upload failed:", error);
      results.instagram = { success: false, error: error.message };
    }

    const uploadSummary = {
      success: results.youtube.success || results.instagram.success,
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

module.exports = {
  uploadToYouTube,
  uploadToInstagram,
  uploadToBothPlatforms,
  generateSocialMediaContent,
};
