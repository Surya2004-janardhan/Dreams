// Delete all files in a specified folder (local cleanup)
// Example: node bin/delete_all_social_posts.js final_video

const fs = require("fs");
const path = require("path");

// Example: Use env keys for remote API deletion
const YT_TOKEN = process.env.YOUTUBE_ACCESS_TOKEN;
const IG_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const FB_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;

function deleteAllFilesInFolder(folderPath) {
  if (!fs.existsSync(folderPath)) {
    console.log(`Folder not found: ${folderPath}`);
    return;
  }
  const files = fs.readdirSync(folderPath);
  let deleted = 0;
  for (const file of files) {
    const filePath = path.join(folderPath, file);
    if (fs.lstatSync(filePath).isFile()) {
      fs.unlinkSync(filePath);
      deleted++;
      console.log(`🗑️ Deleted: ${filePath}`);
    }
  }
  console.log(`✅ Deleted ${deleted} files from ${folderPath}`);
}

async function main() {
  const folder = process.argv[2] || "final_video";
  console.log(
    `⚠️ WARNING: This will delete ALL files in the folder: ${folder}`
  );
  // Delete all content from Instagram, YouTube, and Facebook accounts using API tokens
  require("dotenv").config();

  const {
    deleteAllYouTubeVideos,
    deleteAllInstagramPosts,
    deleteAllFacebookPosts,
  } = require("../src/services/socialMediaService");

  const YT_TOKEN = process.env.YOUTUBE_ACCESS_TOKEN;
  const IG_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
  const FB_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;

  async function main() {
    console.log(
      "⚠️ WARNING: This will delete ALL posts/reels/videos from your social accounts!"
    );

    const axios = require('axios');
    require('dotenv').config();

    const YT_TOKEN = process.env.YOUTUBE_ACCESS_TOKEN;
    const IG_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
    const FB_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
    const IG_USER_ID = process.env.INSTAGRAM_USER_ID;
    const FB_PAGE_ID = process.env.FACEBOOK_PAGE_ID;

    // --- YOUTUBE ---
    async function deleteAllYouTubeVideos(token) {
      // List videos uploaded by the authenticated user
      const listUrl = `https://www.googleapis.com/youtube/v3/videos?part=id&mine=true&maxResults=50`;
      const headers = { Authorization: `Bearer ${token}` };
      let nextPageToken = null;
      let totalDeleted = 0;
      do {
        let url = listUrl;
        if (nextPageToken) url += `&pageToken=${nextPageToken}`;
        const res = await axios.get(url, { headers });
        const videos = res.data.items || [];
        for (const video of videos) {
          const id = video.id;
          try {
            await axios.delete(`https://www.googleapis.com/youtube/v3/videos?id=${id}`, { headers });
            console.log(`🗑️ Deleted YouTube video: ${id}`);
            totalDeleted++;
          } catch (err) {
            console.warn(`❌ Failed to delete YouTube video ${id}: ${err.message}`);
          }
        }
        nextPageToken = res.data.nextPageToken;
      } while (nextPageToken);
      console.log(`✓ Deleted ${totalDeleted} YouTube videos.`);
    }

    // --- INSTAGRAM ---
    async function deleteAllInstagramPosts(token) {
      if (!IG_USER_ID) {
        console.log('❌ INSTAGRAM_USER_ID not set in .env');
        return;
      }
      // List media
      const listUrl = `https://graph.instagram.com/${IG_USER_ID}/media?fields=id,caption&access_token=${token}`;
      const res = await axios.get(listUrl);
      const media = res.data.data || [];
      let totalDeleted = 0;
      for (const item of media) {
        try {
          await axios.delete(`https://graph.instagram.com/${item.id}?access_token=${token}`);
          console.log(`🗑️ Deleted Instagram media: ${item.id}`);
          totalDeleted++;
        } catch (err) {
          console.warn(`❌ Failed to delete Instagram media ${item.id}: ${err.message}`);
        }
      }
      console.log(`✓ Deleted ${totalDeleted} Instagram posts/reels.`);
    }

    // --- FACEBOOK ---
    async function deleteAllFacebookPosts(token) {
      if (!FB_PAGE_ID) {
        console.log('❌ FACEBOOK_PAGE_ID not set in .env');
        return;
      }
      // List posts
      const listUrl = `https://graph.facebook.com/v18.0/${FB_PAGE_ID}/posts?fields=id,message&access_token=${token}`;
      const res = await axios.get(listUrl);
      const posts = res.data.data || [];
      let totalDeleted = 0;
      for (const post of posts) {
        try {
          await axios.delete(`https://graph.facebook.com/v18.0/${post.id}?access_token=${token}`);
          console.log(`🗑️ Deleted Facebook post: ${post.id}`);
          totalDeleted++;
        } catch (err) {
          console.warn(`❌ Failed to delete Facebook post ${post.id}: ${err.message}`);
        }
      }
      console.log(`✓ Deleted ${totalDeleted} Facebook posts/reels.`);
    }

        console.log('⚠️ WARNING: This will delete ALL posts/reels/videos from your social accounts!');
        try {
          // Delete YouTube videos
          if (YT_TOKEN) {
            console.log('🗑️ Deleting all YouTube videos...');
            await deleteAllYouTubeVideos(YT_TOKEN);
          } else {
            console.log('❌ YOUTUBE_ACCESS_TOKEN not set in .env');
          }
    
          // Delete Instagram posts/reels
          if (IG_TOKEN) {
            console.log('🗑️ Deleting all Instagram posts/reels...');
            await deleteAllInstagramPosts(IG_TOKEN);
          } else {
            console.log('❌ INSTAGRAM_ACCESS_TOKEN not set in .env');
          }
    
          // Delete Facebook posts/reels
          if (FB_TOKEN) {
            console.log('🗑️ Deleting all Facebook posts/reels...');
            await deleteAllFacebookPosts(FB_TOKEN);
          } else {
            console.log('❌ FACEBOOK_ACCESS_TOKEN not set in .env');
          }
    
          console.log('✅ All social media content deleted.');
        } catch (err) {
          console.error('❌ Error deleting social media content:', err.message);
        }
      }
    
      await main();
    }
    
    main();
