# Google Drive Base Video Setup

## How to set up your Google Drive base video:

1. **Upload your base video to Google Drive**

   - Go to drive.google.com
   - Upload your base video file
   - Right-click on the uploaded video
   - Select "Get link" and set permissions to "Anyone with the link can view"

2. **Get the direct download link**

   - Copy the Google Drive sharing link (looks like: `https://drive.google.com/file/d/FILE_ID/view?usp=sharing`)
   - Extract the FILE_ID from the link
   - Convert it to direct download format: `https://drive.google.com/uc?export=download&id=FILE_ID`

3. **Update your .env file**
   ```
   BASE_VIDEO_DRIVE_URL=https://drive.google.com/uc?export=download&id=YOUR_FILE_ID
   ```

## Example:

- Sharing link: `https://drive.google.com/file/d/1ABC123xyz456/view?usp=sharing`
- File ID: `1ABC123xyz456`
- Direct download URL: `https://drive.google.com/uc?export=download&id=1ABC123xyz456`

## Notes:

- The system will prioritize Google Drive URL first
- If not set, it will fallback to local files then Filebase
- Make sure the video file is not too large (recommended: under 100MB for better performance)
