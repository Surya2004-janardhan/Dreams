# 🎬 Dreams AI Video Maker (GitHub Actions Edition)

**Dreams AI** is an end-to-end automated pipeline that transforms Google Sheet ideas into high-fidelity AI videos—running entirely on GitHub Actions for $0 cost.

---

## 💡 Motivation
> "Ideas arrive at any time; development shouldn't be the bottleneck. Dreams AI bridges the gap between a single-row thought and a multi-platform social media presence, handling the script, voice, visuals, and distribution while you sleep."

## 🏗️ How it Works
1.  **Trigger**: GitHub Actions wakes up via a **Cron Job** and checks your Google Sheet for rows marked as "Not Posted".
2.  **Voice Cloning**: Your personalized AI voice is synthesized using a reference audio sample in `assets/Base-audio.mp3`.
3.  **Lip-Sync**: The generated audio is synced to a base video in `assets/Base-vedio.mp4`. (Auto-downloaded via secret if missing).
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
- **Fallback**: If not checked into Git, define `BASE_VIDEO_DRIVE_ID` in GitHub Secrets to download it on-the-fly.
- **Duration**: **100 seconds minimum** (Ensures enough buffer for long scripts).
- **Framing**: **Close-up or Half-body** shot.
- **Stability**: **Fixed frame** (Static camera, neutral background).
- **Movement**: Natural blinking and slight head movement is okay, but avoid sudden shifts.

### 🎤 `assets/Base-audio.mp3`
- **Duration**: **< 10 seconds** (Best for zero-shot voice cloning quality).
- **Quality**: Crystal clear audio, no background noise, minimal reverb.

---

### 🔐 GitHub Actions Secrets (Environment Variables)

Add these to your **Settings > Secrets and variables > Actions**.

| Secret | Description |
| :--- | :--- |
| `BASE_VIDEO_DRIVE_ID` | Google Drive ID of your base video (e.g., `1Tc0...`). |
| `GEMINI_API_KEY` | Primary key for scripts and logic. |
| `ASSEMBLYAI_API_KEY` | Required for automatic subtitle (SRT) generation. |
| `GOOGLE_SHEET_ID` | The ID from your sheet's URL. |
| `GOOGLE_CREDENTIALS` | Base64 encoded Service Account JSON. |
| `GOOGLE_CLIENT_ID` | OAuth Client ID for YouTube. |
| `GOOGLE_CLIENT_SECRET` | OAuth Client Secret for YouTube. |
| `YOUTUBE_REFRESH_TOKEN` | OAuth Refresh Token for YouTube. |
| `INSTAGRAM_ACCOUNT_ID` | Your Instagram Business Account ID. |
| `INSTAGRAM_ACCESS_TOKEN` | Long-lived Facebook User Access Token. |
| `FACEBOOK_PAGE_ID` | Your target Facebook Page ID. |
| `FACEBOOK_ACCESS_TOKEN` | Permanent Page Access Token. |
| `SUPABASE_URL` | Your Supabase Project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service Role Key for bucket access. |
| `SUPABASE_BUCKET` | Bucket name (default: `videos`). |
| `EMAIL_USER` | Gmail address for login. |
| `EMAIL_APP_PASSWORD` | Gmail App Password. |
| `NOTIFICATION_EMAIL` | Destination for completion links. |

---

## 🚀 Setup & Installation

### 🛠️ Local Setup (NPM)
Follow these steps to run the pipeline on your local machine:

1.  **Clone & Install**:
    ```bash
    git clone https://github.com/your-repo/dreams-ai.git
    cd dreams-ai
    npm install
    ```
2.  **Environment Configuration**:
    - Create a `.env` file in the root.
    - Copy keys from [`.env.example`](.env.example) and fill them in.
3.  **Prepare Assets**:
    - Place your 100s+ template video at `assets/Base-vedio.mp4`.
    - Place your voice sample (audio) at `assets/Base-audio.mp3`.
4.  **Run Automation**:
    ```bash
    # Ensure any local dev server (for composer) is stopped or on port 3000
    node src/main_automation.js
    ```

### 🐳 Dockerized Setup (Recommended)
Run the entire pipeline in a consistent, isolated environment:

1.  **Build the Container**:
    ```bash
    docker-compose build
    ```
2.  **Configure Environment**:
    - Ensure your `.env` file is populated.
3.  **Run the Pipeline**:
    ```bash
    docker-compose up
    ```
    *Note: The container will handle all system dependencies like FFmpeg and Playwright automatically.*

---

## 📜 Documentation
For a deep dive into setting up GitHub Actions infrastructure and secrets, see **[.github/workflow.md](.github/workflow.md)**.

## Note
- This is only a prototype, it is not a production-ready system.

## Tips
-  Refactor script, captions, descriptions prompts to AI as per your need.
-  Refactor the visual prompt to AI as per your need.
-  Refactor sheet service as per your sheet layout.
-  Modify the email service as per your need. 
-  Update with new social services if u want to add new platform.
-  Utilize strong models if you have access to them (e.g. Gemini 3 Pro, GPT-5, etc.).


## Contributions
-  Feel free to open issue or pull request.
-  Willing to discuss new features or improvements.

## License
-  This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.