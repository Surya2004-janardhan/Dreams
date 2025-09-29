# AI Social media Content Automation System 

## Overview

A comprehensive AI-powered content automation platform that creates and posts educational video and carousel content to social media platforms (YouTube, Instagram, Facebook). Features dual workflow architecture with microservices for scalable content generation.

---

## Architecture Overview

### Core Components

- **Main Application**: Node.js/Express backend with RESTful APIs
- **Slide Generation Microservice**: Python Flask service for image generation
- **AI Services**: Google Gemini, AssemblyAI, Groq for content creation
- **Media Processing**: FFmpeg for video composition, Sharp for image processing
- **Storage**: Supabase for file storage, Google Sheets for metadata
- **Deployment**: GitHub Actions CI/CD with conditional resource optimization

### Key Technologies

- **Backend**: Node.js 18, Express.js, Clean Architecture (MVC)
- **AI/ML**: Google Gemini API, AssemblyAI Speech-to-Text, Groq API
- **Media**: FFmpeg, Sharp, Canvas, PIL (Python)
- **Cloud**: Google Cloud, Supabase, AWS S3
- **Social APIs**: YouTube Data API, Instagram Graph API, Facebook Graph API

---

## Project Structure

```
├── audio/                 # Generated audio files
├── bin/                   # Utility scripts and testing tools
├── final_video/           # Final composed video outputs
├── fonts/                 # Custom fonts for text rendering
├── images/                # Generated images and thumbnails
├── scripts/               # AI-generated text scripts
├── slides/                # Temporary carousel slide storage
├── src/                   # Main application source
│   ├── config/           # Configuration files
│   ├── controllers/      # Express route controllers
│   ├── middleware/       # Express middleware
│   ├── routes/           # API route definitions
│   ├── services/         # Business logic services
│   └── utils/            # Utility functions
├── slide-generation/      # Python Flask microservice
│   ├── app.py           # Flask application
│   ├── assets/          # Fonts and base images
│   └── requirements.txt # Python dependencies
├── subtitles/            # Generated subtitle files
├── temp/                 # Temporary processing files
└── videos/               # Base video files and templates
```

---

## Workflows

### 1. Auto Video Workflow (`/workflow/auto`)

**Purpose**: End-to-end automated educational video creation and multi-platform posting

**Process Flow**:

1. **Task Retrieval** → Fetch next unposted task from Google Sheets
2. **Script Generation** → AI creates Q&A format educational script
3. **Audio Synthesis** → Multi-speaker TTS using Gemini API
4. **Subtitle Creation** → Speech-to-text subtitle generation
5. **Visual Assets** → AI-generated title images
6. **Video Composition** → FFmpeg merges all components
7. **Platform Upload** → Simultaneous posting to YouTube, Instagram, Facebook
8. **Status Update** → Google Sheets updated with results
9. **Notifications** → Email alerts for success/failure
10. **Cleanup** → Automatic resource cleanup

**Key Features**:

- Multi-speaker conversation format
- Platform-optimized video encoding
- Comprehensive error recovery
- Real-time progress monitoring

### 2. Posts Carousel Workflow (`/posts-workflow`)

**Purpose**: Automated carousel post creation for Instagram and Facebook

**Process Flow**:

1. **Task Retrieval** → Fetch carousel data from Google Sheets
2. **Slide Generation** → External Python API creates text overlay images
3. **Image Upload** → Supabase storage for public URLs
4. **Caption Creation** → AI-generated hashtags and descriptions
5. **Social Posting** → Carousel upload to Instagram and Facebook
6. **Status Update** → Google Sheets updated with post URLs
7. **Notifications** → Email delivery of results
8. **Cleanup** → Storage cleanup and local file removal

**Key Features**:

- External Python microservice for image generation
- Times New Roman font rendering
- Supabase CDN integration
- Platform-specific formatting

---

## Microservices Architecture

### Python Slide Generation Service

**Location**: `slide-generation/`

**Technology**: Flask + PIL (Pillow)

**Purpose**: High-quality text overlay image generation

**Features**:

- Times New Roman font rendering
- Cross-platform font management
- RESTful API endpoints
- Error handling and logging
- Font fallback mechanisms

**API Endpoints**:

- `POST /generate` → Generate slide with title and content
- `GET /font-status` → Check font availability
- `GET /` → Health check

---

## Services & Components

### Core Services

- **AudioService**: Multi-speaker TTS with Gemini API
- **ImageService**: AI image generation and processing
- **VideoProcessingService**: FFmpeg-based video composition
- **SocialMediaService**: Multi-platform content posting
- **EmailService**: Automated notifications and alerts
- **CleanupService**: Intelligent resource management

### External Integrations

- **Google Services**: Sheets API, YouTube API, Gemini AI
- **Social Platforms**: Instagram Graph API, Facebook Graph API
- **Cloud Storage**: Supabase file storage and CDN
- **AI Providers**: AssemblyAI, Groq, multiple Gemini API keys

