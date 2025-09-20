const ffmpegPath = require("ffmpeg-static");
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);
const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");
const { getGoogleDriveClient } = require("../config/google");
// Load FFmpeg configuration
require("../config/ffmpeg");

/**
 * Get base video from Google Drive or local videos folder
 */
const getBaseVideo = async () => {
  try {
    logger.info("📹 Looking for base video...");

    // Check local videos folder first
    const videosDir = "videos";
    if (fs.existsSync(videosDir)) {
      const videoFiles = fs
        .readdirSync(videosDir)
        .filter(
          (file) =>
            file.toLowerCase().includes("base") ||
            file.toLowerCase().includes("background") ||
            file.toLowerCase().includes("template")
        );

      if (videoFiles.length > 0) {
        const localVideoPath = path.join(videosDir, videoFiles[0]);
        logger.info(`✅ Found local base video: ${localVideoPath}`);
        return path.resolve(localVideoPath);
      }
    }

    // If no local base video, try to download from Google Drive
    logger.info("🔄 No local base video found, checking Google Drive...");

    const drive = await getGoogleDriveClient();
    const folderId = process.env.GOOGLE_DRIVE_VIDEO_FOLDER_ID;

    if (!folderId) {
      logger.warn(
        "⚠️ GOOGLE_DRIVE_VIDEO_FOLDER_ID not set, creating placeholder video"
      );
      return await createPlaceholderVideo();
    }

    // Search for base video files in the Drive folder
    const response = await drive.files.list({
      q: `'${folderId}' in parents and (name contains 'base' or name contains 'background' or name contains 'template') and mimeType contains 'video'`,
      fields: "files(id, name, mimeType)",
    });

    if (response.data.files && response.data.files.length > 0) {
      const file = response.data.files[0];
      const localPath = path.resolve(`videos/base_video_${Date.now()}.mp4`);

      logger.info(`📥 Downloading base video: ${file.name}`);

      // Ensure videos directory exists
      if (!fs.existsSync(videosDir)) {
        fs.mkdirSync(videosDir, { recursive: true });
      }

      const dest = fs.createWriteStream(localPath);
      const driveResponse = await drive.files.get(
        {
          fileId: file.id,
          alt: "media",
        },
        { responseType: "stream" }
      );

      return new Promise((resolve, reject) => {
        driveResponse.data.pipe(dest);
        dest.on("finish", () => {
          logger.info(`✅ Base video downloaded: ${localPath}`);
          resolve(localPath);
        });
        dest.on("error", reject);
      });
    } else {
      logger.warn(
        "⚠️ No base video found in Google Drive, creating placeholder"
      );
      return await createPlaceholderVideo();
    }
  } catch (error) {
    logger.error("❌ Error getting base video:", error);
    logger.info("🔄 Creating placeholder video as fallback");
    return await createPlaceholderVideo();
  }
};

/**
 * Create a placeholder base video
 */
