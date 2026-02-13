const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require("../config/logger");

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
// gemini-2.5-flash

/**
 * Generates a viral, high-retention script for a 55-60 second technical reel.
 */
const generateScript = async (topic, description = "") => {
  const prompt = `
    TASK: Write a 60-second spoken narration script for a technical educational reel.
    TOPIC: ${topic}
    ${description ? `CONTEXT: ${description}` : ""}

    ABSOLUTE RULES:
    1. OUTPUT ONLY THE SPOKEN WORDS. Nothing else. No titles, no labels, no meta-commentary.
    2. NO introductions like "Hey guys", "Welcome", "Let me tell you", "Today we will".
    3. NO outros like "Hope this helps", "Follow for more", "Let me know".
    4. NO shortcut jargon or abbreviations. Spell things out. Say "Application Programming Interface" the first time, not just "API".
    5. NO filler words or hype phrases.

    STYLE:
    - Straight-cut and explanatory. Each sentence should teach something concrete.
    - Sound like a knowledgeable colleague explaining a concept clearly, not a YouTuber chasing clicks.
    - Use simple, clear language. If a concept is complex, break it down step by step.
    - Flow naturally from one point to the next using phrases like "What this means is...", "The reason this matters is...", "In practice...".
    - Single continuous paragraph of spoken text. No line breaks, no bullet points.

    STRUCTURE:
    - Open directly with the core concept or a factual statement. No questions, no bait.
    - Build explanation logically, adding one layer of depth at a time.
    - End with a practical takeaway or real-world implication.

    WORD COUNT: Strictly between 140 and 160 words.
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let script = response.text().trim();

    // Aggressive cleanup: remove any lines that look like meta-explanation
    const lines = script.split('\n');
    const filteredLines = lines.filter(line => {
      const lower = line.toLowerCase();
      if (lower.includes('here is') && lower.includes('script')) return false;
      if (lower.includes('word count') || lower.includes('words long')) return false;
      if (lower.startsWith('note:') || lower.startsWith('script:')) return false;
      return true;
    });

    script = filteredLines.join(' ').trim();
    
    // Clean up markdown markers and bracketed text
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
