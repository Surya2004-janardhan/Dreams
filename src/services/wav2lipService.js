const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');

/**
 * Syncs lips of a face video with an audio file using Wav2Lip
 * @param {string} audioPath - Path to the source audio
 * @param {string} facePath - Path to the video containing the face
 * @param {string} outputPath - Path to save the synced video
 * @returns {Promise<string>} - Path to the generated video
 */
async function syncLip(audioPath, facePath, outputPath) {
    // Resolve absolute paths
    const absAudioPath = path.resolve(audioPath);
    const absFacePath = path.resolve(facePath);
    const absOutputPath = path.resolve(outputPath);
    
    const wav2lipDir = path.resolve(__dirname, '../../wav2lip');
    const checkpoint = path.join(wav2lipDir, 'checkpoints/wav2lip_gan.pth');
    const inferenceScript = path.join(wav2lipDir, 'inference.py');

    // Ensure wav2lip directory exists
    if (!fs.existsSync(wav2lipDir)) {
        throw new Error(`Wav2Lip directory not found at ${wav2lipDir}`);
    }

    // Command to run inference
    // Note: We use the system 'python' command as the venv seems non-standard or missing python.exe
    const command = `python "${inferenceScript}" ` +
                    `--checkpoint_path "${checkpoint}" ` +
                    `--face "${absFacePath}" ` +
                    `--audio "${absAudioPath}" ` +
                    `--outfile "${absOutputPath}" ` +
                    `--resize_factor 2`;

    logger.info(`👄 Starting Wav2Lip Sync...`);
    logger.debug(`Command: ${command}`);

    return new Promise((resolve, reject) => {
        const process = exec(command, { cwd: wav2lipDir }, (error, stdout, stderr) => {
            if (error) {
                logger.error(`❌ Wav2Lip Sync Failed: ${error.message}`);
                if (stderr) logger.error(`Stderr: ${stderr}`);
                return reject(error);
            }
            logger.info(`✅ Wav2Lip Sync Successful: ${outputPath}`);
            resolve(absOutputPath);
        });

        // Log progress/output if needed
        process.stdout.on('data', (data) => {
            if (data.includes('it/s')) { // Simple progress indicator from tqdm
                // Too much noise for normal logs, just debug
                logger.debug(`Wav2Lip: ${data}`);
            }
        });
    });
}

/**
 * High Quality Lip Sync (Simulating app.py logic with GFPGAN if available)
 * For now, this just calls the basic syncLip.
 */
async function syncLipHQ(audioPath, facePath, outputPath) {
    logger.info(`✨ Running High-Quality Lip Sync (Experimental)`);
    // Ideally this would run inference, then GFPGAN, then merge.
    // For the initial integration, we use the basic sync.
    return syncLip(audioPath, facePath, outputPath);
}

module.exports = { syncLip, syncLipHQ };
