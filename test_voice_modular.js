const voiceboxService = require("./src/services/voiceboxService");
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
require('dotenv').config();

/**
 * PURE MODULAR VOICE TEST SCRIPT
 * Focuses strictly on the internal Voicebox service with hardcoded segments
 * and modulation injection (instruct parameter).
 */

const REF_AUDIO = 'test.mp3'; // Reference voice
const TEST_SCRIPT_SEGMENTS = [
    { text: "Wait, did you know that Bloom Filters never return a false negative?", style: "surprised questioning tone" },
    { text: "Surprise! It's all about probabilistic data structures.", style: "excited discovery tone" },
    { text: "High-node processing requires extreme memory efficiency.", style: "serious technical authoritative tone" },
    { text: "Question is: How will YOU optimize your next big data pipeline?", style: "engaging inquisitive tone" }
];

async function main() {
    console.log("🚀 Starting Pure Modular Voice Test...");

    const tempDir = path.resolve('temp_test');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

    try {
        if (!fs.existsSync(path.resolve(REF_AUDIO))) {
            throw new Error(`Reference audio not found: ${REF_AUDIO}`);
        }

        // 1. Generate Expressive Audio Segments
        console.log("🗣️ Generating 4-Line Modular Expressive Audio...");
        const segmentPaths = [];
        
        for (let i = 0; i < TEST_SCRIPT_SEGMENTS.length; i++) {
            const { text, style } = TEST_SCRIPT_SEGMENTS[i];
            const outputPath = path.join(tempDir, `segment_${i}.wav`);
            
            console.log(`   [${i+1}/4] Synthesizing: "${text.substring(0, 30)}..." with style: ${style}`);
            const segmentPath = await voiceboxService.generateClonedVoice(
                text, 
                REF_AUDIO, 
                outputPath, 
                null, 
                style, 
                1.0 // speed
            );
            segmentPaths.push(segmentPath);
        }

        // 2. Merge Segments using FFmpeg
        console.log("🎞️ Merging expressive segments into final audio...");
        const finalOutput = path.resolve('test_modular_output.wav');
        
        await new Promise((resolve, reject) => {
            let command = ffmpeg();
            segmentPaths.forEach(p => {
                command = command.input(p);
            });
            
            command
                .on('error', (err) => {
                    console.error("FFmpeg Error:", err);
                    reject(err);
                })
                .on('end', () => {
                    console.log("Merge Complete.");
                    resolve();
                })
                .mergeToFile(finalOutput, tempDir);
        });

        console.log(`\n✨ TEST SUCCESSFUL: Full modular audio created at ${finalOutput}`);
        console.log("Listen to 'test_modular_output.wav' to verify the expressive modulation.");

    } catch (err) {
        console.error("❌ Test Failed:", err.message);
    } finally {
        // Cleanup temp segments if desired
        // segmentPaths.forEach(p => { if(fs.existsSync(p)) fs.unlinkSync(p); });
    }
}

main();
