# Dreams Repository Deep Explanation

## 1) What this repository is

`Dreams` is a multi-part automated short-video production system.
It takes an idea (usually from Google Sheets), generates script/audio/visual layers, composes a final vertical video, and posts to social platforms.

It is not a single app. It is a **stack of cooperating systems**:

1. **Node.js orchestration layer** (main pipeline, social upload, Sheets, logging, cleanup) in `src/`
2. **Frontend compositor** (AI-generated HTML/GSAP scene editor/player) in `reel-composer/`
3. **Voice cloning subsystem** in `voicebox/` (Python, FastAPI backend + CLI)
4. **Lip-sync subsystem** in `wav2lip/` (Python deep-learning inference)
5. **Automation glue** in `.github/workflows/` and many `bin/`/`test/` scripts

---

## 2) Top-level folder-by-folder explanation

### `.github/`
- CI/CD and scheduled automation workflows.
- `workflows/reel-automation.yml` is the primary scheduled pipeline:
  - installs dependencies,
  - downloads models/assets,
  - starts `reel-composer` dev server,
  - runs `node src/main_automation.js`.

### `src/`
Main backend/orchestration logic.
- `main_automation.js`: full production automation pipeline entrypoint.
- `controllers/`, `routes/`: API endpoints and request handlers.
- `services/`: integration and domain logic (script generation, social posting, video processing, cleanup, etc.).
- `config/`: logger, FFmpeg, Google clients, style themes.
- `utils/`: subtitle generation/transcription and text cleaning.

### `reel-composer/`
React + TypeScript app for visual composition.
- Upload media/SRT
- Use Gemini to generate HTML animation + layout timeline JSON
- Preview synchronized split/full layout
- Edit HTML/layout manually
- Export via browser recording flow

### `voicebox/`
Voice cloning implementation.
- `main.py`: CLI entrypoint used by Node service (`voiceboxService.js`).
- `backend/`: full FastAPI backend with profile management, generation history, channels/stories, model downloading, task/progress tracking.

### `wav2lip/`
Lip sync deep-learning code and model assets.
- `inference.py`: core lip-sync inference path.
- `app.py`: Gradio app variant with optional GFPGAN enhancement.
- `face_detection/`, `models/`: detection and neural network components.

### `bin/`
Large set of utility/test scripts for diagnostics, API checks, social upload verification, and local workflow checks.

### `test/`
Node test harness and local server helpers (`test/server.js` runs API routes for manual/integration testing).

### `assets/`
Required runtime media assets:
- `Base-vedio.mp4` (base talking-head video)
- `Base-audio.mp3` (voice reference)
- `Bgm.m4a` (optional background music)
- `cover.png` (intro frame prepend)

### `audio/`, `images/`, `scripts/`, `subtitles/`, `temp/`, `final_video/`
Working directories used during processing. Often cleaned by `cleanupService`.

### `bridge/`
Bridge payload (`content.json`) for React rendering helpers.

### `archive/`
Legacy experiments and previous workflow scripts kept for reference.

### `fonts/`
Fonts used in subtitle rendering (`Montserrat`, `BalsamiqSans`, etc.).

### `voicebox`, `wav2lip` model/cache folders
Contain large model assets and runtime caches.

---

## 3) End-to-end architecture in detail

## 3.1 Main production pipeline (`src/main_automation.js`)
The orchestration is strict staged execution:

1. **Fetch task** from Google Sheets (`getNextTask`)
2. **Lock task** as Processing (`updateSheetStatus`)
3. **Generate script** (`scriptService.generateScript`)
4. **Generate cloned voice** using Voicebox (`voiceboxService.generateClonedVoice`)
5. **Slow audio** with FFmpeg (`atempo=0.94`)
6. **Lip-sync** with Wav2Lip (`wav2lipService.syncLip`)
7. **Generate subtitles** from audio using AssemblyAI (`utils/subtitles.createSubtitlesFromAudio`)
8. **Generate visual prompt** (`scriptService.generateVisualPrompt`)
9. **Run compositor automation** (`runCompositor`) via Playwright against local `reel-composer`
10. **Apply cover intro** (`prependCoverIntro`)
11. **Generate social caption** (`socialMediaService.generateUnifiedSocialMediaCaption`)
12. **Upload**:
    - YouTube direct
    - Instagram/Facebook via Supabase public URL
13. **Update Google Sheet and email notification**
14. Cleanup/failure handling

Design characteristics:
- Heavy use of fail-fast checks on required assets.
- Per-step timing logs and explicit current-step tracking.
- Partial success logic for multi-platform posting.

## 3.2 Composition architecture
There are two composition paths in repo:

1. **Primary production path**: browser-based composition in `reel-composer` driven by Playwright (`runCompositor`) then remux via FFmpeg.
2. **Legacy/alternative FFmpeg composition** in `videoProcessingService.composeVideo` and `composeReelVideo`.

