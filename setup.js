const fs = require("fs");
const path = require("path");

console.log(`
╭─────────────────────────────────────────────╮
│  🎥 AI Content Automation Setup v2.0        │
│  ──────────────────────────────────────────  │
│  Setting up your automated content workflow  │
╰─────────────────────────────────────────────╯
`);

// Check required files
const requiredFiles = [".env", "seismic-rarity-468405-j1-a83f924d9fbc.json"];

let missingFiles = [];
requiredFiles.forEach((file) => {
  if (!fs.existsSync(file)) {
    missingFiles.push(file);
  }
});

// Check required directories
const requiredDirs = ["audio", "images", "videos", "temp", "subtitles"];
requiredDirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  } else {
    console.log(`✅ Directory exists: ${dir}`);
  }
});

// Check environment variables
if (fs.existsSync(".env")) {
  const envContent = fs.readFileSync(".env", "utf8");

  const requiredEnvVars = [
    "GROQ_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_SHEET_ID",
    "EMAIL_USER",
    "EMAIL_APP_PASSWORD",
  ];

  console.log("\n📋 Environment Variables Status:");

  let missingEnvVars = [];
  requiredEnvVars.forEach((varName) => {
    if (
      envContent.includes(`${varName}=your_`) ||
      !envContent.includes(varName)
    ) {
      missingEnvVars.push(varName);
      console.log(`❌ ${varName} - Not configured`);
    } else {
      console.log(`✅ ${varName} - Configured`);
    }
  });

  if (missingEnvVars.length > 0) {
    console.log(`
⚠️  Missing Environment Variables:
${missingEnvVars.map((v) => `   • ${v}`).join("\n")}

📝 Please update your .env file with the correct values:

   GROQ_API_KEY=your_actual_groq_key
   GEMINI_API_KEY=your_actual_gemini_key
   GOOGLE_SHEET_ID=your_google_sheet_id
   EMAIL_USER=your_email@gmail.com
   EMAIL_APP_PASSWORD=your_gmail_app_password
`);
  } else {
    console.log("\n✅ All environment variables are configured!");
  }
} else {
  console.log("❌ .env file missing - please create one based on .env file");
}

// Check Google service account file
if (!fs.existsSync("seismic-rarity-468405-j1-a83f924d9fbc.json")) {
  console.log(`
❌ Google Service Account file missing!
   Please place 'seismic-rarity-468405-j1-a83f924d9fbc.json' in the root directory.
   This file is needed for Google Sheets, Drive, and YouTube access.
`);
}

console.log(`
🚀 Setup Summary:
   • Required directories: ${requiredDirs.length}/5 ✅
   • Configuration files: ${requiredFiles.length - missingFiles.length}/${
  requiredFiles.length
}
   
📚 Next Steps:
   1. Configure missing environment variables in .env
   2. Add Google service account JSON file if missing
   3. Set up your Google Sheet with columns: SNO, Idea, Description, Status, YT Link, Insta Link, Timestamp
   4. Run: npm start
   5. Test: POST http://localhost:3000/workflow/auto

📖 Full Documentation: See README-v2.md for complete setup guide

🎬 Ready to create automated content? Run 'npm start' to begin!
`);

if (missingFiles.length === 0) {
  console.log("✅ Setup appears complete! Ready to run the automation.");
} else {
  console.log(`⚠️  Please resolve missing files: ${missingFiles.join(", ")}`);
}
