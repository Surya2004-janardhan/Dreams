# 🎬 AI Reels Automation: The Talking Head Edition

Welcome to the ultimate "Ghost Creator" pipeline. This isn't just a video generator; it's a fully automated digital twin that reads technical topics from a spreadsheet, writes high-velocity scripts, generates professional voiceovers, and literally **lip-syncs** a face to the audio before posting it to your socials.

No cameras, no microphones, no manual editing. Just pure automation.

---

## 🚀 The workflow (What actually happens?)

Here’s the step-by-step journey of a single reel, from a cell in a Google Sheet to a viral post:

1.  **The Idea**: The system wakes up (on a schedule or manual trigger) and grabs a technical topic from your **Google Sheet**.
2.  **The Script**: It sends that topic to **Llama 3.3 (via Groq)**. It’s been prompted to be "Zero Fluff"—meaning it skips the "Hey guys" and jumps straight into high-density technical value.
3.  **The Voice**: The script is narrated by **Gemini Multimodal**. We don't use robotic voices; we use a curated AI persona that sounds like a tech lead explaining a complex concept.
4.  **The Lip-Sync (Wav2Lip)**: This is the magic part. The system takes your `Base-vedio.mp4` (a person talking) and the new AI audio. It uses a neural network to **re-animate the person's mouth** to match the audio word-for-word.
5.  **The Design**: While the video encodes, the **GSAP-powered React app** (`reel-composer`) generates futuristic, Swiss-style typography and technical icons that pulsate in sync with the audio.
6.  **The Merge**: Everything is flattened into a high-bitrate (50Mbps) vertical MP4. 
7.  **The Distribution**: The final reel is uploaded simultaneously to **YouTube Shorts, Instagram, and Facebook**.
8.  **The Report**: You get an email with the links to the posts or a detailed error report if something went wrong.

---

## 🏗️ Project Anatomy

```text
├── main_automation.js      # The "Brain" - orchestrates the entire pipeline
├── wav2lip/                # AI Lip-sync engine (Python based)
├── reel-composer/          # The "Face" - React/GSAP app for visual overlays
├── Base-vedio.mp4          # The "Actor" - The base video used for lip-syncing
├── src/
│   ├── services/
│   │   ├── wav2lipService.js   # Bridges Node.js with the Python AI
│   │   ├── audioService.js     # Voice synthesis via Gemini
│   │   ├── scriptService.js    # Script writing via Groq
│   │   └── socialMediaService.js # The multi-platform uploader
└── .github/workflows/      # The "24/7 Employee" - GitHub Actions config
```

---

## 🛠️ Setting it up (Locally)

If you want to run this on your own machine:

### 1. The Basics
```bash
npm install
npx playwright install chromium --with-deps
```

### 2. The AI (Wav2Lip)
You'll need Python 3.10 and the AI weights:
```bash
cd wav2lip
pip install -r requirements.txt
# The system will automatically download the heavy model weights on the first run!
```

### 3. Your Keys
Grab the `.env.example` (or create a `.env`) and fill in your API keys for Groq, Gemini, AssemblyAI, and your social tokens.

### 4. Let it rip
```bash
# Start the visualizer
cd reel-composer && npm run dev

# In another terminal, run the brain
node main_automation.js
```

---

## 🤖 Cloud Automation (GitHub Actions)

The system is optimized for the cloud. We use **Git LFS** for large files and **Smart Caching** for the 500MB AI models. 
- **Auto-Sync**: Every time you push to the repo, it tests the pipeline.
- **Scheduled**: It’s set to post fresh content every day at **8:00 AM and 8:00 PM IST**.
- **Headless**: It uses a virtual display (Xvfb) on Linux to "record" the browser visualizer.

---

## 🧠 Strategic Content Philosophy

- **High Density**: 150-180 words in 55 seconds. No wasted breath.
- **Visual Rhythm**: Visuals move *with* the speaker's cadence.
- **Dark Mode Aesthetic**: Deep blues, neons, and sharp typography for a premium "developer" feel.

---

*Built with ❤️ for technical creators who would rather code than edit videos.*
