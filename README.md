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

## 📋 Google Sheet Setup

Your Google Sheet must have the following headers (case-insensitive):

| Column Header | Description |
| :--- | :--- |
| **SNO** | Serial Number. |
| **Idea** | The theme/topic for the AI to expand into a script. |
| **Description** | Context for the AI to understand the core message. |
| **Status** | Must be `Not Posted` to trigger. Updates to `Processing` or `Posted`. |
| **YT Link** | (Output) Updated with the Published YouTube link. |
| **Insta Link** | (Output) Updated with the Published Instagram Reel link. |
| **FB Link** | (Output) Updated with the Published Facebook Video link. |
| **Timestamp** | (Output) Updated with completion time. |

---

## 📁 Asset Specifications (Requirements)

For the best results, your template assets must follow these constraints:

### 🎬 `assets/Base-vedio.mp4`
- **Duration**: **100 seconds minimum** (Ensures enough buffer for long scripts).
- **Framing**: **Close-up or Half-body** shot.
- **Stability**: **Fixed frame** (Static camera, neutral background).
- **Movement**: Natural blinking and slight head movement is okay, but avoid sudden shifts.

### 🎤 `assets/Base-audio.mp3`
- **Duration**: **< 10 seconds** (Best for zero-shot voice cloning quality).
- **Quality**: Crystal clear audio, no background noise, minimal reverb.

---

## 🔐 Environment Variables (All)

Add these to your `.env` for local testing or **GitHub Secrets** for GitHub Actions automation.

### 🧠 AI & Logic
- `GEMINI_API_KEY`: Primary key for scripts and logic.
- `GEMINI_API_KEY_FOR_VISUALS`: (Optional) Key specialized for visual prompt generation.
- `ASSEMBLYAI_API_KEY`: Required for automatic subtitle (SRT) generation.

### 📊 Google Services
- `GOOGLE_SHEET_ID`: The ID from your sheet's URL.
- `GOOGLE_CREDENTIALS`: Service Account JSON (or Base64 encoded JSON for GitHub).
- `GOOGLE_CLIENT_ID`: OAuth Client ID for YouTube.
- `GOOGLE_CLIENT_SECRET`: OAuth Client Secret for YouTube.
- `YOUTUBE_REFRESH_TOKEN`: Permanent OAuth Refresh Token for YouTube uploads.

### 📱 Social Media (Access Tokens)
- `INSTAGRAM_ACCOUNT_ID`: Your Instagram Business Account ID.
- `INSTAGRAM_ACCESS_TOKEN`: Long-lived User Access Token.
- `FACEBOOK_PAGE_ID`: Your target Facebook Page ID.
- `FACEBOOK_ACCESS_TOKEN`: Permanent Page Access Token.

### 📤 Cloud Storage & Email
- `SUPABASE_URL`: Your Supabase Project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Service Role Key (needed for bucket uploads).
- `SUPABASE_BUCKET`: Bucket name for video storage (default: `videos`).
- `EMAIL_USER`: Gmail address used to send notifications.
- `EMAIL_APP_PASSWORD`: Gmail App Password (NOT your account password).
- `NOTIFICATION_EMAIL`: The email address that receives the completion links.

---

## 📜 Documentation
For a deep dive into setting up GitHub Actions infrastructure and secrets, see **[.github/workflow.md](.github/workflow.md)**.
