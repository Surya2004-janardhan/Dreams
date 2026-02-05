---
title: Wav2Lip ZeroGPU Studio
emoji: 👄
colorFrom: blue
colorTo: indigo
sdk: gradio
sdk_version: 4.19.2
python_version: 3.10
app_file: app.py
pinned: false
license: mit
short_description: Accurate Lip Sync using Wav2Lip and ZeroGPU.
---

# Wav2Lip ZeroGPU Studio

This space provides a high-quality lip-syncing tool using the Wav2Lip model. 
It utilizes Hugging Face **ZeroGPU** (A100/H100) for fast inference.

## Features:
- **Free GPU Support**: Uses `@spaces.GPU` for rapid processing.
- **Easy API**: You can call this Space as an API.
- **High Quality**: Uses the `wav2lip_gan` model.

## Note:
The weights for the models are being loaded from the local `checkpoints` and `face_detection` folders.
