const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require("../config/logger");

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

/**
 * Generates a viral, high-retention script for a 55-60 second technical reel.
 */
const generateScript = async (topic, description = "") => {
  const prompt = `
    TASK: Write a 55-second viral technical reel script.
    TOPIC: ${topic}
    ${description ? `CONTEXT: ${description}` : ""}

    VIRAL STRATEGY (CRITICAL):
    1. THE HOOK (0-3s): Start with a "Pattern Interrupt." Use a negative hook, a bold contradiction, or a "Stop doing X" statement.
    2. THE GAP (3-10s): Create cognitive dissonance. Why is the status quo wrong? What is the hidden cost?
    3. THE CORE VALUE (10-45s): Fast-paced, high-density technical insight. Use one continuous flow. Skip "First/Second/Third." Use "The secret is..." or "Which means..." to connect ideas.
    4. THE INFINITE LOOP (45-55s): The script MUST end with a leading phrase that seamlessly loops back to the very first word of the Hook. 

    TONE: 
    Confident, slightly edgy tech visionary. Calm but intense. No "Hey guys" or "Welcome back." Jump straight into the jugular.

    FORMAT:
    - Short, punchy lines (max 8 words per line).
    - Use punctuation to force natural pauses (..., !, ?).
    - TOTAL WORD COUNT: Strictly between 100 and 120 words.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let script = response.text().trim();

    // Clean up markdown markers if any
    script = script.replace(/\[.*?\]/g, '').replace(/\*+/g, '').replace(/Hook:|Gap:|Value:|Loop:/gi, '').trim();

    const wordCount = script.split(/\s+/).filter(w => w.length > 0).length;
    logger.info(`✨ Viral Script generated via Gemini (Word count: ${wordCount})`);
    
    return script;
  } catch (error) {
    logger.error("❌ Gemini Script generation error:", error.message);
    throw new Error(`Failed to generate viral script: ${error.message}`);
  }
};

/**
 * Generates a visual style prompt for the compositor based on the script.
 */
const generateVisualPrompt = async (script) => {
    const prompt = `
    Analyze this technical script and describe a Motion Graphics style in exactly 3 lines.
    Focus on: Brand colors (Neon/Cyber/Blueprint), Dynamic movement (Data streams, Glitches, Pulsating icons), and Layout.
    Do NOT mention the speaker.
    
    SCRIPT: "${script}"
    `;
    
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const visualDescription = response.text().trim();
        logger.info("🎨 Visual prompt generated via Gemini");
        return visualDescription;
    } catch (e) {
        logger.error("Failed to generate visual prompt via Gemini", e);
        return "Neon Blueprint aesthetic, dynamic node-graph pulses, sharp tactical overlays.";
    }
};

module.exports = {
  generateScript,
  generateVisualPrompt
};
