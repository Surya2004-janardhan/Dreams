const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);
require('dotenv').config();

async function runAutomation() {
    const videoPath = path.resolve('merged_output.mp4');
    const srtPath = path.resolve('subtitles.srt');
    const promptPath = path.resolve('visual_prompt.txt');
    
    if (!fs.existsSync(videoPath) || !fs.existsSync(srtPath)) {
        console.error("❌ Missing video or SRT file. Run prepare_data.js first.");
        return;
    }

    let visualPrompt = "";
    if (fs.existsSync(promptPath)) {
        visualPrompt = fs.readFileSync(promptPath, 'utf8');
    }

    const uniqueKeys = [...new Set([
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_API_KEY_FOR_AUDIO,
        process.env.GEMINI_API_KEY_FOR_VISUALS,
        process.env.GEMINI_API_KEY_FOR_T2T
    ].filter(Boolean))];

    console.log(`🔑 Attempting automation with ${uniqueKeys.length} possible API keys...`);

    const browser = await chromium.launch({
        headless: false,
        args: [
            '--auto-select-desktop-capture-source=Entire screen',
            '--auto-select-tab-capture-source-by-title=Reel Composer',
            '--enable-usermedia-screen-capturing',
            '--allow-http-screen-capture',
            '--disable-infobars',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--mute-audio',
            '--window-size=1280,1000'
        ]
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        acceptDownloads: true
    });

    const page = await context.newPage();

    page.on('console', msg => console.log(`PAGE LOG: [${msg.type()}] ${msg.text()}`));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    let finalFilePath = "";
    let downloadComplete = false;

    page.on('download', async (download) => {
        const rawFileName = `raw_recorded_${Date.now()}.mp4`;
        const rawPath = path.join(process.cwd(), rawFileName);
        try {
            await download.saveAs(rawPath);
            console.log(`✅ Raw recording saved to ${rawPath}`);
            await new Promise(r => setTimeout(r, 2000));

            const outputFileName = `FINAL_REEL_${Date.now()}.mp4`;
            finalFilePath = path.join(process.cwd(), outputFileName);
            const originalAudioSource = path.resolve('merged_output.mp4');

            console.log("🎞️  Applying 400ms audio sync offset and merging...");
            
            await new Promise((resolve, reject) => {
                ffmpeg(rawPath)
                    .input(originalAudioSource)
                    .complexFilter([
                        {
                            filter: 'adelay',
                            options: '400|400',
                            inputs: '1:a',
                            outputs: 'delayed'
                        }
                    ])
                    .outputOptions([
                        '-y',
                        '-c:v libx264',
                        '-preset fast',
                        '-crf 22',
                        '-c:a aac',
                        '-map 0:v:0',
                        '-map [delayed]',
                        '-shortest'
                    ])
                    .output(finalFilePath)
                    .on('end', () => {
                        console.log(`✨ SUCCESS! Video ready: ${finalFilePath}`);
                        resolve();
                    })
                    .on('error', (err) => {
                        console.error("❌ FFmpeg merge failed:", err.message);
                        reject(err);
                    })
                    .run();
            });

            if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
            downloadComplete = true;
        } catch (err) {
            console.error("❌ Merging failure:", err.message);
        }
    });

    try {
        console.log("🌐 Navigating to Reel Composer...");
        await page.goto('http://localhost:3000', { timeout: 60000, waitUntil: 'networkidle' });

        // 1. Enter Keys
        console.log("🔑 Checking for API Key input...");
        const passwordInput = page.locator('input[type="password"]');
        await passwordInput.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});

        if (await passwordInput.isVisible().catch(() => false)) {
            let keyFound = false;
            for (const key of uniqueKeys) {
                console.log(`Trying API key: ${key.slice(0, 8)}...`);
                await passwordInput.fill(key);
                
                // Explicitly click the verify button as requested
                const verifyBtn = page.locator('button').filter({ hasText: /Enter Studio/i }).first();
                await verifyBtn.click();
                
                // Wait for success or error
                const result = await Promise.race([
                    page.waitForSelector('#video-upload', { state: 'attached', timeout: 15000 }).then(() => 'success'),
                    page.waitForSelector('text=failed', { timeout: 15000 }).then(() => 'fail'),
                    page.waitForTimeout(16000).then(() => 'timeout')
                ]);
                
                if (result === 'success') {
                    console.log("✅ API Key accepted!");
                    keyFound = true;
                    break;
                } else if (result === 'fail') {
                    console.warn("❌ Key failed validation. Clearing input...");
                    await passwordInput.fill('');
                } else {
                    console.warn("⚠️ Validation timed out.");
                    await passwordInput.fill('');
                }
            }
            if (!keyFound) {
                console.log("⚠️ No keys worked, trying manual mode...");
                await page.click('button:has-text("manual mode")').catch(() => {});
            }
        }

        // 2. Upload
        console.log("📁 Uploading Files...");
        await page.waitForSelector('#video-upload', { state: 'attached', timeout: 30000 });
        await page.setInputFiles('#video-upload', videoPath);
        await page.setInputFiles('#srt-upload', srtPath);
        console.log("✅ Files attached");

        await page.waitForTimeout(2000);
        console.log("🚀 Clicking Enter Studio to proceed...");
        const enterStudioBtn = page.locator('button').filter({ hasText: /Enter Studio|Compose Visualizer/i }).first();
        await enterStudioBtn.click();
        
        // 3. Prompt
        console.log("🎨 Filling Visual Prompt...");
        await page.waitForSelector('textarea', { state: 'visible', timeout: 30000 });
        await page.fill('textarea', visualPrompt);
        
        console.log("🎬 Clicking Generate Scene...");
        await page.click('button:has-text("Studio")'); 

        // 4. Wait
        console.log("⏳ Waiting for generation...");
        await page.waitForSelector('button:has-text("Rec & Export")', { timeout: 180000 });
        console.log("✅ Ready to record!");

        // 5. Record
        console.log("🔴 Starting Recording...");
        await page.click('button:has-text("Rec & Export")');
        await page.waitForTimeout(2000);
        await page.click('button:has-text("Browser Recorder")');
        
        console.log("⏳ Recording starting...");
        let playbackStarted = false;
        for (let i = 0; i < 20; i++) {
            playbackStarted = await page.evaluate(() => {
                const v = document.querySelector('video');
                return v && !v.paused && v.currentTime > 0;
            });
            if (playbackStarted) break;
            await page.waitForTimeout(1000);
        }

        console.log("⏳ Waiting for download trigger...");
        const start = Date.now();
        while (!downloadComplete && Date.now() - start < 300000) {
            await page.waitForTimeout(5000);
            const ended = await page.evaluate(() => {
                const v = document.querySelector('video');
                return v ? v.ended : false;
            });
            if (ended && !downloadComplete) {
                console.log("🎞️ Playback ended, waiting for file...");
            }
        }

        if (downloadComplete) {
            console.log("✨ Automation DONE!");
        } else {
            console.log("⚠️ No download captured.");
        }

    } catch (error) {
        console.error("❌ Error:", error.message);
        await page.screenshot({ path: 'automation_fail.png' });
    } finally {
        await page.waitForTimeout(3000);
        await browser.close();
    }
}

runAutomation();
