# AI Content Automation v2.0 - Complete Automated Workflow

## 🎯 What This System Does

This is a **fully automated content creation system** that:

1. **📊 Pulls tasks from Google Sheets** - Finds the first "Not Posted" row
2. **🤖 Generates Q&A conversations** - Creates engaging male/female dialogue using Groq
3. **🎵 Creates multi-speaker TTS** - Different voices for male/female speakers using Gemini
4. **📝 Perfect subtitle timing** - SRT files with 2-line max, positioned at 65% from top
5. **🖼️ Contextual image generation** - Educational images timed to conversation segments
6. **📹 Video composition** - Combines base video, audio, images, and subtitles
7. **📱 Social media upload** - Automatically uploads to YouTube and Instagram
8. **📧 Email notifications** - Success/error notifications with live links
9. **🧹 Auto cleanup** - Empties media folders after successful upload
10. **✅ Sheet updates** - Marks as "Posted" with timestamps and links

## 🚀 Quick Start

### 1. Setup Environment

```bash
# Install dependencies
npm install

# Run setup script
npm run setup

# Start server
npm start
```

### 2. Configure Your .env File

```env
# APIs (Required)
GROQ_API_KEY=your_groq_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# Google Services (Required)
GOOGLE_SHEET_ID=your_google_sheet_id_here
GOOGLE_DRIVE_VIDEO_FOLDER_ID=your_drive_folder_id_here

# Email Notifications (Required)
EMAIL_USER=your_email@gmail.com
EMAIL_APP_PASSWORD=your_gmail_app_password_here

# YouTube (Optional - for uploads)
YOUTUBE_REFRESH_TOKEN=your_youtube_refresh_token
```

### 3. Setup Google Sheet Structure

Create a Google Sheet with these columns:

- **SNO** - Serial number
- **Idea** - Content topic/title
- **Description** - Detailed description
- **Status** - "Not Posted" / "Posted" / "Error"
- **YT Link** - YouTube video URL (auto-filled)
- **Insta Link** - Instagram post URL (auto-filled)
- **Timestamp** - Upload timestamp (auto-filled)

### 4. Run Automated Workflow

```bash
# Fully automated - pulls from Google Sheets
curl -X POST http://localhost:3000/workflow/auto

# Check status
curl http://localhost:3000/workflow/status
```

## 🏗️ Project Structure

```
├── server.js                       # Main application entry point
├── setup.js                        # Setup and configuration checker
├── src/
│   ├── config/                     # Configuration files
│   │   ├── database.js            # S3/Filebase configuration
│   │   ├── ffmpeg.js              # FFmpeg setup
│   │   ├── google.js              # Google APIs (Sheets, Drive, YouTube)
│   │   └── logger.js              # Winston logger setup
│   ├── controllers/               # Request handlers
│   │   ├── audioController.js     # Audio generation endpoints
│   │   ├── imageController.js     # Image generation endpoints
│   │   ├── scriptController.js    # Script generation endpoints
│   │   ├── videoController.js     # Video handling endpoints
│   │   └── workflowController.js  # MAIN automated workflow controller
│   ├── routes/                    # Express route definitions
│   │   ├── audio.js              # /audio routes
│   │   ├── images.js             # /images routes
│   │   ├── script.js             # /script routes
│   │   ├── video.js              # /video routes
│   │   └── workflow.js           # /workflow routes (AUTO + MANUAL)
│   ├── services/                 # Business logic layer
│   │   ├── audioService.js       # Multi-speaker TTS with Gemini
│   │   ├── imageService.js       # Contextual educational images
│   │   ├── scriptService.js      # Q&A conversation generation
│   │   ├── videoProcessingService.js # Video composition & optimization
│   │   ├── sheetsService.js      # Google Sheets integration
│   │   ├── socialMediaService.js # YouTube & Instagram uploads
│   │   ├── emailService.js       # Email notifications
│   │   └── cleanupService.js     # Media folder cleanup
│   ├── utils/                    # Utility functions
│   │   ├── subtitles.js         # Enhanced SRT generation with timing
│   │   └── textCleaner.js       # Text processing utilities
│   └── middleware/               # Express middleware
│       └── upload.js            # File upload handling
├── audio/                        # Generated TTS audio files
├── images/                       # Generated educational images
├── videos/                       # Base videos & final outputs
├── temp/                         # Temporary processing files
└── subtitles/                    # Generated SRT subtitle files
```

## � API Endpoints

### 🤖 Automated Workflow (Recommended)

#### `POST /workflow/auto`

**The main endpoint** - Fully automated workflow that:

- Pulls next task from Google Sheets
- Processes everything automatically
- Updates sheet with results
- Sends email notifications
- Cleans up after completion

```bash
curl -X POST http://localhost:3000/workflow/auto
```

**Response:**

