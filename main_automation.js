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
const Groq = require("groq-sdk");
const logger = require("./src/config/logger");

async function main() {
    console.log("🚀 STARTING FULL REEL AUTOMATION PIPELINE");
    
    let task = null;
    try {
        // Step 0: Fetch from Google Sheets
        console.log("📊 Step 0: Fetching next task from Google Sheets...");
        task = await getNextTask();
        const TOPIC = task.idea;
        console.log(`✅ Selected Topic: ${TOPIC} (Row ${task.rowId})`);

        // Step 1: Generate Script
        console.log("📝 Step 1: Generating script...");
        const script = await generateScript(TOPIC);
        const scriptPath = path.resolve('temp_script.txt');
        fs.writeFileSync(scriptPath, script);
        console.log("✅ Script generated");

        // Step 2: Generate Audio
        console.log("🎤 Step 2: Generating high-quality audio...");
        const audioResult = await generateAudioWithBatchingStrategy(script);
        const audioPath = audioResult.conversationFile;
        console.log(`✅ Audio generated: ${audioPath}`);

        // Step 3: Mix Audio with Base Video & Trim
        console.log("🎞️ Step 3: Merging audio with base video (trimming to fit)...");
        const BASE_VIDEO = path.resolve('base-vedio.mp4'); 
        const MERGED_OUTPUT = path.resolve('merged_output.mp4');
        
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
                .output(MERGED_OUTPUT)
                .on('end', resolve)
                .on('error', reject)
                .run();
        });
        console.log("✅ Base merge complete");

        // Step 4: Generate Subtitles (SRT)
        console.log("📜 Step 4: Generating subtitles (SRT)...");
        const srtResult = await generateSRT(audioPath, process.env.GEMINI_API_KEY_FOR_AUDIO);
        const srtPath = path.resolve('subtitles.srt');
        fs.writeFileSync(srtPath, srtResult.srt);
        console.log("✅ SRT generated");

        // Step 5: Generate Visual Prompt for GSAP
        console.log("🎨 Step 5: Generating visual animation prompt...");
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const groqPrompt = `
        Based on the following script, generate a concise visual style description for a GSAP animation.
        Topic: ${TOPIC}
        Script: ${script}
        
        OUTPUT RULES:
        - Keep it simple and high-quality.
        - Use a modern tech theme.
        - ALWAYS Include the instruction: "Layout splitout must be 0.5".
        - Focus on minimal overlays and smooth transitions.
        - max 4 lines.
        `;
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: groqPrompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
        });
        const visualPrompt = completion.choices[0].message.content;
        const promptPath = path.resolve('visual_prompt.txt');
        fs.writeFileSync(promptPath, visualPrompt);
        console.log("✅ Visual Prompt ready");

        // Step 6: Frontend Automation (Playwright Recording)
        console.log("🌐 Step 6: Starting Frontend Visual Compositor...");
        const finalVideoPath = await runFrontendAutomation(MERGED_OUTPUT, srtPath, visualPrompt);
        if (!finalVideoPath) {
            throw new Error("Frontend automation failed to produce a final video.");
        }
        console.log(`✅ Final Video Composited: ${finalVideoPath}`);

        // Step 7: Generate AI Caption & Hashtags
        console.log("✍️ Step 7: Generating AI captions and hashtags...");
        const socialContent = await generateUnifiedSocialMediaCaption(TOPIC);
        console.log("✅ Captions and hashtags generated");

        // Step 8: Upload to Socials
        console.log("📤 Step 8: Uploading to Social Platforms...");
        const results = { yt: "", insta: "", fb: "" };

        // YT Upload (Shorts)
        try {
            const ytPost = await uploadToYouTube(finalVideoPath, TOPIC, socialContent.caption);
            if (ytPost.success) results.yt = ytPost.url;
        } catch (e) { console.error("YT Upload failed:", e.message); }

        // Insta Upload
        try {
            const instaPost = await uploadToInstagram(finalVideoPath, TOPIC, socialContent.caption);
            if (instaPost.success) results.insta = instaPost.url;
        } catch (e) { console.error("Insta Upload failed:", e.message); }

        // Facebook Upload
        try {
            const fbPost = await uploadToFacebook(finalVideoPath, TOPIC, socialContent.caption);
            if (fbPost.success) results.fb = fbPost.url;
        } catch (e) { console.error("Facebook Upload failed:", e.message); }

        // Step 9: Update Sheet Status
        console.log("📊 Step 9: Updating Google Sheet status...");
        await updateSheetStatus(
            task.rowId,
            "Posted",
            results.yt || "Failed",
            results.insta || "Failed",
            results.fb || "Failed"
        );
        console.log("✨ ALL DONE! Workflow finished successfully.");

    } catch (error) {
        console.error("❌ CRITICAL ERROR IN AUTOMATION:", error);
        if (task) {
            await updateSheetStatus(task.rowId, "Error: " + error.message.slice(0, 50));
        }
    }
}

