require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { generateScript, generateVisualPrompt } = require('./src/services/scriptService');
const { generateAudioWithBatchingStrategy } = require('./src/services/audioService');
const { generateSRT, generateReelContent } = require('./src/services/newFeaturesService');
const { startDevServer, saveContentBridge, renderFramesFromReactApp, compositeFramesWithVideo } = require('./src/services/reactRenderService');
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

        // Export as raw .srt file for standard use
        fs.writeFileSync('subtitles.srt', srt);
        fs.writeFileSync(path.resolve('./new/public/subtitles.srt'), srt);
        log(`Standard SRT file saved to root and public folder.`);

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

        // --- STEP 6: CHECK/START REACT DEV SERVER ---
        log(`🚀 Step 6: Checking React Dev Server...`);
        const reactProjectDir = path.resolve('./new');
        let devServer;
        const defaultUrl = 'http://localhost:3000';
        
        // Check if server is already running
        try {
            const http = require('http');
            await new Promise((resolve, reject) => {
                const req = http.get(defaultUrl, (res) => {
                    log(`✅ Dev server already running at ${defaultUrl}`);
                    devServer = { url: defaultUrl, external: true };
                    resolve();
                });
                req.on('error', () => {
                    log(`Server not running, attempting to start...`);
                    reject();
                });
                req.setTimeout(2000, () => {
                    req.destroy();
                    reject();
                });
            });
        } catch {
            // Server not running, try to start it
            try {
                devServer = await startDevServer(reactProjectDir);
                log(`React server started at ${devServer.url}`);
            } catch (err) {
                log(`⚠️ Failed to start dev server: ${err.message}`);
                log(`Please start manually: cd new && npm run dev`);
            }
        }

        // --- STEP 7: SAVE HTML TO PUBLIC FOLDER ---
        log(`📦 Step 7: Saving HTML to public folder...`);
        const publicHTMLPath = path.resolve('./new/public/render.html');
        
        // Add visibility CSS to fix opacity:0 issues
        const visibilityFix = `
<style id="visibility-override">
/* Override any opacity:0 that prevents visibility */
body, body *:not(script):not(style) { 
    opacity: 1 !important; 
    visibility: visible !important; 
}
/* Ensure text is visible and not hidden by code display */
script, style { display: none !important; }
/* Ensure text elements have color */
div, span, p, h1, h2, h3, h4, h5, h6 { color: white !important; }
/* Background for contrast */
body:not(:has(#stage)) { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important; }
</style>`;
        
        const htmlWithFix = content.html.replace('</head>', `${visibilityFix}</head>`);
        fs.writeFileSync(publicHTMLPath, htmlWithFix);
        log(`HTML saved to: ${publicHTMLPath}`);
        
        // --- STEP 8: RENDER FRAMES FROM REACT APP ---
        log(`🎬 Step 8: Recording frames from React server...`);
        const lastSegment = segments[segments.length - 1];
        const fullDuration = lastSegment ? lastSegment.end + 2 : 10;
        const duration = 5; // Test with 5 seconds
        log(`Recording ${duration}s (Full: ${fullDuration}s)`);
        
        const fps = 15;
        const framesDir = path.resolve(`temp_frames_${timestamp}`);
        
        if (devServer) {
            const renderUrl = `${devServer.url}/render.html`;
            log(`Recording from: ${renderUrl}`);
            await renderFramesFromReactApp(renderUrl, framesDir, duration, fps);
        } else {
            log(`❌ No dev server running, cannot record.`);
            throw new Error('Dev server required for recording');
        }
        
        log(`✅ Frames rendered to: ${framesDir}`);

        // --- STEP 9: COMPOSITE FINAL VIDEO ---
        log(`💿 Step 9: Creating Final Video...`);
        const finalPath = path.resolve(`final_video_${timestamp}.mp4`);
        
        await compositeFramesWithVideo(BASE_VIDEO_PATH, framesDir, audioPath, finalPath, fps);
        
        log(`✅ SUCCESS! Final video: ${finalPath}`);

        // Cleanup
        if (devServer && devServer.process && !devServer.external) {
            log('Stopping dev server...');
            devServer.process.kill();
        } else if (devServer && devServer.external) {
            log('Keeping external dev server running...');
        }
        
        if (fs.existsSync(MERGED_VIDEO_PATH)) fs.unlinkSync(MERGED_VIDEO_PATH);
        // Keep frames for debugging: comment out cleanup
        // fs.rmSync(framesDir, { recursive: true, force: true });

    } catch (error) {
        log(`❌ FAILED: ${error.message}`);
        console.error(error);
    } finally {
        logFile.end();
    }
}

main();
