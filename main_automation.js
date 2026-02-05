const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);
require('dotenv').config();

const { getNextTask, updateSheetStatus } = require('./src/services/sheetsService');
const { generateScript } = require('./src/services/scriptService');
const { generateAudioWithBatchingStrategy } = require('./src/services/audioService');
const { generateSRT } = require('./src/services/newFeaturesService');
const { createSubtitlesFromAudio } = require('./src/utils/subtitles');
const { 
    uploadToYouTube, 
    uploadToInstagramWithUrl, 
    uploadToFacebookWithUrl, 
    uploadToSupabaseAndGetLink,
    deleteFromSupabase,
    generateUnifiedSocialMediaCaption,
    
} = require('./src/services/socialMediaService');
const { sendErrorNotification, sendSuccessNotification } = require('./src/services/emailService');
const Groq = require("groq-sdk");
const logger = require("./src/config/logger");
const { syncLip } = require('./src/services/wav2lipService');

async function main() {
    console.log("🚀 STARTING REELS AUTOMATION PIPELINE");
    
    let task = null;
    let currentStep = "Initialization";
    var supabaseInfo = null; 
    try {
        // Step 0: Fetch task
        currentStep = "Fetching Task from Sheets";
        console.log("📊 Step 0: Fetching task from Google Sheets...");
        task = await getNextTask();
        
        const TOPIC = task.idea;
        console.log(`✅ Topic: ${TOPIC}`);

        // Step 1: Script
        currentStep = "Script Generation";
        console.log("📝 Step 1: Script generation...");
        const script = await generateScript(TOPIC);
        console.log("✅ Script ready");

        // Step 2: Audio
        currentStep = "Audio Generation";
        console.log("🎤 Step 2: Audio generation...");
        let audioPath;
        const CACHE_AUDIO = path.resolve('audio_cache.wav');

        if (fs.existsSync(CACHE_AUDIO)) {
            console.log("♻️ Using cached audio_cache.wav to save API quota.");
            audioPath = CACHE_AUDIO;
        } else {
            const audioResult = await generateAudioWithBatchingStrategy(script);
            audioPath = audioResult.conversationFile;
            // Optionally: fs.copyFileSync(audioPath, CACHE_AUDIO); // Uncomment to enable caching manually
        }
        console.log(`✅ Audio ready: ${audioPath}`);

        // Step 3: Wav2Lip Sync (Dynamic Talking Head)
        currentStep = "Wav2Lip Lip-Syncing";
        console.log("👄 Step 3: Generating Synced Talking Head via Wav2Lip...");
        
        // Use Base-vedio.mp4 from root as the source face for lip-syncing
        const WAV2LIP_BASE = path.resolve('Base-vedio.mp4'); 
        const INIT_MERGE = path.resolve('merged_output.mp4');
        
        if (!fs.existsSync(WAV2LIP_BASE)) {
            console.error("❌ Base-vedio.mp4 not found in root!");
            throw new Error(`Missing base video for Wav2Lip at ${WAV2LIP_BASE}`);
        }

        console.log(`🎬 Using Root Base Video: ${path.basename(WAV2LIP_BASE)}`);
        await syncLip(audioPath, WAV2LIP_BASE, INIT_MERGE);
        console.log("✅ Wav2Lip sync success: merged_output.mp4 created");


        // Step 4: SRT (using AssemblyAI)
        currentStep = "SRT Generation (AssemblyAI)";
        console.log("📜 Step 4: SRT generation via AssemblyAI...");
        const srtRes = await createSubtitlesFromAudio(audioPath);
        const srtPath = srtRes.subtitlesPath;
        // Also save as subtitles.srt in root for consistency if needed by other steps
        fs.copyFileSync(srtPath, path.resolve('subtitles.srt'));
        console.log("✅ SRT ready via AssemblyAI");

        // Step 5: Visual Prompt
        currentStep = "Visual Prompt Generation";
        console.log("🎨 Step 5: Generating technical animation prompt...");
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const groqPrompt = `
        Topic: ${TOPIC}
        Script: ${script}
        
        Task: Create a high-fidelity visual animation storyboard for a 60-second technical reel.
        
        VISUAL STRATEGY:
        - STYLE: Clean, futuristic, icon-driven animation. 
        - VISUALS: Use a continuous stream of relevant technical icons, symbols, and minimalist diagrams that morph and transition rhythmically.
        - TEXT: Minimal text only. Use text only for critical keywords or labels (max 2-3 words at a time).
        - SYNC: Ensure the visuals mirror the technical concepts mentioned in the script.
        - LAYOUT: Use "Layout splitout must be 0.5" for a balanced composition.
        - COLOR: Professional, cohesive color palette (e.g., Deep Blues, Neons, or Tech Grays).
        
        OUTPUT FORMAT:
        - Exactly 4-5 descriptive lines detailing the visual progression.
        - Focus on ACTION and SPECIFIC ICONS. 
        - Avoid generic descriptions like "show a video of X". Instead, use "Animate a revolving 3D CPU icon with data pulse lines".
        `;
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: groqPrompt }],
            model: "llama-3.3-70b-versatile",
        });
        const visualPrompt = completion.choices[0].message.content;
        fs.writeFileSync('visual_prompt.txt', visualPrompt);
        console.log("✅ Prompt ready");

        // Step 6: Playwright Logic
        currentStep = "Browser Recording & Composition";
        console.log("🌐 Step 6: Running Browser Compositor...");
        const finalMasterPath = await runCompositor(INIT_MERGE, srtPath, visualPrompt);
        if (!finalMasterPath) throw new Error("Browser recording failed to produce a file.");
        console.log(`✅ MASTER REEL: ${finalMasterPath}`);

        // Step 7: Social Content
        currentStep = "Generating Captions";
        console.log("✍️ Step 7: Social media context...");
        const social = await generateUnifiedSocialMediaCaption(TOPIC);

        // Step 8: Upload
        currentStep = "Uploading to Social Media";
        console.log("📤 Step 8: Uploading...");
        const links = { yt: "", insta: "", fb: "" };

        // 1. Supabase Upload (One-time) for Meta Platforms
        try {
            console.log("☁️ Pre-uploading to Supabase for Meta platforms...");
            supabaseInfo = await uploadToSupabaseAndGetLink(finalMasterPath, TOPIC);
        } catch (e) {
            console.error("Supabase Pre-upload Error:", e.message);
        }

        if (supabaseInfo && supabaseInfo.success) {
            const publicUrl = supabaseInfo.publicLink;
            console.log(`✅ Supabase URL ready: ${publicUrl}`);

            // A. YouTube Upload (Direct)
            const ytPromise = uploadToYouTube(finalMasterPath, TOPIC, social.caption)
                .then(res => { if(res.success) links.yt = res.url; })
                .catch(e => console.error("YT Error:", e.message));

            // B. Instagram Upload (via URL)
            const instaPromise = uploadToInstagramWithUrl(publicUrl, TOPIC, social.caption)
                .then(res => { if(res.success) links.insta = res.url; })
                .catch(e => console.error("Insta Error:", e.message));

            // C. Facebook Upload (via URL)
            const fbPromise = uploadToFacebookWithUrl(publicUrl, TOPIC, social.caption)
                .then(res => { if(res.success) links.fb = res.url; })
                .catch(e => console.error("FB Error:", e.message));

            await Promise.allSettled([ytPromise, instaPromise, fbPromise]);
            
            // Step 9: Update Sheet
            currentStep = "Updating Sheets & Notifications";
            if (task.rowId > 0) {
                console.log("📊 Step 9: Updating sheet...");
                await updateSheetStatus(task.rowId, "Posted", links.yt, links.insta, links.fb);
            }

            // Final Success Email
            await sendSuccessNotification(task, links).catch(e => console.error("Email failed:", e.message));

            // CRITICAL CLEANUP: Only now, after everything is done, delete from Supabase
            if (supabaseInfo && supabaseInfo.success && supabaseInfo.fileName) {
                console.log("🧹 Final Step: Cleaning up Supabase temporary file...");
                // await deleteFromSupabase(supabaseInfo.fileName, supabaseInfo.bucket || "videos").catch(e => console.error("Supabase Cleanup Error:", e.message));
            }

            console.log("✨ AUTOMATION SUCCESSFUL");
        } else {
            throw new Error("Supabase pre-upload failed. Skipping social platform uploads to avoid partial failures.");
        }

    } catch (err) {
        console.error(`❌ PIPELINE FAILED at Step [${currentStep}]:`, err.message);
        console.log("🚨 AUTOMATION FAILED");
        
        // Cleanup on failure as well, if we managed to upload anything
        if (supabaseInfo && supabaseInfo.success && supabaseInfo.fileName) {
            console.log("🧹 Cleanup on failure: Removing Supabase temporary file...");
            // await deleteFromSupabase(supabaseInfo.fileName, supabaseInfo.bucket || "videos").catch(e => console.error("Supabase Cleanup Error on Failure:", e.message));
        }

        if (task && task.rowId > 0) {
            await updateSheetStatus(task.rowId, "Error: " + err.message.slice(0, 50));
        }

        // Send Error Email - NOW ENABLED
        await sendErrorNotification(task, err, currentStep).catch(e => console.error("Error email failed:", e.message));
    }
}

