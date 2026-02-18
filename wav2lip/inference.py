from os import listdir, path
import numpy as np
import scipy, cv2, os, sys, argparse, audio
import json, subprocess, random, string
from tqdm import tqdm
from glob import glob
import torch, face_detection
from models import Wav2Lip
import platform

# GFPGAN Integration & Compatibility Patch
try:
	import torchvision.transforms.functional as F
	import torchvision.transforms as T
	import sys

	# Monkey-patch for basicsr (dependency of GFPGAN) which fails on newer torchvision
	if not hasattr(T, 'functional_tensor'):
		# Create a virtual module if it's missing
		from types import ModuleType
		mock_module = ModuleType('torchvision.transforms.functional_tensor')
		# Copy all functions from functional to the mock module
		for attr in dir(F):
			if not attr.startswith('__'):
				setattr(mock_module, attr, getattr(F, attr))
		sys.modules['torchvision.transforms.functional_tensor'] = mock_module
		T.functional_tensor = mock_module
		print("🔧 Applied torchvision.transforms.functional_tensor monkey-patch for GFPGAN.")

	import basicsr
	from gfpgan import GFPGANer
	HAS_GFPGAN = True
except ImportError as e:
	print(f"⚠️ GFPGAN Import Warning: {e}")
	HAS_GFPGAN = False
except Exception as e:
	print(f"⚠️ GFPGAN Initialization Warning: {e}")
	HAS_GFPGAN = False

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

# GFPGAN Arguments
parser.add_argument('--restorer', type=str, default=None,
					help='Face restorer name (e.g., gfpgan)')
parser.add_argument('--restorer_path', type=str, default=None,
					help='Path to restorer model weights')
parser.add_argument('--skip_gfpgan', action='store_true',
					help='Skip restoration even if restorer is specified (useful for debugging)')

# Performance & Stability Arguments
parser.add_argument('--nosmooth', default=False, action='store_true',
					help='Prevent smoothing face detections over a short temporal window')

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

