# AI Content Automation Workflow

🤖 **Automated Telugu + English Banking Content Creation System**

This application automatically:

- Fetches tasks from Google Sheets
- Generates bilingual conversation scripts
- Creates audio with TTS
- Assembles videos with subtitles
- Uploads to YouTube & Instagram
- Sends email notifications

## 🔄 Workflow Steps

1. **Sheets → Script → Audio → Video → Upload → Notify**
2. **Runs automatically twice daily (8 AM & 8 PM)**
3. **Stops on errors and sends email alerts**

---

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Fill in all required values in .env
```

### 3. Install FFmpeg

```bash
# Windows (using Chocolatey)
choco install ffmpeg

# Or download from: https://ffmpeg.org/download.html
```

### 4. Install Coqui TTS (Local)

```bash
pip install TTS
tts-server --model_name tts_models/en/ljspeech/tacotron2-DDC --port 5002
```

### 5. Start Server

```bash
npm run dev    # Development
npm start      # Production
```

---

## 🔧 Required Services Setup

### Google Services

1. **Google Cloud Console**

   - Enable Sheets API & YouTube Data API
   - Create Service Account → Download credentials JSON
   - Share your Google Sheet with service account email

2. **YouTube OAuth**
   - Create OAuth 2.0 credentials
   - Get refresh_token using OAuth playground

### AI Services

1. **Hugging Face API**

   - Sign up at huggingface.co
   - Generate API token

2. **Stability AI**
   - Sign up at stability.ai
   - Get API key

### Storage & Social Media

1. **Cloudflare R2**

   - Create R2 bucket
   - Upload base.mp4 background video
   - Generate access keys

2. **Instagram Graph API**
   - Business Instagram account
   - Facebook Developer account
   - Generate access token

### Email

1. **Gmail SMTP**
   - Enable 2-factor authentication
   - Generate App Password

---

## 📋 Google Sheet Format

| Column A         | Column B                  | Column C    | Column D     |
| ---------------- | ------------------------- | ----------- | ------------ |
| Title            | Description               | Category    | Status       |
| "Banking Basics" | "Explain savings account" | "Education" | "Not Posted" |

**Status Values:**

- `Not Posted` - Ready for processing
- `Posted` - Completed
- `Error` - Failed (check email for details)

---

## 🎯 API Endpoints

### Main Workflow

- `POST /workflow/run` - Start automated workflow
- `GET /workflow/status` - Check current status

### Individual Steps

- `GET /sheets/next-task` - Get next pending task
- `POST /script/generate` - Generate conversation script
- `POST /audio/generate` - Convert script to audio
- `GET /video/base` - Get background video URL
- `POST /images/generate` - Generate illustrations
- `POST /video/assemble` - Create final video
- `POST /metadata/generate` - Generate captions/hashtags
- `POST /youtube/upload` - Upload to YouTube
- `POST /instagram/upload` - Upload to Instagram
- `PATCH /sheets/update` - Update sheet status
- `POST /notify/email` - Send notification email

### Monitoring

- `GET /health` - Health check
- `GET /workflow/status` - Current workflow state

---

## 📁 Project Structure

```
├── server.js          # Main application
├── package.json       # Dependencies
├── .env.example       # Environment template
├── README.md          # This file
├── temp/             # Temporary files
├── audio/            # Generated audio files
├── images/           # Generated images
├── videos/           # Final videos
├── subtitles/        # SRT subtitle files
├── error.log         # Error logs
└── combined.log      # All logs
```

---

## 🔄 Cron Schedule

- **8:00 AM IST** - Morning content generation
- **8:00 PM IST** - Evening content generation

To modify schedule, edit the cron pattern in `server.js`:

```javascript
const cronJob = new cron.CronJob('0 8,20 * * *', ...);
```

---

## 📧 Email Notifications

### Success Email

- ✅ Title of published content
- 🔗 YouTube & Instagram links
- ⏰ Timestamp

### Error Email

- ❌ Failed step name
- 🐛 Error details
- 📊 Full workflow state
- ⏰ Timestamp

---

## 🛠️ FFmpeg Command Used

The video assembly uses this ffmpeg command structure:

```bash
ffmpeg -i base_video.mp4 -i combined_audio.mp3
       -i image1.png -i image2.png
       -vf "subtitles=subtitles.srt:force_style='FontSize=24,PrimaryColour=&Hffffff'"
       -c:v libx264 -c:a aac -preset fast -crf 23
       output.mp4
```

---

## 🚨 Troubleshooting

### Common Issues

1. **Coqui TTS Not Running**

   ```bash
   # Start TTS server
   tts-server --model_name tts_models/en/ljspeech/tacotron2-DDC --port 5002
   ```

2. **FFmpeg Not Found**

   ```bash
   # Windows: Install via Chocolatey
   choco install ffmpeg

   # Or add to PATH manually
   ```

3. **Google Sheets Access Denied**

   - Check service account email has sheet access
   - Verify GOOGLE_CREDENTIALS format

4. **YouTube Upload Failed**

   - Verify OAuth refresh token
   - Check video file size (<128MB)

5. **Instagram Upload Failed**
   - Ensure business account
   - Verify access token scope

### Log Files

- `error.log` - Error-level logs only
- `combined.log` - All application logs
- Console output - Real-time status

---

## 📊 Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

### Workflow Status

```bash
curl http://localhost:3000/workflow/status
```

### Manual Trigger

```bash
curl -X POST http://localhost:3000/workflow/run
```

---

## 🔐 Security Notes

1. **Never commit `.env` file**
2. **Use app passwords for email**
3. **Rotate API keys regularly**
4. **Limit service account permissions**
5. **Use HTTPS in production**

---

## 📈 Performance Tips

1. **Optimize base video size** - Keep under 50MB
2. **Limit script length** - 60-90 seconds max
3. **Monitor disk space** - Temp files cleanup
4. **Use CDN for images** - Faster processing
5. **Database logging** - For production scale

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

---

## 📄 License

MIT License - see LICENSE file for details.

---

**🎉 Happy Automating!**

Your content will be automatically generated and published twice daily. Check your email for updates and any error notifications.
