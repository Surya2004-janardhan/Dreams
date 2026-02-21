import asyncio
import os
import sys

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

from backend.backends import get_stt_backend

async def transcribe_test():
    audio_path = "github-explained-in-under-60-seconds-128k_opwYmIrL.mp3"
    print(f"Transcribing {audio_path} to get reference text...")
    
    stt = get_stt_backend()
    await stt.load_model("base")
    text = await stt.transcribe(audio_path)
    
    print("\n--- TRANSCRIPTION START ---")
    print(text)
    print("--- TRANSCRIPTION END ---\n")
    
    with open("ref_text.tmp", "w", encoding="utf-8") as f:
        f.write(text)

if __name__ == "__main__":
    asyncio.run(transcribe_test())
