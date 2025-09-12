const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");

/**
 * Generate image using Gemini API
 */
const generateImageWithGemini = async (prompt, index) => {
  try {
    logger.info(`🎨 Generating image ${index} with Gemini...`);

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY_FOR_IMAGES,
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: prompt,
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.text) {
        logger.info(`Gemini response text: ${part.text}`);
      } else if (part.inlineData) {
        const imageData = part.inlineData.data;
        const buffer = Buffer.from(imageData, "base64");

        const imagePath = path.resolve(
          `images/gemini_image_${index}_${Date.now()}.png`
        );
        fs.writeFileSync(imagePath, buffer);

        logger.info(`✅ Image ${index} saved: ${imagePath}`);
        return imagePath;
      }
    }

    throw new Error("No image data received from Gemini");
  } catch (error) {
    logger.error(`❌ Failed to generate image ${index}:`, error.message);

    // Create a simple fallback image
    try {
      const imagePath = path.resolve(
        `images/fallback_image_${index}_${Date.now()}.png`
      );
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
          /(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/
        );
        if (timestampMatch) {
          const startTimeStr = timestampMatch[1];
          const endTimeStr = timestampMatch[2];

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
  const chunks = [];
  const chunkDuration = totalDuration / 5; // ~14 seconds each (70/5 = 14)

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
 * Generate contextual educational images using subtitle timing
 */
const generateImages = async (subtitlesPath) => {
  try {
    logger.info("🖼️ Starting image generation using subtitle timing...");

    // Step 1: Parse SRT file
    const subtitleSegments = parseSRTFile(subtitlesPath);
    if (subtitleSegments.length === 0) {
      logger.warn("⚠️ No subtitle segments found, cannot generate images");
      return [];
    }

    // Step 2: Create 5 equal chunks from subtitles
    const imageChunks = createImageChunksFromSubtitles(subtitleSegments);

    // Ensure images directory exists
    if (!fs.existsSync("images")) {
      fs.mkdirSync("images", { recursive: true });
    }

    const generatedImages = [];
    let successCount = 0;

    // Step 3: Generate images for each chunk
    for (const chunk of imageChunks) {
      try {
        if (!chunk.text || chunk.text.trim().length === 0) {
          logger.warn(
            `⚠️ Chunk ${chunk.index} has no text content, skipping image generation`
          );
          continue;
        }

        // Create educational image prompt based on subtitle text
        const imagePrompt = `Educational illustration for video content:

Context from conversation: "${chunk.text}"

Create a clean, professional educational image that visually represents the concepts being discussed in this part of the conversation. The image should:

- Be suitable for 16:9 video overlay
- Use bright, engaging colors for learning
- Have clear visual hierarchy
- Focus on visual explanation rather than text
- Be modern and appealing for social media
- Represent the key educational concepts from the conversation
- Have high contrast for good video visibility

Style: Educational, professional, engaging, modern design`;

        logger.info(
          `🎨 Generating image ${
            chunk.index
          }/5 for time ${chunk.startTime.toFixed(1)}-${chunk.endTime.toFixed(
            1
          )}s`
        );
        logger.info(
          `📝 Context: "${chunk.text.substring(0, 100)}${
            chunk.text.length > 100 ? "..." : ""
          }"`
        );

        // Generate image using Gemini
        const imagePath = await generateImageWithGemini(
          imagePrompt,
          chunk.index
        );

        const imageInfo = {
          index: chunk.index,
          filename: imagePath,
          concept: `Educational illustration for segment ${chunk.index}`,
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
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (imageError) {
        logger.error(
          `❌ Failed to generate image ${chunk.index}:`,
          imageError.message
        );
        // Continue with next chunk
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

module.exports = {
  generateImages,
  parseSRTFile,
  createImageChunksFromSubtitles,
};
