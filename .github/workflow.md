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
  - *How to get*: Create Service Account > Keys > Download JSON > Encode using `[Convert]::ToBase64String`.
- **`GOOGLE_SHEET_ID`**: The ID of your automation dashboard.
- **`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`**: From Google Cloud Console > Credentials > OAuth 2.0 Client IDs.
- **`YOUTUBE_REFRESH_TOKEN`**: Generate this using the OAuth Playground or a custom script to allow the runner to upload to YouTube without manual login.

### 2. AI & Media
- **`GEMINI_API_KEY`**: Your Google AI Studio API key.
- **`ASSEMBLYAI_API_KEY`**: From AssemblyAI dashboard (for auto-subtitles).

### 3. Social Media (Graph API)
- **`INSTAGRAM_ACCOUNT_ID`**: Get this from your Facebook Page settings (Connected Accounts).
- **`INSTAGRAM_ACCESS_TOKEN`**: Generate a long-lived token via the Meta for Developers Graph Explorer.
- **`FACEBOOK_PAGE_ID`**: Your Page ID.
- **`FACEBOOK_ACCESS_TOKEN`**: A permanent Page Access Token.

### 4. Supabase (Storage)
- **`SUPABASE_URL`**: `https://xyz.supabase.co`
- **`SUPABASE_SERVICE_ROLE_KEY`**: The secret `service_role` key (bypasses RLS for automated uploads).
- **`SUPABASE_BUCKET`**: The name of the bucket (e.g., `videos`). Make sure it is public or has appropriate policies.

### 5. Notifications
- **`EMAIL_USER`**: Your Gmail address.
- **`EMAIL_APP_PASSWORD`**: Generate this in Google Account > Security > App Passwords.
- **`NOTIFICATION_EMAIL`**: Where you want the final links delivered.

---

## 🚀 Workflow Execution

The pipeline is defined in `.github/workflows/reel-automation.yml`.

- **Auto-Run**: It triggers every day at **6:00 AM UTC**.
- **Manual-Run**: 
  1. Go to the **Actions** tab.
  2. Select **Reels Automation Pipeline**.
  3. Click **Run workflow**.

## 🛡️ Best Practices
1. **Asset Stability**: Ensure `assets/Base-vedio.mp4` is at least 100s long to prevent the lip-sync engine from running out of frames for long scripts.
2. **Token Expiry**: Regularly check if your Instagram/Facebook access tokens are still valid.
3. **Runner Limits**: If a video takes too long (e.g., high-quality GFPGAN), the job might time out (~6 hours limit).
