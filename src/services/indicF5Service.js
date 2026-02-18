const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');

/**
 * Service to generate cloned voice audio using AI4Bharat IndicF5.
 * Better for bilingual Telugu/English content.
 */
class IndicF5Service {
    constructor() {
        this.baseDir = path.resolve(__dirname, '../../');
        this.pythonScript = path.join(this.baseDir, 'indicf5_bridge.py');
    }

    /**
     * Generates a cloned voice audio file.
     * @param {string} text - The text to synthesize (supports native Telugu script).
     * @param {string} refAudioPath - Path to the reference audio sample.
     * @param {string} refText - Transcript of the reference audio (required for IndicF5).
     * @param {string} outputPath - Path to save the generated audio.
     * @returns {Promise<string>} - Path to the generated audio file.
     */
    async generateBilingualVoice(text, refAudioPath, refText, outputPath) {
        if (!fs.existsSync(this.pythonScript)) {
            throw new Error(`IndicF5 bridge script not found at: ${this.pythonScript}`);
        }

        const absRefAudioPath = path.resolve(refAudioPath);
        const absOutputPath = path.resolve(outputPath);

        logger.info(`🗣️ Starting IndicF5 Bilingual Synthesis...`);
        logger.debug(`Script: ${this.pythonScript}`);

        return new Promise((resolve, reject) => {
            const args = [
                this.pythonScript,
                text,
                absRefAudioPath,
                refText,
                absOutputPath
            ];

            const proc = spawn('python', args, { cwd: this.baseDir });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => {
                const output = data.toString();
                stdout += output;
                logger.debug(`[IndicF5] ${output.trim()}`);
            });

            proc.stderr.on('data', (data) => {
                const output = data.toString();
                stderr += output;
                logger.debug(`[IndicF5 Stderr] ${output.trim()}`);
            });

            proc.on('close', (code) => {
                if (code !== 0) {
                    logger.error(`❌ IndicF5 Synthesis Failed with code ${code}`);
                    logger.error(`Stderr: ${stderr}`);
                    return reject(new Error(`IndicF5 failed with code ${code}`));
                }

                if (!fs.existsSync(absOutputPath)) {
                    return reject(new Error(`IndicF5 finished but output file was NOT found at: ${absOutputPath}`));
                }

                const stats = fs.statSync(absOutputPath);
                logger.info(`✅ IndicF5 Synthesis Successful: ${outputPath} (${(stats.size/1024).toFixed(2)} KB)`);
                resolve(absOutputPath);
            });
        });
    }
}

module.exports = new IndicF5Service();
