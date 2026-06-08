const express = require('express');
const speechController = require('../controllers/speechController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/speech/transcribe - Convert audio to text (legacy Google Speech API)
router.post('/transcribe', authenticate, (req, res) => speechController.transcribeAudio(req, res));

// GET /api/speech/soniox-token - Generate a short-lived Soniox temp key for real-time WS transcription
router.get('/soniox-token', authenticate, (req, res) => speechController.getSonioxToken(req, res));

module.exports = router;
