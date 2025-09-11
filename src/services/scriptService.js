const axios = require("axios");
const logger = require("../config/logger");

// Groq API configuration
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const generateScript = async (topic, description = "") => {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is required");
  }

  const prompt = `Create an engaging educational conversation between a curious female questioner (Speaker A) and a knowledgeable male expert (Speaker B) about: ${topic}

${description ? `Context: ${description}` : ""}

Requirements:
- Indian English conversation style
- Female (Speaker A) asks concise, thoughtful questions (keeps responses shorter)
- Male (Speaker B) provides detailed, in-depth explanations with examples
- Each answer should be comprehensive but conversational, not surface-level
- Include interesting facts, real-world applications, and engaging details
- Make it sound natural and spontaneous, not scripted
- Total duration when spoken: 60-90 seconds
- Format: Q&A style but flowing naturally

Make the expert's explanations detailed enough to provide deep understanding, including:
- Why this topic matters
- How it works in detail
- Real-world examples and applications
- Interesting facts or insights
- Practical implications

Format exactly like this:
Speaker A: [concise question]
Speaker B: [detailed, engaging explanation with examples]
Speaker A: [follow-up question]
Speaker B: [comprehensive answer with more depth]
Speaker A: [final clarifying question]
Speaker B: [concluding detailed explanation]

Topic: ${topic}`;

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "You are an expert educational content creator who specializes in creating natural, engaging conversations between a curious female questioner and a knowledgeable male expert. The female asks concise questions while the male provides detailed, comprehensive explanations in Indian English style.",
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
    return response.data.choices[0].message.content;
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
