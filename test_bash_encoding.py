import sys
import os

try:
    text = sys.argv[1] if len(sys.argv) > 1 else "No text provided"
    print(f"Received text: {text}")
    print(f"Encoding: {sys.getdefaultencoding()}")
    print(f"Stdout encoding: {sys.stdout.encoding}")
    
    # Try writing to a file in UTF-8
    with open("test_utf8.txt", "w", encoding="utf-8") as f:
        f.write(text)
    print("Successfully wrote to test_utf8.txt")
except Exception as e:
    print(f"ERROR: {str(e)}")
