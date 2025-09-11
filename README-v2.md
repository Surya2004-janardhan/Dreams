# AI Content Automation v2.0 - Clean Architecture

## 🏗️ Project Structure

```
├── app.js                          # Main application entry point
├── server-old.js                   # Legacy server (backup)
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
│   │   └── workflowController.js  # Main workflow orchestration
│   ├── routes/                    # Express route definitions
│   │   ├── audio.js              # /audio routes
│   │   ├── images.js             # /images routes
│   │   ├── script.js             # /script routes
│   │   ├── video.js              # /video routes
│   │   └── workflow.js           # /workflow routes
│   ├── services/                 # Business logic layer
│   │   ├── audioService.js       # Google GenAI TTS logic
│   │   ├── imageService.js       # Imagen generation logic
│   │   ├── scriptService.js      # Groq script generation
│   │   └── videoService.js       # Google Drive video handling
│   ├── utils/                    # Utility functions
│   │   ├── subtitles.js         # SRT file generation
│   │   └── textCleaner.js       # Text processing utilities
│   └── middleware/               # Express middleware
│       └── upload.js            # File upload handling
├── audio/                        # Generated audio files
├── images/                       # Generated images
├── videos/                       # Final video outputs
├── temp/                         # Temporary processing files
└── subtitles/                    # Generated subtitle files
```

## 🚀 Getting Started

### Run the New Server

```bash
npm start
# or
npm run dev  # with nodemon for development
```

### Run the Legacy Server (if needed)

```bash
npm run old
```

## 📡 API Endpoints

### Main Workflow

- `POST /workflow/run` - Execute complete automation workflow
- `GET /workflow/status` - Get current workflow status

### Individual Components

- `POST /script/generate` - Generate conversation script
- `POST /audio/generate` - Generate audio from script
- `POST /images/generate` - Generate educational images
- `GET /video/base` - Get base video from Google Drive

### Utilities

- `GET /health` - Server health check
- `GET /` - API documentation

## 🔧 Configuration

### Environment Variables

```env
# APIs
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
GOOGLE_CREDENTIALS=your_service_account_json

# Google Drive
# Place seismic-rarity-468405-j1-a83f924d9fbc.json in root directory

# FFmpeg
# Ensure FFmpeg is installed at: C:\ffmpeg\ffmpeg-8.0-essentials_build\bin\
```

## 🎯 Key Improvements

### Architecture Benefits

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
