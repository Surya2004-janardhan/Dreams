"""
PyTorch backend implementation for TTS and STT.
"""

from typing import Optional, List, Tuple
import asyncio
import torch
import numpy as np
import re
import unicodedata
import time
from pathlib import Path

from . import TTSBackend, STTBackend
from ..utils.cache import get_cache_key, get_cached_voice_prompt, cache_voice_prompt
from ..utils.audio import normalize_audio, load_audio
from ..utils.progress import get_progress_manager
from ..utils.hf_progress import HFProgressTracker, create_hf_progress_callback
from ..utils.tasks import get_task_manager
from ..config import get_models_dir


class PyTorchTTSBackend:
    """PyTorch-based TTS backend using Qwen3-TTS."""
    
    def __init__(self, model_size: str = "0.6B"):
        self.model = None
        self.model_size = model_size
        self.device = self._get_device()
        self._current_model_size = None
    
    def _get_device(self) -> str:
        """Get the best available device with manual override support."""
        import os
        if os.getenv("FORCE_CPU", "false").lower() == "true":
            print("ℹ️ FORCE_CPU=true detected. Skipping GPU.")
            self._apply_cpu_optimizations()
            return "cpu"

        if torch.cuda.is_available():
            # Basic sanity check
            try:
                torch.zeros(1).cuda()
                return "cuda"
            except Exception:
                print("⚠️ CUDA available but unusable. Falling back to CPU.")

        self._apply_cpu_optimizations()
        return "cpu"

    def _apply_cpu_optimizations(self):
        """Enable multi-core threading for CPU inference."""
        try:
            import os
            cpu_count = os.cpu_count() or 1
            threads = max(1, min(cpu_count, 8))
            torch.set_num_threads(threads)
            print(f"🚀 CPU Optimization: Using {threads} threads for inference.")
        except Exception:
            pass
    
    def is_loaded(self) -> bool:
        """Check if model is loaded."""
        return self.model is not None
    
    def _get_model_path(self, model_size: str) -> str:
        """
        Get the local path or HuggingFace Hub model ID.
        
        Args:
            model_size: Model size (1.7B or 0.6B)
            
        Returns:
            Local path if found, otherwise HuggingFace Hub model ID
        """
        local_name = f"Qwen3-TTS-12Hz-{model_size}-Base"
        local_path = get_models_dir() / local_name
        
        if local_path.exists():
            print(f"Found local TTS model at: {local_path}")
            return str(local_path.absolute())

        hf_model_map = {
            "1.7B": "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
            "0.6B": "Qwen/Qwen3-TTS-12Hz-0.6B-Base",
        }
        
        if model_size not in hf_model_map:
            raise ValueError(f"Unknown model size: {model_size}")
        
        return hf_model_map[model_size]
    
    def _is_model_cached(self, model_size: str) -> bool:
        """
        Check if the model is already cached locally AND fully downloaded.
        
        Args:
            model_size: Model size to check
            
        Returns:
            True if model is fully cached, False if missing or incomplete
        """
        try:
            from huggingface_hub import constants as hf_constants
            model_path = self._get_model_path(model_size)
            repo_cache = Path(hf_constants.HF_HUB_CACHE) / ("models--" + model_path.replace("/", "--"))
            
            if not repo_cache.exists():
                return False
            
            # Check for .incomplete files - if any exist, download is still in progress
            blobs_dir = repo_cache / "blobs"
            if blobs_dir.exists() and any(blobs_dir.glob("*.incomplete")):
                print(f"[_is_model_cached] Found .incomplete files for {model_size}, treating as not cached")
                return False
            
            # Check that actual model weight files exist in snapshots
            snapshots_dir = repo_cache / "snapshots"
            if snapshots_dir.exists():
                has_weights = (
                    any(snapshots_dir.rglob("*.safetensors")) or
                    any(snapshots_dir.rglob("*.bin"))
                )
                if not has_weights:
                    print(f"[_is_model_cached] No model weights found for {model_size}, treating as not cached")
                    return False
            
            return True
        except Exception as e:
            print(f"[_is_model_cached] Error checking cache for {model_size}: {e}")
            return False
    
    async def load_model_async(self, model_size: Optional[str] = None):
        """
        Lazy load the TTS model with automatic downloading from HuggingFace Hub.
        
        Args:
            model_size: Model size to load (1.7B or 0.6B)
        """
        if model_size is None:
            model_size = self.model_size
            
        # If already loaded with correct size, return
        if self.model is not None and self._current_model_size == model_size:
            return
        
        # Unload existing model if different size requested
        if self.model is not None and self._current_model_size != model_size:
            self.unload_model()
        
        # Run blocking load in thread pool
        await asyncio.to_thread(self._load_model_sync, model_size)
    
    # Alias for compatibility
    load_model = load_model_async
    
    def _load_model_sync(self, model_size: str):
        """Synchronous model loading."""
        try:
            progress_manager = get_progress_manager()
            task_manager = get_task_manager()
            model_name = f"qwen-tts-{model_size}"

            # Check if model is already cached
            is_cached = self._is_model_cached(model_size)

            # Set up progress callback and tracker
            # If cached: filter out non-download progress (like "Segment 1/1" during generation)
            # If not cached: report all progress (we're actually downloading)
            progress_callback = create_hf_progress_callback(model_name, progress_manager)
            tracker = HFProgressTracker(progress_callback, filter_non_downloads=is_cached)

            # Patch tqdm BEFORE importing qwen_tts
            tracker_context = tracker.patch_download()
            tracker_context.__enter__()

            # Import qwen_tts
            from qwen_tts import Qwen3TTSModel

            # Get model path (local or HuggingFace Hub ID)
            model_path = self._get_model_path(model_size)

            print(f"Loading TTS model {model_size} on {self.device}...")

            # Only track download progress if model is NOT cached
            if not is_cached:
                # Start tracking download task
                task_manager.start_download(model_name)

                # Initialize progress state so SSE endpoint has initial data to send
                progress_manager.update_progress(
                    model_name=model_name,
                    current=0,
                    total=0,  # Will be updated once actual total is known
                    filename="Connecting to HuggingFace...",
                    status="downloading",
                )

            # Load the model
            try:
                import os
                is_workflow = os.getenv("GITHUB_ACTIONS") == "true"

                # Precision Selection
                if self.device == "cuda":
                    if is_workflow:
                        # Keep original logic for cloud runners
                        load_dtype = torch.bfloat16
                        print("💎 Workflow: Using original bfloat16 precision.")
                    else:
                        # Optimized for Local Stability
                        # float16 was crashing on RTX 2050; using float32 for stability.
                        load_dtype = torch.float32
                        print("⚡ Local GPU: Using float32 for maximum stability.")
                else:
                    load_dtype = torch.float32
                    print(f"💻 Device: {self.device} | Precision: float32")

                print(f"Loading {model_size} model on {self.device}...")
                
                self.model = Qwen3TTSModel.from_pretrained(
                    model_path,
                    device_map=self.device,
                    torch_dtype=load_dtype,
                )
                print(f"Loaded {model_size} model successfully")
            finally:
                # Exit the patch context
                tracker_context.__exit__(None, None, None)
            
            # Only mark download as complete if we were tracking it
            if not is_cached:
                progress_manager.mark_complete(model_name)
                task_manager.complete_download(model_name)
            
            self._current_model_size = model_size
            self.model_size = model_size
            
            print(f"TTS model {model_size} loaded successfully")
            
        except ImportError as e:
            print(f"Error: qwen_tts package not found. Install with: pip install git+https://github.com/QwenLM/Qwen3-TTS.git")
            progress_manager = get_progress_manager()
            task_manager = get_task_manager()
            model_name = f"qwen-tts-{model_size}"
            progress_manager.mark_error(model_name, str(e))
            task_manager.error_download(model_name, str(e))
            raise
        except Exception as e:
            print(f"Error loading TTS model: {e}")
            print(f"Tip: The model will be automatically downloaded from HuggingFace Hub on first use.")
            progress_manager = get_progress_manager()
            task_manager = get_task_manager()
            model_name = f"qwen-tts-{model_size}"
            progress_manager.mark_error(model_name, str(e))
            task_manager.error_download(model_name, str(e))
            raise
    
    def unload_model(self):
        """Unload the model to free memory."""
        if self.model is not None:
            del self.model
            self.model = None
            self._current_model_size = None
            
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            
            print("TTS model unloaded")
    
    async def create_voice_prompt(
        self,
        audio_path: str,
        reference_text: str,
        use_cache: bool = True,
    ) -> Tuple[dict, bool]:
        """
        Create voice prompt from reference audio.
        
        Args:
            audio_path: Path to reference audio file
            reference_text: Transcript of reference audio
            use_cache: Whether to use cached prompt if available
            
        Returns:
            Tuple of (voice_prompt_dict, was_cached)
        """
        await self.load_model_async(None)
        
        # Check cache if enabled
        if use_cache:
            cache_key = get_cache_key(audio_path, reference_text)
            cached_prompt = get_cached_voice_prompt(cache_key)
            if cached_prompt is not None:
                # Cache stores as torch.Tensor but actual prompt is dict
                # Convert if needed
                if isinstance(cached_prompt, dict):
                    # For PyTorch backend, the dict should contain tensors, not file paths
                    # So we can safely return it
                    return cached_prompt, True
                elif isinstance(cached_prompt, torch.Tensor):
                    # Legacy cache format - convert to dict
                    # This shouldn't happen in practice, but handle it
                    return {"prompt": cached_prompt}, True
        
        def _create_prompt_sync():
            """Run synchronous voice prompt creation in thread pool."""
            return self.model.create_voice_clone_prompt(
                ref_audio=str(audio_path),
                ref_text=reference_text,
                x_vector_only_mode=False,
            )
        
        # Run blocking operation in thread pool
        voice_prompt_items = await asyncio.to_thread(_create_prompt_sync)
        
        # Cache if enabled
        if use_cache:
            cache_key = get_cache_key(audio_path, reference_text)
            cache_voice_prompt(cache_key, voice_prompt_items)
        
        return voice_prompt_items, False
    
    async def combine_voice_prompts(
        self,
        audio_paths: List[str],
        reference_texts: List[str],
    ) -> Tuple[np.ndarray, str]:
        """
        Combine multiple reference samples for better quality.
        
        Args:
            audio_paths: List of audio file paths
            reference_texts: List of reference texts
            
        Returns:
            Tuple of (combined_audio, combined_text)
        """
        combined_audio = []
        
        for audio_path in audio_paths:
            audio, sr = load_audio(audio_path)
            audio = normalize_audio(audio)
            combined_audio.append(audio)
        
        # Concatenate audio
        mixed = np.concatenate(combined_audio)
        mixed = normalize_audio(mixed)
        
        # Combine texts
        combined_text = " ".join(reference_texts)
        
        return mixed, combined_text
    
    async def generate(
        self,
        text: str,
        voice_prompt: dict,
        language: str = "en",
        seed: Optional[int] = None,
        speed: float = 1.0,
        instruct: Optional[str] = None,
    ) -> Tuple[np.ndarray, int]:
        """
        Generate speech using the loaded model in a single pass.
        """
        await self.load_model_async(None)
        
        import time
        import re
        import unicodedata
        
        start_time = time.time()
        print("\n" + "="*50)
        print("STARTING VOICEBOX GENERATION (SINGLE PASS)")
        print(f"TEXT: '{text[:100]}{'...' if len(text) > 100 else ''}'")
        print(f"LENGTH: {len(text)} characters")
        print(f"LANGUAGE: {language}, SPEED: {speed}")
        
        # Aggressive text cleaning for stability
        cleaned_text = "".join(ch for ch in text if unicodedata.category(ch)[0] != 'C')
        cleaned_text = re.sub(r'([.!?])\1+', r'\1', cleaned_text) # Collapse repeated punctuation
        cleaned_text = cleaned_text.replace("—", " ").replace("–", " ").replace('"', '').replace("'", "").replace("*", "")
        cleaned_text = " ".join(cleaned_text.split()) # Normalize whitespace
        
        print(f"CLEANED TEXT: '{cleaned_text[:100]}...'")

        if seed is not None:
            torch.manual_seed(seed)
            print(f"SEED: {seed}")

        # Log Voice Prompt details
        if isinstance(voice_prompt, dict):
            print("VOICE PROMPT DETAILS:")
            for k, v in voice_prompt.items():
                if isinstance(v, torch.Tensor):
                    print(f"  - {k}: shape={list(v.shape)}, dtype={v.dtype}, device={v.device}")
                    # Check for NaNs
                    if torch.isnan(v).any():
                        print(f"    WARNING: NaNs detected in {k}. Zeroing them.")
                        v[torch.isnan(v)] = 0.0
                else:
                    print(f"  - {k}: {type(v)}")

        # Use the provided instruct prompt
        generation_instruct = instruct
        if instruct:
            print(f"🎨 Applying style instruction: '{instruct}'")

        def _generate_sync():
            gen_start = time.time()
            try:
                if torch.cuda.is_available():
                    torch.cuda.synchronize()
                
                print(f"DEVICE: {self.device}, MODEL DTYPE: {getattr(self.model, 'dtype', 'unknown')}")
                import os
                print(f"DEBUG - Environment FORCE_CPU: {os.getenv('FORCE_CPU')}")
                print(f"DEBUG - Environment GITHUB_ACTIONS: {os.getenv('GITHUB_ACTIONS')}")

                # Quality/Speed Estimation
                char_count = len(text)
                est_min = "1-2" if self.model_size == "0.6B" else "4-6"
                print(f"📦 Model Size: {self.model_size} | Script Length: {char_count} chars")
                print(f"⏳ ESTIMATED WAIT: {est_min} minutes on CPU. Please do not close the terminal.")
                print("--- Neural math in progress... ---")
                
                with torch.inference_mode():
                    # Generate the whole thing at once
                    wavs, sr = self.model.generate_voice_clone(
                        text=cleaned_text,
                        voice_clone_prompt=voice_prompt,
                        instruct=generation_instruct,
                    )
                
                # 1. Robust Unpacking (Handle list/tuple nesting)
                print(f"DEBUG - Raw Generated: type={type(wavs)}")
                while isinstance(wavs, (list, tuple)) and len(wavs) > 0:
                    wavs = wavs[0]
                
                # 2. Convert to CPU Tensor for processing
                if isinstance(wavs, torch.Tensor):
                    wavs = wavs.detach().cpu()
                    print(f"DEBUG - Tensor shape before squeeze: {wavs.shape}")
                    wavs = wavs.squeeze() # Remove batch/channel dims
                    print(f"DEBUG - Tensor shape after squeeze: {wavs.shape}")
                
                # 3. Check for empty/failed generation
                if wavs is None or (hasattr(wavs, 'numel') and wavs.numel() < 100):
                    print("⚠️ WARNING: Model generated almost no audio. The text or instructions might be out of range.")
                    return np.zeros(100), sr

                # 4. Professional Normalization & Clipping Prevention
                max_val = torch.abs(wavs).max().item()
                if max_val > 0.00001:
                    if max_val > 1.0:
                        print(f"📏 Normalizing: Peak {max_val:.2f} -> 1.0 (Fixing distortion/shake)")
                        wavs = wavs / (max_val + 1e-6)
                    wavs = torch.clamp(wavs, -0.99, 0.99)
                
                # 5. Final NumPy conversion
                if isinstance(wavs, torch.Tensor):
                    wavs = wavs.numpy()
                elif not isinstance(wavs, np.ndarray):
                    wavs = np.array(wavs)

                print(f"✨ Audio Finalized: {len(wavs)} samples ({(len(wavs)/sr):.2f} seconds)")
                
                if torch.cuda.is_available():
                    torch.cuda.synchronize()
                
                duration = time.time() - gen_start
                print(f"GENERATION COMPLETE in {duration:.2f}s")
                return wavs, sr
            except Exception as e:
                print(f"CRITICAL GENERATION ERROR: {str(e)}")
                raise

        # Run with a generous timeout for the whole generation
        try:
            audio, sample_rate = await asyncio.wait_for(
                asyncio.to_thread(_generate_sync),
                timeout=7200.0 # 2 hours for large text on CPU
            )
        except asyncio.TimeoutError:
            print("GENERATION TIMED OUT after 7200s")
            raise Exception("Voicebox generation timed out.")

        # Apply speed adjustment if requested
        if speed != 1.0:
            import librosa
            print(f"Applying speed adjustment: {speed}x")
            audio = librosa.effects.time_stretch(audio, rate=speed)

        total_duration = time.time() - start_time
        print(f"TOTAL PIPELINE TIME: {total_duration:.2f}s")
        print("="*50 + "\n")

        # Clear VRAM
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        import gc
        gc.collect()

        return audio, sample_rate


