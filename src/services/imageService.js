const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");

/**
 */
const generateImageWithGemini = async (prompt, index, apiKey) => {
  try {
    logger.info(`🎨 Generating image ${index} with Gemini...`);

    const genAI = new GoogleGenerativeAI(apiKey);

    // Set responseModalities to include "Image" so the model can generate
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      generationConfig: {
        responseModalities: ["Text", "Image"],
      },
    });

    const response = await model.generateContent(prompt);

    for (const part of response.response.candidates[0].content.parts) {
      // Based on the part type, either show the text or save the image
      if (part.text) {
        console.log(part.text);
      } else if (part.inlineData) {
        const imageData = part.inlineData.data;
        const buffer = Buffer.from(imageData, "base64");

        const imagePath = path.resolve(`images/image${index}.png`);
        fs.writeFileSync(imagePath, buffer);

        logger.info(`✅ Image ${index} saved: ${imagePath}`);
        return imagePath;
      }
    }

    throw new Error("No image data received");
  } catch (error) {
    logger.error(
      `❌ Failed to generate image ${index}:`,
      error.message || error
    );
    logger.error(`Full error details:`, JSON.stringify(error, null, 2));

    console.error(
      `❌ Failed to generate image ${index}:`,
      error.message || error
    );
    console.error(`Full error details:`, JSON.stringify(error, null, 2));

    // Create a simple fallback image
    try {
      const imagePath = path.resolve(`images/ERROR${index}.png`);
      // Create a minimal 1x1 pixel PNG as fallback
      const minimalPNG = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
        0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0x00,
        0xff, 0xff, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
      ]);
      fs.writeFileSync(imagePath, minimalPNG);
      logger.info(`✅ Fallback image ${index} created: ${imagePath}`);
      return imagePath;
    } catch (fallbackError) {
      logger.error(`❌ Fallback image creation failed:`, fallbackError.message);
      throw error;
    }
  }
};

/**
 * Parse SRT subtitle file and extract segments with timestamps
 */
