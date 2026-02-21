import numpy as np
import soundfile as sf
import librosa
from typing import Tuple, Optional
from scipy import signal

def normalize_audio(
    audio: np.ndarray,
    target_db: float = -20.0,
    peak_limit: float = 0.85,
    sample_rate: int = 24000
) -> np.ndarray:
    """
    Normalize audio to target loudness with high-pass filtering and peak limiting.
    
    Args:
        audio: Input audio array
        target_db: Target RMS level in dB
        peak_limit: Peak limit (0.0-1.0)
        sample_rate: Sample rate for filtering
        
    Returns:
        Normalized audio array
    """
    # Convert to float32
    audio = audio.astype(np.float32)

    # 1. Apply High-Pass Filter (HPF) to remove low-frequency rumble ("base shake")
    # Voicebox/TTS often generates sub-harmonic artifacts
    sos = signal.butter(10, 100, 'hp', fs=sample_rate, output='sos')
    audio = signal.sosfilt(sos, audio)
    
    # 2. Calculate current RMS
    rms = np.sqrt(np.mean(audio**2))
    
    # 3. Calculate target RMS
    target_rms = 10**(target_db / 20)
    
    # 4. Apply gain
    if rms > 0:
        gain = target_rms / rms
        audio = audio * gain
    
    # 5. Soft peak limiting (tanh) to avoid harsh clipping
    # This keeps peaks below peak_limit
    audio = np.tanh(audio) * peak_limit
    
    return audio


def load_audio(
    path: str,
    sample_rate: int = 24000,
    mono: bool = True,
) -> Tuple[np.ndarray, int]:
    """
    Load audio file with normalization.
    
    Args:
        path: Path to audio file
        sample_rate: Target sample rate
        mono: Convert to mono
        
    Returns:
        Tuple of (audio_array, sample_rate)
    """
    audio, sr = librosa.load(path, sr=sample_rate, mono=mono)
    return audio, sr


def save_audio(
    audio: np.ndarray,
    path: str,
    sample_rate: int = 24000,
) -> None:
    """
    Save audio file.
    
    Args:
        audio: Audio array
        path: Output path
        sample_rate: Sample rate
    """
    sf.write(path, audio, sample_rate)


def validate_reference_audio(
    audio_path: str,
    min_duration: float = 2.0,
    max_duration: float = 30.0,
    min_rms: float = 0.01,
) -> Tuple[bool, Optional[str]]:
    """
    Validate reference audio for voice cloning.
    
    Args:
        audio_path: Path to audio file
        min_duration: Minimum duration in seconds
        max_duration: Maximum duration in seconds
        min_rms: Minimum RMS level
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        audio, sr = load_audio(audio_path)
        duration = len(audio) / sr
        
        if duration < min_duration:
            return False, f"Audio too short (minimum {min_duration} seconds)"
        if duration > max_duration:
            return False, f"Audio too long (maximum {max_duration} seconds)"
        
        rms = np.sqrt(np.mean(audio**2))
        if rms < min_rms:
            return False, "Audio is too quiet or silent"
        
        if np.abs(audio).max() > 0.99:
            return False, "Audio is clipping (reduce input gain)"
        
        return True, None
    except Exception as e:
        return False, f"Error validating audio: {str(e)}"
