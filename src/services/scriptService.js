const axios = require("axios");
const logger = require("../config/logger");

// Groq API configuration
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const generateScript = async (topic) => {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("GROQ_API_KEY environment variable is required");
  }

  const prompt = `Create an educational conversation between Speaker A and Speaker B about: ${topic}

Make it:
- Educational and informative
- Natural conversation flow
- 2-3 minutes when spoken
- Clear points and examples
- Engaging dialogue

Format exactly like this:
Speaker A: [dialogue]
Speaker B: [dialogue]
Speaker A: [dialogue]
Speaker B: [dialogue]

Topic: ${topic}`;

  try {
    const response = await axios.post(
      GROQ_API_URL,
      {
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful educational content creator. Create natural, engaging conversations.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    logger.info("✓ Script generated via Groq API");
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
