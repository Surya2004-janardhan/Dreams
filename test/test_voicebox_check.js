const voiceboxService = require('../src/services/voiceboxService');
const path = require('path');
const fs = require('fs');

async function testCurrentVoicebox() {
  console.log("🧪 Testing current Voicebox (Simplified Model)...");

  const referenceAudio = path.resolve(__dirname, '../Base-audio.mp3');
  const outputDir = path.resolve(__dirname, './results');
  const outputFile = path.join(outputDir, `test_result_${Date.now()}.wav`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const script = "Have you ever wondered how artificial intelligence is changing the way we create content? It is absolutely incredible to see these tools in action! I am so excited to see what we build next, and the future looks brighter than ever before!";
  const customPrompt = "Start with a questioning tone, build to a high peak of energy, and end with an extremely happy and joyful expression.";

  try {
    console.log(`🎤 Using Reference: ${referenceAudio}`);
    console.log(`📝 Script: ${script}`);
    console.log(`🎨 Style: ${customPrompt}`);
    
    const start = Date.now();
    const result = await voiceboxService.generateClonedVoice(
      script,
      referenceAudio,
      outputFile,
      null, // Auto-transcribe
      customPrompt, // Custom style instruction
      1.0 // Normal speed
    );
    
    const duration = (Date.now() - start) / 1000;
    console.log(`\n✅ Test Finished in ${duration.toFixed(2)}s`);
    console.log(`📁 Result saved to: ${result}`);
    
    if (fs.existsSync(result)) {
      const stats = fs.statSync(result);
      console.log(`📏 File Size: ${(stats.size / 1024).toFixed(2)} KB`);
      if (stats.size < 50) {
        console.warn("⚠️ Warning: File size is very small (likely only a fragment).");
      }
    }
  } catch (err) {
    console.error("❌ Test Failed:", err.message);
  }
}

testCurrentVoicebox();
