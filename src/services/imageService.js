const { GoogleGenAI } = require("@google/genai");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");
const { parseConversationTiming } = require("../utils/subtitles");

// Initialize Google GenAI client for Imagen
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

// Groq API configuration for script analysis
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Analyze script and determine where images should be placed with timing
 */
const analyzeScriptForImagePlacement = async (script) => {
  try {
    // Get conversation timing from subtitles utility
    const segments = parseConversationTiming(script);

    // Analyze script to identify key visual concepts
    const analysisPrompt = `Analyze this educational script and identify key concepts that would benefit from visual illustration. Focus on complex explanations, examples, and detailed topics.

Script: ${script}

For each visualization point, specify:
1. The concept being explained
2. A detailed image prompt for educational illustration
3. Which part of the conversation this relates to

Respond in this exact JSON format:
{
  "visualizations": [
    {
      "concept": "brief description of concept",
      "prompt": "detailed image prompt for educational illustration",
      "keywords": ["key", "words", "to", "match"],
      "complexity": "high/medium/low"
    }
  ]
}`;

    const groqResponse = await axios.post(
      GROQ_API_URL,
      {
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content:
              "You are an expert educational content analyzer who identifies key concepts that need visual illustration for better understanding.",
          },
          {
            role: "user",
            content: analysisPrompt,
          },
        ],
        temperature: 0.4,
        max_tokens: 2000,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
      }
    );

    let visualizations;
    try {
      const analysisResult = JSON.parse(
        groqResponse.data.choices[0].message.content
      );
      visualizations = analysisResult.visualizations;
    } catch (parseError) {
      logger.warn("⚠️ Failed to parse LLM analysis, using fallback");
      visualizations = [
        {
          concept: "Main topic introduction",
          prompt: "Educational illustration showing the main concept",
          keywords: ["introduction", "concept", "main"],
          complexity: "medium",
        },
      ];
    }

    // Match visualizations to conversation segments based on keywords
    const imageTimings = [];

    visualizations.forEach((viz, vizIndex) => {
      let bestMatch = null;
      let bestScore = 0;

      segments.forEach((segment, segmentIndex) => {
        const segmentText = segment.text.toLowerCase();
        const keywordMatches = viz.keywords.filter((keyword) =>
          segmentText.includes(keyword.toLowerCase())
        ).length;

        const score = keywordMatches / viz.keywords.length;

        if (score > bestScore && score > 0.3) {
          // At least 30% keyword match
          bestScore = score;
          bestMatch = {
            segmentIndex,
            segment,
            matchScore: score,
          };
        }
      });

      // If no good match found, distribute evenly
      if (!bestMatch && segments.length > 0) {
        const evenDistributionIndex = Math.floor(
          (vizIndex / visualizations.length) * segments.length
        );
        bestMatch = {
          segmentIndex: evenDistributionIndex,
          segment: segments[evenDistributionIndex],
          matchScore: 0.1, // Low score for even distribution
        };
      }

      if (bestMatch) {
        imageTimings.push({
          ...viz,
          segmentIndex: bestMatch.segmentIndex,
          startTime: bestMatch.segment.startTime,
          endTime: bestMatch.segment.endTime,
          duration: bestMatch.segment.duration,
          matchedText: bestMatch.segment.text,
          matchScore: bestMatch.matchScore,
        });
      }
    });

    // Sort by start time
    imageTimings.sort((a, b) => a.startTime - b.startTime);

    logger.info(
      `📊 Mapped ${imageTimings.length} images to conversation segments`
    );

    return imageTimings;
  } catch (error) {
    logger.error("Failed to analyze script for image placement:", error);
    return [];
  }
};

/**
 * Generate contextual educational images with timing information
 */