```json
{
  "success": true,
  "message": "Automated workflow started successfully",
  "taskId": "1672531200000",
  "status": "running",
  "note": "Check workflow status at /workflow/status or wait for email notification"
}
```

#### `GET /workflow/status`

Check the current workflow progress:

```json
{
  "workflow": {
    "status": "running",
    "currentStep": "video/compose",
    "progress": {
      "step": 7,
      "total": 12,
      "description": "Composing final video"
    },
    "taskData": {
      "idea": "How does photosynthesis work?",
      "sno": "1",
      "rowId": 2
    }
  }
}
```

### 🔧 Manual Workflow (Legacy)

#### `POST /workflow/run`

Manual workflow with custom title/description:

```bash
curl -X POST http://localhost:3000/workflow/run \
  -H "Content-Type: application/json" \
  -d '{"title": "How AI Works", "description": "Explain artificial intelligence basics"}'
```

### 🔍 Individual Components

- `POST /script/generate` - Generate Q&A conversation only
- `POST /audio/generate` - Generate TTS audio only
- `POST /images/generate` - Generate educational images only
- `GET /video/base` - Get base video from Drive only

## ⚙️ Configuration Details

### Required API Keys

1. **Groq API Key**: Get from [groq.com](https://groq.com)

   - Used for Q&A conversation generation
   - Model: llama3-8b-8192

2. **Gemini API Key**: Get from [Google AI Studio](https://makersuite.google.com)
   - Used for TTS generation and image analysis
   - Requires Text-to-Speech API access

### Google Services Setup

1. **Service Account**: Place `seismic-rarity-468405-j1-a83f924d9fbc.json` in root directory

2. **Google Sheet**: Create with these exact column headers:

   ```
   SNO | Idea | Description | Status | YT Link | Insta Link | Timestamp
   ```

3. **Google Drive**: Create folder for base videos and get the folder ID

4. **YouTube API** (Optional): Set up OAuth2 for automatic uploads

### Email Configuration

Use Gmail App Passwords for notifications:

1. Enable 2FA on your Gmail account
2. Generate an App Password
3. Use that password in `EMAIL_APP_PASSWORD`

## 🎯 Workflow Features Deep Dive

### 1. Multi-Speaker Q&A Generation

- **Female Speaker (A)**: Asks concise, thoughtful questions
- **Male Speaker (B)**: Provides detailed, in-depth explanations
- **Indian English Style**: Natural conversation flow
- **Deep Knowledge**: Not surface-level, comprehensive answers

### 2. Perfect Subtitle Timing

- **Max 2 lines per subtitle**: Better readability
- **Positioned at 65% from top**: Leaves space for images
- **Perfect timing**: Based on actual speech duration
- **Dark background**: High contrast for readability
- **Poppins-Bold font**: Clean, professional appearance

### 3. Contextual Educational Images

- **Content Analysis**: Analyzes conversation for key concepts
- **Timed Placement**: Images appear during relevant discussion
- **Educational Style**: Professional, clean design
- **16:9 Aspect Ratio**: Optimized for video overlay
- **Top 50% Placement**: Positioned above subtitles

### 4. Video Composition

- **Base Video**: Either from Google Drive or placeholder
- **Audio Overlay**: Multi-speaker TTS audio
- **Image Overlays**: Contextual images with fade in/out
- **Subtitle Burn-in**: SRT subtitles burned into video
- **9:16 Aspect Ratio**: Optimized for YouTube Shorts/Instagram Reels

### 5. Social Media Optimization

- **YouTube Shorts**: Optimized encoding for YouTube
- **Instagram Reels**: Size-optimized for Instagram (< 60s)
- **Auto Hashtags**: Generated based on content
- **Custom Captions**: Platform-specific descriptions

### 6. Smart Cleanup

- **Preserves Base Videos**: Only cleans generated content
- **Post-Upload Cleanup**: Only cleans after successful upload
- **Error Preservation**: Keeps files if upload fails

## 🔄 Workflow Steps Breakdown

1. **📊 Sheets Integration**: Finds first "Not Posted" row
2. **📝 Script Generation**: Creates Q&A conversation with Groq
3. **🎵 TTS Generation**: Multi-speaker audio with Gemini
4. **📝 Subtitle Creation**: SRT with perfect timing
5. **📹 Base Video**: Gets from Drive or creates placeholder
6. **🖼️ Image Generation**: Contextual educational images
7. **🎬 Video Composition**: Combines all elements with FFmpeg
8. **📱 Platform Optimization**: Creates YouTube/Instagram versions
9. **🚀 Social Upload**: Uploads to both platforms
10. **📊 Sheet Update**: Updates with links and timestamp
11. **📧 Email Notification**: Sends success notification
12. **🧹 Cleanup**: Empties media folders

## 🐛 Troubleshooting

### Common Issues

1. **FFmpeg not found**:

   ```bash
   # Windows
   Download from: https://ffmpeg.org/download.html
   Add to PATH: C:\ffmpeg\bin
   ```

2. **Google API errors**:

   - Check service account JSON file placement
   - Verify Google Sheet permissions
   - Ensure APIs are enabled in Google Cloud Console

3. **TTS generation fails**:

   - Verify GEMINI_API_KEY is correct
   - Check Text-to-Speech API quota
   - Ensure API has TTS access enabled

4. **Upload failures**:
   - YouTube: Check OAuth2 refresh token
   - Instagram: Currently placeholder (needs Instagram Graph API)
   - Verify file permissions and sizes

### Debug Mode

Enable detailed logging:

```bash
NODE_ENV=development npm start
```

Check logs:

```bash
npm run logs
# or
tail -f combined.log
```

## � Success Indicators

When working correctly, you should see:

- ✅ Task pulled from Google Sheet
- ✅ Q&A conversation generated
- ✅ Multi-speaker TTS created
- ✅ Timed subtitles generated
- ✅ Educational images created
- ✅ Video composed successfully
- ✅ Uploaded to social media
- ✅ Sheet updated with live links
- ✅ Email notification sent
- ✅ Media folders cleaned

## 📧 Email Notifications

You'll receive automated emails for:

- **✅ Success**: With live YouTube/Instagram links
- **❌ Errors**: With detailed error information and troubleshooting steps
- **📊 Status Updates**: For long-running processes

## 🎯 Performance Tips

1. **Optimize base videos**: Use shorter base videos (30-60s)
2. **Monitor API quotas**: Keep track of Groq/Gemini usage
3. **Pre-populate sheets**: Have multiple "Not Posted" rows ready
4. **Check disk space**: Media processing requires temporary storage
5. **Stable internet**: Uploads require reliable connection

## 🔐 Security Notes

- **API Keys**: Never commit API keys to version control
- **Service Account**: Keep Google service account JSON secure
- **Email Passwords**: Use Gmail App Passwords, not account passwords
- **File Permissions**: Ensure proper file/folder permissions

---

## 🎉 Ready to Go!

Once configured, simply run:

```bash
npm start
curl -X POST http://localhost:3000/workflow/auto
```

The system will automatically:

1. Find your next content idea in Google Sheets
2. Create engaging educational content
3. Upload to social media
4. Notify you with live links
5. Clean up and be ready for the next run

**Your content creation is now fully automated! 🚀**

- ✅ **Separation of Concerns** - Controllers, Services, Routes clearly separated
- ✅ **Maintainability** - Each component has single responsibility
- ✅ **Testability** - Services can be unit tested independently
- ✅ **Scalability** - Easy to add new features and endpoints
- ✅ **Error Handling** - Centralized error handling and logging

### Features Enhanced

- ✅ **Google Drive Integration** - Automatic base video fetching
- ✅ **Smart File Checking** - Skips generation if files exist
- ✅ **Improved Subtitles** - Black background, white bold Poppins font
- ✅ **Better Image Positioning** - Images positioned in upper video portion
- ✅ **Clean Logging** - No more Filebase references, clean console output
- ✅ **Audio Optimization** - Single API call strategy for TTS

## 🔄 Migration Notes

### What Changed

- `server.js` → `app.js` (main entry point)
- Monolithic file → Clean architecture with folders
- All Filebase references removed → Google Drive integration
- Enhanced error handling and logging
- Improved video assembly with better subtitles and image positioning

### Backward Compatibility

- All existing API endpoints work the same
- Environment variables remain the same
- Generated files use same directory structure
- Legacy server available as `server-old.js`

## 🧪 Testing

### Test Individual Components

```bash
# Test script generation
curl -X POST http://localhost:3000/script/generate \
  -H "Content-Type: application/json" \
  -d '{"topic": "Machine Learning Basics"}'

# Test full workflow
curl -X POST http://localhost:3000/workflow/run \
  -H "Content-Type: application/json" \
  -d '{"title": "AI Tutorial", "description": "Educational content"}'

# Check status
curl http://localhost:3000/workflow/status
```

### Health Check

```bash
curl http://localhost:3000/health
```

## 📝 Development

### Adding New Features

1. **Service** - Add business logic in `src/services/`
2. **Controller** - Add request handling in `src/controllers/`
3. **Route** - Add endpoint in `src/routes/`
4. **Config** - Add configuration in `src/config/`

### Code Style

- Use async/await for promises
- Proper error handling with try/catch
- Consistent logging with Winston
- Clear function naming and documentation

## 🐛 Troubleshooting

### Common Issues

- **FFmpeg not found** - Check path in `src/config/ffmpeg.js`
- **Google Drive auth** - Verify service account JSON file
- **Missing audio** - Check audio generation logs
- **Subtitle issues** - Verify SRT file generation in temp folder

### Logs

- Error logs: `error.log`
- Combined logs: `combined.log`
- Console logs: Real-time in terminal
