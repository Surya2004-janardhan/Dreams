const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

// Format timestamp for SRT (00:00:00,000)
const formatSRTTimestamp = (seconds) => {
  const date = new Date(0);
  date.setMilliseconds(seconds * 1000);
  const iso = date.toISOString();
  // ISO is YYYY-MM-DDTHH:mm:ss.sssZ, return HH:mm:ss,sss
  const timePart = iso.substr(11, 12).replace('.', ',');
  return timePart;
};

// Generate SRT using Gemini Flash
const generateSRT = async (audioPath, apiKey) => {
  if (!fs.existsSync(audioPath)) throw new Error(`Audio file not found: ${audioPath}`);
  
  const audioData = fs.readFileSync(audioPath);
  const base64Data = audioData.toString("base64");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  
  // Strict schema for subtitles
  const subtitleSchema = {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        start: { type: "NUMBER", description: "Start time in seconds" },
        end: { type: "NUMBER", description: "End time in seconds" },
        text: { type: "STRING", description: "The spoken text" }
      },
      required: ["start", "end", "text"]
    }
  };

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'audio/wav', // Assuming WAV from AudioService
                data: base64Data
              }
            },
            {
              text: `You are a professional captioning assistant. Extract the transcript with EXTREME TIMING PRECISION.
              CRITICAL RULES:
              1. Timestamps must align perfectly with the audio.
              2. Break text into naturally spoken short chunks (max 3-5 words).
              3. Do NOT hallucinate.
              4. If silence, do not create segments.`
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: subtitleSchema
      }
    });

    const response = await result.response;
    let jsonString = response.text() || "[]";
    if (!response.text && response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
        jsonString = response.candidates[0].content.parts[0].text;
    }
    const segments = JSON.parse(jsonString || "[]");
    
    let srtOutput = "";
    segments.forEach((seg, index) => {
       const id = index + 1;
       const startTime = formatSRTTimestamp(seg.start);
       const endTime = formatSRTTimestamp(seg.end);
       const text = seg.text.trim();
       srtOutput += `${id}\n${startTime} --> ${endTime}\n${text}\n\n`;
    });
    
    return { srt: srtOutput.trim(), segments };
  } catch (error) {
    console.error("SRT Generation Error:", error);
    throw error;
  }
};

const constructPrompt = (topic, srt, visualPrompt, theme) => {
    return `
I am creating an Instagram Reel that combines a speaker video with dynamic HTML overlays.
You are a Creative Director and Frontend Developer.

### STYLE & THEME
Color Palette:
- Primary: ${theme.primary}
- Accent: ${theme.accent}
- Background: ${theme.background}

Visual Concept (from external Creative Director):
"${visualPrompt}"

### INPUTS
Topic: ${topic || "General Content"}
Transcript (SRT):
${srt}

### OUTPUT REQUIREMENTS
1. HTML/CSS/JS Animation (GSAP):
   - Use GSAP for animations.
   - Listen for 'timeupdate', 'play', 'pause' events via window.addEventListener('message', ...).
   - USE THE PROVIDED COLOR PALETTE (${theme.name}).
   - 9:16 Portrait Aspect Ratio.
   - Must be a single self-contained HTML string.
   - **IMPORTANT**: If in 'split' mode, the layout will be 40% (0.4) video and 60% (0.6) HTML. Ensure your CSS and animations account for this.
   
2. Layout Configuration (JSON):
   - Define when to show HTML vs Video.
   - List of objects with startTime, endTime, layoutMode ('split', 'full-video', 'full-html'), splitRatio (FOR MODE 'split', ALWAYS USE 0.4).

Return JSON with keys: "html", "layoutConfig".
`;
};

// Generate Reel Content (HTML + Layout)
const generateReelContent = async (
  srtText,
  topicContext,
  apiKey = process.env.GEMINI_API_KEY_FOR_VISUALS || process.env.GEMINI_API_KEY,
  modelName = "gemini-1.5-flash",
  visualPrompt = "Dynamic and modern",
  theme = { primary: "#00f3ff", accent: "#ff0055", background: "#050505", name: "Default" }
) => {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = constructPrompt(topicContext, srtText, visualPrompt, theme);
  
  const layoutStepSchema = {
    type: "OBJECT",
    properties: {
      startTime: { type: "NUMBER" },
      endTime: { type: "NUMBER" },
      layoutMode: { type: "STRING", enum: ['split', 'full-video', 'full-html', 'pip-html'] },
      splitRatio: { type: "NUMBER" },
      captionPosition: { type: "STRING", enum: ['top', 'bottom', 'center', 'hidden'] },
      note: { type: "STRING" }
    },
    required: ["startTime", "endTime", "layoutMode", "splitRatio", "captionPosition"]
  };

  const responseSchema = {
    type: "OBJECT",
    properties: {
      html: { type: "STRING" },
      layoutConfig: { type: "ARRAY", items: layoutStepSchema },
      reasoning: { type: "STRING" }
    },
    required: ["html", "layoutConfig"]
  };

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const response = await result.response;
    const resultJson = JSON.parse(response.text() || "{}");
    
    // Inject ReelHelper
    if (resultJson.html) {
         const reelHelperScript = `<script>
            (function() {
                if (typeof HTMLCollection !== 'undefined' && !HTMLCollection.prototype.forEach) {
                    HTMLCollection.prototype.forEach = Array.prototype.forEach;
                }
                if (typeof NodeList !== 'undefined' && !NodeList.prototype.forEach) {
                    NodeList.prototype.forEach = Array.prototype.forEach;
                }
                window.ReelHelper = {
                    select: function(selector, context) {
                        if (!window.gsap) return [];
                        return gsap.utils.toArray(selector, context);
                    },
                    clear: function(element) {
                        if(element) element.innerHTML = '';
                    }
                };
            })();
        </script>`;
        resultJson.html = resultJson.html.replace('<head>', '<head>' + reelHelperScript);
    }

    return resultJson;
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};

module.exports = {
  generateSRT,
  generateReelContent
};
