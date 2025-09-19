const {
  generateAudioWithBatchingStrategy,
} = require("../src/services/audioService");

async function testGeminiAudio() {
  console.log("Testing Gemini TTS audio generation...");

  const script = `Rani: Hey Raj, what are your plans for the weekend, yaar? Tell me na?
Raj: Actually, I was thinking of going to the beach, you know, to relax and unwind. See, basically, I've been working non-stop for weeks, right? So, I need a break.
Rani: Oh, that sounds cool! I'm planning to go to the mall with my friends, no yaar, we're going to catch a movie and do some shopping.
Raj: No yaar, you should join me at the beach, it'll be more fun, you know? We can play some games, have a picnic, and just chill out.
Rani: Hmm, that's tempting, but I've already committed to my friends, yaar. Maybe next time, right?`;

  try {
    const audioResult = await generateAudioWithBatchingStrategy(script);
    console.log("Gemini audio generation successful!");
    console.log("Audio file:", audioResult.conversationFile);
    console.log("Segments:", audioResult.segments.length);
    console.log(
      "Total duration estimate:",
      audioResult.segments.reduce((sum, seg) => sum + seg.duration, 0)
    );
    return audioResult;
  } catch (error) {
    console.error("Gemini audio generation failed:", error.message);
  }
}

testGeminiAudio();
