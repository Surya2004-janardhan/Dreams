const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require("axios");

// Gemini API configuration
// const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

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
        aspectRatio: "9:8", // 9:8 aspect ratio for portrait orientation
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

    // Use default image from videos folder as fallback
    try {
      const defaultImagePath = path.resolve("videos/default-image.jpg");
      const fallbackImagePath = path.resolve(`images/fallback${index}.jpg`);

      // Check if default image exists
      if (fs.existsSync(defaultImagePath)) {
        // Copy the default image to images folder
        fs.copyFileSync(defaultImagePath, fallbackImagePath);
        logger.info(
          `✅ Fallback image ${index} created from default: ${fallbackImagePath}`
        );
        return fallbackImagePath;
      } else {
        logger.warn(
          `⚠️ Default image not found at ${defaultImagePath}, creating minimal fallback`
        );
        // Fallback to minimal PNG if default image doesn't exist
        const minimalPNG = Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
          0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
          0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
          0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0x99, 0x01,
          0x01, 0x00, 0x00, 0x00, 0xff, 0xff, 0x00, 0x00, 0x00, 0x02, 0x00,
          0x01, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42,
          0x60, 0x82,
        ]);
        fs.writeFileSync(fallbackImagePath, minimalPNG);
        logger.info(
          `✅ Minimal fallback image ${index} created: ${fallbackImagePath}`
        );
        return fallbackImagePath;
      }
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
 * Extract 10 most important technical terms from content using Gemini
 */
const extractTechnicalTerms = async (content) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY_FOR_T2T;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY_FOR_T2T environment variable is required"
      );
    }

    logger.info("🔍 Extracting technical terms using Gemini...");

    const prompt = `Analyze this educational content and extract exactly 5 of the most important technical terms or concepts.

CONTENT:
${content}

RULES:
- Extract exactly 5 technical terms/concepts
- Focus on specific technologies, tools, frameworks, or methodologies
- Prefer concrete terms over abstract concepts
- Include company names, software names, or technical standards
- Return only a JSON array of 5 strings
- Each term should be 1-3 words maximum

OUTPUT FORMAT:
["Term1", "Term2", "Term3", "Term4", "Term5"]`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: `You are an expert at identifying key technical terms from educational content. Focus on specific, actionable technical terms that would be recognizable to developers and IT professionals.

${prompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          topK: 10,
          topP: 0.5,
          maxOutputTokens: 256,
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
    logger.info("📝 Technical terms extraction response:", responseContent);

    // Parse the JSON response
    let terms;
    try {
      const cleanContent = responseContent
        .replace(/```json\s*|\s*```/g, "")
        .trim();
      terms = JSON.parse(cleanContent);
    } catch (parseError) {
      logger.error("❌ Failed to parse technical terms:", parseError.message);
      // Fallback: extract basic terms manually
      const fallbackTerms = [
        "Technology",
        "Software",
        "Development",
        "System",
        "Process",
      ];
      logger.info("🔄 Using fallback terms:", fallbackTerms);
      return fallbackTerms;
    }

    if (!Array.isArray(terms) || terms.length !== 5) {
      logger.warn("⚠️ Invalid terms format, using fallback");
      return ["Technology", "Software", "Development", "System", "Process"];
    }

    logger.info(
      `✅ Extracted ${technicalTerms.length} technical terms: ${technicalTerms}`
    );
    return terms;
  } catch (error) {
    logger.error("❌ Technical terms extraction failed:", error.message);
    // Return fallback terms
    return ["Technology", "Software", "Development", "System", "Process"];
  }
};

/**
 * Generate simple white background image prompts using extracted terms
 */
const generateSimpleImagePrompts = async (technicalTerms) => {
  try {
    const prompts = [];

    for (let i = 0; i < technicalTerms.length; i++) {
      const term = technicalTerms[i];

      const prompt = `Create a detailed, professional image prompt for the technical concept "${term}" that would be perfect for an educational video.

Requirements:
- Focus on clean, professional design
- White or very light background
- Include visual elements that represent the concept
- Make it suitable for technical education
- Keep it concise but descriptive
- Avoid text overlays, use visual metaphors
- Image must be in 9:8 aspect ratio (portrait orientation)
- Important elements should be positioned in the top 45% of the image only
- Leave bottom 55% relatively empty for video overlay text
- Ensure main visual content stays within the upper portion

Example style: "Clean white background with a stylized 3D network diagram showing interconnected nodes representing ${term}, professional blue and green color scheme, minimal design, 9:8 aspect ratio, main elements positioned in top 45% of image"

