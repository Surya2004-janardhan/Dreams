const {
  generateAudioWithBatchingStrategy,
} = require("../src/services/audioService");

async function testGeminiAudio() {
  console.log("Testing Gemini TTS audio generation...");

  const script = `Welcome to this educational video on artificial intelligence. Today, we're going to explore how AI is transforming our world in ways we never imagined. From self-driving cars to medical diagnosis, AI is everywhere. But what exactly is artificial intelligence? At its core, AI is the simulation of human intelligence in machines that are programmed to think and learn like humans. There are different types of AI, including narrow AI which is designed for specific tasks, and general AI which can perform any intellectual task that a human can do. Machine learning is a subset of AI that allows systems to automatically learn and improve from experience without being explicitly programmed. Deep learning, a further subset, uses neural networks with many layers to process data in complex ways. The applications of AI are vast and growing. In healthcare, AI helps doctors diagnose diseases more accurately and quickly. In transportation, it powers autonomous vehicles that can navigate safely. In finance, AI detects fraudulent transactions in real-time. However, with great power comes great responsibility. We must ensure that AI is developed ethically and doesn't harm society. As we continue to advance, the future of AI looks incredibly promising, but it requires careful stewardship to maximize its benefits for humanity.`;

  try {
    const audioResult = await generateAudioWithBatchingStrategy(script);
    console.log("Gemini audio generation successful!");
    console.log("Audio file:", audioResult.conversationFile);
    console.log("Segments:", audioResult.segments.length);
    console.log(
      "Total duration estimate:",
      audioResult.segments.reduce((sum, seg) => sum + seg.duration, 0),
    );
    return audioResult;
  } catch (error) {
    console.error("Gemini audio generation failed:", error.message);
  }
}

testGeminiAudio();
