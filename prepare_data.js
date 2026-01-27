require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { generateScript, generateVisualPrompt } = require('./src/services/scriptService');
const { generateAudioWithBatchingStrategy } = require('./src/services/audioService');
const { generateSRT } = require('./src/services/newFeaturesService');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

async function prepareData() {
    const TOPIC = process.argv[2] || "The Future of AI Agents";
    console.log(`🚀 Preparing data for topic: ${TOPIC}`);

    const CACHE_DIR = path.resolve("test_cache");
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);

    try {
        // 1. Generate Script
        console.log("📝 Step 1: Generating Script...");
        const script = await generateScript(TOPIC);
        fs.writeFileSync(path.join(CACHE_DIR, "production_script.txt"), script);
        console.log("✅ Script Generated");

        // 2. Generate Audio
        console.log("🎤 Step 2: Generating Audio...");
        const audioResult = await generateAudioWithBatchingStrategy(script);
        const audioPath = audioResult.conversationFile;
        console.log(`✅ Audio Generated: ${audioPath}`);

        // 3. Merge Video + Audio
        console.log("🎞️ Step 3: Merging Audio with Base Video...");
        const BASE_VIDEO_PATH = path.resolve("BASE-VEDIO.mp4");
        const MERGED_VIDEO_PATH = path.resolve("merged_output.mp4");
        
        await new Promise((resolve, reject) => {
            console.log("Starting ffmpeg command...");
            ffmpeg(BASE_VIDEO_PATH)
                .input(audioPath)
                .outputOptions([
                    '-c:v copy',
                    '-c:a aac',
                    '-map 0:v:0',
                    '-map 1:a:0',
                    '-shortest'
                ])
                .output(MERGED_VIDEO_PATH)
                .on('start', (cmd) => console.log('FFmpeg started:', cmd))
                .on('end', () => {
                    console.log('FFmpeg finished');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('FFmpeg error:', err);
                    reject(err);
                })
                .run();
        });
        console.log(`✅ Merged Video Created: ${MERGED_VIDEO_PATH}`);

        // 4. Generate SRT
        console.log("📜 Step 4: Generating Subtitles...");
        const srtResult = await generateSRT(audioPath, process.env.GEMINI_API_KEY_FOR_AUDIO);
        fs.writeFileSync('subtitles.srt', srtResult.srt);
        console.log("✅ SRT Generated");

        // 5. Generate Visual Prompt (Refined)
        console.log("🎨 Step 5: Generating Visual Prompt (Simplified)...");
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

        
        const Groq = require("groq-sdk");
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: groqPrompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
        });
        const visualPrompt = completion.choices[0].message.content;
        fs.writeFileSync('visual_prompt.txt', visualPrompt);
        console.log("✅ Visual Prompt Generated");

        console.log("\n✨ DATA PREPARATION COMPLETE ✨");

        console.log("- merged_output.mp4");
        console.log("- subtitles.srt");
        console.log("- visual_prompt.txt");

    } catch (error) {
        console.error("❌ Data preparation failed:", error);
        process.exit(1);
    }
}

prepareData();