Create a prompt for: ${term}`;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY not found");
      }

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
            temperature: 0.7,
            topK: 40,
            topP: 0.8,
            maxOutputTokens: 150,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const generatedPrompt =
        response.data.candidates[0].content.parts[0].text.trim();
      prompts.push(generatedPrompt);
      logger.info(
        `🎨 Generated prompt ${
          i + 1
        } for "${term}": ${generatedPrompt.substring(0, 80)}...`
      );
    }

    logger.info(
      `🎨 Successfully generated ${prompts.length} LLM-crafted image prompts`
    );
    return prompts;
  } catch (error) {
    logger.error("❌ LLM prompt generation failed:", error.message);
    // Fallback to simple prompts
    const fallbackPrompts = technicalTerms.map(
      (term) =>
        `Clean white background with professional illustration representing ${term}, minimal design, educational style, 9:8 aspect ratio`
    );
    logger.info("🔄 Using fallback prompts:", fallbackPrompts);
    return fallbackPrompts;
  }
};

/**
 * Create dynamic image chunks based on when technical terms appear in subtitles
 */
const createDynamicImageChunksFromTerms = (
  technicalTerms,
  subtitleSegments,
  actualDuration = 70
) => {
  const imageChunks = [];

  // Find appearance times for each technical term
  const termAppearances = [];

  technicalTerms.forEach((term, index) => {
    const appearances = [];

    subtitleSegments.forEach((segment, segmentIndex) => {
      // Check if the term appears in this subtitle segment (case-insensitive)
      if (segment.text.toLowerCase().includes(term.toLowerCase())) {
        appearances.push({
          startTime: segment.startTime,
          endTime: segment.endTime,
          segmentIndex: segmentIndex,
          text: segment.text,
        });
      }
    });

    termAppearances.push({
      term: term,
      index: index,
      appearances: appearances,
    });

    logger.info(
      `Term "${term}" appears in ${appearances.length} subtitle segments`
    );
  });

  // Create dynamic chunks based on term appearances
  for (let i = 0; i < technicalTerms.length; i++) {
    const termData = termAppearances[i];
    let chunkStart, chunkEnd;

    if (termData.appearances.length > 0) {
      // Use the first appearance of this term as start time
      chunkStart = termData.appearances[0].startTime;

      // Find when the next term appears to determine end time
      if (i < technicalTerms.length - 1) {
        const nextTermData = termAppearances[i + 1];
        if (nextTermData.appearances.length > 0) {
          // End this chunk when the next term starts appearing
          chunkEnd = nextTermData.appearances[0].startTime;
        } else {
          // Next term not found, use a default duration
          chunkEnd = chunkStart + 7; // Default 7 seconds
        }
      } else {
        // Last term, extend to end of video or use remaining time
        chunkEnd = actualDuration;
      }

      // Ensure minimum duration of 3 seconds
      if (chunkEnd - chunkStart < 3) {
        chunkEnd = Math.min(chunkStart + 7, actualDuration);
      }

      // Ensure we don't exceed video duration
      chunkEnd = Math.min(chunkEnd, actualDuration);
    } else {
      // Term not found in subtitles, use fallback timing
      const fallbackStart = (i / technicalTerms.length) * actualDuration;
      chunkStart = fallbackStart;
      chunkEnd = Math.min(fallbackStart + 7, actualDuration);

      logger.warn(
        `Term "${
          termData.term
        }" not found in subtitles, using fallback timing: ${chunkStart.toFixed(
          1
        )}-${chunkEnd.toFixed(1)}s`
      );
    }

    // Collect subtitle text that falls within this dynamic chunk
    const chunkTexts = [];
    subtitleSegments.forEach((segment) => {
      if (segment.startTime < chunkEnd && segment.endTime > chunkStart) {
        chunkTexts.push(segment.text);
      }
    });

    const mergedText = chunkTexts.join(" ").trim();

    imageChunks.push({
      index: i + 1,
      term: termData.term,
      startTime: chunkStart,
      endTime: chunkEnd,
      duration: chunkEnd - chunkStart,
      text: mergedText,
      subtitleCount: chunkTexts.length,
      appearances: termData.appearances.length,
    });

    logger.info(
      `📊 Dynamic Chunk ${i + 1} (${termData.term}): ${chunkStart.toFixed(
        1
      )}s-${chunkEnd.toFixed(1)}s (${chunkTexts.length} segments, ${
        termData.appearances.length
      } appearances)`
    );
  }

  logger.info(
    `📊 Created ${imageChunks.length} dynamic image chunks based on term timing`
  );

  return imageChunks;
};

/**
 * Generate 5 concise image prompts using Gemini based on technical terms
 */
const generateImagePromptsWithGemini = async (content) => {
  try {
    // First, extract technical terms
    const technicalTerms = await extractTechnicalTerms(content);

    // Then generate simple prompts based on those terms
    const prompts = await generateSimpleImagePrompts(technicalTerms);

    return prompts;
  } catch (error) {
    logger.error("❌ Image prompt generation failed:", error.message);
    // Return very simple fallback prompts
    return [
      "Clean white background with technology logo, 9:8 aspect ratio",
      "Simple white background with software icon, 9:8 aspect ratio",
      "Minimal white background with tech diagram, 9:8 aspect ratio",
      "Clean white background with system logo, 9:8 aspect ratio",
      "Simple white background with process diagram, 9:8 aspect ratio",
    ];
  }
};

/**
 * Generate contextual educational images using subtitle timing and Gemini prompts
 */
const generateImages = async (subtitlesPath, scriptContent = null) => {
  try {
    logger.info(
      "🖼️ Starting image generation using subtitle timing and Gemini prompts..."
    );
    logger.info(`📝 Subtitles path: ${subtitlesPath}`);

    // Step 1: Parse SRT file and extract technical terms for dynamic timing
    let imageChunks;
    let technicalTerms = [];
    let subtitleSegments = [];

    if (subtitlesPath) {
      logger.info("📝 Parsing SRT file for dynamic timing...");
      subtitleSegments = parseSRTFile(subtitlesPath);
      logger.info(`📊 Found ${subtitleSegments.length} subtitle segments`);

      if (subtitleSegments.length === 0) {
        logger.warn("⚠️ No subtitle segments found, cannot generate images");
        return [];
      }

      // Extract all subtitle text for term extraction
      const allSubtitleText = subtitleSegments.map((seg) => seg.text).join(" ");

      if (!allSubtitleText || allSubtitleText.trim().length === 0) {
        throw new Error("No subtitle content found to extract terms from");
      }

      // Extract technical terms first
      logger.info("🔍 Extracting technical terms for dynamic timing...");
      technicalTerms = await extractTechnicalTerms(allSubtitleText);
      logger.info(
        `✅ Extracted ${technicalTerms.length} technical terms: ${technicalTerms}`
      );

      // Create dynamic chunks based on term appearances
      imageChunks = [];

      // Calculate actual duration from subtitles if available
      let actualDuration = 70; // Default 70 seconds
      if (subtitleSegments && subtitleSegments.length > 0) {
        const maxEndTime = Math.max(...subtitleSegments.map((s) => s.endTime));
        actualDuration = Math.max(maxEndTime, 70);
      }

      imageChunks = createDynamicImageChunksFromTerms(
        technicalTerms,
        subtitleSegments,
        actualDuration
      );
    } else {
      // Create default chunks without timing for manual workflow
      logger.info(
        "📝 No subtitles provided, creating default chunks for manual workflow"
      );
      imageChunks = [];
      const totalDuration = 70; // 70 seconds default
      const chunkDuration = totalDuration / 5;

      // Generate default technical terms for fallback
      technicalTerms = [
        "Technology",
        "Software",
        "Development",
        "System",
        "Process",
      ];

      for (let i = 0; i < 5; i++) {
        imageChunks.push({
          index: i + 1,
          term: technicalTerms[i],
          startTime: i * chunkDuration,
          endTime: (i + 1) * chunkDuration,
          duration: chunkDuration,
          text: `Segment ${i + 1} of educational content`,
          subtitleCount: 0,
          appearances: 0,
        });
      }
      logger.info(`📊 Created ${imageChunks.length} default image chunks`);
    }

    // Step 2: Generate image prompts using Gemini with subtitle content or script
    let imagePrompts;
    if (subtitlesPath) {
      logger.info(
        "🤖 Generating prompts using Gemini with subtitle content..."
      );

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

      imagePrompts = await generateImagePromptsWithGemini(allSubtitleText);

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
      logger.info("🤖 Generating prompts using Gemini with script content...");
      logger.info(
        `📝 Script content length: ${scriptContent.length} characters`
      );

      if (!scriptContent || scriptContent.trim().length === 0) {
        throw new Error("No script content provided to generate prompts from");
      }

      imagePrompts = await generateImagePromptsWithGemini(scriptContent);

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

    // Step 3: Generate images for each chunk using Gemini prompts
    for (let i = 0; i < imageChunks.length; i++) {
      const chunk = imageChunks[i];
      try {
        // Use the corresponding Gemini-generated prompt
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
          }/10 for time ${chunk.startTime.toFixed(1)}-${chunk.endTime.toFixed(
            1
          )}s`
        );
        logger.info(`📝 Using Gemini prompt: "${imagePrompt}"`);

        // Generate image using Gemini
        const apiKey =
          chunk.index <= 5
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
          concept: `Technical diagram for ${
            chunk.term || `segment ${chunk.index}`
          }`,
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
          filename: `images/fallback${chunk.index}.jpg`,
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

module.exports = {
  generateImages,
  parseSRTFile,
  createImageChunksFromSubtitles,
  createDynamicImageChunksFromTerms,
  extractTechnicalTerms,
  generateSimpleImagePrompts,
  generateImageWithGemini,
  generateImagePromptsWithGemini,
};
