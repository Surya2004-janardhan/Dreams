import sys
import os
from pathlib import Path

# Add local model path to sys.path
local_model_path = Path("indicf5_models").resolve()
sys.path.append(str(local_model_path))

try:
    from model import INF5Config
    from f5_tts.model.utils import get_tokenizer, convert_char_to_pinyin
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)

# Simulating the loading process
vocab_path = os.path.join(local_model_path, "checkpoints", "vocab.txt")
vocab_char_map, vocab_size = get_tokenizer(vocab_path, "custom")

test_text = "నమస్కారం! ఈరోజు AI Content Automation."
print(f"Original Text: {test_text}")

# 1. Check Pinyin conversion
pinyin_tokens = convert_char_to_pinyin([test_text])
print(f"Converted Tokens: {pinyin_tokens[0]}")

# 2. Check indexing
indices = [vocab_char_map.get(c, -1) for c in pinyin_tokens[0]]
print(f"Indices: {indices}")

# 3. Check for OOV (Out of Vocabulary)
oov = [pinyin_tokens[0][i] for i, idx in enumerate(indices) if idx == -1]
if oov:
    print(f"OOV Characters found: {set(oov)}")
else:
    print("No OOV characters found.")

# 4. Check if Telugu vowel markers are handled as separate tokens
print("Detailed mapping:")
for i, c in enumerate(pinyin_tokens[0]):
    idx = vocab_char_map.get(c, -1)
    if idx == -1:
        print(f"  '{c}' -> OOV (Error!)")
    else:
        # Check nearby line in vocab for verification
        print(f"  '{c}' -> Index {idx}")
