# Checkpoint System Documentation

## Overview
The workflow now includes a comprehensive checkpoint system that saves progress at each step, allowing you to resume from the last successful checkpoint if the workflow fails or is interrupted.

## Checkpoint Features

### 1. **Automatic Checkpointing**
- Saves progress after each major step
- Tracks completed steps to avoid duplication
- Stores asset file paths and metadata
- Saves workflow state and results

### 2. **Asset Tracking**
The checkpoint system tracks these important assets:
- **Audio files**: `audio/conversation_single_call.wav`
- **Images**: `images/image_0.png` to `images/image_4.png`
- **Base video**: Path or URL to base video
- **Subtitles**: Generated `.srt` subtitle files
- **Combined audio**: Processed audio for video assembly
- **Final video**: Completed video file path

### 3. **Step Tracking**
Completed steps are tracked to avoid re-execution:
- `sheets/next-task` - Task retrieval from Google Sheets
- `script/generate` - Telugu-English script generation
- `audio/generate` - Audio file generation or validation
- `video/base` - Base video retrieval
- `images/generate` - Image generation or validation
- `video/assemble` - Video assembly with subtitles and overlays
- `filebase/upload` - Upload to Filebase storage
- `metadata/generate` - Video metadata generation

## API Endpoints

### Check Current Checkpoint
```bash
GET /workflow/checkpoint
```
Returns current checkpoint data and valid asset files.

### Resume from Checkpoint
```bash
POST /workflow/resume
```
Manually resumes workflow from the last saved checkpoint.

### Clear Checkpoint
```bash
DELETE /workflow/checkpoint
```
Removes checkpoint data (useful for starting fresh).

### Start New Workflow
```bash
POST /workflow/run
```
Automatically resumes from checkpoint if available, or starts fresh.

To force a fresh start without resume:
```bash
POST /workflow/run
Content-Type: application/json
{"resume": false}
```

## File Locations

### Checkpoint Files
- `temp/workflow_checkpoint.json` - Main workflow state
- `temp/checkpoint_assets.json` - Asset file information

### Asset Validation
The system automatically validates that asset files still exist before resuming. Missing files are removed from the checkpoint data.

## Example Workflow

1. **Start workflow**: `POST /workflow/run`
2. **Workflow fails** at step "video/assemble"
3. **Check checkpoint**: `GET /workflow/checkpoint` 
4. **Resume**: `POST /workflow/resume`
5. **Workflow continues** from "video/assemble" step using saved assets

## Benefits

1. **No Re-work**: Skip expensive operations (audio generation, image creation) if already completed
2. **Fast Recovery**: Resume exactly where you left off
3. **Asset Preservation**: Keeps track of generated files and their timing information
4. **Debugging**: Error checkpoints help identify failure points
5. **Efficiency**: Particularly useful for video assembly step which can be resource-intensive

## Technical Details

### Checkpoint Structure
```json
{
  "timestamp": "2025-09-11T10:30:00.000Z",
  "step": "video/assemble",
  "data": {
    "taskId": "uuid-string",
    "results": {
      "task": {...},
      "script": [...],
      "audioFiles": {...},
      "images": [...]
    },
    "completedSteps": ["sheets/next-task", "script/generate", ...]
  }
}
```

### Asset Structure
```json
{
  "timestamp": "2025-09-11T10:30:00.000Z",
  "assets": {
    "audioFile": "audio/conversation_single_call.wav",
    "images": [{"filename": "images/image_0.png", ...}],
    "baseVideoUrl": "path/to/base/video",
    "subtitlesPath": "subtitles/subtitles_123.srt",
    "combinedAudioPath": "temp/combined_audio.mp3",
    "finalVideo": "videos/final_123.mp4"
  },
  "step": "video/assemble"
}
```

This checkpoint system ensures reliable workflow execution and makes it easy to recover from failures without losing expensive computational work!
