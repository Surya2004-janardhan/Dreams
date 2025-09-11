const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");
const { getGoogleDriveClient } = require("../config/google");

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
    const tempDir = "temp";

    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    logger.info(`📹 Base video: ${baseVideoPath}`);
    logger.info(`🎵 Audio: ${audioPath}`);
    logger.info(`🖼️ Images: ${images.length} files`);
    logger.info(`📝 Subtitles: ${subtitlesPath}`);

    return new Promise((resolve, reject) => {
      let command = ffmpeg()
        .input(baseVideoPath) // Base video
        .input(audioPath); // Audio track

      // Add image inputs if available
      images.forEach((image, index) => {
        if (fs.existsSync(image.filename)) {
          command = command.input(image.filename);
        }
      });

      // Configure video filters
      let filterComplex = [];

      // Start with base video scaled to 1080x1920 (9:16 ratio for shorts)
      filterComplex.push(
        "[0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black[base]"
      );

      let currentVideoRef = "[base]";

      // Add image overlays with timing
      images.forEach((image, index) => {
        if (fs.existsSync(image.filename)) {
          const inputIndex = 2 + index; // 0=base video, 1=audio, 2+=images
          const startTime = image.timing.startTime;
          const endTime = image.timing.endTime;

          // Scale image to fit in top 50% of video (leaving space for subtitles)
          filterComplex.push(
            `[${inputIndex}:v]scale=1080:540:force_original_aspect_ratio=decrease,pad=1080:540:(ow-iw)/2:(oh-ih)/2:black:eval=frame[img${index}]`
          );

          // Overlay image on video with fade in/out
          const nextVideoRef =
            index === images.length - 1 ? "[final_video]" : `[video${index}]`;
          filterComplex.push(
            `${currentVideoRef}[img${index}]overlay=0:0:enable='between(t,${startTime},${endTime})':eval=frame:format=auto,fade=t=in:st=${startTime}:d=0.5:alpha=1,fade=t=out:st=${
              endTime - 0.5
            }:d=0.5:alpha=1${nextVideoRef}`
          );

          currentVideoRef = nextVideoRef;
        }
      });

      if (filterComplex.length === 1) {
        // No images to overlay, just use base video
        filterComplex[0] = filterComplex[0].replace("[base]", "[final_video]");
      }

      command
        .complexFilter(filterComplex.join(";"))
        .map("[final_video]") // Use the final video output
        .map("[1:a]") // Use the audio from input 1
        .outputOptions([
          "-c:v libx264",
          "-preset fast",
          "-crf 23",
          "-c:a aac",
          "-b:a 128k",
          "-movflags +faststart",
          "-pix_fmt yuv420p",
          "-r 30",
        ]);

      // Add subtitles if available
      if (fs.existsSync(subtitlesPath)) {
        command.outputOptions([
          `-vf subtitles=${subtitlesPath}:force_style='FontName=Poppins-Bold,FontSize=24,PrimaryColour=&Hffffff,BackColour=&H80000000,BorderStyle=1,Outline=2,Shadow=1,MarginV=200,Alignment=2'`,
        ]);
      }

      command
        .output(outputPath)
        .on("start", (commandLine) => {
          logger.info("🔄 FFmpeg process started with command:");
          logger.info(commandLine.substring(0, 200) + "...");
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
            duration: null, // Could be extracted from ffmpeg output
            format: "mp4",
            resolution: "1080x1920",
          });
        })
        .on("error", (error) => {
          logger.error("❌ Video composition failed:", error);
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
      // YouTube Shorts optimization
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
          ])
          .output(youtubeOutputPath)
          .on("end", () => {
            logger.info(
              `✅ YouTube-optimized version created: ${youtubeOutputPath}`
            );
            results.youtube = youtubeOutputPath;
            resolve();
          })
          .on("error", reject)
          .run();
      });
    }

    if (platform === "instagram" || platform === "both") {
      // Instagram Reels optimization
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
            "-t 59", // Instagram Reels limit
          ])
          .output(instagramOutputPath)
          .on("end", () => {
            logger.info(
              `✅ Instagram-optimized version created: ${instagramOutputPath}`
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
    return {};
  }
};

module.exports = {
  getBaseVideo,
  composeVideo,
  createPlaceholderVideo,
  getVideoMetadata,
  createPlatformOptimized,
};
