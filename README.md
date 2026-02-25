# 🎬 Dreams AI - Local Support Pipeline

Welcome to the **local-support** branch of Dreams AI. This branch is a specialized, lean version of the automation pipeline designed to run high-fidelity, voice-cloned, lip-synced AI videos without the overhead of dynamic web-based visuals.

---

## 🏗️ The Streamlined Pipeline: How it Works

This branch focused on a "Speech-to-Video" approach, perfect for high-speed automated output where the base video and audio take center stage.

### 🔄 The End-to-End Workflow
1.  **Trigger**: GitHub Actions wakes up via a **Cron Job** and checks your Google Sheet for rows marked as "Not Posted".
2.  **Voice Cloning (Voicebox)**: Your personalized AI voice is synthesized using the reference audio sample in `assets/Base-audio.mp3`.
3.  **Lip-Synchronization (Wav2Lip)**: The generated audio is synced to the base video in `assets/Base-vedio.mp4`.
4.  **Distribution**: The final video and subtitles (SRT) are uploaded to **Supabase** storage, and a download link is emailed to you automatically.

---

## � GitHub Actions Execution

This branch is optimized for **zero-cost serverless execution**. Every time a job starts, GitHub spins up a fresh environment, processes the daily tasks from your Sheet, and delivers the results via email.

- **Schedule**: Uses `daily-local-support.yml` to run every 3 hours (8x daily).
- **Manual Trigger**: Can be started from the "Actions" tab by selecting the "Daily Local-Support Automation" workflow.

---

## 🚀 Getting Started

### 1. Prerequisites
- **Assets**: Ensure `assets/Base-audio.mp3` and `assets/Base-vedio.mp4` are present.
- **Environment**: You will need a `.env` file or GitHub Secrets containing:
    - `GEMINI_API_KEY`, `SHEET_ID`, `GOOGLE_CREDENTIALS`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `EMAIL_USER`, `EMAIL_APP_PASSWORD`, `NOTIFICATION_EMAIL_LOCAL`, `ASSEMBLYAI_API_KEY`.

### 2. Manual Test
To test the pipeline locally:
```bash
node src/local-support/automation_logic.js
```

---

## 📂 Branch Structure
- `src/local-support/`: The core automated pipeline logic.
- `voicebox/`: Python-based voice cloning models.
- `wav2lip/`: Precision lip-sync engine.
- `assets/`: Reference template media.
- `.github/workflows/`: Automation schedules.

---

> [!NOTE]  
> This branch **discards** the heavy `reel-composer` visual engine and focus purely on delivering high-quality synced talking heads. For the full visual experience with dynamic animations, switch to the `main` branch.
