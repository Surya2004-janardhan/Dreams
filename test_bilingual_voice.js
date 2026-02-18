const voiceboxService = require('./src/services/voiceboxService');
const path = require('path');
const fs = require('fs');
const logger = require('./src/config/logger');

async function testBilingualVoice() {
    logger.info("🎬 Starting Bilingual Voice Cloning Test...");

    const REF_AUDIO = path.resolve('punju-voice.mp3');
    const OUTPUT_AUDIO = path.resolve('audio/punju_bilingual_test.wav');

    // Ensure audio directory exists
    if (!fs.existsSync(path.dirname(OUTPUT_AUDIO))) {
        fs.mkdirSync(path.dirname(OUTPUT_AUDIO), { recursive: true });
    }

    const script = `mama neku nenu cheppa ga already Ee roju manam kotha Telugu mariyu English voice model ni test chestunnam.
    `.trim();

    logger.info(`📝 Script: \n${script}`);

    try {
        const resultPath = await voiceboxService.generateClonedVoice(
            script, 
            REF_AUDIO, 
            OUTPUT_AUDIO, 
            null, 
            "Professional educational tone, natural bilingual flow."
        );
        logger.info(`✅ Test Successful! Audio generated at: ${resultPath}`);
    } catch (error) {
        logger.error(`❌ Test Failed: ${error.message}`);
        process.exit(1);
    }
}

testBilingualVoice();
