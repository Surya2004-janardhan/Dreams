const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');

/**
 * Service to generate cloned voice audio using the Voicebox Python backend.
 */
class VoiceboxService {
    constructor() {
        this.voiceboxDir = path.resolve(__dirname, '../../voicebox');
        this.pythonScript = path.join(this.voiceboxDir, 'main.py');
    }

    /**
     * Generates a cloned voice audio file.
     * @param {string} text - The text to synthesize.
     * @param {string} refAudioPath - Path to the reference audio sample (e.g., Base-audio.mp3).
     * @param {string} outputPath - Path to save the generated audio.
     * @param {string} [refText] - Optional transcript of the reference audio.
     * @returns {Promise<string>} - Path to the generated audio file.
     */
    async generateClonedVoice(text, refAudioPath, outputPath, refText = null) {
        if (!fs.existsSync(this.voiceboxDir)) {
            throw new Error(`Voicebox directory not found at: ${this.voiceboxDir}`);
        }

        const absRefAudioPath = path.resolve(refAudioPath);
        const absOutputPath = path.resolve(outputPath);

        // Build CLI command
        let command = `python "${this.pythonScript}" --text "${text.replace(/"/g, '\\"')}" --audio "${absRefAudioPath}" --output "${absOutputPath}"`;
        if (refText) {
            command += ` --ref_text "${refText.replace(/"/g, '\\"')}"`;
        }

        logger.info(`🗣️ Starting Voicebox Synthesis...`);
        logger.debug(`Command: ${command}`);

        return new Promise((resolve, reject) => {
            const args = [
                this.pythonScript,
                '--text', text,
                '--audio', absRefAudioPath,
                '--output', absOutputPath
            ];
            if (refText) {
                args.push('--ref_text', refText);
            }

            const proc = spawn('python', args, { cwd: this.voiceboxDir });

            proc.stdout.on('data', (data) => {
                const output = data.toString().trim();
                if (output) logger.info(`[Voicebox] ${output}`);
            });

            proc.stderr.on('data', (data) => {
                const output = data.toString().trim();
                if (output) logger.debug(`[Voicebox Stderr] ${output}`);
            });

            proc.on('close', (code) => {
                if (code !== 0) {
                    logger.error(`❌ Voicebox Synthesis Failed with code ${code}`);
                    return reject(new Error(`Voicebox failed with code ${code}`));
                }

                if (!fs.existsSync(absOutputPath)) {
                    return reject(new Error(`Voicebox finished but output file was NOT found at: ${absOutputPath}`));
                }

                const stats = fs.statSync(absOutputPath);
                logger.info(`✅ Voicebox Synthesis Successful: ${outputPath} (${(stats.size/1024).toFixed(2)} KB)`);
                resolve(absOutputPath);
            });
        });
    }
}

module.exports = new VoiceboxService();
