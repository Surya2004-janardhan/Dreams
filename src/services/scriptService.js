const axios = require("axios");
const logger = require("../config/logger");

// Groq API configuration
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const generateScript = async (topic, description = "") => {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is required");
  }

  //   const prompt = `Write a natural conversation in pure Indian English between Rani (curious girl) and Raj (knowledgeable guy) about: ${topic}

  // ${description ? `Context: ${description}` : ""}

  // Tone & Style:
  // - Use casual Indian English with fillers like "yaar", "actually", "you know", "see", "basically", "right?", "no yaar", "tell me na"
  // - Conversation should sound natural, like two friends talking
  // - Rani asks short, curious questions with Indian English fillers
  // - Raj gives clear, detailed explanations but in a friendly conversational way
  // - Avoid robotic or formal tone; keep it flowing like real dialogue
  // - Maximum 2–3 exchanges to fit time
  // - Total must be 110–120 words (count every single word, including fillers)

  // Format Example:
  // Rani: Hey, can you tell me about [topic]? I've been wondering...
  // Raj: Yaar, [topic] is actually quite interesting. See, basically...
  // Rani: Oh really? But how does it work exactly?
  // Raj: No yaar, let me explain properly. You know...

  // CRITICAL RULES:
  // - Strictly 110–120 words only
  // - Must be short enough for ~70 seconds speech
  // - Cover the key technical points with clarity, not surface-level
  // - Keep it natural, engaging, and educational in tone`;
  const prompt = `Write a dialogue in Indian English between Raj and Rani on: ${topic}

${description ? `Context: ${description}` : ""}

Guidelines:
- Rani: very short, curious questions only (1–2 lines each, max 10 words).
- Raj: detailed, clear, friendly answers (bulk of word count).
- Style: casual Indian English with natural fillers ("yaar", "actually", "see", "you know", "right?", "na").
- Keep flow like two friends chatting, not robotic.
- 2–3 exchanges only.
- Strictly 120–130 words total.
- Cover deeper, essential technical points (avoid surface-level talk).
- Output ONLY dialogue lines, no extra comments or thanks.

Format Example:
Rani: Yaar, can you tell me about [topic]?
Raj: Actually, see... [detailed explanation]`;


  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "You are an expert educational content creator who specializes in creating natural, engaging conversations in pure Indian English between Rani (curious female questioner) and Raj (knowledgeable male expert). Focus on clear, content-oriented explanations that are purely educational and informative. Use authentic Indian English expressions like 'yaar', 'actually', 'you know', 'see', 'basically', 'right?', 'no yaar', 'tell me na'. Make it sound like real people talking casually, not formal or robotic. Keep total speaking time to exactly 70 seconds.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 2800,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    logger.info("✓ Multi-speaker Q&A script generated via Groq API");
    let script = response.data.choices[0].message.content;

    // Count words and ensure it's within range
    const wordCount = script
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
    logger.info(`📊 Generated script word count: ${wordCount}`);

    // Try up to 3 times to get desired word count
    let retryCount = 0;
    const maxRetries = 3;

    while ((wordCount < 110 || wordCount > 130) && retryCount < maxRetries) {
      retryCount++;
      logger.warn(
        `⚠️ Script word count ${wordCount} is outside 110-130 range, retrying... (attempt ${retryCount}/${maxRetries})`
      );

      try {
        const retryResponse = await axios.post(
          GROQ_API_URL,
          {
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content:
                  "You are an expert educational content creator who specializes in creating natural, engaging conversations in pure Indian English between Rani (curious female questioner) and Raj (knowledgeable male expert). Focus on clear, content-oriented explanations that are purely educational and informative. Use authentic Indian English expressions like 'yaar', 'actually', 'you know', 'see', 'basically', 'right?', 'no yaar', 'tell me na'. Make it sound like real people talking casually, not formal or robotic. Keep total speaking time to exactly 70 seconds.",
              },
              {
                role: "user",
                content: `The previous script had ${wordCount} words, which is not between 110-130 words. Please regenerate the exact same conversation but ensure the total word count is strictly between 110-130 words.

Original topic: ${topic}
Original description: ${description}

CRITICAL: Count every single word and ensure total is 110-130 words exactly. Do not add or remove content, just adjust the conversation length to meet the word count requirement.`,
              },
            ],
            temperature: 0.8,
            max_tokens: 2500,
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
          }
        );

        script = retryResponse.data.choices[0].message.content;
        const newWordCount = script
          .split(/\s+/)
          .filter((word) => word.length > 0).length;
        logger.info(`📊 Retry ${retryCount} word count: ${newWordCount}`);

        if (newWordCount >= 110 && newWordCount <= 130) {
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
      timestamp: new Date().toISOString(),
    });
    throw new Error(`Failed to generate script: ${error.message}`);
  }
};

module.exports = {
  generateScript,
};
