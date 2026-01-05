# Wildlife YouTube Automation

Single file solution using Google Sheets as data source.

## Files

- **video-processor.js** - All-in-one processor (Google Sheets → YouTube)
- **package.json** - Dependencies
- **credentials.json** - Google API credentials (you create this)

## Setup (5 Steps)

### 1. Install Node Dependencies

```bash
npm install
```

This installs `googleapis` package needed for Google Sheets & YouTube APIs.

### 2. Create Google Cloud Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project
3. Enable **Google Sheets API** and **YouTube Data API v3**
4. Create **Service Account** credentials
5. Download JSON key file
6. Save as `credentials.json` in this folder

### 3. Create Google Sheet

1. Create Google Sheet with these columns:
   - `sno` | `long1_0_7m` | `long1_7_14m` | `long1_14_21m` | `long2_0_7m` | `long2_7_14m` | `long2_14_21m` | `short1_0_1m` | `short1_1_2m` | `short1_2_3m` | `short1_3_4m` | `short2_0_1m` | `short2_1_2m` | `short2_2_3m` | `short2_3_4m` | `short3_0_1m` | `short3_1_2m` | `short3_2_3m` | `short3_3_4m` | `short4_0_1m` | `short4_1_2m` | `short4_2_3m` | `short4_3_4m` | `status`

2. Fill in timing data (timestamps like 00:15, 07:30, etc.)

3. Set status to `not posted` for rows to process

### 4. Set Google Sheet ID

Edit `video-processor.js` line ~255:

```javascript
const GOOGLE_SHEET_ID = 'YOUR_GOOGLE_SHEET_ID_HERE';
```

Or set environment variable:
```bash
$env:GOOGLE_SHEET_ID = 'your-sheet-id-here'
```

Get Sheet ID from URL: `https://docs.google.com/spreadsheets/d/[SHEET_ID]/edit`

### 5. Share Sheet with Service Account

1. Open your Google Sheet
2. Click Share
3. Share with service account email (from credentials.json)
4. Give Editor access

## Usage

### Process Videos (No Upload)

```bash
npm start
```

Output:
```
✓ Google Sheets API initialized
✓ Read 2 unprocessed videos from Google Sheet
Processing 2 rows...

✓ Row 1 processed: 6 videos extracted
✓ Row 2 processed: 6 videos extracted

✅ Processing Complete!
Total rows processed: 2
Total videos: 12
```

### Upload to YouTube

Edit `video-processor.js` last line:

```javascript
processor.processAllVideos(true)  // Change false to true
```

Then run:
```bash
npm start
```

## Google Sheet Structure

Each row = **6 videos** (2 long-form + 4 short-form)

| sno | long1_0_7m | long1_7_14m | long1_14_21m | long2_0_7m | ... | status |
|-----|----------|----------|----------|----------|-----|--------|
| 1 | 00:15 | 07:30 | 14:45 | 00:45 | ... | not posted |
| 2 | 00:30 | 07:45 | 15:00 | 01:00 | ... | not posted |

### Generate Videos Per Row:

From row 1:
- ✓ Part 1 - Long Form 1
- ✓ Part 1 - Long Form 2
- ✓ Part 1 - Short Form 1
- ✓ Part 1 - Short Form 2
- ✓ Part 1 - Short Form 3
- ✓ Part 1 - Short Form 4

Total per row: **6 videos**
For 20 rows: **120 videos**

## Configuration

Edit `video-processor.js`:

```javascript
processor.setConfig(
  'Your description here',
  ['#hashtag1', '#hashtag2', '#hashtag3']
);
```

## What It Does

1. **Reads Google Sheet** - Finds all rows with status "not posted"
2. **Extracts Videos** - 6 videos per row (2 long + 4 short)
3. **Generates Metadata**:
   - Titles: "Part X - Long Form 1/2" or "Part X - Short Form 1/2/3/4"
   - Segments: Timing information from sheet
   - Description + hashtags
   - Education category
4. **Optional Upload** - To YouTube if enabled
5. **Updates Sheet** - Changes status to "posted"

## Environment Variables

```bash
# Set Google Sheet ID
$env:GOOGLE_SHEET_ID = 'your-sheet-id'

# Run
node video-processor.js
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| credentials.json not found | Create it from Google Cloud Console |
| Sheet not readable | Share sheet with service account email |
| GOOGLE_SHEET_ID error | Check sheet ID in URL |
| YouTube upload fails | Ensure OAuth credentials are valid |
| Rate limit | Add delays between uploads |

## Output

```json
{
  "sno": 1,
  "videosCount": 6,
  "videos": [
    {
      "id": "1_long1",
      "type": "long",
      "title": "Part 1 - Long Form 1",
      "segments": [
        { "name": "0-7m", "timing": "00:15" },
        { "name": "7-14m", "timing": "07:30" },
        { "name": "14-21m", "timing": "14:45" }
      ],
      "description": "...",
      "hashtags": ["#wildlife"]
    },
    ... 5 more videos ...
  ]
}
```

## One File, All Features

- ✅ Google Sheets integration
- ✅ Video extraction (2 long + 4 short per row)
- ✅ YouTube API integration
- ✅ Metadata generation
- ✅ Status updates
- ✅ Error handling

Ready to use! Provide your Google Sheet link and we'll integrate it.
