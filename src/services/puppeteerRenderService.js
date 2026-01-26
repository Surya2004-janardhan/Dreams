const puppeteer = require('puppeteer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Renders HTML content to a transparent video (WebM with Alpha)
 * @param {string} htmlContent - The HTML string to render
 * @param {string} outputPath - Path to save the output video
 * @param {number} duration - Duration in seconds
 * @param {number} fps - Frames per second
 */
const renderHTMLToVideo = async (htmlContent, outputPath, duration, fps = 30) => {
    console.log(`Starting HTML render to ${outputPath}...`);
    
    // Launch Puppeteer
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: "new"
    });
    const page = await browser.newPage();
    
    // Set viewport to 1080x1920 (Portrait)
    await page.setViewport({ width: 1080, height: 1920 });
    
    // Set content
    await page.setContent(htmlContent);
    
    // Ensure transparent background
    await page.evaluate(() => {
        document.body.style.background = 'transparent';
        document.documentElement.style.background = 'transparent';
        if(document.querySelector('#stage')) {
            document.querySelector('#stage').style.background = 'transparent'; // Override reference gradient
        }
    });

    console.log("Page loaded. Starting recording...");

    // Start FFmpeg process to receive frames
    const ffmpegProc = ffmpeg()
        .input('pipe:0')
        .inputOptions([
            `-f image2pipe`,
            `-r ${fps}`,
            `-vcodec png` // Reading PNGs from stdin
        ])
        .outputOptions([
            `-c:v libvpx-vp9`, 
            `-pix_fmt yuva420p`,
            `-b:v 2M`,
            `-auto-alt-ref 0`,
            `-cpu-used 8`,      // Fastest encoding
            `-deadline realtime` // Realtime deadline
        ])
        .output(outputPath)
        .on('end', () => console.log('FFmpeg Render finished'))
        .on('error', (e) => console.error('FFmpeg Render error:', e))
        .on('stderr', (line) => console.log('FFmpeg Log:', line)); // LOG FFMPEG OUTPUT

    const ffmpegStream = ffmpegProc.pipe();
    
    const totalFrames = Math.ceil(duration * fps);
    console.log(`Total frames to render: ${totalFrames} (Duration: ${duration}s, FPS: ${fps})`);

    for (let i = 0; i < totalFrames; i++) {
        const time = i / fps;
        
        try {
            // console.log(`Processing frame ${i}...`);
            await page.evaluate((t) => {
                window.postMessage({ type: 'timeupdate', time: t }, '*');
            }, time);
            
            // console.log("Taking screenshot...");
            const startSnap = Date.now();
            const buffer = await page.screenshot({ 
                type: 'png',
                omitBackground: true 
            });
            // console.log(`Screenshot taken in ${Date.now() - startSnap}ms`);
            
            // console.log("Writing to stream...");
            const ok = ffmpegStream.write(buffer);
            if (!ok) {
                console.log("Buffer full, waiting for drain...");
                await new Promise(resolve => ffmpegStream.once('drain', resolve));
                console.log("Drained.");
            }
            
            console.log(`Rendered frame ${i}/${totalFrames} (Snap: ${Date.now() - startSnap}ms)`);
        } catch (err) {
            console.error(`Error rendering frame ${i}:`, err);
            break;
        }
    }
    
    // Close stream
    ffmpegStream.end();
    
    // Wait for FFmpeg to finish
    await new Promise((resolve, reject) => {
        ffmpegProc.on('end', resolve).on('error', reject);
    });
    
    await browser.close();
    console.log("HTML Render completed.");
    return outputPath;
};

/**
 * Composite Video: Base + Overlay + Audio
 */
const compositeVideo = async (baseVideo, overlayVideo, audioPath, finalPath) => {
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(baseVideo)
            .input(overlayVideo)
            .input(audioPath)
            .complexFilter([
                "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[base]",
                "[1:v]scale=1080:1920[overlay]",
                "[base][overlay]overlay[outv]"
            ])
            .outputOptions([
                "-map [outv]",
                "-map 2:a",
                "-c:v libx264",
                "-c:a aac",
                "-shortest"
            ])
            .output(finalPath)
            .on('end', () => resolve(finalPath))
            .on('error', reject)
            .run();
    });
};

module.exports = {
  renderHTMLToVideo,
  compositeVideo
};
