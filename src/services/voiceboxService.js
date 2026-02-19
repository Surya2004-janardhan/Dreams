const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');

/**
 * Service to generate cloned voice audio using the Voicebox Python backend.
 */
class VoiceboxService {
    constructor() {
        this.rootDir = path.resolve(__dirname, '../../');
        this.bridgeScript = path.join(this.rootDir, 'indicf5_bridge.py');
    }

    /**
     * Internal helper to split text into chunks for safe generation.
     */
    _chunkText(text, maxWords = 40) {
        const sentences = text.match(/[^.!?]+[.!?]+|\s*[^.!?]+$/g) || [text];
        const chunks = [];
        let currentChunk = "";

        for (const sentence of sentences) {
            const wordCount = (currentChunk + sentence).split(/\s+/).length;
            if (wordCount > maxWords && currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence;
            } else {
                currentChunk += sentence;
            }
        }
        if (currentChunk) chunks.push(currentChunk.trim());
        return chunks;
    }

    /**
     * Generates a cloned voice audio file using IndicF5.
     */
    async generateClonedVoice(text, refAudioPath, outputPath, refText = "This is a reference audio sample.", instruct = null, speed = 1.0) {
        const absRefAudioPath = path.resolve(refAudioPath);
        const absOutputPath = path.resolve(outputPath);
        
        // Chunking check: If text is long, process in smaller pieces to avoid OOM
        const chunks = this._chunkText(text);
        if (chunks.length > 1) {
            logger.info(`📦 Long script detected (${chunks.length} chunks). Using segmented synthesis.`);
            const chunkPaths = [];
            for (let i = 0; i < chunks.length; i++) {
                const chunkOutput = path.join(path.dirname(absOutputPath), `chunk_${i}_${path.basename(absOutputPath)}`);
                await this._synthesizeSingle(chunks[i], absRefAudioPath, chunkOutput, refText);
                chunkPaths.push(chunkOutput);
            }
            
            // Merge chunks using FFmpeg
            logger.info("🧵 Stitching audio chunks together...");
            await this._mergeAudio(chunkPaths, absOutputPath);
            
            // Cleanup chunks
            chunkPaths.forEach(p => fs.unlinkSync(p));
            return absOutputPath;
        }

        return this._synthesizeSingle(text, absRefAudioPath, absOutputPath, refText);
    }

    async _synthesizeSingle(text, refAudioPath, outputPath, refText) {
        logger.info(`🗣️ IndicF5 Synthesis: "${text.substring(0, 40)}..."`);
        
        return new Promise((resolve, reject) => {
            const args = [
                this.bridgeScript,
                text,
                refAudioPath,
                refText,
                outputPath
            ];

            const proc = spawn('python', args, { cwd: this.rootDir });

            proc.stdout.on('data', (data) => {
                const output = data.toString().trim();
                // Filter out non-essential logs to keep terminal clean
                if (output && !output.includes('Loading model')) logger.info(`[IndicF5] ${output}`);
            });

            proc.stderr.on('data', (data) => {
                const output = data.toString().trim();
                if (output) logger.debug(`[IndicF5 Stderr] ${output}`);
            });

            proc.on('close', (code) => {
                if (code !== 0) return reject(new Error(`IndicF5 failed with code ${code}`));
                if (!fs.existsSync(outputPath)) return reject(new Error(`IndicF5 output missing: ${outputPath}`));
                resolve(outputPath);
            });
        });
    }

    async _mergeAudio(paths, outputPath) {
        const mergeFile = path.join(path.dirname(outputPath), 'merge_list.txt');
        const content = paths.map(p => `file '${path.resolve(p)}'`).join('\n');
        fs.writeFileSync(mergeFile, content);

        return new Promise((resolve, reject) => {
            const args = ['-f', 'concat', '-safe', '0', '-i', mergeFile, '-c', 'copy', '-y', outputPath];
            const proc = spawn('ffmpeg', args);
            proc.on('close', (code) => {
                fs.unlinkSync(mergeFile);
                if (code === 0) resolve(outputPath);
                else reject(new Error(`FFmpeg merge failed with code ${code}`));
            });
        });
    }
}

module.exports = new VoiceboxService();