/**
 * Playwright Automation Logic
 */
async function runFrontendAutomation(videoPath, srtPath, visualPrompt) {
    const keys = [
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_API_KEY_FOR_AUDIO,
        process.env.GEMINI_API_KEY_FOR_VISUALS,
        process.env.GEMINI_API_KEY_FOR_T2T
    ].filter(Boolean);
    const uniqueKeys = [...new Set(keys)];

    console.log("🚀 Launching browser compositor...");
    const browser = await chromium.launch({
        headless: false,
        args: [
            '--auto-select-desktop-capture-source=Entire screen',
            '--auto-select-tab-capture-source-by-title=Reel Composer',
            '--enable-usermedia-screen-capturing',
            '--use-fake-ui-for-media-stream',
            '--mute-audio',
            '--window-size=1280,1000'
        ]
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        acceptDownloads: true
    });

    const page = await context.newPage();
    let finalComposedPath = "";
    let downloadDone = false;

    // Download & Final Merge Listener
    page.on('download', async (download) => {
        const rawFileName = `raw_rec_${Date.now()}.mp4`;
        const rawPath = path.join(process.cwd(), rawFileName);
        try {
            await download.saveAs(rawPath);
            await new Promise(r => setTimeout(r, 2000));

            const outName = `FINAL_REEL_${Date.now()}.mp4`;
            const outPath = path.join(process.cwd(), outName);
            const originalAudioSource = path.resolve('merged_output.mp4');

            console.log("🎞️  Finalizing master video: Adding audio sync offset...");
            await new Promise((resolve, reject) => {
                ffmpeg(rawPath)
                    .input(originalAudioSource)
                    .complexFilter([{ filter: 'adelay', options: '400|400', inputs: '1:a', outputs: 'delayed' }])
                    .outputOptions(['-y', '-c:v libx264', '-preset fast', '-crf 22', '-c:a aac', '-map 0:v:0', '-map [delayed]', '-shortest' ])
                    .output(outPath)
                    .on('end', () => {
                        finalComposedPath = outPath;
                        resolve();
                    })
                    .on('error', reject)
                    .run();
            });

            if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
            downloadDone = true;
        } catch (err) { console.error("Merge error:", err.message); }
    });

    try {
        await page.goto('http://localhost:3000', { timeout: 60000, waitUntil: 'networkidle' });

        // API Key Login
        const pass = page.locator('input[type="password"]');
        await pass.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
        if (await pass.isVisible()) {
            for (const key of uniqueKeys) {
                await pass.fill(key);
                await page.click('button:has-text("Enter Studio")');
                const loggedIn = await Promise.race([
                    page.waitForSelector('#video-upload', { state: 'attached', timeout: 10000 }).then(() => true),
                    page.waitForTimeout(11000).then(() => false)
                ]);
                if (loggedIn) break;
                await pass.fill('');
            }
        }

        // Upload
        console.log("📤 Uploading assets to studio...");
        await page.waitForSelector('#video-upload', { state: 'attached', timeout: 30000 });
        await page.setInputFiles('#video-upload', videoPath);
        await page.setInputFiles('#srt-upload', srtPath);
        await page.waitForTimeout(3000);
        await page.click('button:has-text("Enter Studio")');
        await page.waitForTimeout(5000);

        // Prompt & Generate
        console.log("🎨 Applying visual prompt...");
        await page.waitForSelector('textarea', { state: 'visible', timeout: 30000 });
        await page.fill('textarea', visualPrompt);
        await page.click('button:has-text("Studio")'); 

        // Wait for Generation
        await page.waitForSelector('button:has-text("Rec & Export")', { timeout: 180000 });
        console.log("🎬 Recording started...");
        await page.click('button:has-text("Rec & Export")');
        await page.waitForTimeout(2000);
        await page.click('button:has-text("Browser Recorder")');

        // Monitor playback
        const start = Date.now();
        while (!downloadDone && Date.now() - start < 300000) {
            await page.waitForTimeout(5000);
            const ended = await page.evaluate(() => {
                const v = document.querySelector('video');
                return v ? v.ended : false;
            });
            if (ended) {
                console.log("🎞️ Recording finished. Waiting for file save...");
                const wait = Date.now();
                while (!downloadDone && Date.now() - wait < 60000) await page.waitForTimeout(2000);
                break;
            }
        }
    } catch (e) {
        console.error("Automation error:", e.message);
        await page.screenshot({ path: 'pipeline_fail.png' });
    } finally {
        await browser.close();
    }
    return finalComposedPath;
}

main();
