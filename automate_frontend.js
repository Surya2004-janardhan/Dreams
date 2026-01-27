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

    const keys = [
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_API_KEY_FOR_AUDIO,
        process.env.GEMINI_API_KEY_FOR_VISUALS,
        process.env.GEMINI_API_KEY_FOR_T2T
    ].filter(Boolean);

    const uniqueKeys = [...new Set(keys)];
    console.log(`🔑 Attempting automation with ${uniqueKeys.length} possible API keys...`);

    console.log("🚀 Launching Browser...");
    const browser = await chromium.launch({
        headless: false,
        args: [
            '--auto-select-desktop-capture-source=Entire screen', // Windows logic 
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

    // Console logging
    page.on('console', msg => {
        const text = msg.text();
        console.log(`PAGE LOG: [${msg.type()}] ${text}`);
    });
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    let finalFilePath = "";
    let downloadComplete = false;

    // Listen for download
    page.on('download', async (download) => {
        const rawFileName = `raw_recorded_${Date.now()}.mp4`;
        const rawPath = path.join(process.cwd(), rawFileName);
        console.log(`📥 Download started. Target: ${rawPath}`);
        
        try {
            await download.saveAs(rawPath);
            console.log(`✅ Raw recording saved to ${rawPath}`);
            
            await new Promise(r => setTimeout(r, 2000));

            const outputFileName = `FINAL_REEL_${Date.now()}.mp4`;
            finalFilePath = path.join(process.cwd(), outputFileName);
            const originalAudioSource = path.resolve('merged_output.mp4');

            console.log("🎞️  Final remuxing: merging visuals with original HQ audio...");
            
            await new Promise((resolve, reject) => {
                ffmpeg(rawPath)
                    .input(originalAudioSource)
                    .complexFilter([
                        {
                            filter: 'adelay',
                            options: '400|400',
                            inputs: '1:a',
                            outputs: 'delayed_audio'
                        }
                    ])
                    .outputOptions([
                        '-y',
                        '-c:v libx264',
                        '-preset fast',
                        '-crf 22',
                        '-c:a aac',
                        '-map 0:v:0',
                        '-map [delayed_audio]',
                        '-shortest'
                    ])
                    .output(finalFilePath)
                    .on('start', (cmd) => console.log('FFmpeg command executed'))
                    .on('end', () => {
                        console.log(`✨ SUCCESS! Video ready: ${finalFilePath}`);
                        resolve();
                    })
                    .on('error', (err, stdout, stderr) => {
                        console.error("❌ FFmpeg merge error:", err.message);
                        reject(err);
                    })
                    .run();
            });

            if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
            downloadComplete = true;
        } catch (err) {
            console.error("❌ Download process failure:", err.message);
        }
    });

    try {
        console.log("🌐 Navigating to Reel Composer...");
        await page.goto('http://localhost:3000', { timeout: 60000, waitUntil: 'networkidle' });

        // 1. Handle API Key Entrance
        console.log("🔑 Checking for API Key input...");
        const passwordInput = page.locator('input[type="password"]');
        await passwordInput.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});

        if (await passwordInput.isVisible().catch(() => false)) {
            let keyFound = false;
            for (const key of uniqueKeys) {
                console.log(`Trying API key: ${key.slice(0, 8)}...`);
                await passwordInput.fill(key);
                
                const enterBtn = page.locator('button:has-text("Enter Studio")').first();
                await enterBtn.click();
                
                console.log("⏳ Validating key...");
                // Wait for either the upload field (success) or an error message (fail)
                const result = await Promise.race([
                    page.waitForSelector('#video-upload', { timeout: 15000 }).then(() => 'success'),
                    page.waitForSelector('text=failed', { timeout: 15000 }).then(() => 'fail'),
                    page.waitForTimeout(16000).then(() => 'timeout')
                ]);
                
                if (result === 'success') {
                    console.log("✅ API Key accepted!");
                    keyFound = true;
                    break;
                } else if (result === 'fail') {
                    console.warn("❌ Key failed validation.");
                } else {
                    console.warn("⚠️ Validation timed out or getting stuck. Retrying click or next key...");
                    await enterBtn.click().catch(() => {});
                    await page.waitForTimeout(3000);
                }
            }
            if (!keyFound) {
                console.warn("⚠️ All API keys failed or timed out. Attempting manual mode to proceed...");
                await page.click('button:has-text("manual mode")').catch(() => {});
                await page.waitForSelector('#video-upload', { timeout: 10000 }).catch(() => {});
            }
        }

        // 2. Upload Files
        console.log("📁 Uploading Files...");
        await page.waitForSelector('#video-upload', { state: 'attached', timeout: 30000 });
        await page.setInputFiles('#video-upload', videoPath);
        console.log("✅ Video attached");

        await page.waitForSelector('#srt-upload', { state: 'attached', timeout: 30000 });
        await page.setInputFiles('#srt-upload', srtPath);
        console.log("✅ SRT attached");

        console.log("⏳ Processing data...");
        await page.waitForTimeout(5000);

        const composeBtn = page.locator('button').filter({ hasText: /Enter Studio|Compose Visualizer/i }).first();
        await composeBtn.click();
        await page.waitForTimeout(6000);

        // 3. Enter Visual Prompt
        console.log("🎨 Entering Visual Prompt...");
        await page.waitForSelector('textarea', { timeout: 30000 });
        await page.fill('textarea', visualPrompt);
        console.log("✅ Visual Prompt filled");
        
        console.log("🎬 Initiating Studio Generation...");
        await page.click('button:has-text("Studio")'); 

        // 4. Wait for generation
        console.log("⏳ Waiting for generation (max 180s)...");
        await page.waitForSelector('button:has-text("Rec & Export")', { timeout: 180000 });
        console.log("✅ Scene Generated!");

        // 5. Start Recording
        console.log("🔴 Starting Recording Process...");
        await page.click('button:has-text("Rec & Export")');
        await page.waitForTimeout(2000);
        
        console.log("🖱️ Triggering Browser Recorder...");
        await page.click('button:has-text("Browser Recorder")');
        
        console.log("⏳ Recording... monitoring playback state...");
        
        let playbackDetected = false;
        for (let i = 0; i < 30; i++) {
            playbackDetected = await page.evaluate(() => {
                const v = document.querySelector('video');
                return v && !v.paused && v.currentTime > 0;
            });
            if (playbackDetected) {
                console.log("🎥 Playback live! Recording in progress...");
                break;
            }
            await page.waitForTimeout(1000);
        }

        console.log("⏳ Waiting for video completion...");
        const sessionStart = Date.now();
        while (!downloadComplete && Date.now() - sessionStart < 300000) {
            await page.waitForTimeout(5000);
            
            const isEnded = await page.evaluate(() => {
                const v = document.querySelector('video');
                return v ? v.ended : false;
            });
            
            if (isEnded && !downloadComplete) {
                console.log("🎞️ Video finished playback. Waiting for automatic download...");
            }
        }

        if (downloadComplete) {
            console.log("✨ Automation lifecycle complete!");
        } else {
            console.log("⚠️ Recording may have finished but no download was captured.");
        }

    } catch (error) {
        console.error("❌ Automation lifecycle error:", error.message);
        await page.screenshot({ path: 'automation_fail.png' });
    } finally {
        await page.waitForTimeout(5000);
        await browser.close();
    }
}

runAutomation();
