const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");
const logger = require("../config/logger");

// Function to create WAV header for PCM data
function createWavHeader(pcmData, sampleRate, numChannels, bitsPerSample) {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const buffer = Buffer.alloc(44);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4); // File size
  buffer.write("WAVE", 8);

  // Format chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // Chunk size
  buffer.writeUInt16LE(1, 20); // Audio format (PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // Data chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  return Buffer.concat([buffer, pcmData]);
}

// Define audio directory
const audioDir = "audio";

// Ensure audio directory exists
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// Save WAV file helper function
const saveWaveFile = async (
  filename,
  pcmData,
  channels = 1,
  rate = 24000,
  sampleWidth = 2,
) => {
  return new Promise((resolve, reject) => {
    try {
      // If pcmData is already a complete WAV file (from Google GenAI), just write it
      if (Buffer.isBuffer(pcmData) && pcmData.length > 44) {
        // Check if it looks like a WAV file by examining the header
        const riffHeader = pcmData.slice(0, 4).toString("ascii");
        if (riffHeader === "RIFF") {
          // It's already a valid WAV file, just write it
          console.log(`🎵 Detected WAV data, saving as: ${filename}`);
          fs.writeFile(filename, pcmData, (err) => {
            if (err) {
              console.error(`❌ Failed to write WAV file: ${err.message}`);
              reject(err);
            } else {
              console.log(
                `✅ WAV file written successfully: ${filename} (${pcmData.length} bytes)`,
              );
              resolve(filename); // Return the filename
            }
          });
          return;
        }
      }

      // For Google GenAI TTS response, the data might be raw PCM or MP3
      // Let's try to detect the format and handle accordingly
      if (Buffer.isBuffer(pcmData)) {
        // Check if it's MP3 (starts with ID3 or MPEG frame sync)
        const firstBytes = pcmData.slice(0, 4);
        console.log(
          `🔍 First 4 bytes of audio data: ${firstBytes
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(" ")
            .toUpperCase()}`,
        );

        const isMP3 =
          firstBytes[0] === 0x49 &&
          firstBytes[1] === 0x44 &&
          firstBytes[2] === 0x33; // ID3
        const isMPEG =
          (firstBytes[0] & 0xff) === 0xff && (firstBytes[1] & 0xe0) === 0xe0; // MPEG frame sync

        console.log(`🎵 MP3 detection: isMP3=${isMP3}, isMPEG=${isMPEG}`);

        if (isMP3 || isMPEG) {
          // It's MP3/MPEG data, save as .mp3
          const mp3Filename = filename.replace(".wav", ".mp3");
          console.log(`🎵 Detected MP3/MPEG data, saving as: ${mp3Filename}`);
          fs.writeFile(mp3Filename, pcmData, (err) => {
            if (err) {
              console.error(`❌ Failed to write MP3 file: ${err.message}`);
              reject(err);
            } else {
              console.log(
                `✅ MP3 file written: ${mp3Filename} (${pcmData.length} bytes)`,
              );
              resolve(mp3Filename);
            }
          });
          return;
        }

        // For raw PCM data, convert to proper WAV format
        console.log(`🎵 Converting raw PCM to WAV: ${filename}`);

        const ffmpeg = require("fluent-ffmpeg");
        const ffmpegPath = require("ffmpeg-static");
        ffmpeg.setFfmpegPath(ffmpegPath);

        // First save as temporary raw file
        const tempRawFile = filename.replace(".wav", "_temp.raw");
        fs.writeFileSync(tempRawFile, pcmData);

        // Convert raw PCM to WAV using ffmpeg
        ffmpeg(tempRawFile)
          .inputOptions([
            "-f",
            "s16le",
            "-ar",
            rate.toString(),
            "-ac",
            channels.toString(),
          ])
          .output(filename)
          .on("start", (commandLine) => {
            console.log(`🔧 FFmpeg command: ${commandLine}`);
          })
          .on("progress", (progress) => {
            console.log(`📊 Conversion progress: ${progress.percent}% done`);
          })
          .on("end", () => {
            console.log(`✅ WAV file created from PCM: ${filename}`);
            // Clean up temp file
            try {
              fs.unlinkSync(tempRawFile);
            } catch (cleanupErr) {
              console.warn(
                `⚠️ Could not delete temp file: ${cleanupErr.message}`,
              );
            }
            resolve(filename);
          })
          .on("error", (ffmpegErr) => {
            console.error(`❌ FFmpeg conversion failed: ${ffmpegErr.message}`);
            // If ffmpeg fails, try to save as MP3 instead
            console.log(`📁 Falling back to MP3 format`);
            const mp3Filename = filename.replace(".wav", ".mp3");
            fs.writeFile(mp3Filename, pcmData, (mp3Err) => {
              if (mp3Err) {
                console.error(`❌ MP3 fallback also failed: ${mp3Err.message}`);
                reject(ffmpegErr);
              } else {
                console.log(`✅ Saved as MP3 fallback: ${mp3Filename}`);
                resolve(mp3Filename);
              }
            });
          })
          .run();
      } else {
        reject(new Error("Invalid audio data format"));
      }
    } catch (error) {
      reject(error);
    }
  });
};