async function runCompositor(vPath, sPath, vPrompt) {
    const keys = [
        process.env.GEMINI_API_KEY_FOR_VISUALS,
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_API_KEY_FOR_AUDIO,
        process.env.GEMINI_API_KEY_FOR_T2T
    ].filter(Boolean);
    const uniqueKeys = [...new Set(keys)];

    const browser = await chromium.launch({
        headless: false,
        args: [
            '--auto-select-desktop-capture-source=Entire screen',
            '--auto-select-tab-capture-source-by-title=Reel Composer',
            '--enable-usermedia-screen-capturing',
            '--use-fake-ui-for-media-stream',
            '--mute-audio',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1280,1000'
        ]
    });

    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();
    let masterPath = "";
    let complete = false;

    page.on('download', async (dl) => {
        const raw = `raw_tmp_${Date.now()}.mp4`;
        await dl.saveAs(raw);
        await new Promise(r => setTimeout(r, 3000));
        const finalName = `FINAL_REEL_${Date.now()}.mp4`;
        const out = path.resolve(finalName);
        const audioSrc = path.resolve('merged_output.mp4');

        console.log("📽️ Final Remuxing (audio offset sync + high-compatibility settings)...");
        await new Promise((res, rej) => {
            ffmpeg(raw).input(audioSrc)
                .complexFilter([{ filter: 'adelay', options: '400|400', inputs: '1:a', outputs: 'd' }])
                .outputOptions([
                    '-y', 
                    '-c:v libx264', 
                    '-pix_fmt yuv420p',      // Crucial for Instagram/Facebook
                    '-preset fast', 
                    '-crf 22', 
                    '-profile:v main',       // Main profile is more compatible
                    '-level:v 4.1',
                    '-r 30',                 // Force constant 30fps to avoid VFR issues
                    '-c:a aac', 
                    '-ar 44100',             // Standard audio rate
                    '-map 0:v:0', 
                    '-map [d]', 
                    '-shortest', 
                    '-movflags +faststart'
                ])
                .output(out)
                .on('end', () => { masterPath = out; res(); })
                .on('error', rej)
                .run();
        });
        if (fs.existsSync(raw)) fs.unlinkSync(raw);
        complete = true;
    });

    try {
        console.log("🌐 Navigating to composer...");
        await page.goto('http://localhost:3000', { timeout: 90000, waitUntil: 'networkidle' });
        
        const pass = page.locator('input[type="password"]');
        await pass.waitFor({ state: 'visible', timeout: 30000 }).catch(() => {});
        
        if (await pass.isVisible()) {
            console.log("🔑 Entering API key...");
            for (const key of uniqueKeys) {
                await pass.fill(key);
                await page.click('button:has-text("Enter Studio")');
                const success = await Promise.race([
                    page.waitForSelector('#video-upload', { state: 'attached', timeout: 30000 }).then(() => true),
                    page.waitForTimeout(31000).then(() => false)
                ]);
                if (success) break;
                await pass.fill('');
            }
        }

        console.log("📤 Uploading assets...");
        await page.waitForSelector('#video-upload', { state: 'attached', timeout: 60000 });
        await page.setInputFiles('#video-upload', vPath);
        await page.setInputFiles('#srt-upload', sPath);
        await page.waitForTimeout(5000);
        
        console.log("🚀 Advancing to Studio...");
        await page.click('button:has-text("Enter Studio")');
        await page.waitForTimeout(8000);

        console.log("🎨 Filling animation prompt...");
        await page.waitForSelector('textarea', { state: 'visible', timeout: 60000 });
        await page.fill('textarea', vPrompt);
        await page.click('button:has-text("Studio")'); 

        console.log("⏳ Waiting for visual generation...");
        await page.waitForSelector('button:has-text("Rec & Export")', { timeout: 300000 });
        
        console.log("🎬 Initiating Recording...");
        await page.click('button:has-text("Rec & Export")');
        await page.waitForTimeout(5000);
        await page.click('button:has-text("Browser Recorder")');

        console.log("🎥 Monitoring Playback...");
        const begin = Date.now();
        while (!complete && Date.now() - begin < 800000) {
            await page.waitForTimeout(5000);
            const ended = await page.evaluate(() => { 
                const v = document.querySelector('video'); 
                return v ? v.ended : false; 
            });
            if (ended) {
                console.log("🎞️ Playback ended. Waiting for download...");
                const wait = Date.now();
                while (!complete && Date.now() - wait < 300000) await page.waitForTimeout(2000);
                break;
            }
        }
        
        if (!complete) {
            console.warn("⚠️ Recording/Download timed out but proceeding...");
        }

    } catch (e) {
        console.error("Browser Automation Error:", e.message);
        const screenshotPath = `error_screenshot_${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath });
        console.log(`📸 Error screenshot saved: ${screenshotPath}`);
        throw e;
    } finally {
        await browser.close();
    }
    return masterPath;
}

main();