def face_detect(images, detector=None):
	if detector is None:
		print("Initializing face detector...")
		detector = face_detection.FaceAlignment(face_detection.LandmarksType._2D, 
												flip_input=False, device=device)

	# Memory-Safe Downscaling for detection (Internal)
	# Detection doesn't need high res. 360p is plenty.
	detection_images = []
	scale_factors = []
	for img in images:
		h, w = img.shape[:2]
		max_dim = 360
		if h > max_dim or w > max_dim:
			scale = max_dim / float(max(h, w))
			img_small = cv2.resize(img, (int(w * scale), int(h * scale)))
			detection_images.append(img_small)
			scale_factors.append(scale)
		else:
			detection_images.append(img)
			scale_factors.append(1.0)

	batch_size = args.face_det_batch_size
	
	while 1:
		predictions = []
		try:
			for i in range(0, len(detection_images), batch_size):
				predictions.extend(detector.get_detections_for_batch(np.array(detection_images[i:i + batch_size])))
		except RuntimeError:
			if batch_size == 1: 
				raise RuntimeError('Image too big for detection even with downscaling.')
			batch_size //= 2
			print('Recovering from OOM error; New batch size: {}'.format(batch_size))
			continue
		break

	results = []
	pady1, pady2, padx1, padx2 = args.pads
	for rect, image, scale in zip(predictions, images, scale_factors):
		if rect is None:
			cv2.imwrite('temp/faulty_frame.jpg', image)
			raise ValueError('Face not detected! Ensure the video contains a face in all the frames.')

		# Scale coordinates back to original size
		y1 = max(0, int(rect[1] / scale) - pady1)
		y2 = min(image.shape[0], int(rect[3] / scale) + pady2)
		x1 = max(0, int(rect[0] / scale) - padx1)
		x2 = min(image.shape[1], int(rect[2] / scale) + padx2)
		
		results.append([x1, y1, x2, y2])

	boxes = np.array(results)
	if not args.nosmooth: boxes = get_smoothened_boxes(boxes, T=5) # ONLY return coordinates relative to the ORIGINAL frames passed in
	
	results = [(y1, y2, x1, x2) for (x1, y1, x2, y2) in boxes]
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
		
		# face_det_results now only contains coordinates
		coords = face_det_results[idx]
		y1, y2, x1, x2 = coords
		face = frame_to_save[y1:y2, x1:x2]

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
# Detect device: Use CUDA if available, unless forced to CPU
device = 'cuda' if torch.cuda.is_available() and os.environ.get('FORCE_CPU') != 'true' else 'cpu'
print('Using {} for inference.'.format(device))

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
		full_frames = None # Ensure it is defined for streaming mode

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
			print('Checking video availability (Streaming mode enabled)...')
			# Just count frames without loading them all into RAM
			num_frames = int(video_stream.get(cv2.CAP_PROP_FRAME_COUNT))
			if num_frames == 0:
				# Fallback if metadata is missing
				while video_stream.grab(): num_frames += 1
				video_stream.set(cv2.CAP_PROP_POS_FRAMES, 0)
			print(f"Video has {num_frames} frames.")
			full_frames = None # Use None to signal streaming mode

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

	# Initialize Restorer
	restorer = None
	if args.restorer == 'gfpgan' and not args.skip_gfpgan:
		if not HAS_GFPGAN:
			print("❌ Error: gfpgan package not installed. Skipping restoration.")
		elif not args.restorer_path or not os.path.exists(args.restorer_path):
			print(f"❌ Error: Restorer path {args.restorer_path} not found. Skipping restoration.")
		else:
			print(f"✨ Initializing GFPGAN Restorer with weights: {args.restorer_path}")
			restorer = GFPGANer(
				model_path=args.restorer_path,
				upscale=1,
				arch='clean',
				channel_multiplier=2,
				device=device
			)

	video_stream.set(cv2.CAP_PROP_POS_FRAMES, 0)
	
	# Prepare video writer
	# We need the first frame's shape to initialize the writer
	ret, first_frame = video_stream.read()
	if not ret: raise ValueError("Could not read first frame")
	video_stream.set(cv2.CAP_PROP_POS_FRAMES, 0)

	if args.resize_factor > 1:
		first_frame = cv2.resize(first_frame, (first_frame.shape[1]//args.resize_factor, first_frame.shape[0]//args.resize_factor))
	y1, y2, x1, x2 = args.crop
	if x2 == -1: x2 = first_frame.shape[1]
	if y2 == -1: y2 = first_frame.shape[0]
	first_frame = first_frame[y1:y2, x1:x2]
	frame_h, frame_w = first_frame.shape[:-1]
		
	out = cv2.VideoWriter('temp/result.avi', 
							cv2.VideoWriter_fourcc(*'DIVX'), fps, (frame_w, frame_h))

	# Pre-compute face boxes if not using cache and not using static image
	face_det_results = None
	if not args.face_det_results and args.box[0] == -1:
		print('✨ Run: Automatic face detection (Streaming mode)...')
		video_stream.set(cv2.CAP_PROP_POS_FRAMES, 0)
		
		detector = face_detection.FaceAlignment(face_detection.LandmarksType._2D, 
												flip_input=False, device=device)
		
		# Process in smaller chunks to keep RAM low
		all_coords = []
		chunk_size = 64 # Further reduced chunk size for high-res safety
		for chunk_start in tqdm(range(0, num_frames, chunk_size), desc="Detecting Faces"):
			detection_frames = []
			for _ in range(min(chunk_size, num_frames - chunk_start)):
				ret, f = video_stream.read()
				if not ret: break
				
				# Optimization: Resize for detection only
				# We keep 'f' for detection but don't hold full res in memory if possible
				if args.resize_factor > 1:
					f = cv2.resize(f, (f.shape[1]//args.resize_factor, f.shape[0]//args.resize_factor))
				if args.rotate:
					f = cv2.rotate(f, cv2.ROTATE_90_CLOCKWISE)
				
				y1_c, y2_c, x1_c, x2_c = args.crop
				if x2_c == -1: x2_c = f.shape[1]
				if y2_c == -1: y2_c = f.shape[0]
				f = f[y1_c:y2_c, x1_c:x2_c]
				
				# Keep it FULL RES for detection_frames so face_detect 
				# can return coordinates valid for the original frame
				detection_frames.append(f)
			
			if detection_frames:
				chunk_coords = face_detect(detection_frames, detector=detector)
				all_coords.extend(chunk_coords)
				del detection_frames
		
		face_det_results = all_coords
		del detector # Cleanup detector from GPU
		video_stream.set(cv2.CAP_PROP_POS_FRAMES, 0)

	# Streaming implementation for OOM safety
	for i in tqdm(range(0, num_frames_needed, batch_size)):
		# 1. Prepare batch data
		img_batch, mel_batch, frames, coords = [], [], [], []
		
		current_batch_end = min(i + batch_size, num_frames_needed)
		for j in range(i, current_batch_end):
			# Get frame
			if full_frames is None:
				ret, f = video_stream.read()
				if not ret:
					# End of video reached; if we still need frames, loop back to the start
					video_stream.set(cv2.CAP_PROP_POS_FRAMES, 0)
					ret, f = video_stream.read()
					if not ret: break # Should not happen unless video is corrupted
				
				# Apply transforms
				if args.resize_factor > 1:
					f = cv2.resize(f, (f.shape[1]//args.resize_factor, f.shape[0]//args.resize_factor))
				if args.rotate:
					f = cv2.rotate(f, cv2.ROTATE_90_CLOCKWISE)
				
				y1, y2, x1, x2 = args.crop
				if x2 == -1: x2 = f.shape[1]
				if y2 == -1: y2 = f.shape[0]
				f = f[y1:y2, x1:x2]
			else:
				# Use j % len(full_frames) to support video looping or single-frame static images
				idx = j % len(full_frames)
				f = full_frames[idx].copy()
			
			# Get face coords
			if args.face_det_results:
				# Use cached boxes
				c = cached_boxes[j % len(cached_boxes)]
				x1, y1, x2, y2 = map(int, c)
				y1 = max(0, y1); y2 = min(f.shape[0], y2)
				x1 = max(0, x1); x2 = min(f.shape[1], x2)
				face = f[y1:y2, x1:x2]
				coords_final = (y1, y2, x1, x2)
			elif face_det_results is not None:
				# Use results from automatic detection (stored as coords)
				coords_final = face_det_results[j % len(face_det_results)]
				y1, y2, x1, x2 = coords_final
				face = f[y1:y2, x1:x2]
			elif args.box[0] != -1:
				y1, y2, x1, x2 = args.box
				face = f[y1:y2, x1:x2]
				coords_final = (y1, y2, x1, x2)
			else:
				# Fallback to center crop
				h, w = f.shape[:2]
				face = f[h//4:h//2, w//4:w//2]
				coords_final = (h//4, h//2, w//4, w//2)
			
			# Convert face to RGB for the model
			face_rgb = cv2.cvtColor(face, cv2.COLOR_BGR2RGB)
			face_rgb = cv2.resize(face_rgb, (args.img_size, args.img_size))
			
			img_batch.append(face_rgb)
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
			
			# Wav2Lip output is RGB (from the model), result frame 'f' is BGR (OpenCV)
			# We MUST convert back to BGR to avoid the "blue color filter" look
			p_bgr = cv2.cvtColor(p, cv2.COLOR_RGB2BGR)
			
			if restorer is not None:
				try:
					# Paste the BGR patch into a copy for restoration
					f_copy = f.copy()
					f_copy[y1:y2, x1:x2] = p_bgr
					
					# Enhance with GFPGAN (this creates a seamless face)
					_, _, restored_img = restorer.enhance(f_copy, has_aligned=False, only_center_face=False, paste_back=True)
					if restored_img is not None:
						f = restored_img
					else:
						# Fallback if restoration fails
						f[y1:y2, x1:x2] = p_bgr
				except Exception as e:
					print(f"⚠️ Restoration failed for a frame: {e}. Falling back to standard sync.")
					f[y1:y2, x1:x2] = p_bgr
			else:
				# Standard mode (no restorer)
				f[y1:y2, x1:x2] = p_bgr

			out.write(f)

	out.release()
	video_stream.release()
	
	# Ensure output directory exists for outfile
	out_dir = os.path.dirname(args.outfile)
	if out_dir != '' and not os.path.exists(out_dir):
		os.makedirs(out_dir)

	command = 'ffmpeg -y -i "{}" -i "{}" -strict -2 -q:v 1 "{}"'.format(args.audio, 'temp/result.avi', args.outfile)
	subprocess.check_call(command, shell=True)

if __name__ == '__main__':
	main()
