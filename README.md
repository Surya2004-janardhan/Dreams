# 🎬 Ultimate AI Content Automation (Dreams Pipeline)

Welcome to a professional "Ghost Creator" pipeline. This system transforms technical topics from a Google Sheet into high-retention, fully lip-synced vertical videos (Reels/Shorts) using a multi-agent AI architecture.

**No cameras, no microphones, no manual editing. 24/7 autonomous production.**

---

### **💡How it works: General**
1.  **Selection**: The system picks a topic from your Google Sheet.
2.  **Writing**: An AI writes a short, viral script about that topic.
3.  **Cloning**: Your voice is cloned so the video sounds exactly like you.
4.  **Animating**: A "digital twin" video is created where your lips move to match the new voice.
5.  **Posting**: The final video is automatically uploaded to Instagram, YouTube, and Facebook.

*It’s essentially a 24/7 social media team that never sleeps.*

---

## 🚀 The workflow (How it works)

1.  **Ingestion**: The system polls a **Google Sheet** for new topics.
2.  **Scripting**: **Gemini 2.0 Pro** generates a "Viral Loop" script (Pattern Interrupt → Technical Value → Infinite Loop).
3.  **Voice Cloning**: **Voicebox (Qwen3-TTS)** clones your voice DNA from a 30s sample (`Base-audio.wav`).
4.  **Neural Lip-Sync**: **Wav2Lip** re-animates the mouth of your actor (`Base-vedio.mp4`) to match the cloned audio.
5.  **Visual Composition**: A **React/GSAP** engine rendered via Playwright captures "Swiss-Style" technical overlays.
6.  **Broadcast**: Videos are multi-streamed to **YouTube Shorts, Instagram, and Facebook**.

---

## 🛠️ Global Setup & Installation

### 1. Prerequisites
*   **Node.js**: v20 or higher
*   **Python**: 3.10.x (Essential for Torch/Transformers compatibility)
*   **FFMpeg**: Installed on system path
*   **Hardware**: 16GB RAM minimum. NVIDIA GPU (8GB+ VRAM) highly recommended for local high-speed processing.

### 2. Local Installation
```bash
# Clone the repository
git clone <your-repo-url>
cd Ai-content-automation

# Install Node dependencies
npm install
cd reel-composer && npm install && cd ..

# Install Python dependencies
pip install -r wav2lip/requirements.txt
pip install -r voicebox/requirements.txt
```

### 3. External Asset Hosting (Crucial)
To bypass GitHub LFS bandwidth limits, large models are hosted on **Google Drive**. 
The system automatically downloads these during the GitHub Actions run:
*   `wav2lip_gan.pth` (415MB) - The main lip-sync weights.
*   `s3fd.pth` (90MB) - The face detector weights.
*   `Base-vedio.mp4` (100MB+) - Your high-quality "Actor" footage.

---

## 🤖 Automating with GitHub Actions

The pipeline runs autonomously twice daily (8:00 AM & 8:00 PM IST). 

### Required GitHub Secrets
To make the automation work, you **MUST** add these into your GitHub Repository Secrets (`Settings > Secrets and variables > Actions`):

| Secret Name | Description |
| :--- | :--- |
| `GEMINI_API_KEY` | Your Google AI Studio API Key |
| `GOOGLE_SHEET_ID` | The ID of your content spreadsheet |
| `GOOGLE_CREDENTIALS` | Your Google Service Account JSON |
| `SUPABASE_URL` | For hosting video artifacts |
| `SUPABASE_SERVICE_ROLE_KEY` | For cloud storage access |
| `INSTAGRAM_ACCESS_TOKEN` | Meta Graph API token |
| `YOUTUBE_REFRESH_TOKEN` | OAuth2 token for YouTube uploads |

---

## 🏗️ Project Structure
```text
├── main_automation.js      # The Orchestrator (The "Brain")
├── wav2lip/                # Neural Lip-sync Engine (Python)
├── voicebox/               # Voice Cloning Engine (Python)
├── reel-composer/          # Visual Compositor (React/GSAP/Vite)
├── src/services/           # Logic Bridges (Gemini, Social API, FFmpeg)
├── .github/workflows/      # CI/CD Production Configuration
└── Base-vedio.mp4          # Your "Face" Asset (Downloadable via GDrive)
```

---

## 📊 Performance & Optimization

| Runtime | Environment | Speed |
| :--- | :--- | :--- |
| **GPU (NVIDIA)** | Local PC | ~2 minutes / 60s video (Fast) |
| **CPU (Free Tier)** | GitHub Actions | ~50 minutes / 60s video (Intensive) |

**Note**: In GitHub Actions, we use `spawn` with real-time streaming logs. You can monitor the `Wav2Lip Progress` bar directly in the workflow console to ensure the system is "alive."

---

## 📜 Usage Instructions

### Local Development
1.  Run `cd reel-composer && npm run dev` to start the graphics server.
2.  Run `node main_automation.js` in the root folder.
3.  Check the `final_video/` folder for the result.

### Production
Simply push your code to the `main` branch. The `.github/workflows/reels-automation.yml` will handle the environment setup, model downloads from Google Drive, and the full automation loop.

---

*Built for creators who value high-density technical value over manual manual effort.*

