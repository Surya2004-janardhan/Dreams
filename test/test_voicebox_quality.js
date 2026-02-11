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

  // 2. Technical Dummy Script (Varied punctuation to test prosody)
  const dummyScript = `
    Look... building AI agents is easy. But building agents that actually work? That's the REAL challenge. 
    The secret isn't just the LLM—it's the feedback loop between the perception and the action. 
    Which basically means... you need to stop over-engineering your prompts and start focusing on your data reliability. 
    Anyway, if you're seeing this, the audio quality is definitely working. Let's get back to building something amazing!
  `.trim();

  // 3. Manual Reference Text (Prevents slow Whisper/STT loading)
  const manualRefText = "Hello, this is a sample recording of my natural speaking voice used for cloning.";

  // 4. Cloned Voice Instructions (The "Elite" Style)
  const viralInstructions = "Deliver this with high-octane energy, vary pitch for technical keywords, and use natural pauses.";

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
      manualRefText, // Provided manually to skip STT load
      viralInstructions, 
      // Slightly slower for better clarity
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
