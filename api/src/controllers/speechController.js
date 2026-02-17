const axios = require('axios');

/**
 * Speech-to-Text Controller
 * Converts audio to Malayalam text using Google Cloud Speech-to-Text API
 */

/**
 * POST /api/speech/transcribe
 * Accepts audio as base64 encoded data and returns Malayalam text
 */
const transcribeAudio = async (req, res) => {
  try {
    const { audio, encoding, sampleRateHertz, languageCode } = req.body;

    if (!audio) {
      return res.status(400).json({
        success: false,
        message: 'Audio data is required (base64 encoded)'
      });
    }

    const apiKey = process.env.GOOGLE_SPEECH_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Google Speech API key is not configured'
      });
    }

    const requestBody = {
      config: {
        encoding: encoding || 'WEBM_OPUS',
        sampleRateHertz: sampleRateHertz || 48000,
        languageCode: languageCode || 'ml-IN', // Malayalam (India)
        alternativeLanguageCodes: ['en-IN'], // Fallback to English-India
        model: 'latest_long',
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: false,
      },
      audio: {
        content: audio // base64 encoded audio
      }
    };

    const response = await axios.post(
      `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
      requestBody,
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      }
    );

    const results = response.data.results;
    if (!results || results.length === 0) {
      return res.status(200).json({
        success: true,
        text: '',
        message: 'No speech detected in audio'
      });
    }

    // Combine all transcription results
    const transcription = results
      .map(result => result.alternatives[0]?.transcript || '')
      .join(' ')
      .trim();

    const confidence = results[0]?.alternatives[0]?.confidence || 0;

    return res.status(200).json({
      success: true,
      text: transcription,
      confidence: confidence,
      languageCode: languageCode || 'ml-IN'
    });

  } catch (error) {
    console.error('Speech-to-text error:', error.response?.data || error.message);
    
    if (error.response?.status === 403) {
      return res.status(403).json({
        success: false,
        message: 'Google Speech API key is invalid or quota exceeded'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to transcribe audio',
      error: error.response?.data?.error?.message || error.message
    });
  }
};

module.exports = {
  transcribeAudio
};
