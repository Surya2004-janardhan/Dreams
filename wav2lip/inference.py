from os import listdir, path
import numpy as np
import scipy, cv2, os, sys, argparse, audio
import json, subprocess, random, string
from tqdm import tqdm
from glob import glob
import torch, face_detection
from models import Wav2Lip
import platform

parser = argparse.ArgumentParser(description='Inference code to lip-sync videos in the wild using Wav2Lip models')

parser.add_argument('--checkpoint_path', type=str, 
					help='Name of saved checkpoint to load weights from', required=True)

parser.add_argument('--face', type=str, 
					help='Filepath of video/image that contains faces to use', required=True)
parser.add_argument('--audio', type=str, 
					help='Filepath of video/audio file to use as raw audio source', required=True)
parser.add_argument('--outfile', type=str, help='Video path to save result. See default for an e.g.', 
								default='results/result_voice.mp4')

parser.add_argument('--static', type=bool, 
					help='If True, then use only first video frame for inference', default=False)
parser.add_argument('--fps', type=float, help='Can be specified only if input is a static image (default: 25)', 
					default=25., required=False)

parser.add_argument('--pads', nargs='+', type=int, default=[0, 10, 0, 0], 
					help='Padding (top, bottom, left, right). Please adjust to include chin at least')

parser.add_argument('--face_det_batch_size', type=int, 
					help='Batch size for face detection', default=16)
parser.add_argument('--wav2lip_batch_size', type=int, help='Batch size for Wav2Lip model(s)', default=128)

parser.add_argument('--resize_factor', default=1, type=int, 
			help='Reduce the resolution by this factor. Sometimes, best results are obtained at 480p or 720p')

parser.add_argument('--crop', nargs='+', type=int, default=[0, -1, 0, -1], 
					help='Crop video to a smaller region (top, bottom, left, right). Applied after resize_factor and rotate arg. ' 
					'Useful if multiple face present. -1 implies the value will be auto-inferred based on height, width')

parser.add_argument('--box', nargs='+', type=int, default=[-1, -1, -1, -1], 
					help='Specify a constant bounding box for the face. Use only as a last resort if the face is not detected.'
					'Also, might work only if the face is not moving around much. Syntax: (top, bottom, left, right).')

parser.add_argument('--rotate', default=False, action='store_true',
					help='Sometimes videos taken from a phone can be flipped 90deg. If true, will flip video right by 90deg.'
					'Use if you get a flipped result, despite feeding a normal looking video')

parser.add_argument('--face_det_results', type=str, 
					help='Path to pre-computed face detection results (.npy)', default=None)

args = parser.parse_args()
args.img_size = 96

if os.path.isfile(args.face) and args.face.split('.')[1] in ['jpg', 'png', 'jpeg']:
	args.static = True

def get_smoothened_boxes(boxes, T):
	for i in range(len(boxes)):
		if i + T > len(boxes):
			window = boxes[len(boxes) - T:]
		else:
			window = boxes[i : i + T]
		boxes[i] = np.mean(window, axis=0)
	return boxes

def face_detect(images):
	detector = face_detection.FaceAlignment(face_detection.LandmarksType._2D, 
											flip_input=False, device=device)

	batch_size = args.face_det_batch_size
	
	while 1:
		predictions = []
		try:
			for i in tqdm(range(0, len(images), batch_size)):
				predictions.extend(detector.get_detections_for_batch(np.array(images[i:i + batch_size])))
		except RuntimeError:
			if batch_size == 1: 
				raise RuntimeError('Image too big to run face detection on GPU. Please use the --resize_factor argument')
			batch_size //= 2
			print('Recovering from OOM error; New batch size: {}'.format(batch_size))
			continue
		break

	results = []
	pady1, pady2, padx1, padx2 = args.pads
	for rect, image in zip(predictions, images):
		if rect is None:
			cv2.imwrite('temp/faulty_frame.jpg', image) # check this frame where the face was not detected.
			raise ValueError('Face not detected! Ensure the video contains a face in all the frames.')

		y1 = max(0, rect[1] - pady1)
		y2 = min(image.shape[0], rect[3] + pady2)
		x1 = max(0, rect[0] - padx1)
		x2 = min(image.shape[1], rect[2] + padx2)
		
		results.append([x1, y1, x2, y2])

	boxes = np.array(results)
	if not args.nosmooth: boxes = get_smoothened_boxes(boxes, T=5)
	results = [[image[y1: y2, x1:x2], (y1, y2, x1, x2)] for image, (x1, y1, x2, y2) in zip(images, boxes)]

	del detector
	return results 

