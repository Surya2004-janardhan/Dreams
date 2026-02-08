
import os
import cv2
import numpy as np
from tqdm import tqdm
import torch
import face_detection
import argparse

def precompute_face_boxes(video_path, output_path, batch_size=16):
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
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
        frames.append(frame)
    video_stream.release()

    print(f'Total frames: {len(frames)}. Detecting faces...')
    
    # Batch processing for detection
    predictions = []
    while 1:
        predictions = []
        try:
            for i in tqdm(range(0, len(frames), batch_size)):
                # Convert BGR (OpenCV) to RGB for FaceAlignment
                batch = [cv2.cvtColor(f, cv2.COLOR_BGR2RGB) for f in frames[i:i + batch_size]]
                predictions.extend(detector.get_detections_for_batch(np.array(batch)))
        except RuntimeError:
            if batch_size == 1: 
                raise RuntimeError('Image too big for face detection. Try reducing resolution.')
            batch_size //= 2
            print(f'Recovering from OOM; new batch size: {batch_size}')
            continue
        break
    
    # Convert predictions (rects) to box coordinates [x1, y1, x2, y2]
    # We store the RAW detector output so we can apply different pads later
    boxes = []
    for rect in predictions:
        if rect is None:
            # If a frame fails, we repeat the last good box or fail
            if len(boxes) > 0:
                boxes.append(boxes[-1])
            else:
                # Should not happen in base video, but for safety:
                print("Warning: Initial frame had no face. Using zero box.")
                boxes.append([0, 0, 0, 0])
        else:
            boxes.append([rect[0], rect[1], rect[2], rect[3]])
            
    # Save to .npy
    np.save(output_path, np.array(boxes))
    print(f'✅ Successfully saved {len(boxes)} face boxes to: {output_path}')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--video', type=str, required=True, help='Path to Base-vedio.mp4')
    parser.add_argument('--output', type=str, default='Base-vedio.npy', help='Output cache path')
    args = parser.parse_args()
    
    precompute_face_boxes(args.video, args.output)
