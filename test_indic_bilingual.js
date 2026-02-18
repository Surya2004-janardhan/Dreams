const IndicF5Service = require('./src/services/indicF5Service');
const path = require('path');
const fs = require('fs');
const logger = require('./src/config/logger');

async function testIndicBilingual() {
    logger.info("🎬 Starting IndicF5 Bilingual Test...");

    const REF_AUDIO = path.resolve('punju-voice.mp3');
    const REF_TEXT = "Hi, I'm testing my voice for cloning."; // Ideally this matches the audio
    const OUTPUT_AUDIO = path.resolve('audio/indic_bilingual_test.wav');

    if (!fs.existsSync(path.dirname(OUTPUT_AUDIO))) {
        fs.mkdirSync(path.dirname(OUTPUT_AUDIO), { recursive: true });
    }

    // Direct Telugu + English mixed
    const script = `
        నమస్కారం! ఈ రోజు మనం AI Content Automation గురించి మాట్లాడుకుందాం. 
        We are testing the new IndicF5 model for better bilingual support.
    `.trim();

    logger.info(`📝 Script: \n${script}`);

    try {
        const resultPath = await IndicF5Service.generateBilingualVoice(
            script, 
            REF_AUDIO, 
            REF_TEXT, 
            OUTPUT_AUDIO
        );
        logger.info(`✅ Test Successful! Audio generated at: ${resultPath}`);
    } catch (error) {
        logger.error(`❌ Test Failed: ${error.message}`);
        console.error(error);
    }
}

testIndicBilingual();
