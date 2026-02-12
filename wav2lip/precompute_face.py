
import os
import gc
import cv2
import numpy as np
from tqdm import tqdm
import torch
import face_detection
import argparse

# Max width for detection (480p is plenty for bounding boxes, saves ~5x RAM)
DETECT_MAX_WIDTH = 640

def get_smoothened_boxes(boxes, T):
    for i in range(len(boxes)):
        if i + T > len(boxes):
            window = boxes[len(boxes) - T:]
        else:
            window = boxes[i : i + T]
        boxes[i] = np.mean(window, axis=0)
    return boxes

def precompute_face_boxes(video_path, output_path, batch_size=2, nosmooth=False):
    device = 'cpu'
    print(f'Starting face pre-computation on {device} (Low-RAM Mode)...')
    
    # Initialize detector
    detector = face_detection.FaceAlignment(face_detection.LandmarksType._2D, 
                                            flip_input=False, device=device)
    
    # Load video
    video_stream = cv2.VideoCapture(video_path)
    if not video_stream.isOpened():
        print(f"Error: Could not open video {video_path}")
        return

    total_frames = int(video_stream.get(cv2.CAP_PROP_FRAME_COUNT))
    orig_w = int(video_stream.get(cv2.CAP_PROP_FRAME_WIDTH))
    orig_h = int(video_stream.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # Calculate scale factor for downscaling
    if orig_w > DETECT_MAX_WIDTH:
        scale = DETECT_MAX_WIDTH / orig_w
        det_w = DETECT_MAX_WIDTH
        det_h = int(orig_h * scale)
    else:
        scale = 1.0
        det_w = orig_w
        det_h = orig_h

    print(f'Total frames: {total_frames} | Original: {orig_w}x{orig_h} | Detection: {det_w}x{det_h} | Batch: {batch_size}')
    
    predictions = []
    pbar = tqdm(total=total_frames)
    
    while True:
        batch_frames = []
        for _ in range(batch_size):
            still_reading, frame = video_stream.read()
            if not still_reading:
                break
            # Downscale for detection (saves massive RAM)
            if scale < 1.0:
                frame = cv2.resize(frame, (det_w, det_h))
            # FaceAlignment expects RGB
            batch_frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        
        if not batch_frames:
            break
            
        # Process batch
        try:
            batch_np = np.array(batch_frames)
            preds = detector.get_detections_for_batch(batch_np)
            predictions.extend(preds)
            pbar.update(len(batch_frames))
        except Exception as e:
            print(f"Error during batch processing: {e}")
            break
        
        # Free batch memory immediately
        del batch_frames, batch_np
        gc.collect()

    pbar.close()
    video_stream.release()
    
    # Convert predictions to box coordinates and scale back to original resolution
    boxes = []
    for rect in predictions:
        if rect is None:
            if len(boxes) > 0:
                boxes.append(boxes[-1])
            else:
                boxes.append([0, 0, 100, 100])
        else:
            # Scale boxes back to original resolution
            if scale < 1.0:
                boxes.append([rect[0]/scale, rect[1]/scale, rect[2]/scale, rect[3]/scale])
            else:
                boxes.append([rect[0], rect[1], rect[2], rect[3]])
            
    boxes = np.array(boxes)
    
    # Pad if needed
    if len(boxes) < total_frames:
        print(f"Warning: Only processed {len(boxes)}/{total_frames} frames. Padding.")
        last = boxes[-1] if len(boxes) > 0 else np.array([0,0,100,100])
        pad = np.tile(last, (total_frames - len(boxes), 1))
        boxes = np.vstack([boxes, pad])

    if not nosmooth:
        print("Applying temporal smoothing...")
        boxes = get_smoothened_boxes(boxes, T=5)
        
    np.save(output_path, boxes)
    print(f'✅ CACHE EXPORT SUCCESSFUL: {len(boxes)} frames saved to {output_path}')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--video', type=str, required=True, help='Path to Base-vedio.mp4')
    parser.add_argument('--output', type=str, default='Base-vedio.npy', help='Output cache path')
    parser.add_argument('--batch_size', type=int, default=2, help='Batch size for detection')
    parser.add_argument('--nosmooth', action='store_true', help='Disable smoothing')
    args = parser.parse_args()
    
    precompute_face_boxes(args.video, args.output, batch_size=args.batch_size, nosmooth=args.nosmooth)
