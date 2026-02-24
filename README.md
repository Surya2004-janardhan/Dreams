# 🎬 Dreams AI Video Maker (Short form content maker)

Welcome to **Dreams AI**, an end-to-end automated pipeline that transforms simple ideas from a Google Sheet into high-fidelity, voice-cloned, lip-synced AI videos—running entirely on the cloud for $0.

---

## 🏗️ The Cloud Pipeline: How it Works

The system is designed as a fully automated, hands-off pipeline that executes on cloud runners.

### 🔄 The End-to-End Workflow
1.  **Trigger**: GitHub Actions wakes up via a **Cron Job** and checks your Google Sheet for rows marked as "Not Posted".
2.  **Voice Cloning (Voicebox)**: Your personalized AI voice is synthesized using a 30-second reference audio sample (`Base-audio.mp3`).
3.  **Lip-Synchronization (Wav2Lip)**: The generated audio is synced to a base video (`Base-vedio.mp4`) with sub-pixel precision.
4.  **Assembly & Mixing**: FFmpeg combines the speech, background music (BGM), and synced video into a final MP4.
5.  **Distribution**: The final video and subtitles (SRT) are uploaded to **Supabase** storage, and a download link is emailed to you automatically.

---

## 💡 My Motivation
I have always been passionate about content creation, but the high cost of tools and server maintenance often stood in the way. My goal was to build a system that could automate the entire production cycle for **absolutely $0 operating cost**, leveraging free-tier APIs and serverless infrastructure to prove that high-quality AI content doesn't need a massive budget.

The dynamic animations in this project were inspired by the excellent work in [reel-composer](https://github.com/prasannathapa/reel-composer) by **Prasanna Thapa**, which I have refactored and customized to meet the specific requirements of this automated pipeline.

---

## 💎 The Power of Zero-Cost Automation

One of the most unique aspects of this system is that it runs **entirely for free** with zero server maintenance costs.

### 🚜 Serverless Execution (GitHub Actions)
Instead of paying for a 24/7 VPS or Cloud Server, we utilize **GitHub Actions** as our "virtual computer":
*   **Automatic Cron Jobs**: The system uses GitHub's `schedule` feature to wake up at specific times (e.g., 1 AM, 3 AM IST) to process tasks.
*   **Ephemeral Runners**: Every time a job starts, GitHub spins up a fresh Ubuntu environment, installs dependencies, processes the video, and shuts down—costing you $0.
*   **Performance Metrics (Ubuntu-Latest)**:
    *   **Setup (Dependencies + Models)**: ~2-3 mins ⚡
    *   **Audio Generation**: ~4 mins 🗣️
    *   **Wav2Lip (Basic Mode)**: ~8 mins 👄
    *   **Wav2Lip (Premium GAN Mode)**: ~5 hours (for cinematic quality) ✨
    *   **Final Mixing & Upload**: ~1 min 📤

### 🔌 API Efficiency
The project is built on the "Free Tier" ecosystem:
*   **Google Gemini**: Used for intelligent logic and script handling.
*   **Google Sheets**: Acts as a free, collaborative "Database" and "Admin Panel."
*   **AssemblyAI**: High-quality transcription using free tier credits.
*   **Supabase (Free Tier)**: Hosts visual artifacts and final videos temporarily for download.

---

## 🛠️ Technical Architecture

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Orchestrator** | Node.js | Manages the sequence, updates sheets, and triggers services. |
| **AI Brain** | Google Gemini | Intelligent task planning and script processing. |
| **Voice Engine** | Voicebox (PyTorch) | Zero-shot voice cloning and text-to-speech. |
| **Sync Engine** | Wav2Lip + GFPGAN | Lip-syncing and face restoration for HD quality. |
| **Subtitles** | AssemblyAI | Automatic speech-to-text and SRT generation. |
| **Automation** | GitHub Actions | The "Serverless" engine running the pipeline on a schedule. |

---

## 🚀 Getting Started

### 1. Prerequisites
*   **Environment**: Node.js (v20+), Python (3.10), FFmpeg.
*   **Keys**: You will need a `.env` file containing:
    *   `GEMINI_API_KEY`, `GOOGLE_SHEET_ID`, `ASSEMBLYAI_API_KEY`, `SUPABASE_URL`, `EMAIL_APP_PASSWORD`.

### 2. Execution
To trigger the automated pipeline manually or test the cloud logic:
```bash
node src/local-support/automation_logic.js
```

---

## 📂 Project Structure
*   `src/local-support/`: The core automated pipeline logic.
*   `voicebox/`: Python-based voice cloning models and inference scripts.
*   `wav2lip/`: The lip-sync engine including model checkpoints.
*   `bin/`: Utility scripts for cleanup, testing, and diagnostics.
*   `.github/workflows/`: Cloud automation schedules (Cron configurations).

---

## 🤝 Community & Contribution
Feel free to contribute, open issues, or start a discussion! We are always looking for ways to optimize CPU-based rendering and improve zero-shot voice cloning accuracy.

---

> [!NOTE]  
> This is a **technical framework** designed for automated digital content creation. It demonstrates the integration of multiple SOTA AI models into a single, cohesive, zero-cost production pipeline.
