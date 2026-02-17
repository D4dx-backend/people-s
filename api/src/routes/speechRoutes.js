const express = require('express');
const speechController = require('../controllers/speechController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/speech/transcribe - Convert audio to Malayalam text
router.post('/transcribe', authenticate, (req, res) => speechController.transcribeAudio(req, res));

module.exports = router;