// Generate TTS audio using Gemini API with retry logic
// const generateTTSAudio = async (text, voiceName = "Kore") => {
//   try {
//     logger.info(`🎤 Generating TTS audio for voice: ${voiceName}`);
//     logger.info(`📝 TTS text: "${text}"`);
//     logger.info(
//       `📊 Text analysis: ${text.length} total chars, ${
//         text.replace(/\s/g, "").length
//       } letters, ${
//         text.split(/\s+/).filter((word) => word.length > 0).length
//       } words`
//     );

//     const response = await genAI.models.generateContent({
//       model: "gemini-2.5-flash-preview-tts",
//       contents: [{ parts: [{ text: text }] }],
//       config: {
//         responseModalities: ["AUDIO"],
//         speechConfig: {
//           voiceConfig: {
//             prebuiltVoiceConfig: {
//               voiceName: voiceName,
//             },
//           },
//           // Add slower speech rate for more natural pacing
//           speakingRate: 0.85, // 15% slower than default
//         },
//       },
//     });

//     const audioData =
//       response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

//     if (!audioData) {
//       logger.error("❌ API Response Debug:", {
//         hasResponse: !!response,
//         hasCandidates: !!response.candidates,
//         candidatesLength: response.candidates?.length,
//         firstCandidate: response.candidates?.[0],
//         finishReason: response.candidates?.[0]?.finishReason,
//         hasContent: !!response.candidates?.[0]?.content,
//         content: response.candidates?.[0]?.content,
//         hasParts: !!response.candidates?.[0]?.content?.parts,
//         parts: response.candidates?.[0]?.content?.parts,
//       });
//       throw new Error("No audio data received from API");
//     }

//     const buffer = Buffer.from(audioData, "base64");
//     const fileName = `tts_${Date.now()}_${voiceName}.wav`;
//     const filePath = path.resolve(path.join(audioDir, fileName));

//     await saveWaveFile(filePath, buffer, 1, 24000, 2);

//     logger.info(`✓ TTS audio generated: ${filePath}`);
//     return filePath;
//   } catch (error) {
//     logger.error("❌ TTS generation failed:", error.message || error);
//     logger.error("Full error details:", JSON.stringify(error, null, 2));
//     throw error;
//   }
// };