### Utility Modules

- **Subtitles**: Speech-to-text processing
- **TextCleaner**: LLM output sanitization
- **Logger**: Winston-based logging system

---

## Deployment & CI/CD

### GitHub Actions Workflows

- **Scheduled Execution**: 2x daily automated runs (8AM/8PM IST)
- **Conditional Dependencies**: FFmpeg installed only for video workflows
- **Resource Optimization**: Minimal footprint for carousel-only runs
- **Error Handling**: Comprehensive failure recovery and notifications

### Environment Configuration

```bash
# Core API Keys
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
YOUTUBE_REFRESH_TOKEN=...
GEMINI_API_KEY=...

# Social Media Tokens
INSTAGRAM_ACCESS_TOKEN=...
FACEBOOK_ACCESS_TOKEN=...
FACEBOOK_PAGE_ID=...

# Storage & Communication
SUPABASE_URL=...
EMAIL_USER=...
NOTIFICATION_EMAIL=...
```

---

## API Endpoints

### Main Application (Port 3000)

```
GET  /health              # System health check
POST /workflow/auto       # Trigger full video workflow
POST /posts-workflow      # Trigger carousel workflow
GET  /audio/:file         # Serve audio files
GET  /images/:file        # Serve image files
GET  /videos/:file        # Serve video files
```

### Slide Generation Microservice (Port 5000)

```
GET  /                    # Service health check
GET  /font-status         # Font availability check
POST /generate            # Generate slide image
```

---

## Installation & Setup

### Prerequisites

- Node.js 18+
- Python 3.8+ (for slide generation)
- FFmpeg (installed automatically in CI/CD)

### Main Application Setup

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your API keys

# Start the server
npm start
```

### Slide Generation Service Setup

```bash
cd slide-generation

# Install Python dependencies
pip install -r requirements.txt

# Start the Flask service
python app.py
```

### Testing Workflows

```bash
# Test video workflow
curl -X POST http://localhost:3000/workflow/auto

# Test carousel workflow
curl -X POST http://localhost:3000/posts-workflow

# Check service health
curl http://localhost:3000/health
```

---

## Key Features & Optimizations

### Performance Optimizations

- **Conditional FFmpeg**: Installed only when needed
- **Microservices**: Separated concerns for scalability
- **Resource Cleanup**: Automatic file management
- **API Rate Limiting**: Built-in quota management

### Reliability Features

- **Error Recovery**: Comprehensive failure handling
- **Fallback Mechanisms**: Multiple API keys and services
- **Progress Monitoring**: Real-time workflow tracking
- **Emergency Cleanup**: Resource recovery on failures

### Content Quality

- **AI-Generated Scripts**: Educational Q&A format
- **Multi-Speaker Audio**: Natural conversation flow
- **Platform Optimization**: Format-specific encoding
- **SEO Optimization**: Hashtags and metadata

---

## Monitoring & Debugging

### Logs

- **Application Logs**: `combined.log`, `error.log`
- **Service Monitoring**: Winston logging system
- **API Debugging**: Request/response logging
- **Performance Metrics**: Execution time tracking

### Testing Tools

- **bin/**: Comprehensive test scripts for all services
- **Health Checks**: Automated system validation
- **API Testing**: Individual service endpoint testing
- **Workflow Simulation**: End-to-end testing tools

---

## Security & Best Practices

### API Key Management

- Environment variable configuration
- Multiple fallback keys for redundancy
- Secure secret storage in GitHub

### Data Handling

- Input validation and sanitization
- Secure file upload processing
- Temporary file cleanup
- Error message sanitization

### Access Control

- OAuth2 authentication for social platforms
- API rate limiting and quota management
- Secure webhook endpoints

---

## Troubleshooting

### Common Issues

- **FFmpeg Not Found**: Ensure conditional installation in CI/CD
- **API Quotas Exceeded**: Check service limits and rotate keys
- **Font Rendering Issues**: Verify Times New Roman availability
- **Authentication Failures**: Validate refresh tokens and API keys

### Debug Commands

```bash
# Check service health
curl http://localhost:3000/health

# Test slide generation
curl -X POST http://localhost:5000/generate \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","content":"Test content"}'

# View logs
tail -f combined.log
```

---

## Future Enhancements

- **Additional AI Models**: Support for more TTS and image generation services
- **Advanced Analytics**: Content performance tracking and optimization
- **Multi-Language Support**: International content creation
- **Custom Workflows**: User-configurable automation pipelines
- **Real-time Monitoring**: Dashboard for workflow status and metrics

---

## Support & Contributing

For technical support, bug reports, or feature requests:

- Check existing issues and documentation
- Use test scripts in `bin/` for debugging
- Review logs for detailed error information
- Ensure all environment variables are properly configured

**Version**: 2.0.0
**Last Updated**: September 2025
**Architecture**: Microservices with Clean MVC Design

