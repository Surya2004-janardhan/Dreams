const textToSpeech = require("@google-cloud/text-to-speech");
require("dotenv").config();
const fs = require("fs");

async function testGoogleTTS() {
  try {
    console.log("🔊 Testing Google Text-to-Speech...");

    // Initialize client
    const client = new textToSpeech.TextToSpeechClient({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
    });

    // Test request
    const request = {
      input: { text: "Hello! This is a test of Google Text to Speech." },
      voice: {
        languageCode: "en-US",
        name: "en-US-Journey-D",
        ssmlGender: "MALE",
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 1.0,
        pitch: 0.0,
      },
    };

    const [response] = await client.synthesizeSpeech(request);

    // Save test audio
    fs.writeFileSync("test_audio.mp3", response.audioContent, "binary");

    console.log("✅ Google TTS test successful!");
    console.log(
      `📁 Audio saved as test_audio.mp3 (${response.audioContent.length} bytes)`
    );

    // Clean up
    setTimeout(() => {
      if (fs.existsSync("test_audio.mp3")) {
        fs.unlinkSync("test_audio.mp3");
        console.log("🧹 Test file cleaned up");
      }
    }, 5000);
  } catch (error) {
    console.error("❌ Google TTS test failed:", error.message);
    if (error.code) {
      console.error("Error code:", error.code);
    }
    if (error.details) {
      console.error("Error details:", error.details);
    }
  }
}

testGoogleTTS();
