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

    // Ensure temp directory exists inside wav2lip
    const tempDir = path.join(wav2lipDir, 'temp');
    if (!fs.existsSync(tempDir)) {
        logger.info(`📁 Creating missing temp directory: ${tempDir}`);
        fs.mkdirSync(tempDir, { recursive: true });
    }

    // Command to run inference
    const command = `python "${inferenceScript}" ` +
                    `--checkpoint_path "${checkpoint}" ` +
                    `--face "${absFacePath}" ` +
                    `--audio "${absAudioPath}" ` +
                    `--outfile "${absOutputPath}" ` +
                    `--resize_factor 2`;

    logger.info(`👄 Starting Wav2Lip Sync...`);
    logger.debug(`Command: ${command}`);

    return new Promise((resolve, reject) => {
        const proc = exec(command, { cwd: wav2lipDir }, (error, stdout, stderr) => {
            if (error) {
                logger.error(`❌ Wav2Lip Sync Failed: ${error.message}`);
                if (stderr) logger.error(`Stderr: ${stderr}`);
                return reject(error);
            }

            // VERIFICATION: Check if output file exists and is not 0 bytes
            if (!fs.existsSync(absOutputPath)) {
                return reject(new Error(`Wav2Lip finished but output file was NOT found at: ${absOutputPath}`));
            }

            const stats = fs.statSync(absOutputPath);
            if (stats.size === 0) {
                return reject(new Error(`Wav2Lip generated an EMPTY file at: ${absOutputPath}`));
            }

            logger.info(`✅ Wav2Lip Sync Successful: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
            resolve(absOutputPath);
        });

        // Log progress/output if needed
        proc.stdout.on('data', (data) => {
            if (data.includes('it/s')) { // Simple progress indicator from tqdm
                logger.debug(`Wav2Lip: ${data.trim()}`);
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
