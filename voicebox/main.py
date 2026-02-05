import os
import sys
import asyncio
import argparse
from pathlib import Path

# Add the backend directory to the sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

try:
    from backend.backends import get_tts_backend, get_stt_backend
    from backend.utils.audio import save_audio
except ImportError:
    print("Error: Could not import backend modules. Make sure you are running from the voicebox directory.")
    sys.exit(1)

# Hardcoded Configuration
MODEL_SIZE = os.getenv("VOICEBOX_MODEL_SIZE", "1.7B")
_backend = None
_stt_backend = None

async def voicebox_get_ref_text(audio_sample_path):
    """Auto-transcribe reference audio if text is missing."""
    global _stt_backend
    if _stt_backend is None:
        print("Loading STT Model for auto-transcription...")
        _stt_backend = get_stt_backend()
        await _stt_backend.load_model("base")
    
    print(f"Transcribing reference audio: {audio_sample_path}")
    return await _stt_backend.transcribe(str(audio_sample_path))

async def voicebox_clone_and_generate(text, audio_sample_path, sample_transcript=None, output_path="output.wav"):
    """
    Core function for voice cloning and synthesis.
    """
    global _backend
    
    # 1. Initialize Backend & Model
    if _backend is None:
        print(f"Loading {MODEL_SIZE} Voice Model...")
        _backend = get_tts_backend()
        await _backend.load_model(MODEL_SIZE)

    # 2. Get reference text if missing
    if not sample_transcript:
        sample_transcript = await voicebox_get_ref_text(audio_sample_path)
        print(f"Auto-transcribed Ref Text: {sample_transcript[:50]}...")

    # 3. Handle Cloning
    print(f"Ensuring voice clone exists for: {audio_sample_path}")
    voice_prompt, was_cached = await _backend.create_voice_prompt(
        str(audio_sample_path),
        sample_transcript,
        use_cache=True
    )

    if was_cached:
        print("Using existing voice template.")
    else:
        print("Created new voice clone template.")

    # 4. Generate Speech
    print("Synthesizing speech...")
    audio, sample_rate = await _backend.generate(
        text=text,
        voice_prompt=voice_prompt,
        language="en"
    )

    # 5. Save and Return
    save_audio(audio, str(output_path), sample_rate)
    return os.path.abspath(output_path)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Voicebox CLI for Voice Cloning and Synthesis")
    parser.add_argument("--text", required=True, help="Text to synthesize")
    parser.add_argument("--audio", required=True, help="Path to reference audio sample")
    parser.add_argument("--ref_text", help="Transcript of the reference audio (optional, will auto-transcribe if missing)")
    parser.add_argument("--output", default="output.wav", help="Path to save the generated audio")
    
    args = parser.parse_args()

    async def main():
        try:
            path = await voicebox_clone_and_generate(
                text=args.text,
                audio_sample_path=args.audio,
                sample_transcript=args.ref_text,
                output_path=args.output
            )
            print(f"SUCCESS: {path}")
        except Exception as e:
            print(f"ERROR: {str(e)}")
            sys.exit(1)

    asyncio.run(main())
