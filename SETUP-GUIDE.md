# 🔧 Complete Environment Variables Setup Guide

Follow this step-by-step guide to get all required values for your .env file.

---

## 📋 **Required .env Variables - Step by Step**

### 1. **Server Configuration** ✅ (Already set)

```
PORT=3000
```

**Status:** ✅ No action needed

---

### 2. **Google Services** 🔑

#### **GOOGLE_CREDENTIALS** (Service Account JSON)

**Where to get:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable APIs:
   - Go to "APIs & Services" > "Library"
   - Search and enable "Google Sheets API"
   - Search and enable "YouTube Data API v3"
4. Create Service Account:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service Account"
   - Fill name (e.g., "content-automation")
   - Click "Create and Continue"
   - Skip roles for now, click "Done"
5. Generate Key:
   - Click on your service account email
   - Go to "Keys" tab
   - Click "Add Key" > "Create new key" > "JSON"
   - Download the JSON file
6. **Copy entire JSON content** (minified, single line)

**Example format:**

```json
{
  "type": "service_account",
  "project_id": "your-project-123",
  "private_key_id": "abc123",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIE...",
  "client_email": "content-automation@your-project-123.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token"
}
```

#### **GOOGLE_SHEET_ID**

**Where to get:**

1. Create a Google Sheet with this format:
   | Title | Description | Category | Status |
   |-------|-------------|----------|--------|
   | Banking Basics | Explain savings account | Education | Not Posted |
2. Copy Sheet ID from URL:

   - `https://docs.google.com/spreadsheets/d/`**1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms**`/edit`
   - The bold part is your SHEET_ID

3. **Share sheet with service account:**
   - Click "Share" button
   - Add your service account email (from JSON file)
   - Give "Editor" access

#### **YOUTUBE_REFRESH_TOKEN**

**Where to get:**

