const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require("../config/logger");

// Initialize Gemini
// gemini-2.0-flash only use 1.5 flash fix it
const MODEL_ID = "gemini-2.0-flash"; // Standard for scripts
const VISUALS_MODEL_ID = "gemini-3-flash-preview"; // use onyly 3-flash for this ; Enhanced for visuals as per user request


const getModel = () => {
    const keys = [
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_API_KEY_FOR_VISUALS,
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

let { keys } = getModel();

/**
 * Helper to retry a function with different API keys on failure.
 */
async function retryWithFallback(fn, modelId = MODEL_ID) {
    let lastError;
    
    // 1. Try Gemini Keys
    for (const key of keys) {
        try {
            const genAI = new GoogleGenerativeAI(key);
            const currentModel = genAI.getGenerativeModel({ model: modelId });
            return await fn(currentModel);
        } catch (e) {
            lastError = e;
            const msg = e.message || "";
            if (msg.includes("API_KEY_INVALID") || msg.includes("expired") || msg.includes("429") || msg.includes("fetch")) {
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

  let script;
  try {
    script = await retryWithFallback(async (m) => {
        const result = await m.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    }, MODEL_ID);
  } catch (error) {
    logger.warn(`⚠️ Script Gemini failed, trying Groq fallback...`);
    if (process.env.GROQ_API_KEY) {
        try {
            const Groq = require("groq-sdk");
            const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
            const chatCompletion = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt + "\nRespond with ONLY the script text." }],
                model: "llama-3.3-70b-versatile",
            });
            script = chatCompletion.choices[0].message.content.trim();
            logger.info("✨ Script generated via Groq fallback");
        } catch (groqErr) {
            logger.error("❌ Groq fallback also failed for script:", groqErr.message);
            throw error; // Throw original Gemini error if Groq also fails
        }
    } else {
        throw error;
    }
  }

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
  finalScript = finalScript.replace(/\[.*?\]/g, '').replace(/\*+/g, '').replace(/Hook:|Gap:|Value:|Loop:/gi, '').trim();

  const wordCount = finalScript.split(/\s+/).filter(w => w.length > 0).length;
  logger.info(`✨ Viral Script generated (Word count: ${wordCount})`);
  return finalScript;
};

/**
 * Generates a high-fidelity visual animation storyboard prompt for technical reels.
 */
const generateVisualPrompt = async (topic, scriptText) => {
    const MAX_RETRIES = 3;
    const prompt = `
    Task: Create a clear and simple visual plan for a technical reel.
    Topic: ${topic}
    Script: ${scriptText}
    
    BASE VISUAL PROMPT:
    "Cinematic abstract visualization of ${topic}, minimalist tech-noir aesthetic, deep obsidian and charcoal color palette, high-contrast lighting with subtle neon accents, sharp macro photography style, sleek matte textures, sophisticated data-driven motion, clean geometric lines, professional studio atmosphere, ultra-modern, zero human figures, zero text."

    VISUAL STRATEGY:
    - **STYLE**: Clean, modern, and very easy to follow. 
    - **SIMPLE LANGUAGE**: Describe visuals in simple English.
    - BACKGROUND: Deep dark background with subtle glowing lines.
    - COMPONENTS: Technical items should be in clear, glowing boxes.
    - NO OVERLAP: Make sure no text or icons cover each other.
    - CONNECTIONS: Clearly describe how lines connect components.
    - MATCH THE SCRIPT: Visuals must match the words being spoken.

    OUTPUT FORMAT:
    - Exactly 5-6 simple lines describing the visual steps.
    - Focus on clear actions like "Show a spinning icon".
    `;

    try {
        const visualDescription = await retryWithFallback(async (m) => {
            const result = await m.generateContent(prompt);
            const response = await result.response;
            return response.text().trim();
        }, VISUALS_MODEL_ID);
        return visualDescription;
    } catch (e) {
        logger.warn(`⚠️ Visual prompt Gemini failed, trying Groq fallback...`);
        if (process.env.GROQ_API_KEY) {
            try {
                const Groq = require("groq-sdk");
                const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
                const chatCompletion = await groq.chat.completions.create({
                    messages: [{ role: "user", content: prompt }],
                    model: "llama-3.3-70b-versatile",
                });
                const visualDescription = chatCompletion.choices[0].message.content.trim();
                logger.info("🎨 Visual prompt generated via Groq fallback");
                return visualDescription;
            } catch (groqErr) {
                logger.error("❌ Groq fallback also failed for visual prompt:", groqErr.message);
            }
        }
        throw e;
    }
};

module.exports = {
  generateScript,
  generateVisualPrompt
};