## 3.3 Voice architecture
- Node pipeline calls Python CLI (`voicebox/main.py`) through `voiceboxService.js`.
- Voicebox backend supports profile/sample caching and model backend abstraction (MLX on Apple Silicon, PyTorch elsewhere).

## 3.4 Lip-sync architecture
- Node invokes `wav2lip/inference.py` through `wav2lipService.js`.
- Inference can use precomputed face detection cache (`Base-vedio.npy`) and optional GFPGAN restoration.

## 3.5 Distribution architecture
- YouTube: OAuth2 client with token refresh preflight.
- Instagram/Facebook: Graph API + URL-based media publish.
- Supabase: intermediate storage for Meta uploads.
- Unified caption service (Groq-first path in `generateUnifiedSocialMediaCaption`).

---

## 4) Important implementation details by subsystem

## 4.1 Orchestration and workflow control

### `src/main_automation.js`
- `main()` orchestrates all production stages.
- `prependCoverIntro(inputVideoPath)` injects a static image segment before video playback and delays audio to stay aligned.
- `runCompositor(vPath, sPath, vPrompt)` automates browser UI actions end-to-end (login, upload, generate, record, download, remux).

Key behavior:
- Multiple Gemini key fallback attempts in UI login sequence.
- Robust wait loops with state probing to avoid black/unfinished output.
- Download hook remuxes raw capture + delayed speech + optional looping BGM.

## 4.2 API layer (`test/server.js` + `src/routes/*` + `src/controllers/*`)

- `test/server.js` mounts workflow/script/audio/images/video routes.
- API routes are thin wrappers around controller functions.
- `workflowController.js` contains both:
  - automated sheet-driven workflow,
  - legacy manual workflow,
  - in-memory status tracking object.
- `reelController.js` exposes async task-oriented reel generation API with in-memory task map.

## 4.3 Services

### Script and prompt
- `scriptService.js`: Gemini primary + Groq fallback for script and visual prompt.
- Includes key-rotation retry logic with error-type filtering.

### Media generation and processing
- `imageService.js`: title image via Gemini image response modality.
- `videoProcessingService.js`: validation, composition, platform optimization, day-based subtitle color themes.
- `wav2lipService.js`: Python process spawn + output verification.
- `voiceboxService.js`: Python process spawn for cloned TTS.

### External integrations
- `sheetsService.js`: dynamic header detection and row update logic.
- `socialMediaService.js`: YouTube/Instagram/Facebook uploads + Supabase storage bridge.
- `emailService.js`: success/error/status notifications with templated HTML.

### System reliability
- `cleanupService.js`: folder cleanup, root cleanup, emergency cleanup, essential file checks.
- `config/logger.js`: Winston file + console transports.

## 4.4 Utilities
- `utils/subtitles.js`: AssemblyAI upload → poll transcript → export SRT.
- `utils/textCleaner.js`: cleanup/conversation normalization for LLM output.

## 4.5 Reel Composer frontend

State machine in `App.tsx`:
- `WELCOME` → `UPLOAD` → `GENERATING` → `EDITOR`

Core flow:
1. Upload video/audio + SRT (`FileUpload.tsx`)
2. Parse SRT (`utils/srtParser.ts`)
3. Generate HTML+layout JSON from Gemini (`services/geminiService.ts`)
4. Preview synchronized composition in `ReelPlayer.tsx`
5. Optionally edit config/HTML and regenerate/refine in `EditorPanel.tsx`

Notable frontend mechanics:
- Layout timeline drives dynamic split/full modes.
- Caption renderer does progressive word chunking.
- Iframe receives playback events through `postMessage`.
- Browser recording mode uses `getDisplayMedia` + `MediaRecorder`.

## 4.6 Voicebox backend

`voicebox/backend/main.py` is a large FastAPI surface covering:
- profile CRUD and import/export,
- profile samples and avatar management,
- channels and profile-channel mappings,
- generation endpoint,
- history query/export,
- transcription,
- stories and story item editing/export,
- model load/unload/status/download/delete,
- cache/task endpoints,
- startup/shutdown hooks.

It delegates implementation to modules like `profiles.py`, `history.py`, `channels.py`, `stories.py`, `export_import.py`, and backend abstraction modules in `backends/`.

## 4.7 Wav2Lip

`wav2lip/inference.py` responsibilities:
- parse inference arguments,
- detect/track faces (with optional smoothing),
- batch mel + face data generation,
- model loading/checkpoint handling,
- optional restoration integration and stability paths.

`wav2lip/app.py` wraps this in Gradio with a post-process GFPGAN enhancement loop.

---

## 5) Function-level explanation catalog (core files)

