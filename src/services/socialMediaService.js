const logger = require("../config/logger");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");

// Filebase configuration
const FILEBASE_ACCESS_KEY = process.env.FILEBASE_ACCESS_KEY;
const FILEBASE_SECRET_KEY = process.env.FILEBASE_SECRET_KEY;
const FILEBASE_BUCKET = process.env.FILEBASE_BUCKET || "ai-content-videos";

// Initialize Filebase S3 client
const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: "https://s3.filebase.com",
  credentials: {
    accessKeyId: FILEBASE_ACCESS_KEY,
    secretAccessKey: FILEBASE_SECRET_KEY,
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

    const socialContent = generateSocialMediaContent(title, description);

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

    // Step 1: Upload to Filebase and get public link
    const filebaseResult = await uploadToFilebaseAndGetLink(videoPath, title);
    if (!filebaseResult.success) {
      throw new Error(`Filebase upload failed: ${filebaseResult.error}`);
    }

    const filebaseFileName = filebaseResult.fileName;
    const publicVideoUrl = filebaseResult.publicLink;

    logger.info(`🔗 Using Filebase link for Instagram: ${publicVideoUrl}`);

    // Step 2: Upload video to get media ID using public URL
    const uploadUrl = `https://graph.facebook.com/v18.0/${accountId}/media`;
    const uploadParams = {
      media_type: "REELS",
      video_url: publicVideoUrl, // Use public Filebase URL
      caption: socialContent.caption,
      access_token: accessToken,
    };

    logger.info("📤 Uploading media to Instagram...");
    const uploadResponse = await axios.post(uploadUrl, uploadParams);
    const mediaId = uploadResponse.data.id;

    logger.info(`✅ Media uploaded successfully. Media ID: ${mediaId}`);

    // Wait for Instagram to process the media before publishing
    logger.info("⏳ Waiting for Instagram to process media (40 seconds)...");
    await new Promise((resolve) => setTimeout(resolve, 40000));

    // Step 3: Publish the media with retry mechanism
    const publishUrl = `https://graph.facebook.com/v18.0/${accountId}/media_publish`;
    const publishParams = {
      creation_id: mediaId,
      access_token: accessToken,
    };

    let publishResponse;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        logger.info(
          `🚀 Publishing media (attempt ${retryCount + 1}/${maxRetries})...`
        );
        publishResponse = await axios.post(publishUrl, publishParams);
        break; // Success, exit retry loop
      } catch (publishError) {
        retryCount++;
        if (retryCount < maxRetries) {
          logger.warn(
            `⚠️ Publish attempt ${retryCount} failed, retrying in 25 seconds...`
          );
          await new Promise((resolve) => setTimeout(resolve, 25000));
        } else {
          throw publishError; // Max retries reached, throw error
        }
      }
    }

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

    // Upload to Instagram (this will handle Filebase upload internally)
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
 * Upload video to Filebase and get public shareable link
 */
const uploadToFilebaseAndGetLink = async (videoPath, title) => {
  try {
    logger.info("☁️ Uploading video to Filebase...");

    if (!FILEBASE_ACCESS_KEY || !FILEBASE_SECRET_KEY) {
      throw new Error(
        "FILEBASE_ACCESS_KEY and FILEBASE_SECRET_KEY environment variables are required"
      );
    }

    const fileName = `${title.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.mp4`;
    const fileContent = fs.readFileSync(videoPath);
    const fileStats = fs.statSync(videoPath);

    logger.info(`📁 Uploading file: ${fileName}`);
    logger.info(
      `📊 File size: ${(fileStats.size / (1024 * 1024)).toFixed(2)} MB`
    );

    // Upload to Filebase S3 with proper public access
    const uploadCommand = new PutObjectCommand({
      Bucket: FILEBASE_BUCKET,
      Key: fileName,
      Body: fileContent,
      ContentType: "video/mp4",
      ACL: "public-read",
    });

    const uploadResult = await s3Client.send(uploadCommand);
    logger.info(`✅ File uploaded to Filebase. Key: ${fileName}`);

    // Use Filebase's dedicated public gateway for better Instagram compatibility
    const publicLink = `https://ipfs.filebase.io/ipfs/${fileName}`;
    logger.info(`🔗 Public link: ${publicLink}`);

    return {
      success: true,
      fileName: fileName,
      publicLink: publicLink,
      bucket: FILEBASE_BUCKET,
    };
  } catch (error) {
    logger.error("❌ Filebase upload failed:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Delete file from Filebase S3
 */
const deleteFromDrive = async (fileId) => {
  try {
    logger.info(`🗑️ Deleting file from Filebase S3: ${fileId}`);
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: FILEBASE_BUCKET,
        Key: fileId,
      })
    );
    logger.info("✅ File deleted from Filebase S3");
    return { success: true };
  } catch (error) {
    logger.error("❌ Failed to delete from Filebase S3:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Delete file from Filebase
 */
const deleteFromFilebase = async (fileName, bucket) => {
  try {
    logger.info(`🗑️ Deleting file from Filebase: ${fileName}`);

    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucket,
      Key: fileName,
    });

    await s3Client.send(deleteCommand);
    logger.info("✅ File deleted from Filebase");
    return { success: true };
  } catch (error) {
    logger.error("❌ Failed to delete from Filebase:", error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  uploadToYouTube,
  uploadToInstagram,
  uploadToBothPlatforms,
  generateSocialMediaContent,
  uploadToYouTubeOAuth2,
  uploadToFilebaseAndGetLink,
  deleteFromDrive,
  deleteFromFilebase,
};
