
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
    # Determine device
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    if os.environ.get('GITHUB_ACTIONS') != 'true':
        device = 'cpu'
        
    print(f'Starting pre-computation on {device}...')
    
    # Initialize detector
    detector = face_detection.FaceAlignment(face_detection.LandmarksType._2D, 
                                            flip_input=False, device=device)
    
    # Open video stream
    video_stream = cv2.VideoCapture(video_path)
    if not video_stream.isOpened():
        print(f"Error: Could not open video {video_path}")
        return

    total_frames = int(video_stream.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f'Total frames to process: {total_frames}. Memory-efficient streaming enabled.')

    boxes = []
    
    # Process in batches without storing the whole video in RAM
    pbar = tqdm(total=total_frames)
    
    try:
        while True:
            batch_frames = []
            for _ in range(batch_size):
                still_reading, frame = video_stream.read()
                if not still_reading:
                    break
                # Convert BGR to RGB for detector
                batch_frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            
            if not batch_frames:
                break
                
            # Run detection on current batch
            preds = detector.get_detections_for_batch(np.array(batch_frames))
            
            # Process predictions
            for rect in preds:
                if rect is None:
                    if len(boxes) > 0:
                        boxes.append(boxes[-1])
                    else:
                        boxes.append([0, 0, 100, 100])
                else:
                    boxes.append([rect[0], rect[1], rect[2], rect[3]])
            
            pbar.update(len(batch_frames))
    except Exception as e:
        print(f"Error during detection: {e}")
    finally:
        video_stream.release()
        pbar.close()

    if not boxes:
        print("Error: No faces detected or video empty.")
        return

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
