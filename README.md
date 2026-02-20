# 🎬 Dreams AI Video Maker(Reels/shorts/)

Welcome! This project is a powerful tool that automatically turns your ideas (written in a Google Sheet) into high-quality, professional-looking AI videos for Instagram, YouTube, and Facebook. 

It handles everything: writing the script, cloning your voice, creating beautiful animations, and even making your lips move in sync with the audio.

---

> [!NOTE]
> This is a **technical prototype** for experimentation. It documents the feasibility of zero-shot voice cloning and programmatic motion graphics in a cloud-automated environment.

---

## 🌟 Why this is cool
*   **Your Voice, Your AI**: It uses just 30 seconds of your audio to speak in your voice for any script.
*   **Smart Visuals**: It doesn't just show static images; it builds dynamic, technical animations that match the topic.
*   **Fully Automatic**: Once you set it up, you just update a spreadsheet, and the AI does the rest—even uploading the video for you!

---

## 🚀 Quick Start (The Easiest Way)

If you have **Docker** installed, you can skip the complex setup and run everything in a "bundle":

1.  Open your terminal.
2.  Type: `docker-compose up --build`
3.  Sit back and watch the AI work!

---

## 🛠️ Step-by-Step Manual Setup

If you prefer to run it directly on your computer, follow these 3 simple steps:

### 1. The Basics
*   **Node.js**: Install version 20 or newer.
*   **Python**: Install version 3.10.
*   **FFmpeg**: Make sure this is installed on your system (it's what mixes the audio and video).
*   **Hardware**: You'll need at least 16GB of RAM. If you have an NVIDIA GPU, everything will run much faster!

### 2. Connect Your Apps (The .env file)
You'll need a few "keys" to let the AI talk to different services. Create a file named `.env` in the main folder and add these:

| What it's for | Key Name | Where to find it |
| :--- | :--- | :--- |
| **The AI Brain** | `GEMINI_API_KEY` | Get this from Google AI Studio. |
| **Your Spreadsheet** | `GOOGLE_SHEET_ID` | The ID of the Google Sheet where you write your topics. |
| **Facebook & IG** | `FACEBOOK_ACCESS_TOKEN` | Created in your Meta Developer portal. |
| **Voice Size** | `VOICEBOX_MODEL_SIZE` | Use `1.7B` for the best quality. |

### 3. Let's Build!
1.  Install the project dependencies:
    ```bash
    npm install
    pip install -r voicebox/requirements.txt
    pip install -r wav2lip/requirements.txt
    ```
2.  Install the browser that records the screen:
    ```bash
    npx playwright install --with-deps chromium
    ```
3.  Start the automation:
    ```bash
    node main_automation.js
    ```

---

## 📁 What's Inside?
*   **`main_automation.js`**: The "Boss" that tells everyone what to do.
*   **`voicebox/`**: The part that learns and speaks in your voice.
*   **`wav2lip/`**: The "Lip-Sync" engine that makes the video talk.
*   **`reel-composer/`**: The "Artist" that creates the cool technical animations.
*   **`final_video/`**: This is where your finished videos go!

---

## 💡 Pro Tips
*   **Simple is better**: When writing topics in your sheet, be clear and direct.
*   **Reference Audio**: Make sure your `Base-audio.mp3` is clear and doesn't have background noise.
*   **Lip-Sync Quality**: For the best results, use a video (`Base-vedio.mp4`) where the person is looking directly at the camera.

---

## 🔮 What's Next?
We're working on making the lip-sync even sharper and adding "Smart Trends" so your videos automatically match what's popular on TikTok and Reels!

---

Developed with ❤️ for creators using the Dreams Pipeline.
