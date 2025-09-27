const axios = require("axios");
const logger = require("../config/logger");

// Gemini API configuration
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

const generateScript = async (topic, description = "") => {
  const apiKey = process.env.GEMINI_API_KEY_FOR_T2T;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY_FOR_T2T environment variable is required");
  }

  const prompt = `Create an engaging educational dialogue in Indian English between Raj (knowledgeable expert) and Rani (curious learner) about: ${topic}

${description ? `Additional Context: ${description}` : ""}

REQUIREMENTS:
- Rani asks very brief, curious questions (1-2 lines each, minimum 5 words maximum 10 words)
- Raj provides detailed, clear, educational answers (most of the content)
- Use authentic Indian English expressions: "yaar", "actually", "see", "you know", "right?", "na", "basically", "tell me"
- Keep conversation natural like friends chatting, not formal or robotic
- Exactly 2-3 exchanges only
- Total word count: STRICTLY 110-120 words
- Focus on deeper technical concepts, not surface-level information
- Output ONLY the dialogue lines, no extra comments or explanations

EXAMPLE FORMAT:
Rani: Yaar, can you explain [topic]?
Raj: Actually, see... [detailed educational explanation with Indian English fillers]
Rani: Oh really? Tell me more na?
Raj: No yaar, its more complex server running inside the docker... [more detailed explanation]

IMPORTANT: Count every word carefully and ensure total is exactly 110-120 words. Make it educational, engaging, and perfect for a 70-second video script.
`;

  try {
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: `You are an expert educational content creator specializing in natural Indian English conversations.\n\n${prompt}`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE",
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    logger.info("✓ Multi-speaker Q&A script generated via Gemini API");
    let script = response.data.candidates[0].content.parts[0].text;

    // Count words and ensure it's within range
    const wordCount = script
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
    logger.info(`📊 Generated script word count: ${wordCount}`);

    // Try up to 3 times to get desired word count
    let retryCount = 0;
    const maxRetries = 3;

    while ((wordCount < 105 || wordCount > 120) && retryCount < maxRetries) {
      retryCount++;
      logger.warn(
        `⚠️ Script word count ${wordCount} is outside 110-120 range, retrying... (attempt ${retryCount}/${maxRetries})`
      );

      try {
        const retryResponse = await axios.post(
          `${GEMINI_API_URL}?key=${apiKey}`,
          {
            contents: [
              {
                parts: [
                  {
                    text: `You are an expert educational content creator specializing in natural Indian English conversations.\n\nThe previous script had ${wordCount} words, which is not between 110-120 words. Please regenerate the exact same conversation but ensure the total word count is strictly between 110-120 words.\n\nOriginal topic: ${topic}\n${
                      description ? `Original description: ${description}` : ""
                    }\n\nCRITICAL: Count every single word and ensure total is 110-120 words exactly. Do not add or remove content, just adjust the conversation length to meet the word count requirement.\n\n${prompt}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 2048,
            },
            safetySettings: [
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
              },
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE",
              },
            ],
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        script = retryResponse.data.candidates[0].content.parts[0].text;
        const newWordCount = script
          .split(/\s+/)
          .filter((word) => word.length > 0).length;
        logger.info(`📊 Retry ${retryCount} word count: ${newWordCount}`);

        if (newWordCount >= 105 && newWordCount <= 120) {
          logger.info(`✅ Word count now within range: ${newWordCount} words`);
          break;
        }
      } catch (retryError) {
        logger.error(`❌ Retry ${retryCount} failed:`, retryError.message);
        // Continue to next retry attempt
      }
    }

    if (retryCount >= maxRetries) {
      const finalWordCount = script
        .split(/\s+/)
        .filter((word) => word.length > 0).length;
      logger.warn(
        `⚠️ Could not achieve target word count after ${maxRetries} retries. Using script with ${finalWordCount} words.`
      );
    }

    return script;
  } catch (error) {
    logger.error("❌ Script generation error:", {
      error: error.message,
      stack: error.stack,
      apiResponse: error.response?.data,
      topic: topic,
      description: description,
      api: "Gemini",
      timestamp: new Date().toISOString(),
    });
    throw new Error(
      `Failed to generate script with Gemini API: ${error.message}`
    );
  }
};

module.exports = {
  generateScript,
};