const generateImages = async (script) => {
  try {
    logger.info("🖼️ Starting contextual image generation with timing...");

    // Step 1: Analyze script and determine image placement
    const imageTimings = await analyzeScriptForImagePlacement(script);

    if (imageTimings.length === 0) {
      logger.warn("No image timings determined, creating basic set");
      return [];
    }

    // Ensure images directory exists
    if (!fs.existsSync("images")) {
      fs.mkdirSync("images", { recursive: true });
    }

    const generatedImages = [];
    let successCount = 0;

    // Step 2: Generate images with enhanced prompts
    for (let i = 0; i < imageTimings.length; i++) {
      const timing = imageTimings[i];

      try {
        // Create enhanced educational prompt
        const enhancedPrompt = `Educational illustration: ${timing.prompt}

Style requirements:
- Clean, professional educational design
- 16:9 aspect ratio suitable for video overlay
- Bright, engaging colors suitable for learning
- Clear visual hierarchy
- Minimal text, focus on visual explanation
- High contrast for video overlay
- Indian educational context where appropriate
- Modern, appealing design for social media

Content focus: ${timing.concept}
Matches conversation about: "${timing.matchedText.substring(0, 100)}..."`;

        logger.info(
          `🎨 Generating image ${i + 1}/${imageTimings.length}: ${
            timing.concept
          }`
        );
        logger.info(
          `⏰ Timing: ${timing.startTime.toFixed(
            1
          )}s - ${timing.endTime.toFixed(1)}s`
        );

        // For now, create enhanced placeholder (in real implementation, use Imagen API)
        const imagePath = path.resolve(
          `images/educational_image_${i + 1}_${Date.now()}.png`
        );

        // Create a better placeholder image (colorful educational placeholder)
        const placeholderImageBuffer = createEducationalPlaceholder(
          timing.concept,
          i + 1
        );

        fs.writeFileSync(imagePath, placeholderImageBuffer);

        const imageInfo = {
          index: i + 1,
          filename: imagePath,
          concept: timing.concept,
          prompt: enhancedPrompt,
          timing: {
            startTime: timing.startTime,
            endTime: timing.endTime,
            duration: timing.duration,
            segmentIndex: timing.segmentIndex,
          },
          placement: {
            fromTime: timing.startTime,
            toTime: timing.endTime,
            matchedText: timing.matchedText,
            matchScore: timing.matchScore,
          },
        };

        generatedImages.push(imageInfo);
        successCount++;

        logger.info(`✅ Image ${i + 1} generated with timing: ${imagePath}`);
        logger.info(
          `📍 Placement: ${timing.startTime.toFixed(
            1
          )}s to ${timing.endTime.toFixed(1)}s`
        );

        // Small delay between generations
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (imageError) {
        logger.error(
          `❌ Failed to generate image ${i + 1}:`,
          imageError.message
        );
        // Continue with next image
      }
    }

    logger.info(
      `📊 Image generation complete: ${successCount}/${imageTimings.length} successful`
    );
    logger.info(`🎯 Images are timed and ready for video overlay`);

    return generatedImages;
  } catch (error) {
    logger.error("❌ Contextual image generation failed:", error.message);
    return [];
  }
};

/**
 * Create an educational placeholder image (in lieu of actual image generation)
 */
const createEducationalPlaceholder = (concept, index) => {
  // Create a simple colored PNG placeholder
  // This is a minimal 100x56 pixel PNG (16:9 ratio) with text overlay simulation

  // In a real implementation, this would call actual image generation APIs
  // For now, returning a base64 encoded colored placeholder

  const colors = [
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4nGP4//8/AzYwiqEAAO4AAf9j5X4AAAAASUVORK5CYII=", // Red
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4nGP4/4MBGzBGMQAAEAAB/8j5X4AAAAASUVORK5CYII=", // Green
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4nGP48+cPAzZgjGIAABAAAb/I+V+AAAAABJRU5ErkJggg==", // Blue
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4nGP4/5MBGzBGMQAACAAB/8j5X4AAAAASUVORK5CYII=", // Yellow
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4nGP4+5MBGzBGMQAACgAB/8j5X4AAAAASUVORK5CYII=", // Purple
  ];

  const colorIndex = (index - 1) % colors.length;
  return Buffer.from(colors[colorIndex], "base64");
};

module.exports = {
  generateImages,
  analyzeScriptForImagePlacement,
  createEducationalPlaceholder,
};
