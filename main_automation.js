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
const voiceboxService = require('./src/services/voiceboxService');

async function main() {
    logger.info("🚀 STARTING REELS AUTOMATION PIPELINE");
    const sessionStart = Date.now();
    
    let task = null;
    let currentStep = "Initialization";
    var supabaseInfo = null; 
    try {
        // Step 0: Fetch task
        currentStep = "Fetching Task from Sheets";
        logger.info("📊 Step 0: Fetching task from Google Sheets...");
        const step0Start = Date.now();
        task = await getNextTask();
        logger.info(`✅ Step 0 Complete: Task fetched in ${((Date.now() - step0Start)/1000).toFixed(2)}s`);
        
        const TOPIC = task.idea;
        logger.info(`📝 Target Topic: "${TOPIC}"`);

        // Step 1: Script
        currentStep = "Script Generation";
        logger.info("📝 Step 1: Generating AI Script...");
        const step1Start = Date.now();
        const script = await generateScript(TOPIC);
        logger.info(`✅ Step 1 Complete: Script generated in ${((Date.now() - step1Start)/1000).toFixed(2)}s`);

        // Step 2: Audio (Cloned via Voicebox)
        currentStep = "Audio Generation (Voicebox)";
        logger.info("🎤 Step 2: Generating Cloned Audio via Voicebox...");
        const step2Start = Date.now();
        let audioPath;
        
        // Configuration for Cloned Voice
        const REF_AUDIO = path.resolve('Base-audio.wav'); 
        const GEN_AUDIO = path.join(__dirname, 'audio', `cloned_voice_${Date.now()}.wav`);
        
        if (!fs.existsSync(path.dirname(GEN_AUDIO))) {
            fs.mkdirSync(path.dirname(GEN_AUDIO), { recursive: true });
        }

        if (!fs.existsSync(REF_AUDIO)) {
            logger.warn(`⚠️ Base-audio.wav not found in root. Falling back to Gemini TTS.`);
            const audioResult = await generateAudioWithBatchingStrategy(script);
            audioPath = audioResult.conversationFile;
        } else {
            try {
                // Generate audio with "Elite" viral creator instructions
                const VIRAL_VOICE_INSTRUCT = "Deliver this with high-octane energy, vary pitch for technical keywords, and use natural pauses.";
                audioPath = await voiceboxService.generateClonedVoice(script, REF_AUDIO, GEN_AUDIO, null, VIRAL_VOICE_INSTRUCT);
            } catch (vError) {
                logger.error(`❌ Voicebox failed: ${vError.message}. Falling back to Gemini TTS.`);
                const audioResult = await generateAudioWithBatchingStrategy(script);
                audioPath = audioResult.conversationFile;
            }
        }
        
        /* GEMINI TTS FALLBACK (Commented out)
        if (fs.existsSync(CACHE_AUDIO)) {
            logger.info("♻️ Using cached audio_cache.wav to save API quota.");
            audioPath = CACHE_AUDIO;
        } else {
            const audioResult = await generateAudioWithBatchingStrategy(script);
            audioPath = audioResult.conversationFile;
        }
        */
        logger.info(`✅ Step 2 Complete: Audio ready at ${audioPath} (${((Date.now() - step2Start)/1000).toFixed(2)}s)`);

        // Step 3: Wav2Lip Sync (Dynamic Talking Head)
        currentStep = "Wav2Lip Lip-Syncing";
        logger.info("👄 Step 3: Performing Wav2Lip Sync (Dynamic Talking Head)...");
        const step3Start = Date.now();
        
        // Use Base-vedio.mp4 from root as the source face for lip-syncing
        const WAV2LIP_BASE = path.resolve('Base-vedio.mp4'); 
        const INIT_MERGE = path.resolve('merged_output.mp4');
        
        if (!fs.existsSync(WAV2LIP_BASE)) {
            logger.error(`❌ Base-vedio.mp4 not found in root: ${WAV2LIP_BASE}`);
            throw new Error(`Missing base video for Wav2Lip at ${WAV2LIP_BASE}`);
        }

        logger.info(`🎬 Using Root Base Video: ${path.basename(WAV2LIP_BASE)}`);
        // Use "Elite" Sync Settings: bottom padding for chin + no smoothing for snapping
        await syncLip(audioPath, WAV2LIP_BASE, INIT_MERGE, { pads: [0, 20, 0, 0], nosmooth: true });
        logger.info(`✅ Step 3 Complete: Wav2Lip sync success in ${((Date.now() - step3Start)/1000).toFixed(2)}s`);


        // Step 4: SRT (using AssemblyAI)
        currentStep = "SRT Generation (AssemblyAI)";
        logger.info("📜 Step 4: Generating Subtitles (SRT) via AssemblyAI...");
        const step4Start = Date.now();
        const srtRes = await createSubtitlesFromAudio(audioPath);
        const srtPath = srtRes.subtitlesPath;
        // Also save as subtitles.srt in root for consistency if needed by other steps
        fs.copyFileSync(srtPath, path.resolve('subtitles.srt'));
        logger.info(`✅ Step 4 Complete: SRT generated in ${((Date.now() - step4Start)/1000).toFixed(2)}s`);

        // Step 5: Visual Prompt
        currentStep = "Visual Prompt Generation";
        logger.info("🎨 Step 5: Creating visual prompt for technical animation...");
        const step5Start = Date.now();
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
        logger.info(`✅ Step 5 Complete: Visual prompt ready in ${((Date.now() - step5Start)/1000).toFixed(2)}s`);

        // Step 6: Playwright Logic
        currentStep = "Browser Recording & Composition";
        logger.info("🌐 Step 6: Recording Unified Visuals via Browser Compositor...");
        const step6Start = Date.now();
        const finalMasterPath = await runCompositor(INIT_MERGE, srtPath, visualPrompt);
        if (!finalMasterPath) throw new Error("Browser recording failed to produce a file.");
        logger.info(`✅ Step 6 Complete: MASTER REEL created at ${finalMasterPath} (${((Date.now() - step6Start)/1000).toFixed(2)}s)`);

        // Step 7: Social Content
        currentStep = "Generating Captions";
        logger.info("✍️ Step 7: Creating social media captions...");
        const step7Start = Date.now();
        const social = await generateUnifiedSocialMediaCaption(TOPIC);
        logger.info(`✅ Step 7 Complete: Captions ready in ${((Date.now() - step7Start)/1000).toFixed(2)}s`);

        // Step 8: Upload
        currentStep = "Uploading to Social Media";
        logger.info("📤 Step 8: Starting Social Media Uploads...");
        const step8Start = Date.now();
        const links = { yt: "", insta: "", fb: "" };

        // 1. Supabase Upload (One-time) for Meta Platforms
        try {
            logger.info("☁️ Uploading to Supabase (Staging for Meta)...");
            supabaseInfo = await uploadToSupabaseAndGetLink(finalMasterPath, TOPIC);
        } catch (e) {
            logger.error(`❌ Supabase Upload Error: ${e.message}`);
        }

        // A. YouTube Upload (Direct - Independent of Staging)
        const ytPromise = uploadToYouTube(finalMasterPath, TOPIC, social.caption)
            .then(res => { if(res.success) { links.yt = res.url; logger.info(`✅ YT Posted: ${res.url}`); } })
            .catch(e => logger.error(`❌ YT Error: ${e.message}`));

        const metaPromises = [];

        if (supabaseInfo && supabaseInfo.success) {
            const publicUrl = supabaseInfo.publicLink;
            logger.info(`✅ Supabase Link (Staging for Meta): ${publicUrl}`);

            // B. Instagram Upload (via URL)
            metaPromises.push(
                uploadToInstagramWithUrl(publicUrl, TOPIC, social.caption)
                    .then(res => { if(res.success) { links.insta = res.url; logger.info(`✅ Insta Posted: ${res.url}`); } })
                    .catch(e => logger.error(`❌ Insta Error: ${e.message}`))
            );

            // C. Facebook Upload (via URL)
            metaPromises.push(
                uploadToFacebookWithUrl(publicUrl, TOPIC, social.caption)
                    .then(res => { if(res.success) { links.fb = res.url; logger.info(`✅ FB Posted: ${res.url}`); } })
                    .catch(e => logger.error(`❌ FB Error: ${e.message}`))
            );
        } else {
            logger.warn("⚠️ Meta (Instagram/Facebook) upload skipped because Supabase staging failed.");
        }

        await Promise.allSettled([ytPromise, ...metaPromises]);
        logger.info(`✅ Step 8 Complete: Uploads finished in ${((Date.now() - step8Start)/1000).toFixed(2)}s`);
            
        // Step 9: Update Sheet
        currentStep = "Updating Sheets & Notifications";
        if (task.rowId > 0) {
            logger.info("📊 Step 9: Updating Google Sheets with results...");
            await updateSheetStatus(task.rowId, "Posted", links.yt, links.insta, links.fb);
        }

        // Final Success Email
        await sendSuccessNotification(task, links).catch(e => logger.error(`❌ Email failed: ${e.message}`));

        // CRITICAL CLEANUP: Delete from Supabase staging
        if (supabaseInfo && supabaseInfo.success && supabaseInfo.fileName) {
            logger.info("🧹 Cleaning up Supabase temporary storage...");
            // await deleteFromSupabase(supabaseInfo.fileName, supabaseInfo.bucket || "videos").catch(e => logger.error("Supabase Cleanup Error:", e.message));
        }

        const totalTime = ((Date.now() - sessionStart)/1000).toFixed(2);
        logger.info(`✨ AUTOMATION SUCCESSFUL | Total Time: ${totalTime}s`);

    } catch (err) {
        logger.error(`❌ PIPELINE FAILED | Step: [${currentStep}] | Error: ${err.message}`);
        
        // Cleanup on failure as well, if we managed to upload anything
        if (supabaseInfo && supabaseInfo.success && supabaseInfo.fileName) {
            logger.info("🧹 Cleanup on failure: Removing Supabase temporary file...");
            // await deleteFromSupabase(supabaseInfo.fileName, supabaseInfo.bucket || "videos").catch(e => logger.error("Supabase Cleanup Error on Failure:", e.message));
        }

        if (task && task.rowId > 0) {
            await updateSheetStatus(task.rowId, "Error: " + err.message.slice(0, 50));
        }

        // Send Error Email - NOW ENABLED
        await sendErrorNotification(task, err, currentStep).catch(e => logger.error(`❌ Error email failed: ${e.message}`));
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
            '--use-fake-device-for-media-stream',
            '--disable-dev-shm-usage',
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
        // Resolve BGM source (supporting multiple formats and case sensitivity)
        const bgmExtensions = ['.mp3', '.m4a', '.wav'];
        const bgmNames = ['bgm', 'Bgm'];
        let bgmSrc = null;
        
        for (const name of bgmNames) {
            for (const ext of bgmExtensions) {
                const potentialPath = path.resolve(`${name}${ext}`);
                if (fs.existsSync(potentialPath)) {
                    bgmSrc = potentialPath;
                    break;
                }
            }
            if (bgmSrc) break;
        }

        console.log("📽️ Final Remuxing (audio offset sync + BGM mixing + high-compatibility settings)...");
        
        let command = ffmpeg(raw).input(audioSrc);
        let hasBgm = !!bgmSrc;
        
        if (hasBgm) {
            command = command.input(bgmSrc).inputOptions(['-stream_loop -1']);
        }

        const filterComplex = [
            { filter: 'adelay', options: '400|400', inputs: '1:a', outputs: 'delayed' }
        ];

        if (hasBgm) {
            filterComplex.push({
                filter: 'volume', options: '0.2', inputs: '2:a', outputs: 'lowBgm'
            });
            filterComplex.push({
                filter: 'amix',
                options: { inputs: 2, dropout_transition: 0, normalize: 0 }, 
                inputs: ['delayed', 'lowBgm'],
                outputs: 'mixed'
            });
        } else {
            filterComplex[0].outputs = 'mixed';
        }

        command.complexFilter(filterComplex)
            .outputOptions([
                '-y', 
                '-c:v libx264', 
                '-pix_fmt yuv420p',
                '-preset fast', 
                '-crf 22', 
                '-profile:v main',
                '-level:v 4.1',
                '-r 30',
                '-c:a aac', 
                '-ar 44100',
                '-map 0:v:0', 
                '-map [mixed]', 
                '-shortest', 
                '-movflags +faststart'
            ])
            .output(out)
            .on('end', () => { masterPath = out; res(); })
            .on('error', rej)
            .run();
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

        // VERIFICATION: Check if recording actually started (Stop button should appear)
        const isRecordingStarted = await page.waitForSelector('button:has-text("Stop Recording")', { timeout: 15000 }).then(() => true).catch(() => false);
        if (!isRecordingStarted) {
            console.warn("⚠️ Recording failed to start automatically. Trying to force play...");
            await page.evaluate(() => {
                const v = document.querySelector('video');
                if (v) v.play();
            });
        }

        console.log("🎥 Monitoring Playback...");
        const begin = Date.now();
        let lastReport = 0;
        
        while (!complete && Date.now() - begin < 900000) { // 15 mins timeout
            await page.waitForTimeout(5000);
            
            const stats = await page.evaluate(() => { 
                const v = document.querySelector('video'); 
                return {
                    ended: v ? v.ended : false,
                    paused: v ? v.paused : true,
                    time: v ? v.currentTime : 0,
                    duration: v ? v.duration : 0
                };
            });

            // Log progress every 15 seconds
            if (Date.now() - lastReport > 15000) {
                console.log(`📹 Recording Progress: ${stats.time.toFixed(1)}s / ${stats.duration.toFixed(1)}s (Paused: ${stats.paused}, Ended: ${stats.ended})`);
                lastReport = Date.now();
            }

            // Force play if stalled
            if (stats.paused && !stats.ended && stats.time < stats.duration - 1) {
                await page.evaluate(() => document.querySelector('video')?.play()).catch(() => {});
            }

            if (stats.ended || (stats.duration > 0 && stats.time >= stats.duration - 0.5)) {
                console.log("🎞️ Playback reached end. Stopping recording and waiting for download...");
                // Explicitly stop recording to trigger download
                await page.click('button:has-text("Stop Recording")').catch(() => {
                    // Fallback to calling the function directly if button click fails
                    return page.evaluate(() => {
                        if (window.stopRecording) window.stopRecording();
                        // Find button by other means if necessary
                        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Stop'));
                        if (btn) btn.click();
                    });
                });
                
                const wait = Date.now();
                while (!complete && Date.now() - wait < 300000) await page.waitForTimeout(2000);
                break;
            }
        }
        
        if (!complete) {
            console.error("❌ Recording/Download timed out! Attempting emergency screenshot.");
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
