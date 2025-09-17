const axios = require("axios");
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Instagram Graph API configuration
const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;

// Filebase configuration
const FILEBASE_ACCESS_KEY = process.env.FILEBASE_ACCESS_KEY;
const FILEBASE_SECRET_KEY = process.env.FILEBASE_SECRET_KEY;
const FILEBASE_BUCKET = process.env.FILEBASE_BUCKET || "ai-content-videos";

// Initialize Filebase S3 client
const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: "https://s3.filebase.com",
  credentials: {
    accessKeyId: FILEBASE_ACCESS_KEY,
    secretAccessKey: FILEBASE_SECRET_KEY,
  },
});

// Upload file to Filebase and return public URL
async function uploadToFilebase(filePath, title) {
  try {
    console.log("☁️ Uploading video to Filebase...");

    const fileName = `${title}_${Date.now()}.mp4`;
    const fileContent = fs.readFileSync(filePath);

    // Upload to Filebase S3
    const uploadCommand = new PutObjectCommand({
      Bucket: FILEBASE_BUCKET,
      Key: fileName,
      Body: fileContent,
      ContentType: "video/mp4",
      ACL: "public-read", // Make the file publicly readable
      Metadata: {
        "x-amz-meta-public": "true",
      },
    });

    const uploadResult = await s3Client.send(uploadCommand);
    console.log(`✅ File uploaded to Filebase. Key: ${fileName}`);

    // Try alternative URL formats for better Instagram compatibility
    const s3Url = `https://${FILEBASE_BUCKET}.s3.filebase.com/${fileName}`;
    const ipfsUrl = `https://ipfs.filebase.io/ipfs/${fileName}`;

    console.log(`🔗 S3 URL: ${s3Url}`);
    console.log(`🔗 IPFS URL: ${ipfsUrl}`);

    // Test both URLs and use the one that works
    try {
      const testResponse = await axios.head(s3Url, { timeout: 5000 });
      if (testResponse.status === 200) {
        console.log(`✅ S3 URL is accessible`);
        return {
          success: true,
          fileName: fileName,
          publicUrl: s3Url,
          bucket: FILEBASE_BUCKET,
        };
      }
    } catch (error) {
      console.log(`⚠️ S3 URL not accessible, trying IPFS URL`);
    }

    return {
      success: true,
      fileName: fileName,
      publicUrl: ipfsUrl,
      bucket: FILEBASE_BUCKET,
    };
  } catch (error) {
    console.error("❌ Filebase upload failed:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Filebase upload function
async function uploadToFilebaseAndGetLink(videoPath, title) {
  try {
    console.log("☁️ Uploading video to Filebase...");

    if (!FILEBASE_ACCESS_KEY || !FILEBASE_SECRET_KEY) {
      throw new Error(
        "FILEBASE_ACCESS_KEY and FILEBASE_SECRET_KEY environment variables are required"
      );
    }

    const fileName = `${title.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.mp4`;
    const fileContent = fs.readFileSync(videoPath);
    const fileStats = fs.statSync(videoPath);

    console.log(`📁 Uploading file: ${fileName}`);
    console.log(
      `📊 File size: ${(fileStats.size / (1024 * 1024)).toFixed(2)} MB`
    );

    // Upload to Filebase using PutObjectCommand
    const uploadCommand = new PutObjectCommand({
      Bucket: FILEBASE_BUCKET,
      Key: fileName,
      Body: fileContent,
      ContentType: "video/mp4",
      ACL: "public-read", // Make file publicly accessible
    });

    await s3Client.send(uploadCommand);
    console.log(`✅ File uploaded to Filebase. Key: ${fileName}`);

    // Generate public URL using Filebase's direct access format
    const publicLink = `https://${FILEBASE_BUCKET}.s3.filebase.com/${fileName}`;
    console.log(`🔗 Public link: ${publicLink}`);

    return {
      success: true,
      fileName: fileName,
      publicLink: publicLink,
      bucket: FILEBASE_BUCKET,
    };
  } catch (error) {
    console.error("❌ Filebase upload failed:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Delete file from Filebase
async function deleteFromFilebase(fileName, bucket) {
  try {
    console.log(`🗑️ Deleting file from Filebase: ${fileName}`);

    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucket,
      Key: fileName,
    });

    await s3Client.send(deleteCommand);
    console.log("✅ File deleted from Filebase");
    return { success: true };
  } catch (error) {
    console.error("❌ Failed to delete from Filebase:", error.message);
    return { success: false, error: error.message };
  }
}

// Test function to upload video to Instagram
async function uploadToInstagram(filePath, title, description) {
  let filebaseFileName = null;

  try {
    console.log(`📱 Starting Instagram upload for: ${filePath}`);
    console.log(`📹 Title: ${title}`);
    console.log(`📝 Description: ${description}`);

    if (!ACCESS_TOKEN || !ACCOUNT_ID) {
      throw new Error(
        "INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_ACCOUNT_ID environment variables are required"
      );
    }

    // Step 1: Upload to Filebase and get public link
    const filebaseResult = await uploadToFilebase(filePath, title);
    console.log(filebaseResult);
    if (!filebaseResult.success) {
      throw new Error(`Filebase upload failed: ${filebaseResult.error}`);
    }

    filebaseFileName = filebaseResult.fileName;
    const publicVideoUrl = filebaseResult.publicUrl;

    console.log(`🔗 Using Filebase link for Instagram: ${publicVideoUrl}`);

    // Step 2: Upload video to get media ID using public URL
    const uploadUrl = `https://graph.facebook.com/v18.0/${ACCOUNT_ID}/media`;
    const uploadParams = {
      media_type: "REELS",
      video_url: publicVideoUrl, // Use public Filebase URL
      caption: `${title}\n\n${description}\n\n#AI #Education #Technology #Shorts #Reels`,
      access_token: ACCESS_TOKEN,
    };

    console.log("📤 Uploading media to Instagram...");
    const uploadResponse = await axios.post(uploadUrl, uploadParams);
    const mediaId = uploadResponse.data.id;
    console.log(`✅ Media uploaded successfully. Media ID: ${mediaId}`);

    // Wait for Instagram to process the media before publishing
    console.log("⏳ Waiting for Instagram to process media (30 seconds)...");
    await new Promise((resolve) => setTimeout(resolve, 30000));

    // Step 3: Publish the media with retry mechanism
    const publishUrl = `https://graph.facebook.com/v18.0/${ACCOUNT_ID}/media_publish`;
    const publishParams = {
      creation_id: mediaId,
      access_token: ACCESS_TOKEN,
    };

    let publishResponse;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        console.log(
          `🚀 Publishing media (attempt ${retryCount + 1}/${maxRetries})...`
        );
        publishResponse = await axios.post(publishUrl, publishParams);
        break; // Success, exit retry loop
      } catch (publishError) {
        retryCount++;
        if (retryCount < maxRetries) {
          console.log(
            `⚠️ Publish attempt ${retryCount} failed, retrying in 10 seconds...`
          );
          await new Promise((resolve) => setTimeout(resolve, 10000));
        } else {
          throw publishError; // Max retries reached, throw error
        }
      }
    }

    const postId = publishResponse.data.id;

    const instagramUrl = `https://instagram.com/p/${postId}`;

    console.log("✅ Instagram upload successful!");
    console.log(`🎥 Post ID: ${postId}`);
    console.log(`🔗 Instagram URL: ${instagramUrl}`);

    // Clean up Filebase file after successful Instagram upload
    if (filebaseFileName) {
      await deleteFromFilebase(filebaseFileName, FILEBASE_BUCKET);
    }

    return {
      success: true,
      postId: postId,
      url: instagramUrl,
      mediaId: mediaId,
    };
  } catch (error) {
    console.error("❌ Instagram upload failed:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }

    // Clean up Filebase file on error
    if (filebaseFileName) {
      console.log(
        "🧹 Cleaning up Filebase file due to Instagram upload failure..."
      );
      await deleteFromFilebase(filebaseFileName, FILEBASE_BUCKET);
    }

    throw error;
  }
}

// Test function to upload the existing final video
async function testInstagramUpload() {
  const videoPath = "final_video_1758123737319.mp4";
  const title = "Aii";
  const description =
    "Automatically generated educational video about technology and learning. Created using AI automation tools.";

  try {
    // Check if video file exists
    const fs = require("fs");
    if (!fs.existsSync(videoPath)) {
      console.error(`❌ Video file not found: ${videoPath}`);
      return;
    }

    console.log(`📁 Found video file: ${videoPath}`);
    const stats = fs.statSync(videoPath);
    console.log(`📊 File size: ${(stats.size / (1024 * 1024)).toFixed(2)} MB`);

    console.log("🚀 Starting Filebase → Instagram upload process...");
    const result = await uploadToInstagram(videoPath, title, description);
    console.log("🎉 Instagram test upload completed successfully!");
    console.log("Result:", result);
  } catch (error) {
    console.error("💥 Instagram test upload failed:", error.message);
  }
}

// Run the test
testInstagramUpload();