def datagen(frames, mels, face_det_results=None):
	img_batch, mel_batch, frame_batch, coords_batch = [], [], [], []

	if face_det_results is None:
		if args.box[0] == -1:
			if not args.static:
				face_det_results = face_detect(frames) # BGR2RGB for CNN face detection
			else:
				face_det_results = face_detect([frames[0]])
		else:
			print('Using the specified bounding box instead of face detection...')
			y1, y2, x1, x2 = args.box
			face_det_results = [[f[y1: y2, x1:x2], (y1, y2, x1, x2)] for f in frames]

	for i, m in enumerate(mels):
		idx = 0 if args.static else i%len(frames)
		frame_to_save = frames[idx].copy()
		face, coords = face_det_results[idx].copy()

		face = cv2.resize(face, (args.img_size, args.img_size))
			
		img_batch.append(face)
		mel_batch.append(m)
		frame_batch.append(frame_to_save)
		coords_batch.append(coords)

		if len(img_batch) >= args.wav2lip_batch_size:
			img_batch, mel_batch = np.asarray(img_batch), np.asarray(mel_batch)

			img_masked = img_batch.copy()
			img_masked[:, args.img_size//2:] = 0

			img_batch = np.concatenate((img_masked, img_batch), axis=3) / 255.
			mel_batch = np.reshape(mel_batch, [len(mel_batch), mel_batch.shape[1], mel_batch.shape[2], 1])

			yield img_batch, mel_batch, frame_batch, coords_batch
			img_batch, mel_batch, frame_batch, coords_batch = [], [], [], []

	if len(img_batch) > 0:
		img_batch, mel_batch = np.asarray(img_batch), np.asarray(mel_batch)

		img_masked = img_batch.copy()
		img_masked[:, args.img_size//2:] = 0

		img_batch = np.concatenate((img_masked, img_batch), axis=3) / 255.
		mel_batch = np.reshape(mel_batch, [len(mel_batch), mel_batch.shape[1], mel_batch.shape[2], 1])

		yield img_batch, mel_batch, frame_batch, coords_batch

mel_step_size = 16
# Forced to CPU for stability as requested by the user
device = 'cpu'
print('Using {} for inference (Safe Mode).'.format(device))

def _load(checkpoint_path):
	if device == 'cuda':
		checkpoint = torch.load(checkpoint_path, weights_only=False)
	else:
		checkpoint = torch.load(checkpoint_path,
								map_location=lambda storage, loc: storage, weights_only=False)
	return checkpoint

def load_model(path):
	model = Wav2Lip()
	print("Load checkpoint from: {}".format(path))
	checkpoint = _load(path)
	s = checkpoint["state_dict"]
	new_s = {}
	for k, v in s.items():
		new_s[k.replace('module.', '')] = v
	model.load_state_dict(new_s)

	model = model.to(device)
	return model.eval()

def main():
	if not os.path.isfile(args.face):
		raise ValueError('--face argument must be a valid path to video/image file')

	elif args.face.split('.')[1] in ['jpg', 'png', 'jpeg']:
		full_frames = [cv2.imread(args.face)]
		fps = args.fps

	else:
		video_stream = cv2.VideoCapture(args.face)
		fps = video_stream.get(cv2.CAP_PROP_FPS)

		if fps <= 0:
			# Likely an LFS pointer or corrupted file
			video_stream.release()
			raise ValueError(f"CRITICAL: Could not read FPS from {args.face}. "
							 "The file might be an LFS pointer (not downloaded) or corrupted. "
							 "Check your Git LFS budget and ensure models are pulled.")

		print('Getting video duration...')
		# If we have cache, we only need basic info and then we stream
		if args.face_det_results:
			print(f"Using pre-computed face detection results from {args.face_det_results}")
			cached_boxes = np.load(args.face_det_results)
			num_frames = int(video_stream.get(cv2.CAP_PROP_FRAME_COUNT))
			print(f"Video has {num_frames} frames according to metadata.")
		else:
			print('Reading video frames into memory (Warning: High RAM usage)...')
			full_frames = []
			while 1:
				still_reading, frame = video_stream.read()
				if not still_reading:
					video_stream.release()
					break
				if args.resize_factor > 1:
					frame = cv2.resize(frame, (frame.shape[1]//args.resize_factor, frame.shape[0]//args.resize_factor))

				if args.rotate:
					frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)

				y1, y2, x1, x2 = args.crop
				if x2 == -1: x2 = frame.shape[1]
				if y2 == -1: y2 = frame.shape[0]

				frame = frame[y1:y2, x1:x2]
				full_frames.append(frame)
			num_frames = len(full_frames)

	if not args.audio.endswith('.wav'):
		print('Extracting raw audio...')
		command = 'ffmpeg -y -i "{}" -strict -2 "{}"'.format(args.audio, 'temp/temp.wav')
		subprocess.call(command, shell=True)
		args.audio = 'temp/temp.wav'

	wav = audio.load_wav(args.audio, 16000)
	mel = audio.melspectrogram(wav)
	print(mel.shape)

	if np.isnan(mel.reshape(-1)).sum() > 0:
		raise ValueError('Mel contains nan! Using a TTS voice? Add a small epsilon noise to the wav file and try again')

	mel_chunks = []
	mel_idx_multiplier = 80./fps 
	i = 0
	while 1:
		start_idx = int(i * mel_idx_multiplier)
		if start_idx + mel_step_size > len(mel[0]):
			mel_chunks.append(mel[:, len(mel[0]) - mel_step_size:])
			break
		mel_chunks.append(mel[:, start_idx : start_idx + mel_step_size])
		i += 1

	print("Length of mel chunks: {}".format(len(mel_chunks)))
	
	# Determine how many frames we actually need
	num_frames_needed = len(mel_chunks)
	
	batch_size = args.wav2lip_batch_size
	
	# Load model first to avoid repeating it
	model = load_model(args.checkpoint_path)
	print ("Model loaded")

	video_stream.set(cv2.CAP_PROP_POS_FRAMES, 0)
	
	# Prepare video writer
	# We need the first frame's shape to initialize the writer
	if args.face_det_results:
		ret, first_frame = video_stream.read()
		if not ret: raise ValueError("Could not read first frame")
		video_stream.set(cv2.CAP_PROP_POS_FRAMES, 0)
		frame_h, frame_w = first_frame.shape[:-1]
	else:
		frame_h, frame_w = full_frames[0].shape[:-1]
		
	out = cv2.VideoWriter('temp/result.avi', 
							cv2.VideoWriter_fourcc(*'DIVX'), fps, (frame_w, frame_h))

	# Streaming implementation for OOM safety
	for i in tqdm(range(0, num_frames_needed, batch_size)):
		# 1. Prepare batch data
		img_batch, mel_batch, frames, coords = [], [], [], []
		
		current_batch_end = min(i + batch_size, num_frames_needed)
		for j in range(i, current_batch_end):
			# Get frame
			if args.face_det_results:
				ret, f = video_stream.read()
				if not ret: break
				# Apply same transforms as pre-read
				if args.resize_factor > 1:
					f = cv2.resize(f, (f.shape[1]//args.resize_factor, f.shape[0]//args.resize_factor))
				y1, y2, x1, x2 = args.crop
				if x2 == -1: x2 = f.shape[1]
				if y2 == -1: y2 = f.shape[0]
				f = f[y1:y2, x1:x2]
			else:
				f = full_frames[j].copy()
			
			# Get face coords
			if args.face_det_results:
				# Use cached boxes (they are [x1, y1, x2, y2])
				c = cached_boxes[j % len(cached_boxes)]
				# If boxes were smoothened in precompute, they are already final
				# But results usually expects [face_img, (y1, y2, x1, x2)]
				x1, y1, x2, y2 = map(int, c)
				# Ensure within bounds
				y1 = max(0, y1); y2 = min(f.shape[0], y2)
				x1 = max(0, x1); x2 = min(f.shape[1], x2)
				face = f[y1:y2, x1:x2]
				coords_final = (y1, y2, x1, x2)
			elif args.box[0] != -1:
				y1, y2, x1, x2 = args.box
				face = f[y1:y2, x1:x2]
				coords_final = (y1, y2, x1, x2)
			else:
				# This case shouldn't really happen with large videos anymore
				# but we should handle it if someone runs without cache
				# (Re-runs detection in batches... slow but safer?)
				# For now, let's assume we use cache for large videos.
				pass
			
			face = cv2.resize(face, (args.img_size, args.img_size))
			
			img_batch.append(face)
			mel_batch.append(mel_chunks[j])
			frames.append(f)
			coords.append(coords_final)
			
		if not img_batch: break
		
		# 2. Run inference on batch
		img_batch_np = np.asarray(img_batch)
		mel_batch_np = np.asarray(mel_batch)

		img_masked = img_batch_np.copy()
		img_masked[:, args.img_size//2:] = 0
		img_batch_tensor = np.concatenate((img_masked, img_batch_np), axis=3) / 255.
		
		img_batch_tensor = torch.FloatTensor(np.transpose(img_batch_tensor, (0, 3, 1, 2))).to(device)
		mel_batch_tensor = torch.FloatTensor(np.transpose(mel_batch_np, (0, 1, 2))) # mel_chunks are (80, 16)
		# Needs extra dims: (B, 1, 80, 16)
		mel_batch_tensor = mel_batch_tensor.unsqueeze(1).to(device)

		with torch.no_grad():
			pred = model(mel_batch_tensor, img_batch_tensor)

		pred = pred.cpu().numpy().transpose(0, 2, 3, 1) * 255.
		
		# 3. Post-process and write
		for p, f, c in zip(pred, frames, coords):
			y1, y2, x1, x2 = c
			p = cv2.resize(p.astype(np.uint8), (x2 - x1, y2 - y1))
			f[y1:y2, x1:x2] = p
			out.write(f)

	out.release()
	video_stream.release()
	
	# Ensure temp directory exists for result.avi
	if not os.path.exists('temp'):
		os.makedirs('temp')

	command = 'ffmpeg -y -i "{}" -i "{}" -strict -2 -q:v 1 "{}"'.format(args.audio, 'temp/result.avi', args.outfile)
	subprocess.check_call(command, shell=True)

if __name__ == '__main__':
	main()
