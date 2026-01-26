require('dotenv').config();
const { generateAudioWithBatchingStrategy } = require('./src/services/audioService');
const fs = require('fs');

async function testAudio() {
    try {
        console.log("Testing Audio Generation...");
        const script = fs.readFileSync('test_cache/cached_script.txt', 'utf-8');
        console.log("Script:", script.substring(0, 50) + "...");
        
        const result = await generateAudioWithBatchingStrategy(script);
        console.log("Success!", result);
    } catch (e) {
        console.error("Audio Generation Failed:", e);
    }
}

testAudio();
