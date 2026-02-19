import sys
import os
import torch
import numpy as np
import soundfile as sf
from transformers import AutoModel

def main():
    if len(sys.argv) < 5:
        print("Usage: python indicf5_bridge.py <text> <ref_audio> <ref_text> <output_path>")
        sys.exit(1)

    text = sys.argv[1]
    ref_audio = sys.argv[2]
    ref_text = sys.argv[3]
    output_path = sys.argv[4]

    print(f"Loading IndicF5 model from Hugging Face...")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")

    try:
        # Check for local models first to skip gated/network issues
        local_model_path = os.path.join(os.getcwd(), "indicf5_models")
        repo_id = "ai4bharat/IndicF5"
        hf_token = os.environ.get("HF_TOKEN")
        
        if os.path.exists(local_model_path) and os.path.isdir(local_model_path):
            print(f"Loading local IndicF5 model from: {local_model_path}")
            model_source = local_model_path
        else:
            print(f"Loading IndicF5 model from Hugging Face ({repo_id})...")
            model_source = repo_id

        # trust_remote_code=True is required to load the model's custom logic
        model = AutoModel.from_pretrained(
            model_source, 
            trust_remote_code=True,
            token=hf_token if model_source == repo_id else None
        )
        model = model.to(device)

        print(f"Generating audio for: {text[:50]}...")
        # Zero-shot cloning using the model directly (as per README)
        audio = model(
            text,
            ref_audio_path=ref_audio,
            ref_text=ref_text
        )

        # Normalize if needed (IndicF5 returns int16 or float32 depending on processing)
        if hasattr(audio, 'numpy'):
             audio = audio.cpu().numpy()
        
        if audio.dtype == np.int16:
            audio = audio.astype(np.float32) / 32768.0

        # Save output (24000 is the standard sample rate for IndicF5)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        sf.write(output_path, np.array(audio, dtype=np.float32), 24000)
        print(f"Successfully generated: {output_path}")

    except Exception as e:
        print(f"ERROR during synthesis: {str(e)}")
        # Print traceback for better debugging
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
