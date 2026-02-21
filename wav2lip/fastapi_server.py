from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
import subprocess
import os
import shutil
import uuid

app = FastAPI(title="Wav2Lip Microservice")

# Ensure directories exist
os.makedirs("temp", exist_ok=True)
os.makedirs("results", exist_ok=True)

@app.post("/sync/")
async def sync_lip(
    background_tasks: BackgroundTasks,
    face: UploadFile = File(...),
    audio: UploadFile = File(...),
    resize_factor: int = 2
):
    job_id = str(uuid.uuid4())
    temp_face = f"temp/{job_id}_{face.filename}"
    temp_audio = f"temp/{job_id}_{audio.filename}"
    output_file = f"results/{job_id}_output.mp4"

    # Save uploaded files
    with open(temp_face, "wb") as buffer:
        shutil.copyfileobj(face.file, buffer)
    with open(temp_audio, "wb") as buffer:
        shutil.copyfileobj(audio.file, buffer)

    # Run Wav2Lip Inference
    # Note: We assume 'python' is in the path or venv is active
    command = [
        "python", "inference.py",
        "--checkpoint_path", "checkpoints/wav2lip_gan.pth",
        "--face", temp_face,
        "--audio", temp_audio,
        "--outfile", output_file,
        "--resize_factor", str(resize_factor)
    ]

    try:
        # Run process
        process = subprocess.run(command, capture_output=True, text=True)
        
        if process.returncode != 0:
            return {"error": "Inference failed", "details": process.stderr}

        # Cleanup temp files in background
        background_tasks.add_task(os.remove, temp_face)
        background_tasks.add_task(os.remove, temp_audio)

        return FileResponse(output_file, media_type="video/mp4", filename="synced_video.mp4")

    except Exception as e:
        return {"error": str(e)}

@app.get("/")
async def root():
    return {"message": "Wav2Lip Microservice is running. Use /sync/ to process videos."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
