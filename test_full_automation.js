require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { generateScript, generateVisualPrompt } = require('./src/services/scriptService');
const { generateAudioWithBatchingStrategy } = require('./src/services/audioService');
const { generateSRT, generateReelContent } = require('./src/services/newFeaturesService');
const { renderHTMLToVideo } = require('./src/services/puppeteerRenderService');
const { getRandomTheme } = require('./src/config/styles');

async function main() {
    console.log("🚀 Starting Optimized Automation Pipeline...");
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logFile = fs.createWriteStream(`automation_log_${timestamp}.txt`, { flags: 'a' });
    
    const log = (msg) => {
        const time = new Date().toISOString();
        console.log(`[${time}] ${msg}`);
        logFile.write(`[${time}] ${msg}\n`);
    };

    try {
        const TOPIC = process.argv[2] || "The Paradox of Choice in User Interface Design";
        const BASE_VIDEO_PATH = path.resolve("BASE-VEDIO.mp4");
        
        if (!fs.existsSync(BASE_VIDEO_PATH)) throw new Error(`Base video not found at ${BASE_VIDEO_PATH}`);
        if (!process.env.GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY");
        if (!process.env.GEMINI_API_KEY_FOR_AUDIO) throw new Error("Missing GEMINI_API_KEY_FOR_AUDIO");

        // Cache/Audio Setup
        const AUDIO_DIR = path.resolve("audio");
        const CACHE_DIR = path.resolve("test_cache");
        if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);
        const SCRIPT_CACHE = path.join(CACHE_DIR, "cached_script.txt");
        
        // --- STEP 1: SCRIPT ---
        let script;
        if (fs.existsSync(SCRIPT_CACHE)) {
            log(`📝 Step 1: Using cached Script from ${SCRIPT_CACHE}`);
            script = fs.readFileSync(SCRIPT_CACHE, 'utf-8');
        } else {
            log(`📝 Step 1: Generating Script for topic: "${TOPIC}"`);
            script = await generateScript(TOPIC);
            fs.writeFileSync(SCRIPT_CACHE, script);
            log("Script Generated and Cached.");
        }

        // --- STEP 2: AUDIO SELECTION ---
        let audioPath;
        // Find latest wav in audio dir
        if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR);
        
        const files = fs.readdirSync(AUDIO_DIR)
            .filter(f => f.endsWith('.wav') && f.startsWith('conversation_'))
            .map(f => ({ name: f, time: fs.statSync(path.join(AUDIO_DIR, f)).mtime.getTime() }))
            .sort((a, b) => b.time - a.time);

        if (files.length > 0) {
            audioPath = path.join(AUDIO_DIR, files[0].name);
            log(`🎤 Step 2: Using existing latest audio: ${files[0].name}`);
        } else {
            log(`🎤 Step 2: No existing audio found. Generating...`);
            const audioResult = await generateAudioWithBatchingStrategy(script);
            audioPath = audioResult.conversationFile;
            log(`Audio Generated: ${audioPath}`);
        }

        // --- STEP 2.5: MERGE AUDIO + BASE VIDEO ---
        log(`🎞️ Step 2.5: Merging Audio with Base Video...`);
        const MERGED_VIDEO_PATH = path.resolve(`temp_merged_${timestamp}.mp4`);
        await new Promise((resolve, reject) => {
            const ffmpeg = require('fluent-ffmpeg');
            ffmpeg(BASE_VIDEO_PATH)
                .input(audioPath)
                .outputOptions([
                    '-c:v copy', // Copy video stream (fast)
                    '-c:a aac',  // Encode audio
                    '-map 0:v:0',
                    '-map 1:a:0',
                    '-shortest'   // Cut to shortest stream (usually audio)
                ])
                .output(MERGED_VIDEO_PATH)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });
        log(`Merged Video Created: ${MERGED_VIDEO_PATH}`);

        // Cache Paths
        const SRT_CACHE = path.join(CACHE_DIR, "cached_srt.json");
        const PROMPT_CACHE = path.join(CACHE_DIR, "cached_prompt.txt");
        const HTML_CACHE = path.join(CACHE_DIR, "cached_html.html");

        // --- STEP 3: SRT ---
        log(`📜 Step 3: Generating Subtitles...`);
        let srt, segments;
        
        if (fs.existsSync(SRT_CACHE)) {
             log(`📜 Using Cached SRT from ${SRT_CACHE}`);
             const cached = JSON.parse(fs.readFileSync(SRT_CACHE, 'utf-8'));
             srt = cached.srt;
             segments = cached.segments;
        } else {
            try {
                const result = await generateSRT(audioPath, process.env.GEMINI_API_KEY_FOR_AUDIO);
                srt = result.srt;
                segments = result.segments;
                fs.writeFileSync(SRT_CACHE, JSON.stringify(result));
            } catch (e) {
                 if (e.status === 429) {
                     log("⚠️ Rate Limited (429). Waiting 30 seconds...");
                     await new Promise(r => setTimeout(r, 30000));
                     const result = await generateSRT(audioPath, process.env.GEMINI_API_KEY_FOR_AUDIO);
                     srt = result.srt;
                     segments = result.segments;
                     fs.writeFileSync(SRT_CACHE, JSON.stringify(result));
                 } else {
                     throw e;
                 }
            }
        }
        log(`SRT Generated/Loaded. Segments: ${segments.length}`);

        // --- STEP 4: VISUALS ---
        log(`🎨 Step 4: Generating Visual Concept & Theme...`);
        let visualPrompt;
        if (fs.existsSync(PROMPT_CACHE)) {
            visualPrompt = fs.readFileSync(PROMPT_CACHE, 'utf-8');
            log("Using cached Visual Prompt.");
        } else {
            visualPrompt = await generateVisualPrompt(script);
            fs.writeFileSync(PROMPT_CACHE, visualPrompt);
        }
        
        const theme = getRandomTheme();
        log(`Visual Prompt: "${visualPrompt}"`);
        log(`Theme: ${theme.name}`);

        // --- STEP 5: HTML GENERATION ---
        log(`🧠 Step 5: Generating HTML Overlays...`);
        const visualKey = process.env.GEMINI_API_KEY_FOR_VISUALS || process.env.GEMINI_API_KEY_FOR_AUDIO;
        let content;
        
        if (fs.existsSync(HTML_CACHE)) {
            log("Using cached HTML content.");
            const html = fs.readFileSync(HTML_CACHE, 'utf-8');
            content = { html }; // partial mock
        } else {
            for (let i = 0; i < 3; i++) {
                 try {
                    content = await generateReelContent(srt, TOPIC, visualKey, "gemini-2.5-flash", visualPrompt, theme);
                    break;
                 } catch (e) {
                    if (i === 2) throw e;
                    log(`⚠️ Gemini Error (Attempt ${i+1}): ${e.message}. Retrying...`);
                    await new Promise(r => setTimeout(r, 5000));
                 }
            }
            fs.writeFileSync(HTML_CACHE, content.html);
        }
        
        const htmlPath = path.resolve(`temp_animation_${timestamp}.html`);
        fs.writeFileSync(htmlPath, content.html);
        log(`HTML Saved: ${htmlPath}`);

        // --- STEP 6: RENDER OVERLAY ---
        log(`🎬 Step 6: Rendering Overlay...`);
        const lastSegment = segments[segments.length - 1];
        // For testing, LIMIT DURATION TO 5 SECONDS
        const fullDuration = lastSegment ? lastSegment.end + 2 : 10;
        const duration = 5; // Hardcap for testing speed
        log(`Render Duration Limited to ${duration}s (Full Audio: ${fullDuration}s)`);
        
        const overlayPath = path.resolve(`temp_overlay_${timestamp}.webm`);
        
        // Use 15 FPS for faster testing
        await renderHTMLToVideo(content.html, overlayPath, duration, 15);
        log(`Overlay Rendered.`);

        // --- STEP 7: FINAL COMPOSITE ---
        log(`💿 Step 7: Creating Final Video...`);
        const finalPath = path.resolve(`final_video_${timestamp}.mp4`);
        
        // Composite Overlay onto the ALREADY MERGED video
        const ffmpeg = require('fluent-ffmpeg');
        await new Promise((resolve, reject) => {
            ffmpeg(MERGED_VIDEO_PATH)
                .input(overlayPath)
                .complexFilter([
                    "[1:v]scale=1080:1920[overlay]", // Ensure overlay is scaled
                    "[0:v][overlay]overlay[outv]"
                ])
                .outputOptions([
                    "-map [outv]",
                    "-map 0:a", // Use audio from merged video
                    "-c:v libx264",
                    "-c:a copy"
                ])
                .output(finalPath)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });
        
        log(`✅ SUCCESS! Output: ${finalPath}`);

        // Cleanup merged base file, keep final
        if (fs.existsSync(MERGED_VIDEO_PATH)) fs.unlinkSync(MERGED_VIDEO_PATH);

    } catch (error) {
        log(`❌ FAILED: ${error.message}`);
        console.error(error);
    } finally {
        logFile.end();
    }
}

main();
