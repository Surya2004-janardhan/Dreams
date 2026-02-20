const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require("../config/logger");

// Initialize Gemini
// gemini-2.5-flash only use 2.5 flash fix it
const MODEL_ID = "gemini-2.5-flash"; // Standard for scripts
const VISUALS_MODEL_ID = "gemini-3-flash-preview"; // Enhanced for visuals as per user request

const getModel = () => {
    const keys = [
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_API_KEY_FOR_VISUALS,
        process.env.GEMINI_API_KEY_FOR_AUDIO,
        process.env.GEMINI_API_KEY_FOR_T2T
    ].filter(Boolean);
    const uniqueKeys = [...new Set(keys)];
    
    // Default to the first key for the initial instance
    const initialKey = uniqueKeys[0] || process.env.GEMINI_API_KEY;
    const initialGenAI = new GoogleGenerativeAI(initialKey);
    return { 
        model: initialGenAI.getGenerativeModel({ model: MODEL_ID }),
        keys: uniqueKeys 
    };
};

let { model, keys } = getModel();

/**
 * Helper to retry a function with different API keys on failure.
 */
async function retryWithFallback(fn, modelId = MODEL_ID) {
    let lastError;
    for (const key of keys) {
        try {
            const genAI = new GoogleGenerativeAI(key);
            const currentModel = genAI.getGenerativeModel({ model: modelId });
            return await fn(currentModel);
        } catch (e) {
            lastError = e;
            const msg = e.message || "";
            if (msg.includes("API_KEY_INVALID") || msg.includes("expired") || msg.includes("429")) {
                logger.warn(`⚠️ Gemini Key failed, trying next... Error: ${msg.substring(0, 50)}`);
                continue;
            }
            throw e; 
        }
    }
    throw lastError;
}

/**
 * Generates a viral, high-retention script for a 55-60 second technical reel.
 */
const generateScript = async (topic, description = "") => {
  const prompt = `
    TASK: Write a 60-second spoken narration script for a technical educational reel.
    TOPIC: ${topic}
    ${description ? `CONTEXT: ${description}` : ""}

    CRITICAL RULES:
    1. **SIMPLE ENGLISH**: Use very simple, easy-to-understand English. Avoid big words and complex sentences. 
    2. **EXPLAIN LIKE A FRIEND**: Speak naturally. Explain things simply, as if you are talking to a friend who is new to the topic.
    3. **KEEP TECHNICAL TERMS**: Use the correct technical words (like "API", "Load Balancer"), but explain everything else in the simplest way possible.
    4. NO introductions like "Hey guys", "Welcome", or "Today we will".
    5. NO outros like "Follow for more" or "Let me know".
    6. Spell out acronyms the first time (e.g., "Application Programming Interface").
    7. OUTPUT ONLY THE SPOKEN WORDS. No titles, meta-commentary, or formatting.

    STYLE:
    - Clear and direct. Every sentence should teach one simple thing.
    - Single continuous paragraph. No line breaks or bullet points.
    - Use clear periods and commas for natural TTS pauses.

    WORD COUNT: Strictly between 140 and 160 words.
  `;

  try {
    const script = await retryWithFallback(async (m) => {
        const result = await m.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    });

    // Aggressive cleanup: remove any lines that look like meta-explanation
    const lines = script.split('\n');
    const filteredLines = lines.filter(line => {
      const lower = line.toLowerCase();
      if (lower.includes('here is') && lower.includes('script')) return false;
      if (lower.includes('word count') || lower.includes('words long')) return false;
      if (lower.startsWith('note:') || lower.startsWith('script:')) return false;
      return true;
    });

    let finalScript = filteredLines.join(' ').trim();
    
    // Clean up markdown markers and bracketed text
    finalScript = finalScript.replace(/\[.*?\]/g, '').replace(/\*+/g, '').replace(/Hook:|Gap:|Value:|Loop:/gi, '').trim();

    const wordCount = finalScript.split(/\s+/).filter(w => w.length > 0).length;
    logger.info(`✨ Viral Script generated via Gemini (Word count: ${wordCount})`);
    
    return finalScript;
  } catch (error) {
    logger.error("❌ Gemini Script generation error:", error.message);
    throw new Error(`Failed to generate viral script: ${error.message}`);
  }
};

/**
 * Generates a high-fidelity visual animation storyboard prompt for technical reels.
 */
const generateVisualPrompt = async (topic, scriptText) => {
    const MAX_RETRIES = 3;
    let lastError;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const prompt = `
            Task: Create a clear and simple visual plan for a technical reel.
            Topic: ${topic}
            Script: ${scriptText}
            
            BASE VISUAL PROMPT:
            "Cinematic abstract visualization of ${topic}, minimalist tech-noir aesthetic, deep obsidian and charcoal color palette, high-contrast lighting with subtle neon accents, sharp macro photography style, sleek matte textures, sophisticated data-driven motion, clean geometric lines, professional studio atmosphere, ultra-modern, zero human figures, zero text."

            VISUAL STRATEGY:
            - **STYLE**: Clean, modern, and very easy to follow. 
            - **SIMPLE LANGUAGE**: Describe visuals in simple English. Avoid "big words" in your description.
            - BACKGROUND: Deep dark background with subtle glowing lines.
            - COMPONENTS: Technical items should be in clear, glowing boxes.
            - **ANIMATION FOCUS**: Make sure the animations are the main focus of the screen.
            - NO OVERLAP: Make sure no text or icons cover each other.
            - CONNECTIONS: Clearly describe how lines connect one box to another (e.g., "draw a line from Box A to Box B").
            - BALANCE: Keep everything centered and neat. No oversized or tiny icons.
            - HEADERS: Use simple, bold headings at the very top.
            - MATCH THE SCRIPT: Visuals must match the words being spoken at that moment.

            OUTPUT FORMAT:
            - Exactly 5-6 simple lines describing the visual steps.
            - Focus on clear actions like "Show a spinning icon" or "Move the box to the right."
            `;

            const visualDescription = await retryWithFallback(async (m) => {
                const result = await m.generateContent(prompt);
                const response = await result.response;
                return response.text().trim();
            }, VISUALS_MODEL_ID);

            // VALIDATION: Ensure prompt is not empty, not too short, and contains no "hallucination markers"
            const isInvalidType = !visualDescription || visualDescription.length < 50;
            const hasPlaceholders = /\[PLACEHOLDER\]|\[INSERT.*?\]|TODO|FIXME/i.test(visualDescription);
            const isTooGeneric = visualDescription.toLowerCase().includes("show a video") && !visualDescription.toLowerCase().includes("icon");

            if (isInvalidType || hasPlaceholders || isTooGeneric) {
                logger.warn(`⚠️ Visual prompt validation failed (Attempt ${attempt}/${MAX_RETRIES}). Retrying...`);
                if (attempt < MAX_RETRIES) {
                    await new Promise(r => setTimeout(r, 2000)); // Grace period before retry
                    continue;
                }
                throw new Error("Visual prompt failed validation after multiple attempts.");
            }

            logger.info("🎨 Visual prompt validated and generated successfully.");
            return visualDescription;

        } catch (e) {
            lastError = e;
            logger.error(`❌ Visual prompt error (Attempt ${attempt}/${MAX_RETRIES}): ${e.message}`);
            if (attempt === MAX_RETRIES) throw e;
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    throw lastError;
};

module.exports = {
  generateScript,
  generateVisualPrompt
};
