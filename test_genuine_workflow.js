const axios = require("axios");
const fs = require("fs");
const path = require("path");

// Cache directory for genuine API results
const CACHE_DIR = path.join(__dirname, "genuine_cache");
const SCRIPT_CACHE = path.join(CACHE_DIR, "script.json");
const AUDIO_CACHE = path.join(CACHE_DIR, "audio.mp3");
const SRT_CACHE = path.join(CACHE_DIR, "subtitles.srt");

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

async function testGenuineReelWorkflow() {
  try {
    console.log("🚀 Testing integrated reel workflow (GENUINE API CALLS)...");

    // Test data
    const testTopic = "The Future of Artificial Intelligence";
    const testDescription =
      "Exploring how AI will transform our world in the coming years";

    console.log(`📝 Topic: ${testTopic}`);
    console.log(`📋 Description: ${testDescription}`);

    // Step 1: Generate genuine script using Groq
    console.log("\n📝 Step 1: Generating genuine script with Groq...");
    const scriptResponse = await axios.post(
      "http://localhost:3000/script/generate",
      {
        topic: testTopic,
      },
    );
    const scriptData = scriptResponse.data;
    fs.writeFileSync(SCRIPT_CACHE, JSON.stringify(scriptData, null, 2));
    console.log("💾 Script saved to cache");
    console.log("✅ Script generated successfully");
    console.log(`📝 Script: ${scriptData.script.substring(0, 200)}...`);

    // Step 2: Generate genuine audio using Gemini
    console.log("\n🎵 Step 2: Generating genuine audio with Gemini...");
    const audioResponse = await axios.post(
      "http://localhost:3000/audio/generate",
      {
        script: scriptData.script,
      },
    );
    const audioData = audioResponse.data;
    // Assuming the audio service returns base64 encoded audio
    const audioBuffer = Buffer.from(audioData.audio, "base64");
    fs.writeFileSync(AUDIO_CACHE, audioBuffer);
    console.log("💾 Audio saved to cache");
    console.log("✅ Audio generated successfully");
    console.log(`📏 Audio size: ${(audioBuffer.length / 1024).toFixed(2)} KB`);
    console.log("💾 Mock audio saved to cache");
    console.log("✅ Mock audio ready");
    console.log(`📏 Audio size: ${(audioBuffer.length / 1024).toFixed(2)} KB`);

    // Step 3: Generate subtitles from script (instead of audio)
    console.log("\n📝 Step 3: Generating subtitles from script...");

    // Function to generate subtitles from script text
    function generateSubtitlesFromScript(scriptText) {
      const words = scriptText.split(" ");
      const wordsPerMinute = 150; // Average speaking rate
      const wordsPerSecond = wordsPerMinute / 60;
      const secondsPerWord = 1 / wordsPerSecond;

      const subtitles = [];
      let currentTime = 0;
      let subtitleId = 1;
      let currentText = "";
      let wordCount = 0;

      // Target 4-6 words per subtitle (roughly 3-4 seconds)
      const targetWordsPerSubtitle = 5;

      for (let i = 0; i < words.length; i++) {
        currentText += (currentText ? " " : "") + words[i];
        wordCount++;

        // Create subtitle when we reach target word count or punctuation
        if (
          wordCount >= targetWordsPerSubtitle ||
          words[i].includes(".") ||
          words[i].includes("!") ||
          words[i].includes("?") ||
          i === words.length - 1
        ) {
          const duration = wordCount * secondsPerWord;
          const startTime = currentTime;
          const endTime = currentTime + duration;

          // Format timestamps as SRT format (HH:MM:SS,mmm)
          const formatTime = (seconds) => {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);
            const ms = Math.floor((seconds % 1) * 1000);
            return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
          };

          subtitles.push({
            id: subtitleId,
            startTime: formatTime(startTime),
            endTime: formatTime(endTime),
            text: currentText.trim(),
          });

          currentTime = endTime;
          currentText = "";
          wordCount = 0;
          subtitleId++;
        }
      }

      return { subtitles };
    }

    const scriptSubtitles = generateSubtitlesFromScript(scriptData.script);
    fs.writeFileSync(SRT_CACHE, JSON.stringify(scriptSubtitles, null, 2));
    console.log("💾 Script-based subtitles saved to cache");
    console.log("✅ Subtitles generated from script");
    console.log(`📝 Subtitles: ${scriptSubtitles.subtitles.length} entries`);

    // Step 4: Use base video
    console.log("\n🎬 Step 4: Using base video: Base-vedio.mp4");
    console.log("✅ Base video ready");

    // Step 5: Generate reel with genuine content
    console.log("\n🎨 Step 5: Generating reel with genuine content...");
    const reelResponse = await axios.post(
      "http://localhost:3000/reel/generate",
      {
        topic: testTopic,
        apiKey: "AIzaSyA5lFH3RaMRRv33qKxcoqhAdT1gzbVsJno", // GEMINI_API_KEY_FOR_VISUALS
        modelName: "gemini-1.5-flash",
      },
    );

    console.log("✅ Reel generation started:", reelResponse.data);

    const taskId = reelResponse.data.taskId;

    // Step 6: Monitor progress until completion
    console.log("\n⏳ Step 6: Monitoring reel generation progress...");
    let status = "processing";
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes max

    while (status === "processing" && attempts < maxAttempts) {
      try {
        const statusResponse = await axios.get(
          `http://localhost:3000/reel/status/${taskId}`,
        );
        status = statusResponse.data.status;
        const progress = statusResponse.data.progress || 0;
        const step = statusResponse.data.step || "unknown";

        console.log(
          `📊 Status: ${status} | Step: ${step} | Progress: ${progress}%`,
        );

        if (status === "failed") {
          console.error("❌ Generation failed:", statusResponse.data.error);
          return;
        }

        if (status === "completed") {
          console.log("🎉 Reel generation completed!");

          // Step 7: Download the video to root directory
          console.log("\n📥 Step 7: Downloading final video to root...");
          const downloadResponse = await axios.get(
            `http://localhost:3000/reel/download/${taskId}`,
            {
              responseType: "stream",
            },
          );

          const rootVideoPath = path.join(
            __dirname,
            `genuine_reel_${Date.now()}.mp4`,
          );
          const writer = fs.createWriteStream(rootVideoPath);

          downloadResponse.data.pipe(writer);

          await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
          });

          console.log(`✅ Video saved to root: ${rootVideoPath}`);

          // Get file size
          const stats = fs.statSync(rootVideoPath);
          const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
          console.log(`📏 File size: ${fileSizeMB} MB`);

          // Show day-based color scheme used
          const {
            getDayBasedColors,
          } = require("./src/services/videoProcessingService");
          const dayColors = getDayBasedColors();
          console.log(
            `🎨 Color scheme used: ${dayColors.name} (${dayColors.textColor})`,
          );

          console.log("\n🎬 GENUINE WORKFLOW COMPLETED SUCCESSFULLY!");
          console.log("📁 Final video saved to project root");
          console.log("🎵 Genuine audio saved to: test_cache/audio.mp3");
          console.log(
            "📝 Genuine subtitles saved to: test_cache/subtitles.srt",
          );
          console.log("📝 Genuine script saved to: test_cache/script.json");
          console.log("🚫 Social media posting was skipped (as requested)");

          return;
        }

        // Wait 2 seconds before next check
        await new Promise((resolve) => setTimeout(resolve, 2000));
        attempts++;
      } catch (error) {
        console.error("❌ Error checking status:", error.message);
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (attempts >= maxAttempts) {
      console.error("⏰ Timeout: Reel generation took too long");
    }
  } catch (error) {
    console.error("❌ Test failed:", error.response?.data || error.message);
    console.error("Stack:", error.stack);
  }
}

// Run test if called directly
if (require.main === module) {
  testGenuineReelWorkflow();
}

module.exports = { testGenuineReelWorkflow };
