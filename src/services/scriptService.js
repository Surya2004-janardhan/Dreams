const axios = require("axios");
const logger = require("../config/logger");

// Groq API configuration
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const generateScript = async (topic, description = "") => {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is required");
  }

  //   const prompt = `Create a natural, engaging conversation in pure Indian English between Rani (curious female questioner) and Raj (knowledgeable male expert) about: ${topic}

  // ${description ? `Context: ${description}` : ""}

  // Style Requirements:
  // - Pure Indian English with natural expressions like "yaar", "actually", "you know", "see", "basically", "right?", "no yaar", "tell me na"
  // - Sound like real people talking casually, not formal or robotic
  // - Rani asks short, natural questions with Indian English fillers
  // - Raj explains in detail but conversationally, using Indian English phrases
  // - Keep it flowing naturally like a real discussion, not structured Q&A
  // - Make explanations comprehensive but concise to fit 70 seconds with 120-130 words strictly
  // - Include 2-3 exchanges maximum to stay within time limit

  // Format naturally like this:
  // Rani: Hey, can you tell me about [topic]? I've been wondering...
  // Raj: Yaar, [topic] is actually quite interesting. See, basically...
  // Rani: Oh really? But how does it work exactly?
  // Raj: No yaar, let me explain properly. You know...

  // Topic: ${topic}

  // CRITICAL REQUIREMENTS:
  // - Total word count MUST be between 120-130 words exactly
  // - Count every word including "yaar", "actually", etc.
  // - Do not exceed 130 words or go below 120 words
  // - Focus on key technical points while staying conversational
  // - Ensure the conversation feels natural and educational

  // IMPORTANT: Keep total content short enough to be spoken in exactly 120-130 words strictly 70 seconds. Focus on key points with natural Indian English expressions.`;

  const prompt = `Write a natural conversation in pure Indian English between Rani (curious girl) and Raj (knowledgeable guy) about: ${topic}

${description ? `Context: ${description}` : ""}

Tone & Style:
- Use casual Indian English with fillers like "yaar", "actually", "you know", "see", "basically", "right?", "no yaar", "tell me na"
- Conversation should sound natural, like two friends talking
- Rani asks short, curious questions with Indian English fillers
- Raj gives clear, detailed explanations but in a friendly conversational way
- Avoid robotic or formal tone; keep it flowing like real dialogue
- Maximum 2–3 exchanges to fit time
- Total must be 110–120 words (count every single word, including fillers)

Format Example:
Rani: Hey, can you tell me about [topic]? I've been wondering...
Raj: Yaar, [topic] is actually quite interesting. See, basically...
Rani: Oh really? But how does it work exactly?
Raj: No yaar, let me explain properly. You know...

CRITICAL RULES:
- Strictly 110–120 words only
- Must be short enough for ~70 seconds speech
- Cover the key technical points with clarity, not surface-level
- Keep it natural, engaging, and educational in tone`;

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
        max_tokens: 2500,
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

    // Retry up to 3 times if word count is not in range
    let retryCount = 0;
    const maxRetries = 3;

    while ((wordCount < 120 || wordCount > 130) && retryCount < maxRetries) {
      retryCount++;
      logger.warn(
        `⚠️ Script word count ${wordCount} is outside 120-130 range, regenerating... (attempt ${retryCount}/${maxRetries})`
      );

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
              content: `The previous script had ${wordCount} words, which is not between 120-130 words. Please regenerate the exact same conversation but ensure the total word count is strictly between 120-130 words.

Original topic: ${topic}
Original description: ${description}

CRITICAL: Count every single word and ensure total is 120-130 words exactly. Do not add or remove content, just adjust the conversation length to meet the word count requirement.`,
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

      if (newWordCount >= 120 && newWordCount <= 130) {
        logger.info(`✅ Word count now within range: ${newWordCount} words`);
        break;
      }
    }

    if (retryCount >= maxRetries) {
      logger.warn(
        `⚠️ Could not achieve target word count after ${maxRetries} retries. Final count: ${wordCount}`
      );
    }

    return script;
  } catch (error) {
    logger.error(
      "Script generation error:",
      error.response?.data || error.message
    );
    throw new Error("Failed to generate script");
  }
};

module.exports = {
  generateScript,
};
