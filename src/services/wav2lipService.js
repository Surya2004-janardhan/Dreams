const { spawn } = require('child_process');
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
async function syncLip(audioPath, facePath, outputPath, options = {}) {
    // Resolve absolute paths
    const absAudioPath = path.resolve(audioPath);
    const absFacePath = path.resolve(facePath);
    const absOutputPath = path.resolve(outputPath);
    // Use "Elite" Sync Settings: bottom padding for chin + no smoothing for snapping
    const pads = options.pads || [0, 20, 0, 0]; // Extra bottom padding for chin movement
    const nosmooth = options.nosmooth !== undefined ? options.nosmooth : true; // Default to snap for tech content
    
    // Check for pre-computed face cache to save time
    const cachePath = path.resolve('Base-vedio.npy');
    const hasCache = fs.existsSync(cachePath);
    
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

    logger.info(`👄 Starting Wav2Lip Sync (Safe Mode - CPU)...`);
    logger.debug(`Command: ${command}`);

    return new Promise((resolve, reject) => {
        // Use spawn for real-time streaming of logs
        const args = [
            inferenceScript,
            '--checkpoint_path', checkpoint,
            '--face', absFacePath,
            '--audio', absAudioPath,
            '--outfile', absOutputPath,
            '--resize_factor', '1'
        ];
        
        const proc = spawn('python', args, { cwd: wav2lipDir });

        proc.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) logger.info(`[Wav2Lip] ${output}`);
        });

        proc.stderr.on('data', (data) => {
            const output = data.toString().trim();
            // TQDM often uses stderr, so we don't necessarily treat it as an error
            if (output.includes('it/s') || output.includes('%')) {
                logger.info(`[Wav2Lip Progress] ${output}`);
            } else {
                logger.debug(`[Wav2Lip Stderr] ${output}`);
            }
        });

        proc.on('close', (code) => {
            if (code !== 0) {
                logger.error(`❌ Wav2Lip Sync Failed with exit code ${code}`);
                return reject(new Error(`Wav2Lip failed with code ${code}`));
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
