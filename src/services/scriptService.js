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
    TASK: Write a 55-second technical educational script for a reel.
    TOPIC: ${topic}
    ${description ? `CONTEXT: ${description}` : ""}

    STRICT RULES (FAILURE TO FOLLOW WILL RESULT IN INVALID OUTPUT):
    1. NO INTRODUCTIONS: Do not say "Here is your script" or "I have written a 55-word script". 
    2. NO OUTROS: Do not say "Hope this helps" or "End of script".
    3. NO LABELS: Do not include [Hook], [Gap], etc.
    4. ONLY SCRIPT CONTENT: The output must contain ONLY the words to be spoken.

    VIRAL STRATEGY:
    1. THE HOOK (0-3s): Start with a sharp technical contradiction or a "Stop doing X" statement.
    2. THE GAP (3-10s): Explain why the standard approach is failing.
    3. THE CORE VALUE (10-45s): High-density technical insight. Use one continuous flow. Use "Which means..." or "Effectively..." as connectors.
    4. THE INFINITE LOOP (45-55s): End with a phrase that loops perfectly back to the first word of the hook.

    TONE & STYLE:
    - Voice of a high-level technical educator. Clear, punchy, authoritative.
    - No filler. No "Hey guys." No generic hype.
    - Format as a single paragraph of spoken text.

    TOTAL WORD COUNT: Strictly between 100 and 120 words.
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
