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
 * Generates a high-fidelity visual animation storyboard prompt for technical reels.
 */
const generateVisualPrompt = async (topic, script) => {
    const prompt = `
    Topic: ${topic}
    Script: ${script}
    
    Task: Create a high-fidelity visual animation storyboard for a technical reel.
    
    VISUAL STRATEGY:
    - STYLE: Premium "Tech Influencer" motion graphics. Dark, cinematic, and high-fidelity.
    - BACKGROUND: Use **dark topographic line textures** (flowing abstract terrain) as the base layer.
    - COMPONENTS: Place technical concepts inside **sleek boxes with glowing neon borders**. 
    - COMPOSITION: Use a **strict grid-based alignment**. Ensure components are centered and balanced.
    - SCALING: Maintain **proportional icon weights**. E.g., a "User" icon must have similar visual scale/impact as a "Server/CDN" component. NO oversized or tiny elements.
    - SPACING: **Minimize awkward gaps**. Position connected components close enough to feel part of a unified flow. Use a max of 2-3 main elements on screen at once for clarity.
    - HEADERS: Use **Bold, center-aligned technical headers** at the top top.
    - MOVEMENT: Every scene MUST have **dynamic kinetic flows**. Connect boxes with pulsating data lines. Use revolving progress circles and morphing nodes. **ZERO static frames**.
    - TEXT IN VISUALS: Keep text minimal and top-aligned to avoid cluttering the recording area.
    - SYNC: Visuals must mirror script technicalities with kinetic energy and perfect timing.
    - COLOR: Deep Blacks, Cyber Blues, Neon Greens, and Tech Grays.
    
    OUTPUT FORMAT:
    - Exactly 5-6 descriptive lines detailing the visual progression.
    - Focus on ACTION and SPECIFIC ICONS. 
    - Avoid generic descriptions like "show a video of X". Instead, use "Animate a revolving 3D CPU icon with data pulse lines".
    `;
    
    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const visualDescription = response.text().trim();
        
        if (!visualDescription || visualDescription.length < 20) {
            throw new Error("Gemini returned an empty or insufficient visual prompt.");
        }
        
        logger.info("🎨 Visual prompt generated via Gemini (Length: " + visualDescription.length + ")");
        return visualDescription;
    } catch (e) {
        logger.error("❌ Failed to generate visual prompt via Gemini:", e.message);
        throw e; // Rethrow to stop the pipeline
    }
};

module.exports = {
  generateScript,
  generateVisualPrompt
};
