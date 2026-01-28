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
const { 
    uploadToYouTube, 
    uploadToInstagram, 
    uploadToFacebook, 
    generateUnifiedSocialMediaCaption 
} = require('./src/services/socialMediaService');
const { sendErrorNotification, sendSuccessNotification } = require('./src/services/emailService');
const Groq = require("groq-sdk");
const logger = require("./src/config/logger");

async function main() {
    console.log("🚀 STARTING REELS AUTOMATION PIPELINE");
    
    let task = null;
    let currentStep = "Initialization";
    try {
        // Step 0: Fetch task
        currentStep = "Fetching Task from Sheets";
        console.log("📊 Step 0: Fetching task from Google Sheets...");
        task = await getNextTask().catch(err => {
            console.warn("⚠️ Sheet Service Failed or No Tasks: ", err.message);
            return { idea: process.env.FALLBACK_TOPIC || "AI in 2026", rowId: 0 };
        });
        
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
        const audioResult = await generateAudioWithBatchingStrategy(script);
        const audioPath = audioResult.conversationFile;
        console.log(`✅ Audio: ${audioPath}`);

        // Step 3: Base Merge (Trim Video to Audio)
        currentStep = "Base Video Audio Merge";
        console.log("🎞️ Step 3: Mixing Audio with Base Video (Trimming to sync)...");
        const BASE_VIDEO = path.resolve('base-vedio.mp4'); 
        const INIT_MERGE = path.resolve('merged_output.mp4');
        
        if (!fs.existsSync(BASE_VIDEO)) {
            console.error("❌ base-vedio.mp4 not found in root!");
            throw new Error("Missing base-vedio.mp4");
        }

        await new Promise((resolve, reject) => {
            ffmpeg(BASE_VIDEO)
                .input(audioPath)
                .outputOptions([
                    '-y',
                    '-c:v copy',
                    '-c:a aac',
                    '-map 0:v:0',
                    '-map 1:a:0',
                    '-shortest' 
                ])
                .output(INIT_MERGE)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });
        console.log("✅ Base merge success");

        // Step 4: SRT
        currentStep = "SRT Generation";
        console.log("📜 Step 4: SRT generation...");
        const srtRes = await generateSRT(audioPath, process.env.GEMINI_API_KEY_FOR_AUDIO);
        const srtPath = path.resolve('subtitles.srt');
        fs.writeFileSync(srtPath, srtRes.srt);
        console.log("✅ SRT ready");

        // Step 5: Visual Prompt
        currentStep = "Visual Prompt Generation";
        console.log("🎨 Step 5: Generating technical animation prompt...");
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const groqPrompt = `
        Draft a technical GSAP animation storyboard for: ${TOPIC}
        Context: ${script}
        
        VISUAL RULES:
        - Style: Cyber-technical, data-driven, clean Swiss typography.
        - Components: Dynamic graphs, code snippets, or architecture diagrams.
        - Constraint: ALWAYS include "Layout splitout must be 0.5".
        - Motion: Sharp, rhythmic transitions. No generic sweeps.
        - Output: Exactly 3-4 professional lines.
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

        const ytPromise = uploadToYouTube(finalMasterPath, TOPIC, social.caption)
            .then(res => { if(res.success) links.yt = res.url; })
            .catch(e => console.error("YT Error:", e.message));

        const instaPromise = uploadToInstagram(finalMasterPath, TOPIC, social.caption)
            .then(res => { if(res.success) links.insta = res.url; })
            .catch(e => console.error("Insta Error:", e.message));

        const fbPromise = uploadToFacebook(finalMasterPath, TOPIC, social.caption)
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

        console.log("✨ AUTOMATION SUCCESSFUL");

    } catch (err) {
        console.error(`❌ PIPELINE FAILED at Step [${currentStep}]:`, err);
        if (task && task.rowId > 0) {
            await updateSheetStatus(task.rowId, "Error: " + err.message.slice(0, 50));
        }
        // Send Error Email
        await sendErrorNotification(task, err, currentStep).catch(e => console.error("Error email failed:", e.message));
    }
}

async function runCompositor(vPath, sPath, vPrompt) {
    const keys = [
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_API_KEY_FOR_AUDIO,
        process.env.GEMINI_API_KEY_FOR_VISUALS,
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

        console.log("📽️ Final Remuxing (audio offset sync)...");
        await new Promise((res, rej) => {
            ffmpeg(raw).input(audioSrc)
                .complexFilter([{ filter: 'adelay', options: '400|400', inputs: '1:a', outputs: 'd' }])
                .outputOptions(['-y', '-c:v libx264', '-preset fast', '-crf 22', '-c:a aac', '-map 0:v:0', '-map [d]', '-shortest'])
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
                    page.waitForSelector('#video-upload', { state: 'attached', timeout: 15000 }).then(() => true),
                    page.waitForTimeout(16000).then(() => false)
                ]);
                if (success) break;
                await pass.fill('');
            }
        }

        console.log("📤 Uploading assets...");
        await page.waitForSelector('#video-upload', { state: 'attached', timeout: 45000 });
        await page.setInputFiles('#video-upload', vPath);
        await page.setInputFiles('#srt-upload', sPath);
        await page.waitForTimeout(5000);
        
        console.log("🚀 Advancing to Studio...");
        await page.click('button:has-text("Enter Studio")');
        await page.waitForTimeout(8000);

        console.log("🎨 Filling animation prompt...");
        await page.waitForSelector('textarea', { state: 'visible', timeout: 45000 });
        await page.fill('textarea', vPrompt);
        await page.click('button:has-text("Studio")'); 

        console.log("⏳ Waiting for visual generation...");
        await page.waitForSelector('button:has-text("Rec & Export")', { timeout: 240000 });
        
        console.log("🎬 Initiating Recording...");
        await page.click('button:has-text("Rec & Export")');
        await page.waitForTimeout(3000);
        await page.click('button:has-text("Browser Recorder")');

        console.log("🎥 Monitoring Playback...");
        const begin = Date.now();
        while (!complete && Date.now() - begin < 400000) {
            await page.waitForTimeout(5000);
            const ended = await page.evaluate(() => { 
                const v = document.querySelector('video'); 
                return v ? v.ended : false; 
            });
            if (ended) {
                console.log("🎞️ Playback ended. Waiting for download...");
                const wait = Date.now();
                while (!complete && Date.now() - wait < 120000) await page.waitForTimeout(2000);
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
