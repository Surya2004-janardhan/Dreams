# 🎬 Ultimate AI Content Automation - 0/-

Welcome to the ultimate "Ghost Creator" pipeline. This isn't just a video generator; it's a fully automated digital twin that reads technical topics from a spreadsheet, writes high-velocity scripts, generates professional voiceovers, and literally **lip-syncs** a face to the audio before posting it to your socials.

No cameras, no microphones, no manual editing. Just pure automation.

---

## 🚀 The workflow (What actually happens?)

Here’s the step-by-step journey of a single reel, from a cell in a Google Sheet to a viral post:

1.  **The Idea**: The system wakes up (on a schedule or manual trigger) and grabs a technical topic from your **Google Sheet**.
2.  **The Script**: It sends that topic to **Llama 3.3 (via Groq)**. It’s been prompted to be "Zero Fluff"—meaning it skips the "Hey guys" and jumps straight into high-density technical value.
3.  **The Voicebox (Cloning)**: Instead of generic voices, we use **Voicebox**. Provide a 30-second `Base-audio.mp3` of your own voice, and the system **clones it** in real-time. The AI tech lead now literally speaks with *your* voice. (Gemini TTS remains as a rock-solid backup).
4.  **The Lip-Sync (Wav2Lip)**: The magic part. The system takes your `Base-vedio.mp4` (the face) and the newly cloned audio. It uses a neural network to **re-animate the person's mouth** to match your voice word-for-word.
5.  **The Design**: While the video encodes, the **GSAP-powered React app** (`reel-composer`) generates futuristic, Swiss-style typography and technical icons that pulsate in sync with the audio.
6.  **The Merge**: Everything is flattened into a high-bitrate (50Mbps) vertical MP4. 
7.  **The Distribution**: The final reel is uploaded simultaneously to **YouTube Shorts, Instagram, and Facebook**.
8.  **The Report**: You get an email with the links to the posts or a detailed error report if something went wrong.

---

## 🚀 General Workflow: How it works

The system operates as a **master orchestration loop** (`main_automation.js`) that synchronizes four different AI engines and a browser-based visual compositor.

1.  **Ingestion**: The "Brain" polls a Google Sheet for new technical ideas. It cross-references existing posts to ensure zero content duplication.
2.  **Viral Scripting**: The topic is sent to **Gemini 1.5 Pro**. Our proprietary prompt strategy forces a "Viral Loop" structure:
    *   **Pattern Interrupt Hook**: A negative or controversial opening (0-3s).
    *   **The Gap**: Identifying a pain point or cognitive dissonance.
    *   **Continuous Value**: Fast-paced technical insights (no "Intro/Outro" fluff).
    *   **Infinite Loop Outro**: Ending on a phrase that links back to the video start.
3.  **Voice Cloning (Voicebox)**: The script is synthesized using a 1.7B parameter **Qwen3-TTS** model. It clones your voice from `Base-audio.mp3` and uses "Instruct Tags" to add emotional peaks, varied pitch, and natural pauses.
4.  **Neural Lip-Sync (Wav2Lip)**: Using a pre-trained GAN, the system re-animates the mouth of your `Base-vedio.mp4` actor. We use specific **vertical padding** to ensure the entire jaw and chin move in sync with the cloned audio.
5.  **Visual Composition (Browser Engine)**: A headless Chromium instance (Playwright) boots a **React/GSAP** application. This engine renders high-fidelity animations, futuristic typography, and technical overlays that are frame-synced to the audio.
6.  **Broadcast**: The final high-bitrate (50Mbps) master is stage-uploaded to Supabase, then simultaneously pushed to **YouTube Shorts, Instagram, and Facebook**.

---

## 🏗️ Technical Architecture

### **The "Brain" (Node.js)**
The orchestrator manages the state machine and bridges the JavaScript ecosystem with the Python AI modules. It handles error recovery, logging, and 24/7 scheduling via GitHub Actions.

### **The "Voice" (Voicebox Python)**
*   **Model**: Qwen3-TTS (1.7B base).
*   **STT Engine**: Whisper (for automatic reference transcription).
*   **Feature**: Real-time voice cloning via few-shot learning (zeros out the need for fine-tuning).

### **The "Face" (Wav2Lip Python)**
*   **Engine**: GAN-based Lipsync (Wav2Lip model).
*   **Detection**: S3FD face detector for frame-by-frame coordinate tracking.
*   **Optimization**: Syllabic snapping (disabled smoothing) for fast-paced technical narration.

### **The "Visuals" (React + GSAP)**
*   **Compositor**: `reel-composer` (Vite, React, TypeScript).
*   **Animation**: GSAP (GreenSock) for high-performance visual timing.
*   **Capture**: Playwright + MediaRecorder API @ 60fps for "Master Grade" video capture.

---

## 🏗️ Project Anatomy

```text
├── main_automation.js      # Orchestrator & State Machine
├── wav2lip/                # Neural Lip-sync Engine (Python/PyTorch)
├── voicebox/               # Voice Cloning Engine (Python/Transformers)
├── reel-composer/          # Visual Compositor (React/GSAP)
├── Base-vedio.mp4          # The "Actor" Asset
├── Base-audio.mp3          # The "Voice" DNA Asset
├── src/
│   └── services/
│       ├── voiceboxService.js  # Node <-> Python Voice Bridge
│       ├── wav2lipService.js   # Node <-> Python Face Bridge
│       ├── scriptService.js    # Gemini 1.5 Pro Viral Scripting
│       └── socialMediaService.js # Multi-APIs (YT, Meta, Supabase)
└── .github/workflows/      # 24/7 CI/CD Production Pipeline
```

---

## 🛠️ Installation & Setup

### 1. Environment
*   Node.js v20+
*   Python 3.10+ (with CUDA/MPS for acceleration)
*   Playwright Browsers: `npx playwright install chromium --with-deps`

### 2. AI Weight Download
The system uses Git LFS to track heavy `.pth` and `.bin` models. Initial setup requires:
```bash
git lfs pull
```

### 3. Local Run
```bash
# 1. Start the visual compositor
cd reel-composer && npm run dev

# 2. Run the automation pipeline
node main_automation.js
```

---

## 🤖 Continuous Production (Cloud)

The pipeline is optimized for **GitHub Actions**:
- **Schedule**: Twice daily (8:00 AM & 8:00 PM IST).
- **Execution**: Headless Xvfb display on Ubuntu runners.
- **Persistence**: Git LFS + Smart Caching for rapid 500MB AI model loading.

---

*Built for creators who would rather build the future than manually edit it.*
