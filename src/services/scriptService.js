const Groq = require("groq-sdk");
const logger = require("../config/logger");

// future safer side shift to gen ai sdk instead of raw api calls to models
// use sdk intead for script generation
// import { GoogleGenAI } from "@google/genai";

// const ai = new GoogleGenAI({});

// async function main() {
//   const response = await ai.models.generateContent({
//     model: "gemini-2.5-flash",
//     contents: "Explain how AI works in a few words",
//   });
//   console.log(response.text);
// }

// await main();
// Groq API configuration
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const generateScript = async (topic, description = "") => {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is required");
  }

  const prompt = `Generate a single-speaker educational video script on: ${topic}

${description ? `Context: ${description}` : ""}

TECHNICAL REQUIREMENTS:
- Narration voice: Single expert educator
- Language style: Natural Indian English (include casual discourse markers such as "yaar", "actually", "see", "you know", "right?", "na", "basically", "tell me")
- Structure order (strict):
  1. Hook (attention-grabbing opening)
  2. Core concept explanation (clear and logically sequenced)
  3. Practical examples or real-world applications
  4. Concluding impact statement
- Educational depth: Simplify complex concepts without losing factual accuracy
- Word count constraint: STRICTLY between 110 and 120 words
- Flow requirement: Smooth cognitive progression; each sentence must build on the previous one
- Tone: Enthusiastic teacher addressing curious learners
- Clarity: Optimized for speech synthesis and accurate subtitle generation

OUTPUT RULES:
- Return ONLY the raw script text
- No headings, labels, formatting, or metadata
- No timestamps
- No extra commentary
- Must strictly stay within 110–120 words`;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "You are an expert educational content creator specializing in natural Indian English explanations.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama-3.3-70b-versatile", // Using available Groq model
      temperature: 0.8,
      max_tokens: 2048,
      top_p: 0.95,
    });

    logger.info("✓ Multi-speaker Q&A script generated via Groq API");
    let script = chatCompletion.choices[0].message.content;

    // Count words and ensure it's within range
    const wordCount = script
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
    logger.info(`📊 Generated script word count: ${wordCount}`);

    // Try up to 3 times to get desired word count
    let retryCount = 0;
    const maxRetries = 1;

    while ((wordCount < 105 || wordCount > 120) && retryCount < maxRetries) {
      retryCount++;
      logger.warn(
        `⚠️ Script word count ${wordCount} is outside 110-120 range, retrying... (attempt ${retryCount}/${maxRetries})`,
      );

      // Wait 66 seconds before retry
      logger.info(`⏳ Waiting 66 seconds before retry ${retryCount}...`);
      await new Promise((resolve) => setTimeout(resolve, 6000));

      try {
        const retryChatCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: "system",
              content:
                "You are an expert educational content creator specializing in natural Indian English explanations.",
            },
            {
              role: "user",
              content: `The previous explanation had ${wordCount} words, which is not between 110-120 words. Please regenerate the exact same explanation but ensure the total word count is strictly between 110-120 words.\n\nOriginal topic: ${topic}\n${
                description ? `Original description: ${description}` : ""
              }\n\nCRITICAL: Count every single word and ensure total is 110-120 words exactly. Do not add or remove content, just adjust the explanation length to meet the word count requirement.\n\n${prompt}`,
            },
          ],
          model: "llama-3.3-70b-versatile",
          temperature: 0.7,
          max_tokens: 2048,
          top_p: 0.95,
        });

        script = retryChatCompletion.choices[0].message.content;
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
        `⚠️ Could not achieve target word count after ${maxRetries} retries. Using script with ${finalWordCount} words.`,
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
      api: "Groq",
      timestamp: new Date().toISOString(),
    });
    throw new Error(
      `Failed to generate script with Groq API: ${error.message}`,
    );
  }
};

const generateVisualPrompt = async (script) => {
    const prompt = `
    Based on the following video script, describe a Visual Style and Motion Graphics Concept in exactly 3 lines.
    Focus on colors, shapes, and movement. Do NOT describe the speaker. Focus on the overlay graphics.
    
    SCRIPT:
    "${script}"
    
    OUTPUT RULES:
    - 3 lines only.
    - Concise and descriptive.
    `;
    
    try {
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
        });
        const visualDescription = completion.choices[0].message.content;
        logger.info("✓ Visual prompt generated via Groq");
        return visualDescription;
    } catch (e) {
        logger.error("Failed to generate visual prompt", e);
        return "Neon aesthetic, dynamic data pulse, cybernetic overlays.";
    }
};

module.exports = {
  generateScript,
  generateVisualPrompt
};
