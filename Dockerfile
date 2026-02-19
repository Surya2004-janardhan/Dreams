# Use NVIDIA CUDA base for GPU acceleration
FROM nvidia/cuda:12.1.1-devel-ubuntu22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV NODE_VERSION=20.x

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ffmpeg \
    python3 \
    python3-pip \
    python3-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_$NODE_VERSION | bash - \
    && apt-get install -y nodejs

# Set working directory
WORKDIR /app

# Copy package.json and install Node dependencies
COPY package*.json ./
RUN npm install

# Install Playwright browsers and dependencies
RUN npx playwright install --with-deps chromium

# Copy Voicebox requirements and install
COPY voicebox/requirements.txt ./voicebox/requirements.txt
RUN pip3 install --no-cache-dir -r voicebox/requirements.txt

# Copy Wav2Lip requirements and install
COPY wav2lip/requirements.txt ./wav2lip/requirements.txt
RUN pip3 install --no-cache-dir -r wav2lip/requirements.txt

# Copy the rest of the application code
COPY . .

# Create necessary directories
RUN mkdir -p audio recordings final_video results temp

# Set default command
CMD ["node", "main_automation.js"]
