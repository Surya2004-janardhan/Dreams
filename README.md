# 🎬 Dreams AI Video Maker (GitHub Actions Edition)

**Dreams AI** is an end-to-end automated pipeline that transforms Google Sheet ideas into high-fidelity AI videos—running entirely on GitHub Actions for $0 cost.

---
**Estimated Run Time for full Automation**
**Note**: This is an estimated run time and may vary depending on the speed of the GitHub Actions runner and the size of the video.
**CPU**: 
- **Script Generation**: 3 minutes
- **Voice Cloning**: 7 minutes
- **Lip-Sync**: 4 hours( Advanced GAN)
- **Composition**: 20 minutes
- **Upload**: 10 minutes
- **Total**: 4 hours 40 minutes

**GPU**: 
- **Script Generation**: 3 minutes
- **Voice Cloning**: 7 minutes
- **Lip-Sync**: 20 minutes
- **Composition**: 20 minutes
- **Upload**: 10 minutes
- **Total**: 1 hour 2 minutes

## 💡 Motivation
> It all started from a young boy who had intrest in doing content on social media.
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
**For local use case you must keep the below mentioned three files(exact file names) in the assets directory**

### 🎬 `assets/Base-vedio.mp4`
- **Fallback**: If not checked into Git, define `BASE_VIDEO_DRIVE_ID` in GitHub Secrets to download it on-the-fly.
- **Duration**: **100 seconds minimum** (Ensures enough buffer for long scripts).
- **Framing**: **Close-up or Half-body** shot.
- **Stability**: **Fixed frame** (Static camera, neutral background).
- **Movement**: Natural blinking and slight head movement is okay, but avoid sudden shifts.

### 🎤 `assets/Base-audio.mp3`
- **Duration**: **< 10 seconds** (Best for zero-shot voice cloning quality).
- **Quality**: Crystal clear audio, no background noise, minimal reverb.

### � `assets/Bgm.m4a`
- **Purpose**: Background music for the final reel.
- **Default Volume**: **0.2 (20%)** in the automated pipeline.
- **Formats Supported**: `.m4a`, `.mp3`, `.wav`.

### �🌟 Publishing Capabilities
- **Triple-Platform Push**: Automatically uploads unique reels to **YouTube Shorts**, **Instagram Reels**, and **Facebook Reels**.
- **Deterministic Voice**: Uses **Voicebox** (Qwen3-TTS) as the mandatory audio engine.

---

### 🔐 GitHub Actions Secrets (Environment Variables)

Add these to your **Settings > Secrets and variables > Actions**.

| Secret | Description |
| :--- | :--- |
| `BASE_VIDEO_DRIVE_ID` | Google Drive ID of your base video (e.g., `1Tc0...`). |
| `GEMINI_API_KEY` | Primary key for scripts and logic. |
| `ASSEMBLYAI_API_KEY` | Required for automatic subtitle (SRT) generation. |
| `GOOGLE_SHEET_ID` | The ID from your sheet's URL. |
| `GOOGLE_CREDENTIALS` | Service Account JSON. |
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

### 🛠️ Local Setup (npm & pip)
Follow these steps to run the pipeline on your local machine:

1.  **Clone & Install**:
    ```bash
    git clone https://github.com/Surya2004-janardhan/Dreams.git
    cd Dreams
    npm install
    ```
2.  **Environment Configuration**:
    - Create a `.env` file in the root.
    - Copy keys from [`.env.example`](.env.example) and fill them in.
3.  **Prepare Assets**:
    - Place your 100s+ template video at `assets/Base-vedio.mp4` .
    - Place your voice sample (audio) at `assets/Base-audio.mp3`.
    - Place your background music at `assets/Bgm.m4a`.
4.  **Run Reel-composer**:
    ```bash
    cd reel-composer
    npm install 
    npm run dev
    ```
5.  **Voicebox Setup**:
    - You dont have to do anything the base Qwen3-TTS-12Hz-1.7B model is automatically loaded from the system global HuggingFace cache for the first time it is gonna download automatically.

6.  **Wav2lip Setup**:
    Wav2Lip requires pre-trained models. Run these commands from the root to download them:
    ```bash
    # Install gdown if you don't have it
    pip install gdown

    # Create directories
    mkdir -p wav2lip/checkpoints
    mkdir -p wav2lip/face_detection/detection/sfd

    # Download Models (Google Drive)
    gdown 1mF-3k82JnizTvP9R2PWLPsGfOEBa82pr -O wav2lip/checkpoints/wav2lip_gan.pth
    gdown 1hxwNL1lzclbRnyugv1q8rmk6JlqumOoh -O wav2lip/face_detection/detection/sfd/s3fd.pth

    # Download GFPGAN (Direct GitHub Link)
    curl -L https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.4.pth -o wav2lip/checkpoints/GFPGANv1.4.pth
    ```
7.  **Run Automation**:
    ```bash
    # Ensure that all above steps are properly done
    node src/main_automation.js
    ```

## 📝 Notes
-  **Mandatory Voicebox**: Gemini TTS support has been removed to ensure a consistent, professional brand voice. You **must** have `Base-audio.mp3` in your assets.
-  **Fail-Fast Workflow**: If Voicebox synthesis fails, the workflow will stop immediately to avoid generating low-quality content, and you will receive a notification via the configured email service.
-  **My suggestions**:
-  You can see the global logs while running the automation if you encounter any issue the detailed logs help you to understand the error or you can raise an issue vai github.
-  The repo is not so clean and modularized, soon i will make it clean and modularized.
-  If you really want deterministic results I recommmend you to use above raw appraoch instead of docker since I have not tried the new version of this repo on Docker yet, feel free to raise an issue particularly for the Docker setup and run.
-  You can customize several sections of this repo as per your requirements.

**Visuals are bottleneck, refactoring the base prompt using strong model wins**

**At any step the automation fails it cleans the directories sends a detailed error message vai email service applies the same if the automation gets success it sends the links of the published content**

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