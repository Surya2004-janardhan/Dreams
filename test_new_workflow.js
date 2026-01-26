require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { generateScript } = require('./src/services/scriptService');
const { generateAudioWithBatchingStrategy } = require('./src/services/audioService');
const { generateSRT, generateReelContent } = require('./src/services/newFeaturesService');
const { renderHTMLToVideo, compositeVideo } = require('./src/services/puppeteerRenderService');

async function main() {
    try {
        console.log("🚀 Starting Integrated Workflow Test...");

        const TOPIC = "The Future of Quantum Computing";
        const BASE_VIDEO_PATH = path.resolve("BASE-VEDIO.mp4"); // In root
        
        if (!process.env.GROQ_API_KEY || !process.env.GEMINI_API_KEY_FOR_AUDIO) {
            console.error("❌ Missing API Keys in .env");
            return;
        }

        // 1. Generate Script (Groq)
        console.log("\n📝 Step 1: Generating Script...");
        const script = await generateScript(TOPIC);
        console.log("Script:", script);

        // 2. Generate Audio (Gemini TTS)
        console.log("\n🎤 Step 2: Generating Audio...");
        // generateAudio returns { conversationFile: path, ... }
        const audioResult = await generateAudioWithBatchingStrategy(script);
        const audioPath = audioResult.conversationFile;
        console.log("Audio generated at:", audioPath);

        // 3. Generate SRT (Gemini)
        console.log("\n📜 Step 3: Generating Subtitles...");
        const { srt, segments } = await generateSRT(audioPath, process.env.GEMINI_API_KEY_FOR_AUDIO);
        console.log("SRT generated (preview):", srt.substring(0, 100) + "...");

        // 4. Generate Content (HTML/Layout)
        console.log("\n🎨 Step 4: Generating Re-designed Video Content (HTML/Layout)...");
        // Using GEMINI_API_KEY_FOR_VISUALS or Fallback to Audio Key
        const visualKey = process.env.GEMINI_API_KEY_FOR_VISUALS || process.env.GEMINI_API_KEY_FOR_AUDIO;
        
        const content = await generateReelContent(srt, TOPIC, visualKey, "gemini-2.5-flash");
        if (!content.html) throw new Error("No HTML generated");
        
        const htmlPath = path.resolve('temp_animation.html');
        fs.writeFileSync(htmlPath, content.html);
        console.log("Refined HTML saved to:", htmlPath);

        // 5. Render Video
        console.log("\n🎬 Step 5: Rendering Final Video (Puppeteer + FFmpeg)...");
        console.log("This may take a while...");
        
        // Calculate duration from audio segments or srt
        // Last segment end time
        const lastSegment = segments[segments.length - 1];
        const duration = lastSegment ? lastSegment.end + 2 : 10; // + buffer

        const overlayPath = path.resolve('temp_overlay.webm');
        await renderHTMLToVideo(content.html, overlayPath, duration);
        
        const finalPath = path.resolve('final_redesigned_video.mp4');
        await compositeVideo(BASE_VIDEO_PATH, overlayPath, audioPath, finalPath);
        
        console.log("\n✅ WORKFLOW COMPLETED!");
        console.log(`🎥 Final Video: ${finalPath}`);
        
        // Clean up
        // fs.unlinkSync(htmlPath);
        // fs.unlinkSync(overlayPath);

    } catch (error) {
        console.error("❌ Workflow Failed:", error);
    }
}

main();
