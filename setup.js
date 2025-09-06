#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

console.log("🚀 AI Content Automation - Setup Script");
console.log("=====================================\n");

// Check if .env exists
const envPath = path.join(__dirname, ".env");
const envExamplePath = path.join(__dirname, ".env.example");

if (!fs.existsSync(envPath)) {
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log("✅ Created .env file from .env.example");
  } else {
    console.log("❌ .env.example file not found");
  }
} else {
  console.log("ℹ️  .env file already exists");
}

// Create required directories
const directories = ["temp", "audio", "images", "videos", "subtitles"];
directories.forEach((dir) => {
  const dirPath = path.join(__dirname, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  } else {
    console.log(`ℹ️  Directory already exists: ${dir}`);
  }
});

console.log("\n📋 Next Steps:");
console.log("1. Fill in all values in .env file");
console.log("2. Install FFmpeg: choco install ffmpeg");
console.log("3. Install Coqui TTS: pip install TTS");
console.log(
  "4. Start TTS server: tts-server --model_name tts_models/en/ljspeech/tacotron2-DDC --port 5002"
);
console.log("5. Run: npm run dev");

console.log("\n🔗 Quick Links:");
console.log("• Health Check: http://localhost:3000/health");
console.log("• Workflow Status: http://localhost:3000/workflow/status");
console.log("• Manual Trigger: POST http://localhost:3000/workflow/run");

console.log("\n🎉 Setup complete! Happy automating! 🤖");
