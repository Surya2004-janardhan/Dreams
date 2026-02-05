import os
import sys
import asyncio
from pathlib import Path

# Add the backend directory to the sys.path
sys.path.append(os.path.join(os.getcwd(), "backend"))

try:
    from backend.backends import get_tts_backend
    from backend.utils.audio import save_audio
except ImportError:
    print("Error: Could not import backend modules.")
    sys.exit(1)

# Hardcoded Configuration
MODEL_SIZE = "1.7B"  # Big model for high quality
_backend = None

async def voicebox_clone_and_generate(text, audio_sample_path, sample_transcript, output_path="output.wav"):
    """
    Core function for voice cloning and synthesis.
    - If the voice hasn't been processed before, it clones it (creates template).
    - If it has been processed, it uses the existing template.
    - Generates audio from text and returns the file path.
    """
    global _backend
    
    # 1. Initialize Backend & Model
    if _backend is None:
        print(f"Loading {MODEL_SIZE} Voice Model...")
        _backend = get_tts_backend()
        await _backend.load_model(MODEL_SIZE)

    # 2. Handle Cloning (uses internal caching automatically)
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

    # 3. Generate Speech
    print("Synthesizing speech...")
    audio, sample_rate = await _backend.generate(
        text=text,
        voice_prompt=voice_prompt,
        language="en"
    )

    # 4. Save and Return
    save_audio(audio, str(output_path), sample_rate)
    return os.path.abspath(output_path)

if __name__ == "__main__":
    # Example standalone usage
    async def main():
        # Update these for your specific test
        sample = "github-explained-in-under-60-seconds-128k_opwYmIrL.mp3"
        transcript = "GitHub is a web-based platform..." 
        
        path = await voicebox_clone_and_generate(
            text="This is a test run with the hardcoded 1.7B model.",
            audio_sample_path=sample,
            sample_transcript=transcript,
            output_path="final_result.wav"
        )
        print(f"DONE! File at: {path}")

    asyncio.run(main())
