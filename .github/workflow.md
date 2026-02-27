# ⚙️ GitHub Actions Setup & Secrets

This document explains how to set up and manage the GitHub Actions automation for Dreams AI.

## 🔐 Full Secrets Reference

Add these variables to **Settings > Secrets and variables > Actions > New repository secret**.

### 1. External Media & Models
- **`BASE_VIDEO_DRIVE_ID`**: 
  - The Google Drive ID of your template video.
  - *Requirement*: 100s+ duration, fixed frame, close-up/half-body.
  - *Fallback*: The workflow only downloads this if `assets/Base-vedio.mp4` is missing from the repo. This is recommended to keep the repository size small.
  - *Recommendation*: Use of this secret helps bypass GitHub's 100MB file limit for repos.

### 2. Google Integration
- **`GOOGLE_CREDENTIALS`**: 
  - Base64 encoded JSON key from your Google Service Account.
  - *How to get*: Create Service Account > Keys > Download JSON.
- **`GOOGLE_SHEET_ID`**: The ID of your sheet containing the content ideas(Not the full URL). If you restrict the file to be private ensure you give editor access to the email that is present in the above GOOGLE_CREDENTIALS.
- **`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`**: From Google Cloud Console > Credentials > OAuth 2.0 Client IDs.
- **`YOUTUBE_REFRESH_TOKEN`**: Generate this using the OAuth Playground make sure you have youtube related all permissions enabled in the OAuth Playground.

### 2. AI & Media
- **`GEMINI_API_KEY`**: Your Google AI Studio API key.
- **`ASSEMBLYAI_API_KEY`**: From AssemblyAI dashboard (for auto-subtitles).
- **`GROQ_API_KEY`**: Your Groq API key(FALLBACK FOR SCRIPT AND CAPTION SERVICE).

### 3. Social Media (Graph API)
- **`INSTAGRAM_ACCOUNT_ID`**: Get this from your Facebook Page settings (Connected Accounts).
- **`INSTAGRAM_ACCESS_TOKEN`**: Generate a long-lived token via the Meta for Developers Graph Explorer.
- **`FACEBOOK_PAGE_ID`**: Your Page ID.
- **`FACEBOOK_ACCESS_TOKEN`**: A permanent Page Access Token.

### 4. Supabase (Storage)
- **`SUPABASE_URL`**: `https://xyz.supabase.co`
- **`SUPABASE_SERVICE_ROLE_KEY`**: The secret `service_role` key (bypasses RLS for automated uploads).
- **`SUPABASE_BUCKET`**: Defaults to `videos`. **IMPORTANT**: You MUST create a bucket named `videos` in your Supabase storage and ensure it is public or has appropriate RLS policies for video hosting.

### 5. Notifications
- **`EMAIL_USER`**: Your Gmail address(make sure you use secondary email).
- **`EMAIL_APP_PASSWORD`**: Generate this in Google Account > Security > App Passwords(make sure you use secondary email).
- **`NOTIFICATION_EMAIL`**: Where you want the final links delivered.

---

### 6. Advanced Optimization
- **`USE_PREMIUM_WAV2LIP`**: Set to `true` to enable **GFPGAN** restoration. 
    - **Pros**: Significant boost in facial clarity and lip sync sharpness.
    - **Cons**: Dramatically increases processing time on GitHub Actions (CPU). Use with caution for long videos.
- **`FORCE_CPU`**: Set to `true` to ensure standard library compatibility on runners.

---

## 🚀 Workflow Execution

The pipeline is defined in `.github/workflows/reel-automation.yml` and is designed for **Triple-Platform Distribution**:
- **YouTube Shorts**: Direct upload via OAuth 2.0.
- **Instagram Reels**: Automated push via Supabase staging and Meta Graph API.
- **Facebook Reels**: Automated push via Supabase staging and Meta Graph API.

- **Auto-Run**: It triggers every day at **6:00 AM UTC**(CRON jobs are adjustable you can set how you like).
- **Manual-Run**: 
  1. Go to the **Actions** tab.
  2. Select **Reels Automation Pipeline**.
  3. Click **Run workflow**.

## 🛡️ Best Practices
1. **Asset Stability**: Ensure `assets/Base-vedio.mp4` is at least 100s long to prevent the lip-sync engine from running out of frames for long scripts.
2. **Token Expiry**: Regularly check if your Instagram/Facebook access tokens are still valid.
3. **Runner Limits**: If a video takes too long (e.g., high-quality GFPGAN), the job might time out (~6 hours limit).
4. **Background Music (BGM)**:
   - The pipeline expects `assets/Bgm.m4a` (or `.mp3`/`.wav`).
   - **Default Volume**: Set to **20% (`0.2`)** to ensure primary audio clarity.
   - **Customization**: To change the volume, modify the `filter: 'volume', options: '0.2'` line in `src/main_automation.js` within the `runCompositor` function.
