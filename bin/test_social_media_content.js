const axios = require("axios");
require("dotenv").config();

// Mock logger to avoid requiring the full service
const logger = {
  info: (msg) => console.log(`ℹ️ ${msg}`),
  warn: (msg) => console.log(`⚠️ ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
};

// Helper functions (copied from socialMediaService.js)
const generateTopicPoints = async (title, description, scriptContent = "") => {
  try {
    const geminiApiKey = process.env.GEMINI_API_KEY_FOR_T2T;
    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY_FOR_T2T not found");
    }

    logger.info("🤖 Generating 5 key points about the topic...");

    const prompt = `Create exactly 5 simple, educational points about this topic:

Topic: "${title}"
Description: "${description}"
${scriptContent ? `Content: ${scriptContent.substring(0, 1000)}` : ""}

Generate exactly 5 bullet points that cover the most important aspects of this topic. Each point should be:
- Simple and easy to understand
- Educational and informative
- 1-2 sentences maximum per point
- Focus on key concepts, benefits, and practical applications

Return only the 5 points as a JSON array of strings, like this:
["Point 1 here", "Point 2 here", "Point 3 here", "Point 4 here", "Point 5 here"]`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
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
      .replace(/```json\s*|\s*```/g, "")
      .trim();
    const points = JSON.parse(cleanContent);

    if (!Array.isArray(points) || points.length !== 5) {
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

const generateAISocialMediaContent = async (
  title,
  description,
  scriptContent = ""
) => {
  try {
    // First, generate 5 key points about the topic
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

    // Create YouTube description with 5 points
    const youtubeDescription = `${topicEmoji} ${title}

${topicPoints.map((point, index) => `${index + 1}. ${point}`).join("\n")}

🔥 Don't forget to:
👍 Like this video if you learned something new!
🔔 Subscribe for more educational content like this!
💬 Share your thoughts in the comments below!
🔗 Save this video to watch again later!

${hashtagString}`;

    // Create Instagram caption with 5 points
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
    throw error;
  }
};

async function testSocialMediaContent() {
  try {
    console.log("🧪 Testing new social media content generation...");

    const title = "Introduction to Machine Learning";
    const description =
      "Learn the basics of machine learning algorithms and their applications";
    const scriptContent =
      "Machine learning is a subset of artificial intelligence that enables computers to learn without being explicitly programmed. It involves algorithms that can identify patterns in data and make predictions.";

    console.log("\n📝 Test Input:");
    console.log(`Title: ${title}`);
    console.log(`Description: ${description}`);

    // Test topic emoji generation
    console.log("\n😀 Testing emoji generation...");
    const emoji = getTopicEmoji(title, description);
    console.log(`Topic emoji: ${emoji}`);

    // Test topic points generation
    console.log("\n📋 Testing topic points generation...");
    const points = await generateTopicPoints(title, description, scriptContent);
    console.log("Generated points:");
    points.forEach((point, index) => {
      console.log(`${index + 1}. ${point}`);
    });

    // Test full social media content generation
    console.log("\n📱 Testing full social media content generation...");
    const content = await generateAISocialMediaContent(
      title,
      description,
      scriptContent
    );

    console.log("\n📺 YouTube Content:");
    console.log(`Title: ${content.youtube.title}`);
    console.log(
      `Description (first 300 chars): ${content.youtube.description.substring(
        0,
        300
      )}...`
    );
    console.log(`Tags: ${content.youtube.tags.join(", ")}`);

    console.log("\n📸 Instagram Content:");
    console.log(
      `Caption (first 300 chars): ${content.instagram.caption.substring(
        0,
        300
      )}...`
    );

    console.log("\n✅ Test completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
  }
}

// Run the test
testSocialMediaContent();
