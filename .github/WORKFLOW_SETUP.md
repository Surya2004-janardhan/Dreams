
 GitHub Workflow Setup Guide - Wild-Life YT Automation

## Overview
The GitHub Actions workflow automatically runs your wild-life-yt-automation video processor daily at **8:00 AM UTC**.

## Setup Instructions

### 1. Add GitHub Secrets
Your workflow requires 4 secrets to be configured in GitHub:

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions → "New repository secret"
3. Add each of these secrets:

| Secret Name                        | Description                        |
|------------------------------------|------------------------------------|
| `EMAIL_USER`                       | `studypurp01@gmail.com`            |
| `EMAIL_PASS`                       | `--- --- --- --- --- `              |
| `RECIPIENT_EMAIL`                  | `chintalajanardhan2004@gmail.com`  |
| `GOOGLE_CREDENTIALS_JSON`          | Base6 Google credentials.json file |

### 2. Create GOOGLE_CREDENTIALS_JSON Secret

The Google credentials JSON needs to be base64 encoded:

```bash
# On Windows PowerShell:
$credentials = Get-Content "wild-life-yt-automation/seismic-rarity-468405-j1-cd12fe29c298.json" -Raw
$encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($credentials))
Write-Output $encoded
```

Then copy the output and create a new secret:
- Secret name: `GOOGLE_CREDENTIALS_JSON`
- Secret value: (paste the base64 encoded string)

**Note:** The Google Sheet ID is hardcoded in video-processor.js, so no secret is needed for it.

## Test the Workflow

### Option A: Trigger manually from GitHub
1. Go to **Actions** tab in your repository
2. Select **"Wild-Life YT Daily Workflow"**
3. Click **"Run workflow"** → **"Run workflow"**

### Option B: Automatic schedule
The workflow runs automatically daily at:
- **8:00 AM UTC**

## Monitor Workflow Execution

1. Go to **Actions** tab in your repository
2. Look for **"Wild-Life YT Daily Workflow"**
3. Click on a run to see detailed logs

## Workflow Features

✅ **Daily Scheduling** - Runs at 8:00 AM UTC every day  
✅ **Manual Trigger** - Can be triggered manually from GitHub UI  
✅ **Automatic Backups** - Creates backups of processed videos  
✅ **Artifact Upload** - Saves logs and backups for 30 days  
✅ **Error Handling** - Reports failures with details  

## Modifying the Schedule

To change the daily execution time, edit `.github/workflows/wild-life-daily.yml`:

```yaml
on:
  schedule:
    - cron: '0 8 * * *'  # Change this line
```

Cron format: `minute hour day month day-of-week`

**Examples:**
- `0 8 * * *` = 8:00 AM UTC every day
- `30 9 * * *` = 9:30 AM UTC every day
- `0 8 * * 1-5` = 8:00 AM UTC, Monday to Friday only

## Timezone Note

GitHub Actions uses UTC timezone by default. If you need a different timezone:
- 8:00 AM EST = `1 13 * * *` (13:00 UTC)
- 8:00 AM PST = `4 16 * * *` (16:00 UTC)
- 8:00 AM IST = `2 2 * * *` (2:30 UTC next day)

## Troubleshooting

### Workflow not running
- Check that `.github/workflows/wild-life-daily.yml` exists
- Verify all 4 required secrets are configured (including `GOOGLE_CREDENTIALS_JSON`)
- Check GitHub Actions is enabled for the repository

### Build failures
- Check the workflow logs in the Actions tab
- Verify `GOOGLE_CREDENTIALS_JSON` secret is properly base64 encoded
- Ensure Google Sheets & YouTube APIs are enabled in Google Cloud Console

### Google credentials errors
- Verify the base64 encoding is correct
- Check that the original JSON file is valid
- Ensure the credentials file has proper permissions for Google Sheets & YouTube APIs

## File Structure

```
.github/
└── workflows/
    └── wild-life-daily.yml    ← Main workflow file
```

## Quick Setup Summary

```bash
# 1. Encode your Google credentials file to base64:
$credentials = Get-Content "wild-life-yt-automation/seismic-rarity-468405-j1-cd12fe29c298.json" -Raw
$encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($credentials))
Write-Output $encoded

# 2. Add 4 secrets to GitHub (Settings → Secrets and variables → Actions):
EMAIL_USER=studypurp01@gmail.com
EMAIL_PASS=---------
RECIPIENT_EMAIL=chintalajanardhan2004@gmail.com
GOOGLE_CREDENTIALS_JSON=<paste-the-base64-encoded-string>

# 3. Workflow will run automatically at 8 AM UTC daily
# Or trigger manually from Actions tab
```

---

**Questions?** Check the [GitHub Actions Documentation](https://docs.github.com/en/actions) for more details.