class PyTorchSTTBackend:
    """PyTorch-based STT backend using Whisper."""
    
    def __init__(self, model_size: str = "base"):
        self.model = None
        self.processor = None
        self.model_size = model_size
        self.device = self._get_device()
    
    def _get_device(self) -> str:
        """Get the best available device."""
        if torch.cuda.is_available():
            return "cuda"
        elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            # MPS support for Whisper
            return "cpu"  # Use CPU for stability
        return "cpu"
    
    def is_loaded(self) -> bool:
        """Check if model is loaded."""
        return self.model is not None
    
    def _is_model_cached(self, model_size: str) -> bool:
        """
        Check if the Whisper model is already cached locally AND fully downloaded.
        
        Args:
            model_size: Model size to check
            
        Returns:
            True if model is fully cached, False if missing or incomplete
        """
        try:
            from huggingface_hub import constants as hf_constants
            model_name = f"openai/whisper-{model_size}"
            repo_cache = Path(hf_constants.HF_HUB_CACHE) / ("models--" + model_name.replace("/", "--"))
            
            if not repo_cache.exists():
                return False
            
            # Check for .incomplete files - if any exist, download is still in progress
            blobs_dir = repo_cache / "blobs"
            if blobs_dir.exists() and any(blobs_dir.glob("*.incomplete")):
                print(f"[_is_model_cached] Found .incomplete files for whisper-{model_size}, treating as not cached")
                return False
            
            # Check that actual model weight files exist in snapshots
            snapshots_dir = repo_cache / "snapshots"
            if snapshots_dir.exists():
                has_weights = (
                    any(snapshots_dir.rglob("*.safetensors")) or
                    any(snapshots_dir.rglob("*.bin"))
                )
                if not has_weights:
                    print(f"[_is_model_cached] No model weights found for whisper-{model_size}, treating as not cached")
                    return False
            
            return True
        except Exception as e:
            print(f"[_is_model_cached] Error checking cache for whisper-{model_size}: {e}")
            return False
    
    async def load_model_async(self, model_size: Optional[str] = None):
        """
        Lazy load the Whisper model.

        Args:
            model_size: Model size (tiny, base, small, medium, large)
        """
        print(f"[DEBUG] load_model_async called with size: {model_size}")
        if model_size is None:
            model_size = self.model_size

        print(f"[DEBUG] Model already loaded? {self.model is not None}, current size: {self.model_size}, requested: {model_size}")
        if self.model is not None and self.model_size == model_size:
            print(f"[DEBUG] Early return - model already loaded")
            return

        print(f"[DEBUG] Calling asyncio.to_thread for _load_model_sync")
        # Run blocking load in thread pool
        await asyncio.to_thread(self._load_model_sync, model_size)
        print(f"[DEBUG] asyncio.to_thread completed")
    
    # Alias for compatibility
    load_model = load_model_async
    
    def _load_model_sync(self, model_size: str):
        """Synchronous model loading."""
        print(f"[DEBUG] _load_model_sync called for Whisper {model_size}")
        try:
            progress_manager = get_progress_manager()
            task_manager = get_task_manager()
            progress_model_name = f"whisper-{model_size}"

            # Check if model is already cached
            is_cached = self._is_model_cached(model_size)

            # Set up progress callback and tracker
            # If cached: filter out non-download progress
            # If not cached: report all progress (we're actually downloading)
            progress_callback = create_hf_progress_callback(progress_model_name, progress_manager)
            tracker = HFProgressTracker(progress_callback, filter_non_downloads=is_cached)

            # Patch tqdm BEFORE importing transformers
            print("[DEBUG] Starting tqdm patch BEFORE transformers import")
            tracker_context = tracker.patch_download()
            tracker_context.__enter__()
            print("[DEBUG] tqdm patched, now importing transformers")

            # Import transformers
            from transformers import WhisperProcessor, WhisperForConditionalGeneration

            # Get local or HF model path
            local_name = f"whisper-{model_size}"
            local_path = get_models_dir() / local_name
            
            if local_path.exists():
                print(f"Found local Whisper model at: {local_path}")
                model_name = str(local_path.absolute())
                is_cached = True # Skip download tracking if using local path
            else:
                model_name = f"openai/whisper-{model_size}"

            print(f"Loading Whisper model {model_size} from {model_name} on {self.device}...")

            # Only track download progress if model is NOT cached
            if not is_cached:
                # Start tracking download task
                task_manager.start_download(progress_model_name)

                # Initialize progress state so SSE endpoint has initial data to send
                progress_manager.update_progress(
                    model_name=progress_model_name,
                    current=0,
                    total=0,  # Will be updated once actual total is known
                    filename="Connecting to HuggingFace...",
                    status="downloading",
                )

            # Load models (tqdm is patched, but filters out non-download progress)
            try:
                self.processor = WhisperProcessor.from_pretrained(model_name)
                self.model = WhisperForConditionalGeneration.from_pretrained(model_name)
            finally:
                # Exit the patch context
                tracker_context.__exit__(None, None, None)
            
            # Only mark download as complete if we were tracking it
            if not is_cached:
                progress_manager.mark_complete(progress_model_name)
                task_manager.complete_download(progress_model_name)
            
            self.model.to(self.device)
            self.model_size = model_size
            
            print(f"Whisper model {model_size} loaded successfully")
            
        except Exception as e:
            print(f"Error loading Whisper model: {e}")
            progress_manager = get_progress_manager()
            task_manager = get_task_manager()
            progress_model_name = f"whisper-{model_size}"
            progress_manager.mark_error(progress_model_name, str(e))
            task_manager.error_download(progress_model_name, str(e))
            raise
    
    def unload_model(self):
        """Unload the model to free memory."""
        if self.model is not None:
            del self.model
            del self.processor
            self.model = None
            self.processor = None
            
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            
            print("Whisper model unloaded")
    
    async def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
    ) -> str:
        """
        Transcribe audio to text.
        
        Args:
            audio_path: Path to audio file
            language: Optional language hint (en or zh)
            
        Returns:
            Transcribed text
        """
        await self.load_model_async(None)
        
        def _transcribe_sync():
            """Run synchronous transcription in thread pool."""
            # Load audio
            audio, sr = load_audio(audio_path, sample_rate=16000)
            
            # Process audio
            inputs = self.processor(
                audio,
                sampling_rate=16000,
                return_tensors="pt",
            )
            inputs = inputs.to(self.device)
            
            # Set language if provided
            forced_decoder_ids = None
            if language:
                # Support all languages from frontend: en, zh, ja, ko, de, fr, ru, pt, es, it
                # Whisper supports these and many more
                forced_decoder_ids = self.processor.get_decoder_prompt_ids(
                    language=language,
                    task="transcribe",
                )
            
            # Generate transcription
            with torch.no_grad():
                predicted_ids = self.model.generate(
                    inputs["input_features"],
                    forced_decoder_ids=forced_decoder_ids,
                )
            
            # Decode
            transcription = self.processor.batch_decode(
                predicted_ids,
                skip_special_tokens=True,
            )[0]
            
            return transcription.strip()
        
        # Run blocking transcription in thread pool
        return await asyncio.to_thread(_transcribe_sync)
