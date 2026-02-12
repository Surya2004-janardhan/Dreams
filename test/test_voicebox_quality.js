require('dotenv').config();
const voiceboxService = require('../src/services/voiceboxService');
const path = require('path');
const fs = require('fs');

/**
 * TEST: Voicebox Audio Quality Check
 * This script tests the real audio quality using a dummy technical script.
 */
async function testAudioQuality() {
  console.log("🧪 Starting Voicebox Quality Test...");

  // 1. Setup paths
  const referenceAudio = path.resolve(__dirname, '../Base-audio.wav');
  const outputDir = path.resolve(__dirname, './results');
  const outputFile = path.join(outputDir, `quality_test_${Date.now()}.wav`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 2. High-Modulation Technical Script
  const dummyScript = `
    Listen... the future of software isn't built on just code anymore. It's built on INTELLIGENCE. 
    If you're still using old-school databases, you're literally living in the past! 
    But don't worry... I can help you fix it. Let's start with your data pipeline, and then? 
    Then we scale it to the moon!
  `.trim();

  // 3. Manual Reference Text
  const manualRefText = "Hello, this is a sample recording of my natural speaking voice used for cloning.";

  // 4. Expression & Modulation Instructions
  const viralInstructions = "Speak with a calm, confident, and professional tone.";

  try {
    if (!fs.existsSync(referenceAudio)) {
      throw new Error(`Reference audio not found at: ${referenceAudio}. Please ensure Base-audio.wav exists in the root.`);
    }

    console.log(`🎤 Reference: ${referenceAudio}`);
    console.log(`📝 Script Length: ${dummyScript.length} characters`);
    console.log("⏳ Synthesizing... (Whisper STT skipped, jumping straight to Voicebox)");

    const startTime = Date.now();
    
    // Generate the voice
    const resultPath = await voiceboxService.generateClonedVoice(
      dummyScript, 
      referenceAudio, 
      outputFile, 
      null, // Set to null to enable automatic Whisper STT transcription
      viralInstructions, 
      0.9 
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log("\n✅ QUALITY TEST COMPLETE!");
    console.log(`🕒 Time Taken: ${duration}s`);
    console.log(`📁 Final Audio saved to: ${resultPath}`);
    console.log("\nListen for: \n1. Pitch variation on 'REAL' and 'LLM'.\n2. Natural pauses at ellipses (...).\n3. Breathiness and vocal texture.");

  } catch (error) {
    console.error("❌ Quality Test Failed:", error.message);
  }
}

// Run the test
testAudioQuality();
