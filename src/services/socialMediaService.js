const logger = require("../config/logger");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { google } = require("googleapis");
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
    // First, generate 10 key points about the topic
    const topicPoints = await generateTopicPoints(
      title,
      description,
      scriptContent
    );

    // Get topic-related emoji
    const topicEmoji = getTopicEmoji(title, description);

    // Generate hashtags
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
      "#tech",
      "#technology",
      "#ai",
      "#innovation",
      "#digital",
      "#tutorial",
      "#howto",
      "#explained",
      "#guide",
      "#tips",
    ];

    const text = `${title} ${description}`.toLowerCase();
    const topicHashtags = [];

    if (text.includes("science")) topicHashtags.push("#science", "#scientific");
    if (text.includes("tech")) topicHashtags.push("#programming", "#coding");
    if (text.includes("ai"))
      topicHashtags.push("#artificialintelligence", "#machinelearning");
    if (text.includes("data")) topicHashtags.push("#datascience", "#analytics");
    if (text.includes("web"))
      topicHashtags.push("#webdevelopment", "#javascript");
    if (text.includes("mobile")) topicHashtags.push("#mobileapp", "#android");
    if (text.includes("cloud")) topicHashtags.push("#cloudcomputing", "#aws");
    if (text.includes("security"))
      topicHashtags.push("#cybersecurity", "#hacking");
    if (text.includes("business"))
      topicHashtags.push("#business", "#entrepreneurship");
    if (text.includes("design")) topicHashtags.push("#design", "#uiux");

    const allHashtags = [...baseHashtags, ...topicHashtags].slice(0, 20);
    const hashtagString = allHashtags.join(" ");

    // Create YouTube description with 10 points
    const youtubeDescription = `${topicEmoji} ${title}

${topicPoints.map((point, index) => `${index + 1}. ${point}`).join("\n")}

🔥 Don't forget to:
👍 Like this video if you learned something new!
🔔 Subscribe for more educational content like this!
💬 Share your thoughts in the comments below!
🔗 Save this video to watch again later!

${hashtagString}`;

    // Create Instagram caption with 10 points
    const instagramCaption = `${topicEmoji} ${title}

${topicPoints.map((point, index) => `${index + 1}. ${point}`).join("\n")}

💡 What did you learn? Share in comments!
👍 Like & Follow for more educational content!
🔥 Share this with someone who needs to learn this!

${hashtagString}`;

    return {
      youtube: {
        title: title.length > 55 ? title.substring(0, 50) + "..." : title,
        description: youtubeDescription,
        tags: allHashtags.map((h) => h.replace("#", "")).slice(0, 10),
        hashtags: hashtagString,
      },
      instagram: {
        caption: instagramCaption,
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

    // Use the original title from sheet without modifications
    const finalTitle = socialContent.youtube.title;
    const tags = [...socialContent.youtube.tags];

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
      caption: finalTitle, // Use only title for YouTube caption, not the full description
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
const uploadToInstagram = async (videoPath, caption, description) => {
  let uploadedFileName = null; // Changed from filebaseFileName to be more descriptive

  try {
    logger.info("📱 Starting Instagram upload...");

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
      caption: caption,
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
      caption: caption,
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

/**
 * Generate 10 simple points about a topic using Gemini AI
 */
const generateTopicPoints = async (title, description, scriptContent = "") => {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY_FOR_T2T;
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY_FOR_T2T not found");
    }

    logger.info("🤖 Generating 10 key points about the topic...");

    const prompt = `Create exactly 10 simple, educational points about this topic:

Topic: "${title}"
Description: "${description}"
${scriptContent ? `Content: ${scriptContent.substring(0, 1000)}` : ""}

Generate exactly 10 bullet points that cover the most important aspects of this topic. Each point should be:
- Simple and easy to understand
- Educational and informative
- 1-2 sentences maximum per point
- Focus on key concepts, benefits, and practical applications

Return only the 10 points as a JSON array of strings, like this:
["Point 1 here", "Point 2 here", "Point 3 here", ...]`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          topK: 20,
          topP: 0.8,
          maxOutputTokens: 1024,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const responseContent =
      response.data.candidates[0].content.parts[0].text.trim();
    const cleanContent = responseContent
      .replace(/```json\s*|\s*|\s*```/g, "")
      .trim();
    const points = JSON.parse(cleanContent);

    if (!Array.isArray(points) || points.length !== 10) {
      throw new Error("Invalid points format received from AI");
    }

    logger.info(`✅ Generated ${points.length} topic points`);
    return points;
  } catch (error) {
    logger.error("❌ Failed to generate topic points:", error.message);

    // Fallback points
    return [
      `Understanding the fundamentals of ${title.toLowerCase()}`,
      "Practical applications in real-world scenarios",
      "Key concepts and terminology explained",
      "Step-by-step implementation guide",
      "Common challenges and solutions",
      "Best practices for success",
      "Future trends and developments",
      "Learning resources and next steps",
      "Real-world examples and case studies",
      "Tips for getting started today",
    ];
  }
};

/**
 * Get emoji related to the topic
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
  generateTopicPoints,
  getTopicEmoji,
};