1. Go to [Google API Console](https://console.cloud.google.com/)
2. Same project as above
3. Go to "Credentials" > "Create Credentials" > "OAuth 2.0 Client IDs"
4. Application type: "Desktop application"
5. Download JSON file
6. Use [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/):
   - Click ⚙️ settings icon
   - Check "Use your own OAuth credentials"
   - Enter your Client ID and Client Secret
   - In Step 1: Add scope `https://www.googleapis.com/auth/youtube.upload`
   - Click "Authorize APIs"
   - Complete authorization
   - In Step 2: Click "Exchange authorization code for tokens"
   - **Copy the refresh_token**

---

### 3. **AI Services** 🤖

#### **GROQ_API_KEY**

**Where to get:**

1. Go to [Groq Console](https://console.groq.com/)
2. Create free account
3. Go to "API Keys" section
4. Click "Create API Key"
5. Name: "content-automation"
6. **Copy the API key** (starts with `gsk_...`)
7. Note: Groq offers fast inference with generous free tier

#### **STABILITY_API_KEY**

**Where to get:**

1. Go to [Stability AI](https://platform.stability.ai/)
2. Create account (free tier available)
3. Go to [API Keys](https://platform.stability.ai/account/keys)
4. Click "Create API Key"
5. Name: "content-automation"
6. **Copy the API key** (starts with `sk-...`)

---

### 4. **Filebase Storage** ☁️

#### **Filebase Credentials**

**Where to get:**

1. Go to [Filebase](https://filebase.com/)
2. Create free account (5GB free tier)
3. Go to "Buckets" in dashboard
4. Click "Create Bucket"
5. Bucket name: `content-automation-videos`
6. Select any region (e.g., us-east-1)
7. Create bucket

**Get API Credentials:**

1. Go to "Access Keys" in dashboard
2. Click "Create Access Key"
3. Name: "content-automation"
4. Permissions: "Full Access" (or specific bucket access)
5. **Copy:**
   - Access Key ID
   - Secret Access Key
   - Note: Endpoint is always `https://s3.filebase.com`

**Values needed:**

```
FILEBASE_ENDPOINT=https://s3.filebase.com
FILEBASE_ACCESS_KEY_ID=your_access_key
FILEBASE_SECRET_ACCESS_KEY=your_secret_key
FILEBASE_BUCKET_NAME=content-automation-videos
```

**Upload Base Video via API:**

After starting your server (`npm run dev`), upload your base video:

```bash
# Upload base video (background video for your content)
curl -X POST http://localhost:3000/filebase/upload-base-video \
  -F "video=@path/to/your/base.mp4"

# Alternative: Upload multiple files
curl -X POST http://localhost:3000/filebase/upload-multiple \
  -F "files=@video1.mp4" \
  -F "files=@video2.mp4"

# List uploaded files
curl http://localhost:3000/filebase/list

# Get download URL for any file
curl http://localhost:3000/filebase/download/base.mp4
```

---

### 5. **Instagram Graph API** 📱

#### **Instagram Credentials**

**Where to get:**

1. **Requirements:**

   - Instagram Business Account
   - Facebook Page connected to Instagram
   - Facebook Developer Account

2. **Setup:**
   - Go to [Facebook Developers](https://developers.facebook.com/)
   - Create App > "Consumer" > "Business"
   - Add "Instagram Graph API" product
3. **Get Access Token:**

   - Use [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
   - Select your app
   - Generate token with scopes:
     - `instagram_graph_user_profile`
     - `instagram_graph_user_media`
   - **Copy long-lived access token**

4. **Get Account ID:**
   - In Graph API Explorer: `me/accounts`
   - Find your Instagram business account ID

**Values needed:**

```
INSTAGRAM_ACCOUNT_ID=your_instagram_business_id
INSTAGRAM_ACCESS_TOKEN=your_long_lived_token
```

---

### 6. **Email Configuration** 📧

#### **Gmail SMTP Setup**

**Where to get:**

1. **Gmail Account Setup:**

   - Use any Gmail account
   - Enable 2-Factor Authentication:
     - Go to Google Account settings
     - Security > 2-Step Verification > Turn on

2. **Generate App Password:**
   - Go to Google Account > Security
   - 2-Step Verification > App passwords
   - Select app: "Mail"
   - Select device: "Other" > "Content Automation"
   - **Copy the 16-character password**

**Values needed:**

```
EMAIL_USER=your.email@gmail.com
EMAIL_APP_PASSWORD=abcd efgh ijkl mnop
NOTIFICATION_EMAIL=recipient@email.com
```

---

### 7. **Coqui TTS Server** 🗣️

#### **Local TTS Setup**

**Installation:**

```bash
# Install Python TTS library
pip install TTS

# Start TTS server
tts-server --model_name tts_models/en/ljspeech/tacotron2-DDC --port 5002
```

**Value:**

```
COQUI_TTS_URL=http://localhost:5002
```

---

## 📝 **Final .env File Example**

```bash
# Server Configuration
PORT=3000

# Google Services
GOOGLE_CREDENTIALS={"type":"service_account","project_id":"banking-content-123"...}
GOOGLE_SHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
YOUTUBE_REFRESH_TOKEN=1//04-refresh-token-here

# AI Services
GROQ_API_KEY=gsk_abcdefghijklmnop
STABILITY_API_KEY=sk-abcdefghijklmnop

# Filebase Storage
FILEBASE_ENDPOINT=https://s3.filebase.com
FILEBASE_ACCESS_KEY_ID=your-access-key
FILEBASE_SECRET_ACCESS_KEY=your-secret-key
FILEBASE_BUCKET_NAME=content-automation-videos

# Instagram
INSTAGRAM_ACCOUNT_ID=17841405822304914
INSTAGRAM_ACCESS_TOKEN=EAABwzLixnjYBO...

# Email
EMAIL_USER=your.automation@gmail.com
EMAIL_APP_PASSWORD=abcd efgh ijkl mnop
NOTIFICATION_EMAIL=notifications@yourdomain.com

# TTS Server
COQUI_TTS_URL=http://localhost:5002
```

---

## 🚀 **Quick Start Checklist**

- [ ] Google Cloud Project created + APIs enabled
- [ ] Service account JSON downloaded
- [ ] Google Sheet created + shared with service account
- [ ] YouTube OAuth refresh token obtained
- [ ] Groq account + API key
- [ ] Stability AI account + API key
- [ ] Filebase bucket created + base.mp4 uploaded
- [ ] Instagram Business account + Graph API token
- [ ] Gmail app password generated
- [ ] Coqui TTS server installed
- [ ] All values filled in .env file

---

## 🔍 **Test Your Setup**

After filling .env, test each service:

```bash
# Start the server
npm run dev

# Test health check
curl http://localhost:3000/health

# Test individual endpoints
curl http://localhost:3000/sheets/next-task
```

---

**💡 Need help with any specific step? Let me know which service you're stuck on!**