## 5.1 Core Node functions

### `src/main_automation.js`
- `main`: master orchestration and step transitions.
- `prependCoverIntro`: prepends static cover frame and re-aligns audio timeline.
- `runCompositor`: automates reel-composer UI and recording/export flow.

### `src/services/scriptService.js`
- `getModel`: builds Gemini model + key list.
- `retryWithFallback`: rotates Gemini keys on known failure signatures.
- `generateScript`: creates narration script with cleanup.
- `generateVisualPrompt`: generates concise visual direction prompt.

### `src/services/videoProcessingService.js`
- `validateVideoFile`: structural and size-level video checks.
- `getBaseVideo`: locate/validate base video with CI handling and fallback.
- `createPlaceholderVideo`: synthetic fallback generator.
- `composeVideo`: overlay/subtitle composition path.
- `getVideoMetadata`: ffprobe wrapper.
- `createPlatformOptimized`: platform-safe transcode.
- `timeToSeconds`: parser helper.
- `getDayBasedColors`: rotating subtitle palette.
- `composeReelVideo`: subtitle/music reel composition path.

### `src/services/socialMediaService.js`
- `getInstagramThumbOffsetMs`: thumbnail frame timing resolver.
- `createYouTubeOAuthClient`: validated OAuth client setup.
- `generateSocialMediaContent`: template caption generation.
- `generateAISocialMediaContent`: AI-enhanced per-platform caption variant.
- `uploadToYouTube`, `uploadToInstagram`, `uploadToFacebook`: direct platform uploads.
- `uploadToInstagramWithUrl`, `uploadToFacebookWithUrl`: URL-based upload variants.
- `uploadToBothPlatforms`: orchestrates all platform uploads + summary.
- `uploadToSupabaseAndGetLink`: intermediate hosting path.
- `deleteFromSupabase`: cleanup helper.
- `getInstagramPermalink`: permalink resolver with fallback.
- `getTopicEmoji`: heuristic emoji selector.
- `generateTopicExplanation`: generic educational summary string.
- `generateUnifiedSocialMediaCaption`: consolidated Groq-generated caption components.

### `src/services/sheetsService.js`
- `getNextTask`: scans rows for processable status values.
- `updateSheetStatus`: updates status/links/timestamp by discovered headers.
- `getColumnLetter`: A1 conversion helper.

### `src/services/cleanupService.js`
- `cleanDirectory`: controlled file deletion.
- `cleanupAllMediaFolders`: broad post-run cleanup.
- `cleanupOldFiles`: age-based cleanup.
- `getFolderSizes`: storage metrics.
- `ensureDirectoryExists`: mkdir helper.
- `initializeDirectories`: bootstraps required folders.
- `cleanupRootDirectory`: root mp4 cleanup.
- `cleanupOnError`: emergency cleanup.
- `ensureEssentialVideoFiles`: required-asset validation.
- `cleanupFinalVideoFolder`: final output cleanup.

### `src/services/imageService.js`
- `generateImageWithGemini`: image API call + save.
- `generateTitleImage`: title-image wrapper with fallback.
- `validateImage`: path/size check.
- `cleanupOldImages`: generated file cleanup.

### `src/services/wav2lipService.js`
- `syncLip`: process invoke + cache + optional restoration flags.
- `syncLipHQ`: current wrapper alias to `syncLip`.

### `src/services/voiceboxService.js`
- `generateClonedVoice`: Python CLI bridge for voice synthesis.

### `src/utils/subtitles.js`
- `getAudioDuration`, `validateSRTFormat`, `generateSubtitlesFromAudio`, `saveSubtitlesToFile`, `createSubtitlesFromAudio`, `upload_file`, `transcribeAudio`, `exportSubtitles`.

### `src/controllers/workflowController.js`
- `formatSRTTimestamp`, `generateGeminiTTS`, `generateSRTFromAudio`, `generateReelContent`,
- `runCompleteWorkflow`, `runAutomatedWorkflow`, `runWorkflow`,
- `getWorkflowStatus`, `getProgressInfo`, `assembleVideo`, `combineAudioFiles`.

### `src/controllers/reelController.js`
- `formatSRTTimestamp`, `extractAudioFromBaseVideo`, `generateSRTFromBaseVideo`, `parseSRT`,
- `generateReelContentAI`, `generateReelContent`, `processReelGeneration`,
- `getReelStatus`, `downloadReel`.

## 5.2 Reel Composer functions/components

### Service
- `validateGeminiConnection`, `generateSRT`, `generateTTS`, `generateReelContent` in `reel-composer/src/services/geminiService.ts`.

### Utilities
- `parseSRT` (`srtParser.ts`)
- `extractAudioBlob`, `extractWavFromVideo`, `fileToBase64`, `pcmToWav` (`audioHelpers.ts`)
- `constructPrompt` (`promptTemplates.ts`)

