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

    const outputPath = path.resolve(`videos/final_video_${Date.now()}.mp4`);

    logger.info(`📹 Base video: ${baseVideoPath}`);
    logger.info(`🎵 Audio: ${audioPath}`);
    logger.info(`🖼️ Images: ${images.length} files`);
    logger.info(`📝 Subtitles: ${subtitlesPath}`);

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

      // Scale each image to 1000:500 with white padding
      validImages.forEach((image, index) => {
        const inputIndex = index + (audioPath ? 2 : 1); // Images start from input 2 if audio, input 1 if no audio
        filterParts.push(
          `[${inputIndex}:v]scale=1000:500:force_original_aspect_ratio=decrease,pad=1000:500:(ow-iw)/2:(oh-ih)/2:white[img${index}]`
        );
      });

      // Create overlay chain with timing
      let currentVideo = "[base]";
      validImages.forEach((image, index) => {
        const startTime = image.timing.startTime;
        const endTime = image.timing.endTime;
        const nextVideo =
          index === validImages.length - 1
            ? "[video_with_overlays]"
            : `[v${index}]`;

        filterParts.push(
          `${currentVideo}[img${index}]overlay=40:200:enable=between(t\\,${startTime}\\,${endTime})${nextVideo}`
        );

        currentVideo = nextVideo;
      });

      // If no subtitles, just use the video with overlays as final
      filterParts.push(`[video_with_overlays]copy[final_video]`);

      // Set up output options
      const outputOptions = [
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "23",
        "-movflags",
        "+faststart",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "30",
      ];

      // Map video stream
      outputOptions.push("-map", "[final_video]");

      // Map audio stream - use the provided audio if available, otherwise use base video audio
      if (audioPath) {
        outputOptions.push("-map", "1:a");
        outputOptions.push("-c:a", "aac");
        outputOptions.push("-b:a", "192k");
      } else {
        // Use audio from base video if no separate audio provided
        outputOptions.push("-map", "0:a");
        outputOptions.push("-c:a", "copy");
      }

      // Add subtitles as a separate video filter if they exist
      if (fs.existsSync(subtitlesPath)) {
        const simpleSubtitlesPath = subtitlesPath
          .replace(/\\/g, "\\\\")
          .replace(/:/g, "\\:")
          .replace(/'/g, "\\'");
        outputOptions.push(
          "-vf",
          `subtitles='${simpleSubtitlesPath}':force_style='FontName=Poppins,FontSize=48,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,BorderStyle=1,Outline=2'`
        );
      }

      command
        .complexFilter(filterParts.join(";"))
        .outputOptions(outputOptions)
        .output(outputPath);

      command
        .on("start", (commandLine) => {
          logger.info("🔄 FFmpeg process started with command:");
          logger.info(commandLine);
        })
        .on("progress", (progress) => {
          if (progress.percent) {
            logger.info(
              `⏳ Video composition progress: ${Math.round(progress.percent)}%`
            );
          }
        })
        .on("end", () => {
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
 * Create optimized versions for different platforms
 */
const createPlatformOptimized = async (videoPath, platform = "both") => {
  try {
    const results = {};

    if (platform === "youtube" || platform === "both") {
      // YouTube Shorts optimization (9:16 aspect ratio)
      const youtubeOutputPath = videoPath.replace(".mp4", "_youtube.mp4");

      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .outputOptions([
            "-c:v libx264",
            "-preset slower",
            "-crf 21",
            "-maxrate 5000k",
            "-bufsize 10000k",
            "-c:a aac",
            "-b:a 192k",
            "-movflags +faststart",
            "-vf scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2", // 9:16 aspect ratio
            "-t 60", // YouTube Shorts limit
          ])
          .output(youtubeOutputPath)
          .on("end", () => {
            logger.info(
              `✅ YouTube Shorts (9:16) version created: ${youtubeOutputPath}`
            );
            results.youtube = youtubeOutputPath;
            resolve();
          })
          .on("error", reject)
          .run();
      });
    }

    if (platform === "instagram" || platform === "both") {
      // Instagram Reels optimization (9:16 aspect ratio)
      const instagramOutputPath = videoPath.replace(".mp4", "_instagram.mp4");

      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .outputOptions([
            "-c:v libx264",
            "-preset fast",
            "-crf 25",
            "-maxrate 3500k",
            "-bufsize 7000k",
            "-c:a aac",
            "-b:a 128k",
            "-movflags +faststart",
            "-vf scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2", // 9:16 aspect ratio
            "-t 59", // Instagram Reels limit
          ])
          .output(instagramOutputPath)
          .on("end", () => {
            logger.info(
              `✅ Instagram Reels (9:16) version created: ${instagramOutputPath}`
            );
            results.instagram = instagramOutputPath;
            resolve();
          })
          .on("error", reject)
          .run();
      });
    }

    return results;
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