const parseSRTFile = (srtFilePath) => {
  try {
    const content = fs.readFileSync(srtFilePath, "utf8");
    const segments = [];
    const blocks = content.split("\n\n").filter((block) => block.trim());

    blocks.forEach((block) => {
      const lines = block.split("\n").filter((line) => line.trim());
      if (lines.length >= 3) {
        // Skip the sequence number (first line)
        const timestampLine = lines[1];
        const textLines = lines.slice(2);

        // Parse timestamp line: "00:00:01,500 --> 00:00:04,200"
        const timestampMatch = timestampLine.match(
          /(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/
        );
        if (timestampMatch) {
          // Fix: Properly reconstruct the timestamp strings
          const startTimeStr = `${timestampMatch[1]}:${timestampMatch[2]}:${timestampMatch[3]},${timestampMatch[4]}`;
          const endTimeStr = `${timestampMatch[5]}:${timestampMatch[6]}:${timestampMatch[7]},${timestampMatch[8]}`;

          // Convert to seconds
          const startTime = timeStringToSeconds(startTimeStr);
          const endTime = timeStringToSeconds(endTimeStr);
          const text = textLines.join(" ").trim();

          segments.push({
            startTime,
            endTime,
            duration: endTime - startTime,
            text,
          });
        }
      }
    });

    logger.info(`📝 Parsed ${segments.length} subtitle segments from SRT file`);
    return segments;
  } catch (error) {
    logger.error("❌ Failed to parse SRT file:", error.message);
    return [];
  }
};

/**
 * Convert SRT timestamp string to seconds
 */
const timeStringToSeconds = (timeStr) => {
  const match = timeStr.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
  if (match) {
    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const seconds = parseInt(match[3]);
    const milliseconds = parseInt(match[4]);
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }
  return 0;
};

/**
 * Divide total duration into 5 equal chunks and collect subtitle text for each
 */
const createImageChunksFromSubtitles = (
  subtitleSegments,
  totalDuration = 70
) => {
  // Calculate actual duration from subtitles if available
  let actualDuration = totalDuration;
  if (subtitleSegments.length > 0) {
    const maxEndTime = Math.max(...subtitleSegments.map((s) => s.endTime));
    actualDuration = Math.max(maxEndTime, totalDuration); // Use at least the default if subtitles are shorter
  }

  const chunks = [];
  const chunkDuration = actualDuration / 5;

  for (let i = 0; i < 5; i++) {
    const chunkStart = i * chunkDuration;
    const chunkEnd = (i + 1) * chunkDuration;

    // Collect all subtitle text that falls within this chunk
    const chunkTexts = [];
    subtitleSegments.forEach((segment) => {
      // Check if segment overlaps with chunk
      if (segment.startTime < chunkEnd && segment.endTime > chunkStart) {
        chunkTexts.push(segment.text);
      }
    });

    const mergedText = chunkTexts.join(" ").trim();

    chunks.push({
      index: i + 1,
      startTime: chunkStart,
      endTime: chunkEnd,
      duration: chunkDuration,
      text: mergedText,
      subtitleCount: chunkTexts.length,
    });

    logger.info(
      `📊 Chunk ${i + 1}: ${chunkStart.toFixed(1)}s-${chunkEnd.toFixed(1)}s (${
        chunkTexts.length
      } subtitle segments)`
    );
  }

  return chunks;
};

/**
 * Extract technical keywords from text
 */
const extractTechnicalKeywords = (text) => {
  // Common technical keywords and patterns
  const technicalTerms = [
    // Programming/Tech
    "algorithm",
    "API",
    "architecture",
    "automation",
    "backend",
    "blockchain",
    "cloud",
    "code",
    "database",
    "debugging",
    "deployment",
    "framework",
    "frontend",
    "function",
    "infrastructure",
    "integration",
    "library",
    "machine learning",
    "microservices",
    "middleware",
    "optimization",
    "pipeline",
    "platform",
    "protocol",
    "query",
    "repository",
    "scalability",
    "script",
    "security",
    "server",
    "software",
    "system",
    "technology",
    "testing",
    "workflow",

    // Data/AI
    "analytics",
    "artificial intelligence",
    "big data",
    "classification",
    "clustering",
    "data mining",
    "dataset",
    "deep learning",
    "feature",
    "model",
    "neural network",
    "prediction",
    "processing",
    "regression",
    "training",

    // Web/Internet
    "browser",
    "cache",
    "cookie",
    "domain",
    "encryption",
    "firewall",
    "hosting",
    "HTTP",
    "HTTPS",
    "internet",
    "IP address",
    "load balancer",
    "network",
    "router",
    "SSL",
    "TCP",
    "UDP",
    "VPN",
    "webhook",

    // Business/Process
    "agile",
    "automation",
    "CI/CD",
    "DevOps",
    "efficiency",
    "kanban",
    "methodology",
    "optimization",
    "process",
    "productivity",
    "scrum",
    "workflow",
  ];

  const foundKeywords = [];
  const lowerText = text.toLowerCase();

  for (const term of technicalTerms) {
    if (lowerText.includes(term.toLowerCase())) {
      foundKeywords.push(term);
    }
  }

  // If no technical terms found, extract nouns as potential keywords
  if (foundKeywords.length === 0) {
    const words = text.split(/\s+/);
    const potentialKeywords = words
      .filter(
        (word) =>
          word.length > 4 &&
          ![
            "about",
            "would",
            "there",
            "their",
            "which",
            "where",
            "these",
            "those",
            "though",
            "through",
          ].includes(word.toLowerCase())
      )
      .slice(0, 5);
    return potentialKeywords;
  }

  return foundKeywords.slice(0, 8); // Limit to top 8 keywords
};

/**
 * Generate contextual educational images using subtitle timing and Groq prompts
 */
const generateImages = async (subtitlesPath, fullScript = null) => {
  try {
    logger.info(
      "🖼️ Starting image generation using subtitle timing and Groq prompts..."
    );
    logger.info(`📝 Subtitles path: ${subtitlesPath}`);
    logger.info(`📝 Script provided: ${!!fullScript}`);

    // Step 1: Parse SRT file or create default chunks
    let imageChunks;
    if (subtitlesPath) {
      logger.info("📝 Parsing SRT file for timing...");
      const subtitleSegments = parseSRTFile(subtitlesPath);
      logger.info(`📊 Found ${subtitleSegments.length} subtitle segments`);

      if (subtitleSegments.length === 0) {
        logger.warn("⚠️ No subtitle segments found, cannot generate images");
        return [];
      }
      imageChunks = createImageChunksFromSubtitles(subtitleSegments);
      logger.info(
        `📊 Created ${imageChunks.length} image chunks from subtitles`
      );
    } else {
      // Create default chunks without timing for manual workflow
      logger.info(
        "📝 No subtitles provided, creating default chunks for manual workflow"
      );
      imageChunks = [];
      const totalDuration = 70; // 70 seconds default
      const chunkDuration = totalDuration / 5;
      for (let i = 0; i < 5; i++) {
        imageChunks.push({
          index: i + 1,
          startTime: i * chunkDuration,
          endTime: (i + 1) * chunkDuration,
          duration: chunkDuration,
          text: `Segment ${i + 1} of educational content`,
          subtitleCount: 0,
        });
      }
      logger.info(`📊 Created ${imageChunks.length} default image chunks`);
    }

    // Step 2: Generate image prompts using Groq if script is provided
    let imagePrompts;
    if (fullScript) {
      logger.info(
        "📝 Generating prompts using Groq with full script content..."
      );
      imagePrompts = await generateImagePromptsWithGroq(fullScript);
    } else {
      logger.warn("⚠️ No script provided, using fallback prompts");
      imagePrompts = [
        "Create technical diagram of system architecture with white background in 9:8 aspect ratio",
        "Illustrate algorithm flowchart for data processing workflow with white background in 9:8 aspect ratio",
        "Show database schema relationships and connections diagram with white background in 9:8 aspect ratio",
        "Display network topology and infrastructure visualization with white background in 9:8 aspect ratio",
        "Present API integration and service communication flow with white background in 9:8 aspect ratio",
      ];
    }

    const generatedImages = [];
    let successCount = 0;

    // Step 3: Generate images for each chunk using Groq prompts
    for (let i = 0; i < imageChunks.length; i++) {
      const chunk = imageChunks[i];
      try {
        // Use the corresponding Groq-generated prompt
        const imagePrompt = imagePrompts[i] || imagePrompts[0]; // Fallback to first prompt if index out of range

        logger.info(
          `🎨 Generating image ${
            chunk.index
          }/5 for time ${chunk.startTime.toFixed(1)}-${chunk.endTime.toFixed(
            1
          )}s`
        );
        logger.info(`📝 Using Groq prompt: "${imagePrompt}"`);

        // Generate image using Gemini
        const apiKey =
          chunk.index <= 3
            ? process.env.GEMINI_API_KEY_FOR_IMAGES_1
            : process.env.GEMINI_API_KEY_FOR_IMAGES_2;
        const imagePath = await generateImageWithGemini(
          imagePrompt,
          chunk.index,
          apiKey
        );

        const imageInfo = {
          index: chunk.index,
          filename: imagePath,
          concept: `Technical diagram for segment ${chunk.index}`,
          prompt: imagePrompt,
          timing: {
            startTime: chunk.startTime,
            endTime: chunk.endTime,
            duration: chunk.duration,
          },
          placement: {
            fromTime: chunk.startTime,
            toTime: chunk.endTime,
            subtitleText: chunk.text,
            subtitleCount: chunk.subtitleCount,
          },
        };

        generatedImages.push(imageInfo);
        successCount++;

        logger.info(`✅ Image ${chunk.index} generated successfully`);

        // Small delay between generations to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 63000));
      } catch (imageError) {
        logger.error(
          `❌ Failed to generate image ${chunk.index}:`,
          imageError.message
        );

        // Create fallback image info even if generation failed
        const fallbackImageInfo = {
          index: chunk.index,
          filename: `images/ERROR${chunk.index}.png`, // This will be created by the generateImageWithGemini function
          concept: `Fallback image for segment ${chunk.index}`,
          prompt: imagePrompt,
          timing: {
            startTime: chunk.startTime,
            endTime: chunk.endTime,
            duration: chunk.duration,
          },
          placement: {
            fromTime: chunk.startTime,
            toTime: chunk.endTime,
            subtitleText: chunk.text,
            subtitleCount: chunk.subtitleCount,
          },
        };

        generatedImages.push(fallbackImageInfo);
        successCount++;

        logger.info(`⚠️ Using fallback image for chunk ${chunk.index}`);
      }
    }

    logger.info(
      `📊 Image generation complete: ${successCount}/5 chunks processed`
    );
    logger.info(`🎯 Images are perfectly timed with subtitle segments`);

    return generatedImages;
  } catch (error) {
    logger.error("❌ Image generation failed:", error.message);
    return [];
  }
};

/**
 * Generate 5 concise image prompts using Groq based on the full script
 */
const generateImagePromptsWithGroq = async (fullScript) => {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY environment variable is required");
    }

    logger.info("🤖 Generating image prompts using Groq...");

    const prompt = `Analyze this educational conversation script and create 5 concise image prompts for technical diagrams:

FULL SCRIPT:
${fullScript}

REQUIREMENTS:
- Create exactly 5 image prompts
- Each prompt must be very concise (under 50 words)
- Focus ONLY on technical terms and diagrammatic flow
- Images must have white background
- Images must be 9:8 aspect ratio
- Show technical concepts, workflows, algorithms, or system architectures
- Use clear, professional technical illustration style
- Include specific technical terms from the conversation

FORMAT: Return only a JSON array of 5 strings, no additional text.

Example format:
["Create a technical diagram showing API architecture with white background", "Illustrate database schema relationships in 9:8 ratio", "Show algorithm flowchart for data processing", "Display network topology diagram", "Present system workflow visualization"]`;

    const response = await axios.post(
      GROQ_API_URL,
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "You are an expert at creating concise, technical image prompts for educational content. Focus on technical diagrams, workflows, and system architectures. Always return valid JSON arrays.",
          },
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
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    const content = response.data.choices[0].message.content.trim();
    logger.info("📝 Groq generated prompts response:", content);

    // Parse the JSON response
    let prompts;
    try {
      // Remove any markdown formatting if present
      const cleanContent = content.replace(/```json\s*|\s*```/g, "").trim();
      prompts = JSON.parse(cleanContent);
    } catch (parseError) {
      logger.warn(
        "⚠️ Failed to parse Groq response as JSON, using fallback prompts"
      );
      // Fallback prompts based on common technical topics
      prompts = [
        "Create technical diagram of system architecture with white background 9:8 ratio",
        "Illustrate algorithm flowchart for data processing workflow",
        "Show database schema relationships and connections diagram",
        "Display network topology and infrastructure visualization",
        "Present API integration and service communication flow",
      ];
    }

    if (!Array.isArray(prompts) || prompts.length !== 5) {
      logger.warn("⚠️ Invalid prompts format, using fallback");
      prompts = [
        "Create technical diagram of system architecture with white background 9:8 ratio",
        "Illustrate algorithm flowchart for data processing workflow",
        "Show database schema relationships and connections diagram",
        "Display network topology and infrastructure visualization",
        "Present API integration and service communication flow",
      ];
    }

    // Ensure all prompts include white background and 9:8 ratio
    const enhancedPrompts = prompts.map((prompt) => {
      if (!prompt.includes("white background")) {
        prompt += " with white background";
      }
      if (!prompt.includes("9:8")) {
        prompt += " in 9:8 aspect ratio";
      }
      return prompt;
    });

    logger.info(
      `✅ Generated ${enhancedPrompts.length} image prompts from Groq`
    );
    return enhancedPrompts;
  } catch (error) {
    logger.error("❌ Failed to generate prompts with Groq:", error.message);

    // Fallback prompts
    const fallbackPrompts = [
      "Create technical diagram of system architecture with white background in 9:8 aspect ratio",
      "Illustrate algorithm flowchart for data processing workflow with white background in 9:8 aspect ratio",
      "Show database schema relationships and connections diagram with white background in 9:8 aspect ratio",
      "Display network topology and infrastructure visualization with white background in 9:8 aspect ratio",
      "Present API integration and service communication flow with white background in 9:8 aspect ratio",
    ];

    logger.info("🔄 Using fallback prompts due to Groq error");
    return fallbackPrompts;
  }
};

module.exports = {
  generateImages,
  parseSRTFile,
  createImageChunksFromSubtitles,
  generateImageWithGemini,
  generateImagePromptsWithGroq,
};
