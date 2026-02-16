const { GoogleGenerativeAI } = require("@google/generative-ai");
const logger = require("../config/logger");

// Initialize Gemini
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
        model: initialGenAI.getGenerativeModel({ model: "gemini-2.5-flash" }),
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
            const currentModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
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
 * RETURNS: { fullText: string, segments: [{ text: string, tone: string }] }
 */
const generateScript = async (topic, description = "") => {
  const prompt = `
    TASK: Write a 60-second spoken narration script for a technical educational reel.
    TOPIC: ${topic}
    ${description ? `CONTEXT: ${description}` : ""}

    ABSOLUTE RULES:
    1. OUTPUT ONLY A JSON ARRAY OF OBJECTS. No Markdown, no labels.
    2. JSON Format: [{"text": "sentence segment", "tone": "voice modulation instruction"}]
    3. NO introductions ("Hey guys") or outtros ("Follow for more").
    4. NO filler words. Each sentence must teach something concrete.
    5. TONE tags must be short modulation cues like "surprised questioning", "excited discovery", "serious technical authoritative", "engaging inquisitive".
    6. Language: Straight-cut technical educator.

    WORD COUNT: Total text strictly between 140 and 160 words across all segments.
  `;

  try {
    const rawJson = await retryWithFallback(async (m) => {
        const result = await m.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    });

    // Clean up potential markdown formatting if Gemini adds it
    const jsonStr = rawJson.replace(/```json\n?|```/g, '').trim();
    const segments = JSON.parse(jsonStr);

    const fullText = segments.map(s => s.text).join(' ');
    const wordCount = fullText.split(/\s+/).filter(w => w.length > 0).length;
    
    logger.info(`✨ Atomic Script segments generated (Segments: ${segments.length}, Total Words: ${wordCount})`);
    
    return { fullText, segments };
  } catch (error) {
    logger.error("❌ Gemini Script generation error:", error.message);
    throw new Error(`Failed to generate viral script: ${error.message}`);
  }
};

/**
 * Generates a high-fidelity visual animation storyboard prompt for technical reels.
 */
const generateVisualPrompt = async (topic, scriptText) => {
    const prompt = `
    Topic: ${topic}
    Script: ${scriptText}
    
    Task: Create a high-fidelity visual animation storyboard for a technical reel.
    
    VISUAL STRATEGY:
    - STYLE: Premium "Tech Influencer" motion graphics. Dark, cinematic, and high-fidelity.
    - BACKGROUND: Use **dark topographic line textures** (flowing abstract terrain) as the base layer.
    - COMPONENTS: Place technical concepts inside **sleek boxes with glowing neon borders**. 
    - COMPOSITION: Use a **strict grid-based alignment**. Ensure components are centered and balanced.
    - SCALING: Maintain **proportional icon weights**. E.g., a "User" icon must have similar visual scale/impact as a "Server/CDN" component. NO oversized or tiny elements.
    - SPACING: **Minimize awkward gaps**. Position connected components close enough to feel part of a unified flow. Use a max of 2-3 main elements on screen at once for clarity.
    - HEADERS: Use **Bold, center-aligned technical headers** at the top top.
    - MOVEMENT: Visuals must represent the **semantic meaning** of the script. Icons and animations must be **apt to what is being said**. Allow for static moments if they aid clarity. Prioritize **representative icons** and clear representations over generic motion.
    - TEXT IN VISUALS: Keep text minimal and top-aligned to avoid cluttering the recording area.
    - SYNC: Visuals must mirror script technicalities with kinetic energy and perfect timing. Use dynamic or static elements based on the script's semantic flow.
    - COLOR: Deep Blacks, Cyber Blues, Neon Greens, and Tech Grays.
    
    OUTPUT FORMAT:
    - Exactly 5-6 descriptive lines detailing the visual progression.
    - Focus on ACTION and SPECIFIC ICONS. 
    - Avoid generic descriptions like "show a video of X". Instead, use "Animate a revolving 3D CPU icon with data pulse lines".
    `;
    
    try {
        const visualDescription = await retryWithFallback(async (m) => {
            const result = await m.generateContent(prompt);
            const response = await result.response;
            return response.text().trim();
        });
        
        if (!visualDescription || visualDescription.length < 20) {
            throw new Error("Gemini returned an empty or insufficient visual prompt.");
        }
        
        logger.info("🎨 Visual prompt generated via Gemini (Length: " + visualDescription.length + ")");
        return visualDescription;
    } catch (e) {
        logger.error("❌ Failed to generate visual prompt via Gemini:", e.message);
        throw e; 
    }
};

module.exports = {
  generateScript,
  generateVisualPrompt
};
