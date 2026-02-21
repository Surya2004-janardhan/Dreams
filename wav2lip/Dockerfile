# Use an official Python runtime with GPU support (Optional, change to python:3.9-slim for CPU only)
FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsm6 \
    libxext6 \
    libgl1-mesa-glx \
    python3.10 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Upgrade pip and install fundamental tools
RUN python3 -m pip install --upgrade pip

# Copy only requirements first to leverage Docker cache
COPY requirements.txt .
# Add extra requirements for the microservice
RUN echo "fastapi\nuvicorn\npython-multipart" >> requirements.txt

# Install python dependencies
RUN python3 -m pip install -r requirements.txt

# Note: For GPU support in Docker, you'd usually install torch separately
# but for simplicity, we'll keep the requirements.txt logic.
# If you want GPU, uncomment the line below:
# RUN python3 -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# Copy the rest of the application
COPY . .

# Expose the API port
EXPOSE 8000

# Start the microservice
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
