import sys
import os
import torch
import soundfile as sf
from indicf5.tts import IndicF5TTS

def main():
    if len(sys.argv) < 5:
        print("Usage: python indicf5_bridge.py <text> <ref_audio> <ref_text> <output_path>")
        sys.exit(1)

    text = sys.argv[1]
    ref_audio = sys.argv[2]
    ref_text = sys.argv[3]
    output_path = sys.argv[4]

    print(f"Loading IndicF5 model...")
    # Using cpu for stability on Windows/Actions by default
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")

    try:
        # Initialize model
        # Note: IndicF5 automatically handles downloading if not cached
        tts = IndicF5TTS(device=device)

        print(f"Generating audio for: {text[:50]}...")
        # Zero-shot cloning
        audio_array, sampling_rate = tts.predict(
            text=text,
            ref_audio=ref_audio,
            ref_text=ref_text
        )

        # Save output
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        sf.write(output_path, audio_array, sampling_rate)
        print(f"Successfully generated: {output_path}")

    except Exception as e:
        print(f"ERROR during synthesis: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
