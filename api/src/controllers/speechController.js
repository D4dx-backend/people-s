const axios = require('axios');

/**
 * Speech-to-Text Controller
 * Converts audio to Malayalam text using Google Cloud Speech-to-Text API
 * Then corrects/polishes the text using Google Gemini AI
 */

/**
 * Correct and polish transcribed text using Google Gemini API
 * Fixes spelling, grammar, and makes the text natural
 */
const correctTranscription = async (rawText, languageCode, apiKey) => {
  try {
    if (!rawText || rawText.trim().length < 2) return rawText;

    const isMalayalam = languageCode?.startsWith('ml');
    
    const prompt = isMalayalam 
      ? `You are a Malayalam language expert. The following text was transcribed from speech and may contain errors. 
Please correct any spelling mistakes, grammar errors, and make the text natural and readable in Malayalam.
Only return the corrected text, nothing else. Do not add explanations or quotes.
If the text is already correct, return it as-is.
If the text contains a mix of Malayalam and English, keep the English words as-is but fix any Malayalam errors.

Raw transcription: "${rawText}"`
      : `The following text was transcribed from speech and may contain errors.
Please correct any spelling mistakes, grammar errors, and make the text natural and readable.
Only return the corrected text, nothing else. Do not add explanations or quotes.
If the text is already correct, return it as-is.

Raw transcription: "${rawText}"`;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
          topP: 0.8
        }
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      }
    );

    const correctedText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    
    if (correctedText && correctedText.length > 0) {
      // Remove any surrounding quotes that Gemini might add
      return correctedText.replace(/^["']|["']$/g, '').trim();
    }
    
    return rawText;
  } catch (error) {
    console.error('Gemini correction error:', error.response?.data?.error?.message || error.message);
    // If Gemini fails, return the raw transcription (graceful fallback)
    return rawText;
  }
};

/**
 * POST /api/speech/transcribe
 * Accepts audio as base64 encoded data and returns corrected Malayalam text
 * Also accepts rawText directly (from Web Speech API) for correction only
 */
const transcribeAudio = async (req, res) => {
  try {
    const { audio, encoding, sampleRateHertz, languageCode, rawText } = req.body;

    const apiKey = process.env.GOOGLE_SPEECH_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'Google Speech API key is not configured'
      });
    }

    const lang = languageCode || 'ml-IN';

    // If rawText is provided directly (from Web Speech API), skip transcription and just correct
    if (rawText && rawText.trim()) {
      const correctedText = await correctTranscription(rawText.trim(), lang, apiKey);
      return res.status(200).json({
        success: true,
        text: correctedText,
        rawText: rawText.trim(),
        corrected: correctedText !== rawText.trim(),
        confidence: 1,
        languageCode: lang
      });
    }

    if (!audio) {
      return res.status(400).json({
        success: false,
        message: 'Audio data or rawText is required'
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
    const rawTranscription = results
      .map(result => result.alternatives[0]?.transcript || '')
      .join(' ')
      .trim();

    const confidence = results[0]?.alternatives[0]?.confidence || 0;

    // Step 2: Correct and polish the transcription using Gemini AI
    const correctedText = await correctTranscription(rawTranscription, lang, apiKey);

    return res.status(200).json({
      success: true,
      text: correctedText,
      rawText: rawTranscription,
      corrected: correctedText !== rawTranscription,
      confidence: confidence,
      languageCode: lang
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