// Main audio generation function - Single-speaker explanation
const generateAudioWithBatchingStrategy = async (script) => {
  try {
    logger.info(`🎭 Generating single-speaker explanation audio`);

    // Initialize Google GenAI client
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY_FOR_AUDIO);

    // Reference from doc: Gemini 2.5 Flash Preview TTS is the standard for high-quality audio
    const modelName = "gemini-2.5-flash-preview-tts";
    const voiceName = "Puck"; // Upbeat base voice for natural energy and pitch peaks

    const model = genAI.getGenerativeModel({ model: modelName });

    // Construct the refined "Dynamic Tech Global" persona
    const styledPrompt = `
      Role: Expert Global Tech Educator.
      Tone: High energy, authoritative, and extremely confident.
      Speaking Style: Dynamic with natural pitch peaks and valleys (highs and lows). 
      Accent: Modern, neutral International English with a minimal, professional Indian touch.
      Pace: Brisk and energetic delivery 
      Instructions: Use varied intonation to emphasize key technical points. Sound like a world-class conference speaker. Clean, dry studio sound.

      Script:
      ${script}
    `.trim();

    logger.info(`📝 Sending High-Energy/Brisk TTS request with "Puck" base`);
    
    const response = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: styledPrompt }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
        console.log("Full Response:", JSON.stringify(response, null, 2));
        throw new Error("No audio data returned from Gemini TTS");
    }

    // Convert Base64 to Buffer (PCM Data)
    const binaryString = Buffer.from(base64Audio, "base64").toString("binary");
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create WAV from PCM data
    const pcmBuffer = Buffer.from(bytes);
    const wavBuffer = createWavHeader(pcmBuffer, 24000, 1, 16);

    logger.info(`🔊 Audio buffer size: ${wavBuffer.length} bytes`);

    const conversationFile = path.resolve(
      path.join(audioDir, `conversation_${Date.now()}.wav`),
    );

    fs.writeFileSync(conversationFile, wavBuffer);

    // Validate that the file was actually created and has content
    if (!fs.existsSync(conversationFile)) {
      throw new Error(`Audio file was not created: ${conversationFile}`);
    }

    const stats = fs.statSync(conversationFile);
    if (stats.size === 0) {
      throw new Error(`Audio file is empty: ${conversationFile}`);
    }

    logger.info(
      `✅ Audio file created successfully: ${conversationFile} (${stats.size} bytes)`,
    );

    const audioSegments = [];
    // Since we're doing a single API call, create a single segment
    const estimatedDuration = 70 * (1 / 0.85); // Adjust for 15% slower speech rate
    audioSegments.push({
      file: conversationFile,
      duration: estimatedDuration,
      speaker: "Multi-speaker conversation",
    });

    logger.info(`✓ Generated complete conversation: ${conversationFile}`);

    return {
      conversationFile: conversationFile,
      segments: audioSegments,
      totalSegments: 1, // Single API call
      apiCallsUsed: 1,
    };
  } catch (error) {
    logger.error("❌ Audio generation failed:", error.message || error);
    logger.error(
      "Full error details:",
      JSON.stringify(error, Object.getOwnPropertyNames(error), 2),
    );
    throw error;
  }
};

// Parse script to extract Raj and Rani dialogues
const parseScriptDialogues = (script) => {
  const dialogues = [];
  const lines = script.split("\n").filter((line) => line.trim());

  for (const line of lines) {
    const rajMatch = line.match(/^Raj:\s*(.+)/i);
    const raniMatch = line.match(/^Rani:\s*(.+)/i);

    if (rajMatch) {
      dialogues.push({
        speaker: "Raj",
        text: rajMatch[1].trim(),
      });
    } else if (raniMatch) {
      dialogues.push({
        speaker: "Rani",
        text: raniMatch[1].trim(),
      });
    }
  }

  logger.info(`📝 Parsed ${dialogues.length} dialogue segments`);
  return dialogues;
};

// Combine multiple audio segments
// const combineAudioSegments = async (segments, outputFile) => {
//   return new Promise((resolve, reject) => {
//     let ffmpegCommand = require("fluent-ffmpeg")();

//     segments.forEach((segment) => {
//       ffmpegCommand = ffmpegCommand.input(segment.file);
//     });

//     const inputs = segments.map((_, index) => `[${index}:0]`).join("");
//     const filterComplex = `${inputs}concat=n=${segments.length}:v=0:a=1[out]`;

//     ffmpegCommand
//       .complexFilter(filterComplex)
//       .outputOptions(["-map", "[out]"])
//       .audioCodec("pcm_s16le")
//       .output(outputFile)
//       .on("end", () => {
//         logger.info(`✓ Audio segments combined: ${outputFile}`);
//         resolve(outputFile);
//       })
//       .on("error", (error) => {
//         logger.error("Audio combination error:", error);
//         reject(error);
//       })
//       .run();
//   });
// };

module.exports = {
  generateAudioWithBatchingStrategy,
  // generateTTSAudio,
};
