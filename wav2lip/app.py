import os
import gradio as gr
import subprocess
import uuid
import shutil

import cv2
from gfpgan import GFPGANer

# This check is for Hugging Face Spaces environment
try:
    import spaces
    has_gpu = True
except ImportError:
    has_gpu = False

# Download GFPGAN weights automatically
GFPGAN_WEIGHTS = "gfpgan/weights/GFPGANv1.3.pth"
if not os.path.exists(GFPGAN_WEIGHTS):
    os.makedirs("gfpgan/weights", exist_ok=True)
    url = "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.3.pth"
    import requests
    response = requests.get(url)
    with open(GFPGAN_WEIGHTS, "wb") as f:
        f.write(response.content)

# Initialize Restorer
restorer = GFPGANer(model_path=GFPGAN_WEIGHTS, upscale=2, arch='clean', channel_multiplier=2, bg_upsampler=None)

# Fallback decorator
def gpu_decorator(duration=120):
    if has_gpu:
        return spaces.GPU(duration=duration)
    return lambda f: f

@gpu_decorator(duration=250) # Request more time for HD
def sync_lip(face_file, audio_file, resize_factor):
    if face_file is None or audio_file is None:
        return None

    job_id = str(uuid.uuid4())
    os.makedirs("results", exist_ok=True)
    temp_output = f"results/{job_id}_low_res.mp4"
    hd_no_audio = f"results/{job_id}_hd_no_audio.mp4"
    final_output = f"results/{job_id}_FINAL_HD.mp4"
    
    # 1. Wav2Lip Syncing
    command = [
        "python", "inference.py",
        "--checkpoint_path", "checkpoints/wav2lip_gan.pth",
        "--face", face_file,
        "--audio", audio_file,
        "--outfile", temp_output,
        "--resize_factor", str(int(resize_factor))
    ]
    
    try:
        subprocess.run(command, capture_output=True, text=True)
        
        # 2. GFPGAN Enhancement
        video_cap = cv2.VideoCapture(temp_output)
        fps = video_cap.get(cv2.CAP_PROP_FPS)
        width = int(video_cap.get(cv2.CAP_PROP_FRAME_WIDTH) * 2)
        height = int(video_cap.get(cv2.CAP_PROP_FRAME_HEIGHT) * 2)
        
        out_writer = cv2.VideoWriter(hd_no_audio, cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))
        
        while True:
            ret, frame = video_cap.read()
            if not ret: break
            _, _, enhanced_frame = restorer.enhance(frame, has_aligned=False, only_center_face=False, paste_back=True)
            out_writer.write(enhanced_frame)
        
        video_cap.release()
        out_writer.release()

        # 3. Final FFmpeg Merge (Add audio back)
        merge_cmd = f'ffmpeg -y -i "{hd_no_audio}" -i "{audio_file}" -c:v libx264 -c:a aac -map 0:v:0 -map 1:a:0 -pix_fmt yuv420p "{final_output}"'
        subprocess.call(merge_cmd, shell=True)

        return final_output
    except Exception as e:
        print(f"Error: {e}")
        return None

# Build UI
with gr.Blocks(title="Wav2Lip Studio") as interface:
    gr.Markdown("# 👄 Wav2Lip AI Video Sync")
    gr.Markdown("Upload a video and an audio clip to sync the lips perfectly.")
    
    with gr.Row():
        with gr.Column():
            video_input = gr.Video(label="Source Video (Face)")
            audio_input = gr.Audio(label="Source Audio", type="filepath")
            resize = gr.Slider(minimum=1, maximum=4, value=2, step=1, label="Resize Factor (Higher = Faster)")
            btn = gr.Button("Generate Synced Video", variant="primary")
        
        with gr.Column():
            video_output = gr.Video(label="Result")

    btn.click(
        fn=sync_lip,
        inputs=[video_input, audio_input, resize],
        outputs=video_output
    )

if __name__ == "__main__":
    interface.launch()
