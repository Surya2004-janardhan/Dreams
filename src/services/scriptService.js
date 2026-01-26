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

  const prompt = `Create a compelling educational video script for: ${topic}

${description ? `Additional Context: ${description}` : ""}

VIDEO SCRIPT REQUIREMENTS:
- Single expert narrator explaining the topic conversationally
- Use natural Indian English with expressions like "yaar", "actually", "see", "you know", "right?", "na", "basically", "tell me"
- Structure: Introduction → Key concepts → Examples → Conclusion
- Educational depth: Explain technical concepts accessibly but accurately
- Engaging tone: Like explaining to a curious friend who wants to learn
- Word count: STRICTLY 110-120 words (this fits ~60-70 seconds of speech)
- Flow: Natural progression that builds understanding step by step

EXAMPLE STRUCTURE:
"Actually yaar, let me break down artificial intelligence for you. See, AI is basically computer systems that can learn and make decisions like humans do. You know, it uses complex algorithms and massive amounts of data to recognize patterns we might miss. Right now, we're seeing AI in self-driving cars, medical diagnosis, and even creative work like writing and art. But na, the real magic happens with machine learning and neural networks that process information in incredible ways. Tell me, it's transforming healthcare, education, and so many fields!"

OUTPUT: Only the script text, no formatting, no speaker labels, no extra comments. Just the continuous explanation that will be converted to speech and video.`;

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
      model: "llama-3.1-8b-instant", // Using current Groq model
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
    const maxRetries = 3;

    while ((wordCount < 105 || wordCount > 120) && retryCount < maxRetries) {
      retryCount++;
      logger.warn(
        `⚠️ Script word count ${wordCount} is outside 110-120 range, retrying... (attempt ${retryCount}/${maxRetries})`,
      );

      // Wait 66 seconds before retry
      logger.info(`⏳ Waiting 66 seconds before retry ${retryCount}...`);
      await new Promise((resolve) => setTimeout(resolve, 66000));

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
          model: "llama-3.1-8b-instant",
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

module.exports = {
  generateScript,
};
