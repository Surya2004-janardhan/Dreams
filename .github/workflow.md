# ⚙️ GitHub Workflow Setup

This document explains how to set up and manage the cloud-based automation for Dreams AI.

## 🚀 Deployment Steps

### 1. Google Cloud Setup
1. Create a **Service Account** in Google Cloud Console.
2. Enable **Google Sheets API**.
3. Download the JSON key.
4. Convert the JSON key to **Base64** string:
   ```bash
   [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Content "key.json" -Raw)))
   ```
5. Save this as `GOOGLE_CREDENTIALS` in GitHub Secrets.

### 2. GitHub Secrets Configuration
Add the following secrets in **Settings > Secrets and variables > Actions**:

| Secret | Description |
| :--- | :--- |
| `GEMINI_API_KEY` | Google Gemini API Key |
| `SHEET_ID` | Your Google Sheet ID |
| `GOOGLE_CREDENTIALS` | Base64 encoded Google service account JSON |
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key |
| `ASSEMBLYAI_API_KEY` | API Key for SRT generation |
| `EMAIL_USER` | Gmail address for notifications |
| `EMAIL_APP_PASSWORD` | App-specific password for the email |

### 3. Workflow Activation
- The main automation workflow is located in `.github/workflows/reels-automation.yml`.
- It is configured to run on a **schedule** (check the `cron` settings).
- You can also trigger it manually from the **Actions** tab by selecting the workflow and clicking **Run workflow**.

## 🛠️ Performance & Scalability
- **Runner**: Uses `ubuntu-latest`.
- **Execution Time**: Average 15-20 minutes per video.
- **Cost**: $0 (leveraging GitHub Actions free minutes and free-tier APIs).

## 📄 Troubleshooting
- Check the **Actions Logs** for specific step failures.
- Ensure your Google Sheet has the correct column headers: `Title`, `scripts`, `status`.
