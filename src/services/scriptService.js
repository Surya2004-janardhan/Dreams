const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require("../config/logger");

// Initialize Gemini
// gemini-2.5-flash only use 2.5 flash fix it
const MODEL_ID = "gemini-2.5-flash"; // Standardizing on 2.5 Flash as per user request

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
async function retryWithFallback(fn) {
    let lastError;
    for (const key of keys) {
        try {
            const genAI = new GoogleGenerativeAI(key);
            const currentModel = genAI.getGenerativeModel({ model: MODEL_ID });
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
            Topic: ${topic}
            Script: ${scriptText}
            
            Task: Create a high-fidelity visual animation storyboard for a technical reel.
            
            VISUAL STRATEGY:
            - STYLE: Premium "Tech Influencer" motion graphics. Dark, cinematic, and high-fidelity.
            - BACKGROUND: Use **dark topographic line textures** (flowing abstract terrain) as the base layer.
            - COMPONENTS: Place technical concepts inside **sleek boxes with glowing neon borders**. 
            - COMPOSITION: Use a **strict grid-based alignment**. Ensure components are centered and balanced.
            - **ANTI-COLLISION**: ABSOLUTELY NO overlapping elements. Icons must never cover text. Maintain clear padding between every visual component.
            - **CONNECTOR PRECISION**: All arrows, links, or data flows must have **precise start and end points**. Describe them as "connecting the right-center of Box A to the left-center of Box B". NO floating or misaligned lines.
            - SCALING: Maintain **proportional icon weights**. E.g., a "User" icon must have similar visual scale/impact as a "Server/CDN" component. NO oversized or tiny elements.
            - SPACING: **Minimize awkward gaps**. Position connected components close enough to feel part of a unified flow. Use a max of 2-3 main elements on screen at once for clarity.
            - HEADERS: Use **Bold, center-aligned technical headers** at the top top.
            - MOVEMENT: Visuals must represent the **semantic meaning** of the script. Icons and animations must be **apt to what is being said**. Allow for static moments if they aid clarity. Prioritize **representative icons** and clear representations over generic motion.
            - TEXT IN VISUALS: Keep text minimal and top-aligned to avoid cluttering the recording area.
            - COLOR: Deep Blacks, Cyber Blues, Neon Greens, and Tech Grays.
            
            OUTPUT FORMAT:
            - Exactly 5-6 descriptive lines detailing the visual progression.
            - Focus on ACTION and SPECIFIC ICONS. 
            - Avoid generic descriptions like "show a video of X". Instead, use "Animate a revolving 3D CPU icon with data pulse lines".
            `;

            const visualDescription = await retryWithFallback(async (m) => {
                const result = await m.generateContent(prompt);
                const response = await result.response;
                return response.text().trim();
            });

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
