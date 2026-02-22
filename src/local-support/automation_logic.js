const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { getNextTask, updateSheetStatus } = require('../services/sheetsService');
const { createSubtitlesFromAudio } = require('../utils/subtitles');
const { uploadToSupabaseAndGetLink } = require('../services/socialMediaService');
const { sendSuccessNotification, sendErrorNotification, sendLocalSupportNotification } = require('../services/emailService');
const { syncLip } = require('../services/wav2lipService');
const voiceboxService = require('../services/voiceboxService');
const logger = require("../config/logger");

/**
 * Minimal Automation Logic for Daily Support
 * Runs: Topic -> Script -> Audio -> LipSync -> Supabase -> Email
 * Skips: Dynamic HTML visuals and Reel Composer
 * No AI Script Generation - Uses Sheet Data Directly
 */
async function runDailyAutomation() {
    logger.info("📅 STARTING DAILY LOCAL-SUPPORT AUTOMATION");
    const sessionStart = Date.now();
    let currentStep = "Initialization";
    let task = null;
    let supabaseInfo = null;

    try {
        // 1. Fetch task (Specialized for sheet-direct data)
        currentStep = "Fetching Task";
        task = await getNextTask();
        
        // IMMEDIATE LOCK: Set status to Processing
        if (task.rowId > 0) {
            logger.info(`🔒 Locking Row ${task.rowId} as "Processing"...`);
            await updateSheetStatus(task.rowId, "Processing");
        }

        // Title comes from 'idea' column (or 'title'/'topic' headers)
        // Script comes from 'scripts' column
        const TOPIC = task.idea || "Daily Task"; 
        const script = task.scripts || task.idea;
        
        // Safety: ensure it's a string and clean it up
        const cleanScript = String(script).trim();
        const cleanTitle = String(TOPIC).trim().substring(0, 100);

        logger.info(`📝 Using Sheet Title: "${cleanTitle}"`);
        logger.info(`📝 Using Sheet Script: "${cleanScript.substring(0, 50)}..."`);

        // 2. Audio (Cloned Voice)
        currentStep = "Audio Generation";
        const REF_AUDIO = path.resolve('Base-audio.mp3');
        const GEN_AUDIO = path.join(process.cwd(), 'audio', `daily_voice_${Date.now()}.wav`);
        
        if (!fs.existsSync(path.dirname(GEN_AUDIO))) fs.mkdirSync(path.dirname(GEN_AUDIO), { recursive: true });

        // Generate and apply 0.94 slowdown
        const VOICE_INSTRUCT = "Professional technical delivery. Clear and steady.";
        const rawAudio = await voiceboxService.generateClonedVoice(cleanScript, REF_AUDIO, GEN_AUDIO, null, VOICE_INSTRUCT);
        const audioPath = path.join(path.dirname(GEN_AUDIO), `slowed_${path.basename(GEN_AUDIO)}`);
        
        await new Promise((res, rej) => {
            ffmpeg(rawAudio).audioFilters('atempo=0.94').on('end', res).on('error', rej).save(audioPath);
        });

        // 4. Lip-Sync
        currentStep = "Wav2Lip Processing";
        const WAV2LIP_BASE = path.resolve('Base-vedio.mp4');
        const SYNCED_VIDEO = path.resolve('daily_synced.mp4');
        await syncLip(audioPath, WAV2LIP_BASE, SYNCED_VIDEO);

        // 5. SRT Generation
        currentStep = "SRT Generation";
        const srtRes = await createSubtitlesFromAudio(audioPath);
        const srtPath = srtRes.subtitlesPath;

        // 6. Final Mix (Add BGM)
        currentStep = "Final Mixing";
        const FINAL_VIDEO = path.resolve('daily_final_output.mp4');
        const BGM_PATH = path.resolve('bgm.mp3'); // Assumes bgm.mp3 exists
        
        await new Promise((res, rej) => {
            let command = ffmpeg(SYNCED_VIDEO).input(audioPath);
            let filter = '[1:a]volume=1.0[speech]';
            
            if (fs.existsSync(BGM_PATH)) {
                command.input(BGM_PATH);
                filter = '[1:a]volume=1.0[speech];[2:a]volume=0.07[bgm];[speech][bgm]amix=inputs=2:duration=first[a]';
            } else {
                filter = '[1:a]volume=1.0[a]';
            }

            command
                .complexFilter([filter])
                .outputOptions(['-map 0:v', '-map [a]', '-c:v copy', '-shortest'])
                .on('end', res)
                .on('error', rej)
                .save(FINAL_VIDEO);
        });

        // 7. Supabase Upload
        currentStep = "Supabase Upload";
        supabaseInfo = await uploadToSupabaseAndGetLink(FINAL_VIDEO, `Daily_${cleanTitle}`);
        const srtUpload = await uploadToSupabaseAndGetLink(srtPath, `Daily_SRT_${cleanTitle}`);

        // 8. Notification & Sheet Update
        currentStep = "Notifications";
        if (task.rowId > 0) {
            // Updated for: Title, scripts, status, Links, Timestamp
            // We put the primary video link in the 'Links' column.
            await updateSheetStatus(task.rowId, "Local Support Posted", supabaseInfo.publicLink);
        }

        // Send specialized download-focused email
        await sendLocalSupportNotification(task, supabaseInfo.publicLink, srtUpload.publicLink);

        logger.info(`✨ DAILY AUTOMATION SUCCESSFUL | Time: ${((Date.now() - sessionStart)/1000).toFixed(2)}s`);

    } catch (err) {
        logger.error(`❌ DAILY PIPELINE FAILED | Step: ${currentStep} | Error: ${err.message}`);
        if (task) await sendErrorNotification(task, err, currentStep);
        if (task && task.rowId > 0) await updateSheetStatus(task.rowId, "Local Error: " + err.message.slice(0, 50));
    }
}

if (require.main === module) {
    runDailyAutomation();
}

module.exports = { runDailyAutomation };
