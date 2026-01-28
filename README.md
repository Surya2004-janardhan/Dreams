# 🎥 AI Reels Automation Pipeline v3.0

The ultimate automated system for generating and distributing professional tech reels. This system integrates high-velocity technical scripting, GSAP-powered browser visualizers, and multi-platform social media distribution.

## 🚀 Overview

This repository automates the entire lifecycle of a tech influencer/educator:
1.  **Task Pulling**: Fetches technical topics from Google Sheets.
2.  **Scripting**: Generates zero-fluff, information-dense scripts using Groq (Llama 3.3).
3.  **Vocal Synthesis**: Synthesizes narration via Gemini Multimodal.
4.  **Visual Composition**: Automates a GSAP-based frontend at `reel-composer` to record premium visuals.
5.  **Multi-Social Upload**: Simultaneously posts to YouTube Shorts, Instagram Reels, and Facebook.
6.  **Reporting**: Emails the owner success logs or error post-mortems.

---

## 🏗️ Project Structure

```text
├── main_automation.js     # Master Entry Point (Sheet -> Post)
├── automate_frontend.js   # (Legacy) Visual compositor logic
├── base-vedio.mp4         # Target background for reels
├── reel-composer/         # GSAP Visualizer App (Run: npm run dev)
├── src/
│   ├── services/
│   │   ├── sheetsService.js    # Google Sheets Integration
│   │   ├── scriptService.js    # Groq-powered technical scripting
│   │   ├── audioService.js     # Gemini-powered voice synthesis
│   │   ├── socialMediaService.js # YouTube, Insta, FB Uploaders
│   │   └── emailService.js     # SMTP Error & Success alerts
│   └── routes/                 # API Endpoints (via server.js)
├── .github/workflows/         # Scheduled automation (8am/8pm IST)
├── archive/                   # Legacy tests and old scripts
└── final_video/               # Directory for exported masters
```

---

## 🛠️ Getting Started

### 1. Installation
Install root dependencies and Playwright browsers:
```bash
npm install
npx playwright install chromium --with-deps
```

Install Frontend dependencies:
```bash
cd reel-composer
npm install
```

### 2. Environment Setup
Create a `.env` in the root (see `.env.example` if available) with:
- `GROQ_API_KEY`, `GEMINI_API_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`
- `INSTAGRAM_ACCESS_TOKEN`, `FACEBOOK_ACCESS_TOKEN`
- `EMAIL_USER`, `EMAIL_APP_PASSWORD`
- `GOOGLE_SHEET_ID`

### 3. Running the Pipeline

**Step 1: Start Visualizer**
```bash
cd reel-composer
npm run dev
```

**Step 2: Start Automation**
```bash
# In a new terminal
node main_automation.js
```

---

## 🤖 GitHub Automation
The system is configured to run automatically via GitHub Actions:
- **Triggers**: Every push to `develop` or **Cron Schedule** (8 AM and 8 PM IST).
- **Environment**: Runs headless Playwright recording on Linux runners.
- **Artifacts**: Final master videos are saved as workflow artifacts for manual download.

---

## 🧠 Strategic Content Philosophy (V3)
- **Zero Fluff**: No "Hello everyone" or bush-beating.
- **High Velocity**: 150-200 technical words in ~50 seconds.
- **Premium Aesthetics**: Swiss typography and cyber-technical GSAP transitions.
- **Master Quality**: 50Mbps video recording with synchronized HQ audio remuxing.