const createPlaceholderVideo = async () => {
  return new Promise((resolve, reject) => {
    const outputPath = path.resolve("videos/placeholder_base_video.mp4");

    logger.info("🎨 Creating placeholder base video...");

    ffmpeg()
      .input("color=c=0x1e3a8a:size=1080x1920:duration=60:rate=30") // Dark blue background, vertical format
      .inputFormat("lavfi")
      .outputOptions(["-c:v libx264", "-pix_fmt yuv420p", "-r 30"])
      .output(outputPath)
      .on("end", () => {
        logger.info(`✅ Placeholder base video created: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (error) => {
        logger.error("❌ Failed to create placeholder video:", error);
        reject(error);
      })
      .run();
  });
};

/**
 * Compose final video with base video, audio, images, and subtitles
 */
const composeVideo = async (
  baseVideoPath,
  audioPath,
  images,
  subtitlesPath,
  title
) => {
  try {
    logger.info("🎬 Starting final video composition...");

    // Create final video directly in final_video folder
    const finalVideoFolder = "final_video";
    const timestamp = Date.now();
    const outputPath = path.resolve(
      path.join(finalVideoFolder, `final_video_${timestamp}.mp4`)
    );

    // Ensure final_video folder exists
    if (!fs.existsSync(finalVideoFolder)) {
      fs.mkdirSync(finalVideoFolder, { recursive: true });
    }

    logger.info(`📹 Base video: ${baseVideoPath}`);
    logger.info(`🎵 Audio: ${audioPath}`);
    logger.info(`🖼️ Images: ${images.length} files`);
    logger.info(`📝 Subtitles: ${subtitlesPath}`);
    logger.info(`📁 Output: ${outputPath}`);

    // Validate input files exist
    if (!fs.existsSync(baseVideoPath)) {
      throw new Error(`Base video file not found: ${baseVideoPath}`);
    }
    if (audioPath && !fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    return new Promise((resolve, reject) => {
      // FFmpeg is already configured with static path at module level
      let command = ffmpeg().input(baseVideoPath); // Input 0: base video

      // Add audio input if provided
      if (audioPath) {
        command = command.input(audioPath); // Input 1: audio
      }

      // Filter out images that don't exist and add valid image inputs
      const validImages = images.filter((image) =>
        fs.existsSync(image.filename)
      );

      // Add image inputs (inputs 2, 3, 4, 5, 6 for images)
      validImages.forEach((image) => {
        command = command.input(image.filename);
      });

      // Build complex filter for multiple image overlays with timing and subtitles
      let filterParts = [];

      // Scale base video to 1080:1920 with black padding
      filterParts.push(
        "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[base]"
      );

      // Scale each image to fit within video width (90% of 1080 = 972px) without padding
      validImages.forEach((image, index) => {
        const inputIndex = index + (audioPath ? 2 : 1); // Images start from input 2 if audio, input 1 if no audio
        // Scale to fit within 90% of video width (972px) while maintaining aspect ratio
        filterParts.push(
          `[${inputIndex}:v]scale=972:-1:force_original_aspect_ratio=decrease[img${index}]`
        );
      });

      // Create overlay chain with timing (reference test video approach)
      let currentVideo = "[base]";
      if (validImages.length > 0) {
        if (validImages.length === 1) {
          // Single image - use simple overlay like test video
          const startTime = Math.max(
            0,
            parseFloat(validImages[0].timing.startTime) || 0
          );
          const endTime = Math.max(
            startTime + 1,
            parseFloat(validImages[0].timing.endTime) || startTime + 14
          );

          filterParts.push(
            `${currentVideo}[img0]overlay=(W-w)/2:20:enable='between(t,${startTime},${endTime})'[video]`
          );
          currentVideo = "[video]";
        } else {
          // Multiple images - create overlay chain
          validImages.forEach((image, index) => {
            const startTime = Math.max(
              0,
              parseFloat(image.timing.startTime) || 0
            );
            const endTime = Math.max(
              startTime + 1,
              parseFloat(image.timing.endTime) || startTime + 14
            );
            const nextVideo =
              index === validImages.length - 1 ? "[video]" : `[v${index}]`;

            filterParts.push(
              `${currentVideo}[img${index}]overlay=(W-w)/2:20:enable='between(t,${startTime},${endTime})'${nextVideo}`
            );

            currentVideo = nextVideo;
          });
        }
      }

      // Handle subtitles based on whether we have overlays or not
      if (!fs.existsSync(subtitlesPath)) {
        // No subtitles, use base video or video with overlays
        filterParts.push(`${currentVideo}copy[final]`);
      } else {
        // Use working subtitles approach from test video
        const safeSubtitlePath = subtitlesPath
          .replace(/\\/g, "\\\\")
          .replace(/:/g, "\\:")
          .replace(/'/g, "\\'");

        const subtitleFilter = `${currentVideo}subtitles='${safeSubtitlePath}':force_style='FontName=Montserrat Black,FontSize=13,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,BackColour=&H80000000,Bold=1,Alignment=2,MarginV=37,Outline=3,Spacing=0'[final]`;
        filterParts.push(subtitleFilter);
      }

      // Set up output options - optimized for both YouTube and Instagram
      const outputOptions = [
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23", // Balanced quality
        "-maxrate",
        "4000k", // Good for both platforms
        "-bufsize",
        "8000k",
        "-movflags",
        "+faststart",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "30", // 30fps for compatibility
        "-t",
        "59", // Under both limits (YouTube 60s, Instagram 59s)
      ];

      // Map video stream
      outputOptions.push("-map", "[final]");

      // Map audio stream - use the provided audio if available, otherwise use base video audio
      if (audioPath) {
        outputOptions.push("-map", "1:a");
        outputOptions.push("-c:a", "aac");
        outputOptions.push("-b:a", "160k"); // Good audio quality
      } else {
        // Use audio from base video if no separate audio provided
        outputOptions.push("-map", "0:a");
        outputOptions.push("-c:a", "copy");
      }

      outputOptions.push("-shortest");

      command
        .complexFilter(filterParts.join(";"))
        .outputOptions(outputOptions)
        .output(outputPath)
        .on("start", (commandLine) => {
          logger.info("🔄 FFmpeg process started with command:");
          logger.info(commandLine);
          logger.info("🎬 Filter parts:", filterParts);
          logger.info("🎬 Complete filter:", filterParts.join(";"));
        })
        .on("progress", (progress) => {
          if (progress.percent) {
            logger.info(
              `⏳ Video composition progress: ${Math.round(progress.percent)}%`
            );
          }
        })
        .on("end", async () => {
          logger.info(`✅ Final video composed successfully: ${outputPath}`);

          resolve({
            success: true,
            videoPath: outputPath,
            duration: null,
            format: "mp4",
            resolution: "1080x1920",
          });
        })
        .on("error", (error) => {
          logger.error("❌ Video composition failed:", error.message);
          reject(error);
        })
        .run();
    });
  } catch (error) {
    logger.error("❌ Video composition process failed:", error);
    throw error;
  }
};

/**
 * Get video metadata
 */
const getVideoMetadata = async (videoPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (error, metadata) => {
      if (error) {
        reject(error);
      } else {
        const videoStream = metadata.streams.find(
          (stream) => stream.codec_type === "video"
        );
        const audioStream = metadata.streams.find(
          (stream) => stream.codec_type === "audio"
        );

        resolve({
          duration: metadata.format.duration,
          size: metadata.format.size,
          bitrate: metadata.format.bit_rate,
          video: videoStream
            ? {
                codec: videoStream.codec_name,
                width: videoStream.width,
                height: videoStream.height,
                fps: eval(videoStream.r_frame_rate), // Convert fraction to decimal
              }
            : null,
          audio: audioStream
            ? {
                codec: audioStream.codec_name,
                sampleRate: audioStream.sample_rate,
                channels: audioStream.channels,
              }
            : null,
        });
      }
    });
  });
};

/**
 * Create optimized version for both platforms (single video)
 */
const createPlatformOptimized = async (videoPath, platform = "both") => {
  try {
    // Create a single optimized video that works for both YouTube and Instagram
    const optimizedOutputPath = videoPath.replace(".mp4", "_optimized.mp4");

    logger.info(
      `🎬 Creating single optimized video for both platforms: ${optimizedOutputPath}`
    );

    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([
          "-c:v libx264",
          "-preset fast",
          "-crf 23", // Balanced quality
          "-maxrate 4000k", // Good for both platforms
          "-bufsize 8000k",
          "-c:a aac",
          "-b:a 160k", // Good audio quality
          "-movflags +faststart",
          "-vf scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2", // 9:16 aspect ratio
          "-t 59", // Under both limits (YouTube 60s, Instagram 59s)
          "-r 30", // 30fps for compatibility
        ])
        .output(optimizedOutputPath)
        .on("start", (commandLine) => {
          logger.info("🔄 Creating optimized video...");
        })
        .on("progress", (progress) => {
          if (progress.percent) {
            logger.info(
              `⏳ Optimization progress: ${Math.round(progress.percent)}%`
            );
          }
        })
        .on("end", () => {
          logger.info(
            `✅ Single optimized video created: ${optimizedOutputPath}`
          );
          resolve(optimizedOutputPath);
        })
        .on("error", (error) => {
          logger.error("❌ Video optimization failed:", error.message);
          reject(error);
        })
        .run();
    });

    return {
      youtube: optimizedOutputPath,
      instagram: optimizedOutputPath,
      singleVideo: true,
    };
  } catch (error) {
    logger.error("❌ Platform optimization failed:", error);
    throw error;
  }
};

module.exports = {
  getBaseVideo,
  composeVideo,
  createPlaceholderVideo,
  getVideoMetadata,
  createPlatformOptimized,
};
