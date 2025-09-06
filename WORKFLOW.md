# 🔄 AI Content Automation Workflow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         🕰️ AUTOMATED CRON TRIGGER                               │
│                         (8:00 AM & 8:00 PM IST Daily)                          │
└─────────────────────────────┬───────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  1️⃣ POST /workflow/run                                                          │
│     ├─ Check if workflow already running                                       │
│     ├─ Start async execution                                                   │
│     └─ Return task ID immediately                                              │
└─────────────────────────────┬───────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  2️⃣ GET /sheets/next-task                                                       │
│     ├─ Connect to Google Sheets                                                │
│     ├─ Find first row with Status = "Not Posted"                               │
│     └─ Return: { title, description, category, rowId }                        │
└─────────────────────────────┬───────────────────────────────────────────────────┘
                              │
                 ❌ No tasks? │ ✅ Task found
                     STOP ────┤
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  3️⃣ POST /script/generate                                                       │
│     ├─ Send title + description to Hugging Face LLM                           │
│     ├─ Generate Telugu + English conversation script                           │
│     └─ Return: [{ speaker, text, subtitle }...]                               │
└─────────────────────────────┬───────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  4️⃣ POST /audio/generate                                                        │
│     ├─ For each script line:                                                   │
│     │   ├─ Send text to Coqui TTS server                                       │
│     │   ├─ Use different voices for Person A & Person B                       │
│     │   └─ Save as MP3 file                                                    │
│     └─ Return: [{ line, speaker, file, text }...]                             │
└─────────────────────────────┬───────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  5️⃣ GET /video/base                                                             │
│     ├─ Generate signed URL for base.mp4 from Cloudflare R2                    │
│     └─ Return: { url: "https://r2.../base.mp4?signed..." }                    │
└─────────────────────────────┬───────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  6️⃣ POST /images/generate                                                       │
│     ├─ Take first 4 script lines as image prompts                             │
│     ├─ Send each prompt to Stability AI                                       │
│     ├─ Generate banking/finance illustrations                                 │
│     └─ Return: [{ index, filename, prompt }...]                               │
└─────────────────────────────┬───────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  7️⃣ POST /video/assemble                                                        │
│     ├─ Download base video from R2 signed URL                                 │
│     ├─ Combine all audio files into single track                              │
│     ├─ Create SRT subtitle file from script                                   │
│     ├─ Use FFmpeg to merge:                                                    │
│     │   ├─ Base video (background)                                             │
│     │   ├─ Combined audio track                                               │
│     │   ├─ Image overlays at intervals                                        │
│     │   └─ Subtitle track (English)                                           │
│     └─ Return: { video: "videos/final_123456.mp4" }                           │
└─────────────────────────────┬───────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  8️⃣ POST /metadata/generate                                                     │
│     ├─ Send script content to Hugging Face LLM                                │
│     ├─ Generate engaging caption + hashtags                                   │
│     └─ Return: { caption: "🏦 Banking made simple...", hashtags: [...] }      │
└─────────────────────────────┬───────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  9️⃣ POST /youtube/upload                                                        │
│     ├─ Use refresh_token to get access_token                                   │
│     ├─ Upload video with title, description, tags                             │
│     ├─ Set as public video                                                     │
│     └─ Return: "https://www.youtube.com/watch?v=VIDEO_ID"                     │
└─────────────────────────────┬───────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  🔟 POST /instagram/upload                                                       │
│     ├─ Upload video to Instagram Graph API                                     │
│     ├─ Publish as Instagram Reel                                              │
│     └─ Return: "https://www.instagram.com/reel/REEL_ID"                       │
└─────────────────────────────┬───────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  1️⃣1️⃣ PATCH /sheets/update                                                       │
│     ├─ Update the row's Status column to "Posted"                             │
│     └─ Mark task as completed in Google Sheet                                 │
└─────────────────────────────┬───────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  1️⃣2️⃣ POST /notify/email                                                         │
│     ├─ Send success email with:                                               │
│     │   ├─ Content title                                                      │
│     │   ├─ YouTube link                                                       │
│     │   ├─ Instagram link                                                     │
│     │   └─ Timestamp                                                          │
│     └─ Workflow COMPLETED ✅                                                   │
└─────────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════════

❌ ERROR HANDLING AT ANY STEP:

┌─────────────────────────────────────────────────────────────────────────────────┐
│  🚨 ERROR OCCURS                                                                │
│     ├─ Stop workflow execution immediately                                     │
│     ├─ Log error details                                                       │
│     ├─ Send error email with:                                                  │
│     │   ├─ Failed step name                                                    │
│     │   ├─ Error message                                                       │
│     │   ├─ Full workflow state                                                 │
│     │   └─ Timestamp                                                           │
│     └─ Set workflow status to "error"                                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 📊 **File Flow Diagram**

```
Google Sheet (Input)
        │
        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Script JSON   │───▶│   Audio Files   │───▶│  Combined Audio │
│  [conversation] │    │   speaker_*.mp3 │    │   merged.mp3    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                                               │
        ▼                                               ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Image Prompts  │───▶│  Generated Imgs │───▶│   Final Video   │
│  [AI prompts]   │    │   image_*.png   │    │   final.mp4     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                                               │
        ▼                                               ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  SRT Subtitles  │───▶│   Base Video    │───▶│   Platforms     │
│  subtitles.srt  │    │    base.mp4     │    │ YouTube + Insta │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🕒 **Timing Breakdown**

| Step | Service             | Avg Time | Max Time |
| ---- | ------------------- | -------- | -------- |
| 1    | Workflow Start      | 0.1s     | 0.5s     |
| 2    | Google Sheets       | 2s       | 5s       |
| 3    | Script Generation   | 10s      | 30s      |
| 4    | Audio Generation    | 30s      | 60s      |
| 5    | Video Base URL      | 1s       | 3s       |
| 6    | Image Generation    | 20s      | 60s      |
| 7    | Video Assembly      | 45s      | 120s     |
| 8    | Metadata Generation | 5s       | 15s      |
| 9    | YouTube Upload      | 60s      | 300s     |
| 10   | Instagram Upload    | 30s      | 120s     |
| 11   | Sheet Update        | 2s       | 5s       |
| 12   | Email Notification  | 3s       | 10s      |

**⏱️ Total Estimated Time: 3-13 minutes per content piece**

## 🎯 **Success Indicators**

- ✅ **Workflow Status**: `completed`
- ✅ **Email Received**: Success notification with links
- ✅ **Sheet Updated**: Status changed to "Posted"
- ✅ **Content Live**: YouTube + Instagram links working
- ✅ **Files Generated**: Videos, audio, images saved locally

---

**🔄 The entire process runs automatically twice daily, handling everything from content creation to publishing and notifications!**
