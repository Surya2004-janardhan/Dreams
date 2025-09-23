# AI Content Automation Workflow

## Overview

This project automates the creation and posting of video and carousel content to social media platforms (YouTube, Instagram, Facebook) using AI-driven workflows. It is designed with a clean architecture, separating routes, controllers, and services for maintainability and scalability.

---

## Folder Structure

- **audio/**: Stores generated audio files for videos.
- **bin/**: Utility and test scripts for debugging, testing, and setup.
- **final_video/**: Output folder for final composed videos.
- **fonts/**: Custom fonts used for image and video generation.
- **images/**: Stores generated or fallback images for video slides.
- **scripts/**: Stores generated scripts (text) for videos.
- **slides/**: Temporary storage for generated carousel slide images.
- **src/**: Main source code.
  - **config/**: Configuration files (database, ffmpeg, logger, etc).
  - **controllers/**: Express controllers for handling workflow logic.
  - **middleware/**: Express middleware (e.g., file uploads).
  - **routes/**: API route definitions.
  - **services/**: Business logic for audio, image, video, workflow, social posting, etc.
  - **utils/**: Utility functions (e.g., subtitles, text cleaning).
- **subtitles/**: Stores generated subtitle files.
- **temp/**: Temporary files (e.g., combined audio).
- **videos/**: Base and output video files, default images.

---

## Key Workflows

### 1. **Auto Workflow** (`/workflow/auto`)

**Purpose:**

- Fully automated video content creation and posting, triggered via API or schedule.
- Pulls tasks from a Google Sheet, generates all media, composes a video, uploads to platforms, and updates the sheet.

**Detailed Workflow Steps:**

1. **Task Fetch**

- **What:** Pulls the next 'Not Posted' task (idea, description) from Google Sheets using `SheetsService`.
- **How:** `src/services/sheetsService.js` reads the sheet and returns the next task.
- **Data:** `{ idea, description, rowId }`

2. **Script Generation**

- **What:** Uses AI (LLM) to generate a Q&A script based on the task idea/description.
- **How:** `src/services/scriptService.js` calls the LLM API and returns a formatted script.
- **Data:** Script is saved to `scripts/`.

3. **Audio Generation**

- **What:** Converts the script to multi-speaker TTS audio.
- **How:** `src/services/audioService.js` batches the script and generates audio files (WAV/MP3) using TTS APIs.
- **Data:** Audio files are saved in `audio/`.

4. **Subtitles**

- **What:** Generates subtitles (SRT) from the audio.
- **How:** `src/utils/subtitles.js` uses speech-to-text to create timed subtitles.
- **Data:** Subtitles are saved in `subtitles/`.

5. **Image Generation**

- **What:** Creates a title image for the video (AI-generated or fallback to existing/default image).
- **How:** `src/services/imageService.js` generates or selects an image.
- **Data:** Image is saved in `images/`.

6. **Video Composition**

- **What:** Merges the base video, audio, images, and subtitles into a final video.
- **How:** `src/services/videoProcessingService.js` uses FFmpeg to compose the video.
- **Data:** Final video is saved in `final_video/`.

7. **Upload to Social Platforms**

- **What:** Uploads the final video to YouTube, Instagram, and Facebook.
- **How:** `src/services/socialMediaService.js` handles API calls and authentication for each platform.
- **Data:** URLs of uploaded videos are returned.

8. **Sheet Update**

- **What:** Updates the Google Sheet row with status 'Posted' and the URLs of the uploaded videos.
- **How:** `src/services/sheetsService.js` writes back to the sheet.

9. **Notifications**

- **What:** Sends email notifications about workflow success, partial success, or failure.
- **How:** `src/services/emailService.js` sends emails to configured recipients.

10. **Cleanup**

- **What:** Removes all temporary and intermediate files (audio, images, scripts, subtitles, etc).
- **How:** `src/services/cleanupService.js` handles file and folder cleanup.

**Error Handling:**

- If any step fails, the workflow stops, cleans up, and sends an error notification. The sheet is not updated unless all uploads succeed.

---

### 2. **Post Workflow** (`/posts-workflow`)

**Purpose:**

- Automated creation and posting of carousel (multi-image) posts to Instagram and Facebook.
- Reads tasks from a Google Sheet, generates slides, uploads images, posts to platforms, and updates the sheet.

**Detailed Workflow Steps:**

1. **Task Fetch**

- **What:** Gets the next unposted carousel task (title, slide1, slide2, slide3) from the Google Sheet using `PostsSheetService`.
- **How:** `src/services/postsSheetService.js` reads the sheet and returns the next task.

2. **Validation**

- **What:** Ensures all required fields (title, slide1, slide2, slide3) are present.
- **How:** Checks for missing data and throws an error if incomplete.

3. **Slide Generation**

- **What:** Generates 3 images with text overlays (title + slide content) for the carousel.
- **How:** `generateCarouselSlides` in `src/routes/postsWorkflow.js` uses FFmpeg and custom fonts to create slides, saved in `slides/`.

4. **Upload Slides**

- **What:** Uploads the generated slide images to Supabase storage and retrieves public URLs.
- **How:** `src/services/supabaseCarouselService.js` handles upload and returns URLs.

5. **Caption Preparation**

- **What:** Creates a caption using the title and a set of relevant hashtags.
- **How:** Concatenates the title and hashtags for use in social posts.

6. **Posting to Social Platforms**

- **What:** Posts the carousel (all 3 images) to Instagram and Facebook using the public image URLs.
- **How:** `src/services/socialMediaPostingService.js` calls platform-specific services (`instagramPostMaker`, `facebookPostMaker`).
- **Data:** Returns post URLs and success/failure status for each platform.

7. **Sheet Update**

- **What:** If all posts succeed, updates the Google Sheet row with status 'Posted' and the post URLs.
- **How:** `src/services/postsSheetService.js` writes back to the sheet.

8. **Cleanup**

- **What:** Deletes uploaded images from Supabase and removes local slide files.
- **How:** `src/services/supabaseCarouselService.js` and local file deletion logic in `postsWorkflow.js`.

9. **Notifications**

- **What:** Sends an email notification with the results (success or error details).
- **How:** `src/services/emailService.js` sends emails to configured recipients.

**Error Handling:**

- If any platform fails, the sheet is NOT updated. All temporary files are cleaned up and an error notification is sent.

---

## Services & Utilities

- **AudioService:** Handles TTS audio generation and batching.
- **ImageService:** Generates or fetches images for video slides.
- **VideoProcessingService:** Merges video, audio, images, and subtitles.
- **SocialMediaPostingService:** Unified posting to Instagram and Facebook (carousel and single image).
- **EmailService:** Sends notifications for workflow status.
- **CleanupService:** Cleans up temporary and output files.
- **SupabaseCarouselService:** Uploads and deletes carousel images from Supabase storage.
- **SheetsService/PostsSheetService:** Reads and updates Google Sheets for workflow tasks.

---

## Running the Project

1. **Install dependencies:**
   ```sh
   npm install
   ```
2. **Start the server:**
   ```sh
   npm start
   ```
3. **Trigger workflows:**
   - **Auto Workflow:**
     ```sh
     curl -X POST http://localhost:3000/workflow/auto
     ```
   - **Post Workflow:**
     ```sh
     curl -X POST http://localhost:3000/posts-workflow
     ```

---

## Notes

- Configure your Google Sheets, Supabase, and social media API keys in the appropriate config files or environment variables.
- All logs are written to `combined.log` and `error.log`.
- For detailed debugging, use scripts in the `bin/` folder.

---

## Contact

For questions or support, please contact the project maintainer.
