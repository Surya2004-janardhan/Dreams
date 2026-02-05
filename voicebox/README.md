# Voicebox Daily Service

This is a simplified version of Voicebox designed for automated voice cloning and speech generation. It is optimized to run as a script or within a microservice architecture.

## Features
- **One-Call Synthesis**: Provide text and a voice sample; the script handles cloning and generation in one go.
- **Microservice Ready**: Configurable via environment variables and easy to integrate into larger Python projects.
- **Dual Model Support**:
  - **1.7B (Big)**: Recommended for production/service use (Studio Grade quality).
  - **0.6B (Small)**: Recommended for local testing or low-resource environments (Speed optimized).

## Configuration
You can set defaults using environment variables or a `.env` file:
```bash
VOICEBOX_MODEL_SIZE=1.7B
```

## Setup
1. Create a virtual environment and install dependencies:
   ```bash
   python -m venv venv
   .\venv\Scripts\activate  # Windows
   pip install -r requirements.txt
   pip install git+https://github.com/QwenLM/Qwen3-TTS.git
   ```

## Usage (CLI)
```bash
python main.py --text "Today is a beautiful day." \
               --audio "my_voice.wav" \
               --ref_text "The exact words in the audio file." \
               --output "final.wav"
```

## Usage (As a Python Module)
```python
from main import VoiceService
import asyncio

async def main():
    service = VoiceService(model_size="1.7B")
    await service.generate_audio(
        text="Hello world!",
        ref_audio_path="sample.wav",
        ref_text="Reference text",
        output_path="output.wav"
    )

if __name__ == "__main__":
    asyncio.run(main())
```
