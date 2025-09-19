const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");

// Groq API configuration
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 */
const generateImageWithGemini = async (prompt, index, apiKey) => {
  try {
    logger.info(`🎨 Generating image ${index} with Gemini...`);
    logger.info(`🔑 Using API key ending with: ...${apiKey.slice(-10)}`);
    logger.info(`📝 Prompt: ${prompt.substring(0, 100)}...`);

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
    console.log("SRT Content:", content);
    const segments = [];
    const blocks = content.split("\n\n").filter((block) => block.trim());
    console.log("Blocks found:", blocks.length);

    blocks.forEach((block, index) => {
      console.log(`Block ${index}:`, block);
      const lines = block.split("\n").filter((line) => line.trim());
      console.log(`Lines in block ${index}:`, lines.length, lines);
      if (lines.length >= 3) {
        // Skip the sequence number (first line)
        const timestampLine = lines[1];
        const textLines = lines.slice(2);

        // Parse timestamp line: "00:00:01,500 --> 00:00:04,200"
        const timestampMatch = timestampLine.match(
          /(\d{2}):(\d{2}):(\d{2}),(\d{3}) --> (\d{2}):(\d{2}):(\d{2}),(\d{3})/
        );
        console.log(`Timestamp match for block ${index}:`, timestampMatch);
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
    throw new Error(`Failed to parse SRT file: ${error.message}`);
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
const generateImages = async (subtitlesPath, scriptContent = null) => {
  try {
    logger.info(
      "🖼️ Starting image generation using subtitle timing and Groq prompts..."
    );
    logger.info(`📝 Subtitles path: ${subtitlesPath}`);

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

    // Step 2: Generate image prompts using Groq with subtitle content or script
    let imagePrompts;
    if (subtitlesPath) {
      logger.info("🤖 Generating prompts using Groq with subtitle content...");

      // Extract all subtitle text for prompt generation
      let allSubtitleText = "";
      try {
        const subtitleSegments = parseSRTFile(subtitlesPath);
        allSubtitleText = subtitleSegments.map((seg) => seg.text).join(" ");
        logger.info(
          `📝 Successfully parsed ${subtitleSegments.length} subtitle segments`
        );
      } catch (parseError) {
        logger.warn(
          "⚠️ SRT parsing failed, trying to read raw subtitle file content..."
        );
        // Fallback: try to read the raw subtitle file content
        try {
          allSubtitleText = fs.readFileSync(subtitlesPath, "utf8");
          logger.info("📝 Using raw subtitle file content as fallback");
        } catch (readError) {
          logger.error("❌ Failed to read subtitle file:", readError.message);
          throw new Error(`Cannot read subtitle content: ${readError.message}`);
        }
      }

      logger.info(
        `📝 Subtitle content length: ${allSubtitleText.length} characters`
      );

      if (!allSubtitleText || allSubtitleText.trim().length === 0) {
        throw new Error("No subtitle content found to generate prompts from");
      }

      imagePrompts = await generateImagePromptsWithGroq(allSubtitleText);

      if (!imagePrompts || imagePrompts.length === 0) {
        throw new Error(
          "Failed to generate image prompts from subtitle content"
        );
      }

      logger.info(
        `✅ Generated ${imagePrompts.length} prompts from subtitles:`,
        imagePrompts
      );
    } else if (scriptContent) {
      logger.info("🤖 Generating prompts using Groq with script content...");
      logger.info(
        `📝 Script content length: ${scriptContent.length} characters`
      );

      if (!scriptContent || scriptContent.trim().length === 0) {
        throw new Error("No script content provided to generate prompts from");
      }

      imagePrompts = await generateImagePromptsWithGroq(scriptContent);

      if (!imagePrompts || imagePrompts.length === 0) {
        throw new Error("Failed to generate image prompts from script content");
      }

      logger.info(
        `✅ Generated ${imagePrompts.length} prompts from script:`,
        imagePrompts
      );
    } else {
      throw new Error(
        "No subtitle file or script content provided for image prompt generation"
      );
    }

    const generatedImages = [];
    let successCount = 0;

    // Step 3: Generate images for each chunk using Groq prompts
    for (let i = 0; i < imageChunks.length; i++) {
      const chunk = imageChunks[i];
      try {
        // Use the corresponding Groq-generated prompt
        if (i >= imagePrompts.length) {
          throw new Error(
            `No prompt available for chunk ${i + 1} - only ${
              imagePrompts.length
            } prompts generated`
          );
        }
        const imagePrompt = imagePrompts[i];

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
    logger.error("❌ Image generation failed:", {
      error: error.message,
      stack: error.stack,
      subtitlesPath: subtitlesPath,
      contentLength: scriptContent ? scriptContent.length : 0,
      timestamp: new Date().toISOString(),
    });
    throw new Error(`Image generation failed: ${error.message}`);
  }
};

/**
 * Generate 5 concise image prompts using Groq based on the full script
 */
const generateImagePromptsWithGroq = async (content) => {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY environment variable is required");
    }

    logger.info("🤖 Generating image prompts using Groq...");

    const prompt = `From the content below, generate 5 concise image prompts for technical diagrams.

CONTENT:
${content}

RULES:
- Exactly 5 prompts
- Each under 20 words
- Only diagrammatic/technical terms from content
- White background
- Strictly 9:8 aspect ratio
- Professional technical style
✅ Good Types of Images for Edu  Content:

Infographic Snippets – minimal icons + labels (like memory, CPU, network, DB).

Minimal UI Mockups – simplified boxes showing “how software works” without real UI clutter.

OUTPUT:
Return only a JSON array of 5 strings.`;

    const response = await axios.post(
      GROQ_API_URL,
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "You are an expert at creating concise, technical image prompts for educational content. Focus on technical terms. Always return valid JSON arrays.",
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

    const responseContent = response.data.choices[0].message.content.trim();
    logger.info("📝 Groq generated prompts response:", responseContent);

    // Parse the JSON response
    let prompts;
    try {
      // Remove any markdown formatting if present
      const cleanContent = responseContent
        .replace(/```json\s*|\s*```/g, "")
        .trim();
      prompts = JSON.parse(cleanContent);
    } catch (parseError) {
      logger.error(
        "❌ Failed to parse Groq response as JSON:",
        parseError.message
      );
      logger.error("Raw response content:", responseContent);
      throw new Error(
        `Failed to parse image prompts from Groq response: ${parseError.message}`
      );
    }

    if (!Array.isArray(prompts) || prompts.length !== 5) {
      logger.error(
        "❌ Invalid prompts format - expected array of 5 strings, got:",
        prompts
      );
      throw new Error(
        `Invalid prompts format from Groq - expected 5 prompts, got ${
          Array.isArray(prompts) ? prompts.length : "non-array"
        }`
      );
    }

    // Validate each prompt is a string
    for (let i = 0; i < prompts.length; i++) {
      if (typeof prompts[i] !== "string" || prompts[i].trim().length === 0) {
        logger.error(`❌ Invalid prompt at index ${i}:`, prompts[i]);
        throw new Error(
          `Invalid prompt at index ${i} - must be non-empty string`
        );
      }
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
    logger.error("❌ Failed to generate prompts with Groq:", {
      error: error.message,
      stack: error.stack,
      apiResponse: error.response?.data,
      contentLength: content?.length || 0,
      timestamp: new Date().toISOString(),
    });
    throw new Error(
      `Failed to generate image prompts with Groq: ${error.message}`
    );
  }
};

module.exports = {
  generateImages,
  parseSRTFile,
  createImageChunksFromSubtitles,
  generateImageWithGemini,
  generateImagePromptsWithGroq,
};
