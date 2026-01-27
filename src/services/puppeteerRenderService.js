const puppeteer = require('puppeteer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Renders HTML content to PNG frames saved in a directory
 * @param {string} htmlContent - HTML to render
 * @param {string} outputDir - Directory to save frames
 * @param {number} duration - Seconds
 * @param {number} fps - FPS
 */
const renderHTMLToFrames = async (htmlContent, outputDir, duration, fps = 15) => {
    console.log(`Rendering HTML to frames in ${outputDir}...`);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: false // Visible for debugging
    });
    const page = await browser.newPage();
    
    // Load wrapper template
    const wrapperPath = path.resolve(__dirname, '../templates/reel-wrapper.html');
    let wrapperHTML = fs.readFileSync(wrapperPath, 'utf-8');
    
    // Extract head scripts and styles from generated HTML
    const headMatch = htmlContent.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    const headContent = headMatch ? headMatch[1] : '';
    
    // Extract body content
    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : htmlContent;
    
    // Build final HTML: wrapper + head content + body content
    let finalHTML = wrapperHTML;
    
    // Inject head content (scripts, styles) BEFORE closing </head>
    finalHTML = finalHTML.replace('</head>', `${headContent}</head>`);
    
    // Inject body content
    finalHTML = finalHTML.replace('<!-- CONTENT_PLACEHOLDER -->', bodyContent);
    
    // Capture logs
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    page.on('pageerror', err => console.error('PAGE ERROR:', err));
    
    await page.setViewport({ width: 1080, height: 1920 });
    await page.setContent(finalHTML, { waitUntil: 'networkidle0' });
    
    // Wait for GSAP and check status
    await new Promise(r => setTimeout(r, 2000));
    
    const status = await page.evaluate(() => {
        return {
            gsap: typeof window.gsap !== 'undefined',
            mainTimeline: typeof window.mainTimeline !== 'undefined',
            tl: typeof window.tl !== 'undefined',
            elementCount: document.body.getElementsByTagName('*').length
        };
    });
    
    console.log('Page Status:', JSON.stringify(status, null, 2));

    const totalFrames = Math.ceil(duration * fps);
    console.log(`Rendering ${totalFrames} frames (${duration}s @ ${fps}fps)`);

    for (let i = 0; i < totalFrames; i++) {
        const time = i / fps;
        
        // Send time update
        await page.evaluate((t) => {
            window.postMessage({ type: 'timeupdate', time: t }, '*');
        }, time);

        // Small delay for animation to update
        await new Promise(r => setTimeout(r, 16)); // ~60fps delay

        const pad = i.toString().padStart(5, '0');
        const framePath = path.join(outputDir, `frame_${pad}.png`);
        
        await page.screenshot({
            path: framePath,
            omitBackground: true
        });

        if (i === 0) {
            const stats = fs.statSync(framePath);
            console.log(`Frame 0 Size: ${stats.size} bytes`);
        }

        if (i % 10 === 0) console.log(`Saved frame ${i}/${totalFrames}`);
    }
    
    await browser.close();
    console.log("Frames rendered successfully!");
};

/**
 * Composites Base Video + Image Sequence + Audio
 */
const compositeFramesWithVideo = async (baseVideo, framesDir, audioPath, finalPath, fps = 15) => {
    console.log(`Compositing Frames + Base Video -> ${finalPath}`);
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(baseVideo) // Input 0
            .input(path.join(framesDir, 'frame_%05d.png')) // Input 1 (Sequence)
            .inputOptions([`-framerate ${fps}`])
            .input(audioPath) // Input 2 (Audio)
            .complexFilter([
                "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[base]",
                "[1:v]format=rgba,scale=1080:1920[overlay]",
                "[base][overlay]overlay=0:0:format=auto[outv]"
            ])
            .outputOptions([
                "-map [outv]",
                "-map 2:a",
                "-c:v libx264",
                "-enc_time_base -1",
                "-c:a aac",
                "-shortest",
                "-pix_fmt yuv420p" // Important for compatibility
            ])
            .output(finalPath)
            .on('end', () => {
                console.log("Composite finished.");
                resolve(finalPath);
            })
            .on('error', (err) => {
                console.error("Composite error:", err);
                reject(err);
            })
            .on('stderr', (l) => console.log('FFmpeg:', l))
            .run();
    });
};

module.exports = {
  renderHTMLToFrames,
  compositeFramesWithVideo
};
