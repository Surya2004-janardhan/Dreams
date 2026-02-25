# 🎬 Dreams AI Video Maker (Cloud-Only Edition)

**Dreams AI** is an end-to-end automated pipeline that transforms Google Sheet ideas into high-fidelity AI videos—running entirely on GitHub Actions for $0 cost.

---

## 🏗️ How it Works
1.  **Trigger**: GitHub Actions wakes up via a **Cron Job** and checks your Google Sheet for rows marked as "Not Posted".
2.  **Voice Cloning**: Your personalized AI voice is synthesized using a reference audio sample in `assets/Base-audio.mp3`.
3.  **Lip-Sync**: The generated audio is synced to a base video in `assets/Base-vedio.mp4`.
4.  **Composition**: The system uses a browser-based composer to generate dynamic AI visuals and animations.
5.  **Distribution**: Final videos are uploaded to **Supabase** and social media links are updated in your Sheet.

---

## 🚀 Quick Setup

### 1. Repository Setup
- Clone this repository.
- Ensure your `assets/` folder contains `Base-audio.mp3` and `Base-vedio.mp4`.

### 2. Environment Configuration
Create a `.env` file for local testing or add these to **GitHub Secrets**:
- `GEMINI_API_KEY`: For script and visual generation.
- `GOOGLE_SHEET_ID`: Your automation dashboard.
- `GOOGLE_CREDENTIALS`: Search for "Base64 Service Account" in docs.
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`: For video storage.
- `EMAIL_USER` / `EMAIL_APP_PASSWORD`: For status notifications.

### 3. Execution
The system is designed for **GitHub Actions**. To test manually:
```bash
node src/main_automation.js
```

---

## 📂 Structure
- `src/`: Core automation logic and cloud services.
- `assets/`: Media templates (Reference audio & video).
- `voicebox/`: Zero-shot voice cloning engine.
- `wav2lip/`: Precision lip-syncing engine.
- `.github/workflows/`: Cloud scheduling configurations.

---

## 📜 Documentation
For a deep dive into setting up the cloud infrastructure, see **[.github/workflow.md](.github/workflow.md)**.
