const { getYouTubeClient } = require("../config/google");
const logger = require("../config/logger");
const fs = require("fs");
const path = require("path");

/**
 * Generate hashtags and captions for social media
 */
const generateSocialMediaContent = (title, description) => {
  // Generate relevant hashtags
  const baseHashtags = [
    "#education", "#learning", "#knowledge", "#facts", "#educational",
    "#shorts", "#viral", "#trending", "#india", "#informative"
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
      tags: allHashtags.map(h => h.replace("#", "")).slice(0, 10),
      hashtags: allHashtags.join(" ")
    },
    instagram: {
      caption: instagramCaption,
      hashtags: allHashtags.join(" ")
    }
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
        defaultAudioLanguage: "en-IN"
      },
      status: {
        privacyStatus: "public",
        selfDeclaredMadeForKids: false,
      }
    };

    const media = {
      mimeType: "video/mp4",
      body: fs.createReadStream(videoPath)
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
      caption: socialContent.youtube.description
    };

  } catch (error) {
    logger.error("❌ YouTube upload failed:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Upload video to Instagram (placeholder - requires Instagram API setup)
 */
const uploadToInstagram = async (videoPath, title, description) => {
  try {
    logger.info("📱 Starting Instagram upload...");
    
    const socialContent = generateSocialMediaContent(title, description);
    
    // Instagram Graph API implementation would go here
    // For now, returning a placeholder response
    
    // In a real implementation, you would:
    // 1. Upload video to Instagram using Instagram Graph API
    // 2. Create a container with the video and caption
    // 3. Publish the container
    
    logger.warn("⚠️ Instagram upload not implemented - returning placeholder");
    
    const placeholderUrl = `https://instagram.com/p/placeholder_${Date.now()}`;
    
    return {
      success: true,
      url: placeholderUrl,
      caption: socialContent.instagram.caption,
      note: "Instagram upload placeholder - implement Instagram Graph API"
    };

  } catch (error) {
    logger.error("❌ Instagram upload failed:", error);
    return {
      success: false,
      error: error.message
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
      instagram: null
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
      results.instagram = await uploadToInstagram(videoPath, title, description);
    } catch (error) {
      logger.error("Instagram upload failed:", error);
      results.instagram = { success: false, error: error.message };
    }

    const uploadSummary = {
      success: results.youtube.success || results.instagram.success,
      youtube: results.youtube,
      instagram: results.instagram,
      youtubeUrl: results.youtube.success ? results.youtube.url : null,
      instagramUrl: results.instagram.success ? results.instagram.url : null
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
  generateSocialMediaContent
};
