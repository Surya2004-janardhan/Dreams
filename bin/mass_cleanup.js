const fs = require('fs');
const { google } = require('googleapis');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const logger = require('../src/config/logger');

/**
 * Mass Cleanup Tool
 * Destructive tool to remove existing content from linked social platforms.
 * 
 * SAFETY: Requires DANGER_ZONE_UNLOCK=true in .env or as an environment variable.
 */

const DANGER_UNLOCK = process.env.DANGER_ZONE_UNLOCK === 'true';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// --- YouTube Cleanup ---
async function cleanupYouTube() {
    logger.info("📺 Starting YouTube Cleanup...");
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    try {
        let deletedCount = 0;
        let hasMore = true;

        while (hasMore) {
            const listRes = await youtube.search.list({
                part: 'id',
                forMine: true,
                type: 'video',
                maxResults: 50
            });

            const videos = listRes.data.items || [];
            if (videos.length === 0) {
                hasMore = false;
                break;
            }

            for (const item of videos) {
                const videoId = item.id.videoId;
                logger.info(`  🗑️ Deleting YouTube Video: ${videoId}`);
                await youtube.videos.delete({ id: videoId });
                deletedCount++;
                await sleep(3000); // 3s delay
            }
        }
        logger.info(`✅ YouTube Cleanup Complete. Total deleted: ${deletedCount}`);
    } catch (error) {
        logger.error(`❌ YouTube Cleanup Failed: ${error.message}`);
    }
}

// --- Facebook Cleanup ---
async function cleanupFacebook() {
    logger.info("📘 Starting Facebook Cleanup...");
    const pageId = process.env.FACEBOOK_PAGE_ID;
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
    const baseUrl = "https://graph.facebook.com/v23.0";

    if (!pageId || !accessToken) {
        logger.error("❌ Facebook Cleanup Skipped: FACEBOOK_PAGE_ID or FACEBOOK_ACCESS_TOKEN missing in .env");
        return;
    }

    try {
        let deletedCount = 0;
        let hasMore = true;
        let nextUrl = `${baseUrl}/${pageId}/feed?access_token=${accessToken}`;

        while (hasMore && nextUrl) {
            let response;
            try {
                response = await axios.get(nextUrl);
            } catch (getErr) {
                logger.error(`❌ Failed to fetch Facebook feed: ${getErr.message}`);
                if (getErr.response) logger.error(`Response Data: ${JSON.stringify(getErr.response.data)}`);
                break;
            }

            const posts = response.data.data || [];
            
            if (posts.length === 0) {
                logger.info("ℹ️ No more Facebook posts found.");
                break;
            }

            for (const post of posts) {
                logger.info(`  🗑️ Deleting Facebook Post: ${post.id}`);
                try {
                    await axios.delete(`${baseUrl}/${post.id}?access_token=${accessToken}`);
                    deletedCount++;
                } catch (delErr) {
                    logger.error(`  ⚠️ Failed to delete post ${post.id}: ${delErr.message}`);
                    if (delErr.response) logger.error(`  Response Data: ${JSON.stringify(delErr.response.data)}`);
                }
                await sleep(3000); // 3s delay
            }

            nextUrl = response.data.paging?.next || null;
        }
        logger.info(`✅ Facebook Cleanup Complete. Total deleted: ${deletedCount}`);
    } catch (error) {
        logger.error(`❌ Facebook Cleanup Error: ${error.message}`);
        if (error.response) logger.error(`Response Data: ${JSON.stringify(error.response.data)}`);
    }
}

// --- Instagram Cleanup ---
// NOTE: Instagram Graph API for Business/Creators does NOT currently support deleting media/posts via API.
// This is a known limitation to prevent mass-deletion bots.
async function cleanupInstagram() {
    logger.warn("📸 Instagram Cleanup: Deletion via API is restricted by Meta for Instagram accounts.");
    logger.warn("💡 Please delete Instagram posts manually via the app or Business Suite.");
}

async function startCleanup() {
    if (!DANGER_UNLOCK) {
        logger.error("🚫 CLEANUP BLOCKED: DANGER_ZONE_UNLOCK is not set to 'true'.");
        logger.info("To proceed, run: $env:DANGER_ZONE_UNLOCK='true'; node bin/mass_cleanup.js");
        process.exit(1);
    }

    console.log("\n⚠️  WARNING: This will permanently delete content from YouTube and Facebook.  ⚠️");
    console.log("Press Ctrl+C to abort in 5 seconds...");
    await sleep(5000);

    await cleanupYouTube();
    await cleanupFacebook();
    await cleanupInstagram();

    logger.info("\n🏁 Mass Cleanup Finished.");
}

startCleanup();
