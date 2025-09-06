# 📋 Setup Progress Checklist

## 🔑 **API Keys & Credentials** (Copy these to your .env file)

### Google Services

- [ ] **Google Cloud Project Created**

  - [ ] APIs enabled (Sheets + YouTube)
  - [ ] Service Account created
  - [ ] JSON credentials downloaded
  - [ ] `GOOGLE_CREDENTIALS` = `{paste entire JSON here}`

- [ ] **Google Sheet Setup**

  - [ ] Sheet created with columns: Title | Description | Category | Status
  - [ ] Sheet shared with service account email
  - [ ] `GOOGLE_SHEET_ID` = `{ID from sheet URL}`

- [ ] **YouTube OAuth**
  - [ ] OAuth 2.0 credentials created
  - [ ] Refresh token obtained from OAuth playground
  - [ ] `YOUTUBE_REFRESH_TOKEN` = `{refresh token}`

### AI Services

- [ ] **Hugging Face**

  - [ ] Account created at huggingface.co
  - [ ] API token generated
  - [ ] `HUGGINGFACE_API_KEY` = `hf_...`

- [ ] **Stability AI**
  - [ ] Account created at platform.stability.ai
  - [ ] API key generated
  - [ ] `STABILITY_API_KEY` = `sk-...`

### Storage & Social Media

- [ ] **Cloudflare R2**

  - [ ] Account created at cloudflare.com
  - [ ] R2 bucket created
  - [ ] base.mp4 video uploaded to bucket
  - [ ] API credentials generated
  - [ ] `R2_ENDPOINT` = `https://[account-id].r2.cloudflarestorage.com`
  - [ ] `R2_ACCESS_KEY_ID` = `{access key}`
  - [ ] `R2_SECRET_ACCESS_KEY` = `{secret key}`
  - [ ] `R2_BUCKET_NAME` = `{bucket name}`

- [ ] **Instagram Business**
  - [ ] Instagram business account ready
  - [ ] Facebook page connected
  - [ ] Facebook Developer app created
  - [ ] Graph API access token generated
  - [ ] `INSTAGRAM_ACCOUNT_ID` = `{business account ID}`
  - [ ] `INSTAGRAM_ACCESS_TOKEN` = `{long-lived token}`

### Email & TTS

- [ ] **Gmail SMTP**

  - [ ] Gmail 2FA enabled
  - [ ] App password generated
  - [ ] `EMAIL_USER` = `{your gmail}`
  - [ ] `EMAIL_APP_PASSWORD` = `{16-char app password}`
  - [ ] `NOTIFICATION_EMAIL` = `{where to send notifications}`

- [ ] **Coqui TTS**
  - [ ] Python installed
  - [ ] TTS library installed (`pip install TTS`)
  - [ ] TTS server started (`tts-server --model_name tts_models/en/ljspeech/tacotron2-DDC --port 5002`)
  - [ ] `COQUI_TTS_URL` = `http://localhost:5002`

---

## 🧪 **Testing Your Setup**

After filling all .env values, run these commands:

```bash
# 1. Test all connections
npm run test-setup

# 2. If all tests pass, start the server
npm run dev

# 3. Test the health endpoint
# Open: http://localhost:3000/health

# 4. Test manual workflow trigger
# POST to: http://localhost:3000/workflow/run
```

---

## 🎯 **Current Status**

**Priority 1 - Free Services (Start Here):**

- [ ] Hugging Face API (Free)
- [ ] Gmail SMTP (Free)
- [ ] Google Sheets API (Free)
- [ ] Coqui TTS Local (Free)

**Priority 2 - Paid Services:**

- [ ] Stability AI ($10 credit)
- [ ] Cloudflare R2 (Free tier: 10GB)
- [ ] YouTube API (Free with OAuth)
- [ ] Instagram Graph API (Free with business account)

---

## 📝 **Quick Copy-Paste Template**

```bash
# Add these to your .env file:

PORT=3000

GOOGLE_CREDENTIALS=
GOOGLE_SHEET_ID=
YOUTUBE_REFRESH_TOKEN=

HUGGINGFACE_API_KEY=
STABILITY_API_KEY=

R2_ENDPOINT=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=

INSTAGRAM_ACCOUNT_ID=
INSTAGRAM_ACCESS_TOKEN=

EMAIL_USER=
EMAIL_APP_PASSWORD=
NOTIFICATION_EMAIL=

COQUI_TTS_URL=http://localhost:5002
```

---

**🚀 Next Steps After Setup:**

1. Run `npm run test-setup` to verify all connections
2. Start server with `npm run dev`
3. Add sample data to your Google Sheet
4. Test manual workflow: `POST /workflow/run`
5. Check logs for any issues

**Need help with any specific service? Check SETUP-GUIDE.md for detailed instructions!**
