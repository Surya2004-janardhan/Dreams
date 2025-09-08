const axios = require('axios');
require('dotenv').config();

const testTTS = async () => {
  const voiceId = '21m00Tcm4TlvDq8ikWAM'; // Rachel
  const text = 'Hello, this is a test.';
  
  console.log('Testing ElevenLabs TTS...');
  console.log('Voice ID:', voiceId);
  console.log('API Key:', process.env.ELEVENLABS_API_KEY?.substring(0, 10) + '...');
  
  try {
    const response = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      },
      {
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg"
        },
        responseType: "arraybuffer",
      }
    );
    
    console.log('✓ TTS Success - Response size:', response.data.byteLength, 'bytes');
    console.log('✓ Content-Type:', response.headers['content-type']);
    
  } catch (error) {
    console.log('✗ TTS Error:', error.response?.status);
    console.log('✗ Error message:', error.response?.data?.detail?.message || error.message);
    console.log('✗ Full error data:', error.response?.data);
  }
};

testTTS();
