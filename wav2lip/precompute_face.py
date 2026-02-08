
import os
import cv2
import numpy as np
from tqdm import tqdm
import torch
import face_detection
import argparse

def get_smoothened_boxes(boxes, T):
    for i in range(len(boxes)):
        if i + T > len(boxes):
            window = boxes[len(boxes) - T:]
        else:
            window = boxes[i : i + T]
        boxes[i] = np.mean(window, axis=0)
    return boxes

def precompute_face_boxes(video_path, output_path, batch_size=4, nosmooth=False):
    # Forced to CPU for stability as requested by user for local runs
    # But will use GPU if we ever flip this back
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    # For now, let's respect the user's wish for "normal cpu itself" local
    # We can detect if we are in GitHub Actions and use GPU there
    if os.environ.get('GITHUB_ACTIONS') != 'true':
        device = 'cpu'
        
    print(f'Starting pre-computation on {device}...')
    
    # Initialize detector
    detector = face_detection.FaceAlignment(face_detection.LandmarksType._2D, 
                                            flip_input=False, device=device)
    
    # Load video
    video_stream = cv2.VideoCapture(video_path)
    if not video_stream.isOpened():
        print(f"Error: Could not open video {video_path}")
        return

    frames = []
    fps = video_stream.get(cv2.CAP_PROP_FPS)
    if fps == 0:
        print("Error: Invalid video file (FPS is 0)")
        return

    while True:
        still_reading, frame = video_stream.read()
        if not still_reading:
            break
        # FaceAlignment expects RGB
        frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    video_stream.release()

    total_frames = len(frames)
    print(f'Total frames: {total_frames}. Detecting faces...')
    
    # Batch processing for detection
    predictions = []
    while 1:
        predictions = []
        try:
            for i in tqdm(range(0, total_frames, batch_size)):
                batch = np.array(frames[i:i + batch_size])
                preds = detector.get_detections_for_batch(batch)
                predictions.extend(preds)
        except RuntimeError as e:
            if "out of memory" in str(e).lower() and batch_size > 1:
                batch_size //= 2
                print(f'Memory Pressure; auto-reducing batch size to: {batch_size}')
                continue
            raise e
        break
    
    # Convert predictions (rects) to box coordinates [x1, y1, x2, y2]
    boxes = []
    for rect in predictions:
        if rect is None:
            if len(boxes) > 0:
                boxes.append(boxes[-1])
            else:
                print("Warning: Initial frame had no face. Defaulting to center box.")
                boxes.append([0, 0, 100, 100])
        else:
            boxes.append([rect[0], rect[1], rect[2], rect[3]])
            
    boxes = np.array(boxes)
    if not nosmooth:
        print("Applying temporal smoothing to face boxes...")
        boxes = get_smoothened_boxes(boxes, T=5)
        
    # Save to .npy
    np.save(output_path, boxes)
    print(f'✅ PRE-COMPUTATION SUCCESSFUL: {len(boxes)} frames cached to {output_path}')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--video', type=str, required=True, help='Path to Base-vedio.mp4')
    parser.add_argument('--output', type=str, default='Base-vedio.npy', help='Output cache path')
    parser.add_argument('--batch_size', type=int, default=4, help='Batch size for detection')
    parser.add_argument('--nosmooth', action='store_true', help='Disable smoothing')
    args = parser.parse_args()
    
    precompute_face_boxes(args.video, args.output, batch_size=args.batch_size, nosmooth=args.nosmooth)