### App/View logic
- `App` state handlers (`handleFilesSelected`, `handleGenerate`, `handleEnterStudio`, `handleManualModeEnter`, etc.).
- `EditorPanel` handlers (`handleSave`, `handleSaveKeyConfig`, `handleCopyPrompt`, subtitle/audio controls).
- `ReelPlayer` timing/rendering/recording handlers (`togglePlay`, `restart`, `startRecording`, `stopRecording`, `renderAnimatedCaption`, layout/caption style calculators).

### Components
- `WelcomeScreen`, `GeneratingScreen`, `FileUpload`, `AppHeader`, `ReplaceSceneDialog`, `Snackbar`, `MobileBlocker` provide staged UX shell.

## 5.3 Voicebox Python function overview

### `voicebox/main.py`
- `voicebox_get_ref_text`: auto-transcribe reference sample.
- `voicebox_clone_and_generate`: load model, build voice prompt, generate, save.

### `voicebox/backend/main.py` (major route handlers)
Includes `root`, `shutdown`, `health`, full profile/channel/story/history/model/task endpoint functions such as:
- `create_profile`, `list_profiles`, `import_profile`, `get_profile`, `update_profile`, `delete_profile`
- `add_profile_sample`, `get_profile_samples`, `update_profile_sample`, `delete_profile_sample`
- `upload_profile_avatar`, `get_profile_avatar`, `delete_profile_avatar`, `export_profile`
- `list_channels`, `create_channel`, `get_channel`, `update_channel`, `delete_channel`, `get_channel_voices`, `set_channel_voices`
- `get_profile_channels`, `set_profile_channels`
- `generate_speech`
- `list_history`, `get_stats`, `import_generation`, `get_generation`, `delete_generation`, `export_generation`, `export_generation_audio`
- `transcribe_audio`
- story handlers (`list_stories`, `create_story`, `add_story_item`, `trim_story_item`, `split_story_item`, etc.)
- model handlers (`load_model`, `unload_model`, `get_model_progress`, `get_model_status`, `trigger_model_download`, `delete_model`)
- task/cache/lifecycle (`clear_cache`, `get_active_tasks`, `startup_event`, `shutdown_event`)
- helper `_get_gpu_status`.

## 5.4 Wav2Lip Python function overview

Key functions extracted from major modules:
- `wav2lip/inference.py`: `get_smoothened_boxes`, `face_detect`, `datagen`, `_load`, `load_model`, `main`.
- `wav2lip/precompute_face.py`: `get_smoothened_boxes`, `precompute_face_boxes`.
- `wav2lip/audio.py`: waveform/spectrogram and normalization helpers (`load_wav`, `melspectrogram`, `_normalize`, etc.).
- `wav2lip/face_detection/*`: detector classes and utility math (`detect`, `batch_detect`, `nms`, `crop`, `get_preds_fromhm`, etc.).

---

## 6) Cross-module data flow

1. **Idea source**: Google Sheet row (`sheetsService.getNextTask`).
2. **Narrative generation**: script (`scriptService.generateScript`).
3. **Audio realization**: Voicebox clone (`voiceboxService`).
4. **Facial synchronization**: Wav2Lip (`wav2lipService`).
5. **Subtitles**: AssemblyAI transcription (`utils/subtitles`).
6. **Visual layer generation**: prompt + `reel-composer` generation.
7. **Final render/remux**: Playwright download + FFmpeg remux.
8. **Distribution**: YouTube + Meta via Supabase staging.
9. **Tracking/ops**: Sheets status + email notifications + cleanup.

---

## 7) Technical strengths and current complexity hotspots

Strengths:
- Full-stack automated content pipeline.
- Multiple fallback paths (API keys, provider fallback, local fallback assets).
- Practical operational tooling (cleanup, logs, diagnostics scripts).
- Rich Voicebox backend with production-like endpoint coverage.

Complexity hotspots:
- Significant legacy overlap (`videoService` vs `videoProcessingService`, manual vs automated paths).
- Some stale/inconsistent imports (e.g., image/audio endpoint wiring vs available exports).
- Multiple render paths and historical code retained in same codebase.
- Very large `socialMediaService.js` and `workflowController.js` with mixed responsibilities.

---

## 8) Practical mental model for this repo

Think of it as four engines chained together:

- **Engine A (Content Brain):** script + visual prompt + captions
- **Engine B (Voice & Face):** Voicebox + Wav2Lip
- **Engine C (Visual Layer):** Reel Composer (HTML animation over video)
- **Engine D (Distribution):** Supabase + YouTube/Instagram/Facebook + Sheets/email

Everything else (config, cleanup, workflows, bin scripts) exists to keep these four engines running repeatedly in unattended automation mode.

