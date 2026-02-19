import sys
import os
from pathlib import Path
local_model_path = Path("indicf5_models").resolve()
sys.path.append(str(local_model_path))
from model import INF5Model, INF5Config
import torch
import numpy as np
import soundfile as sf

# Load INF5 from local folder
config = INF5Config.from_pretrained(str(local_model_path))
model = INF5Model.from_pretrained(str(local_model_path), config=config)
model = model.to("cuda" if torch.cuda.is_available() else "cpu")

# Generate speech
audio = model(
    "నమస్కారం! ఈరోజు మనం AI Content Automation గురించి మాట్లాడుకుందాం. This process is fully automated.",
    ref_audio_path="Base-audio.mp3",
    ref_text="Hello there! this is your expressive indian voice that can be used for advertisements or story narrations."
)
# Normalize and save
audio = audio.astype(np.float32) / 32768.0
os.makedirs("samples", exist_ok=True)
sf.write("samples/namaste.wav", np.array(audio, dtype=np.float32), samplerate=24000)
print("Saved to samples/namaste.wav")