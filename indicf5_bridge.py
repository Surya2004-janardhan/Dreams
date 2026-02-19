import sys
import os
import torch
import numpy as np
import soundfile as sf
import unicodedata
from pathlib import Path

def main():
    if len(sys.argv) < 5:
        print("Usage: python indicf5_bridge.py <text> <ref_audio> <ref_text> <output_path> [speed] [cfg]")
        sys.exit(1)

    text = sys.argv[1]
    ref_audio = sys.argv[2]
    ref_text = sys.argv[3]
    output_path = sys.argv[4]
    
    speed = float(sys.argv[5]) if len(sys.argv) > 5 else 1.0
    cfg = float(sys.argv[6]) if len(sys.argv) > 6 else 2.5

    # CRITICAL: NFC normalization for correct Indic character handling
    text = unicodedata.normalize('NFC', text)
    ref_text = unicodedata.normalize('NFC', ref_text)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device} | Speed: {speed} | CFG: {cfg}")

    try:
        local_model_path = Path("indicf5_models").resolve()
        if not (local_model_path.exists() and local_model_path.is_dir()):
            print(f"ERROR: Local model folder not found at {local_model_path}")
            sys.exit(1)

        sys.path.append(str(local_model_path))
        from model import INF5Model, INF5Config
        
        print("Loading local weights...")
        config = INF5Config.from_pretrained(str(local_model_path))
        if hasattr(config, 'speed'): config.speed = speed
        
        model = INF5Model.from_pretrained(
            str(local_model_path), 
            config=config, 
            low_cpu_mem_usage=False,
            device_map=None,
            torch_dtype=torch.float32
        )
        model = model.to(device)
        model.eval()

        print(f"🗣️ Synthesizing...")
        with torch.no_grad():
            audio = model(
                text,
                ref_audio_path=ref_audio,
                ref_text=ref_text
            )

        # Basic normalization and saving
        if hasattr(audio, 'cpu'): audio = audio.cpu().numpy()
        if isinstance(audio, np.ndarray) and audio.dtype == np.int16:
            audio = audio.astype(np.float32) / 32768.0

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        sf.write(output_path, np.array(audio, dtype=np.float32), 24000)
        print(f"✅ Success: {output_path}")

    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()

if __name__ == "__main__":
    main()
