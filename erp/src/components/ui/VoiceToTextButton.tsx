import React, { useState, useRef, useCallback } from 'react';
import { Mic, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { speech } from '@/lib/api';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const SONIOX_WS_URL = 'wss://stt-rt.soniox.com/transcribe-websocket';

/** Animated equalizer bars shown while recording — mimics an audio waveform signal. */
const WaveformBars: React.FC = () => {
  const bars = [0.45, 0.75, 1.0, 0.85, 0.6, 0.9, 0.5];
  return (
    <span className="flex items-center justify-center gap-[2px] w-5 h-4">
      {bars.map((peak, i) => (
        <span
          key={i}
          className="inline-block w-[2.5px] rounded-full bg-current origin-bottom"
          style={{
            height: `${Math.round(peak * 14)}px`,
            animation: `voiceWave ${0.5 + (i % 3) * 0.15}s ease-in-out infinite alternate`,
            animationDelay: `${i * 0.08}s`,
          }}
        />
      ))}
    </span>
  );
};

interface VoiceToTextButtonProps {
  /** Callback fired with each batch of newly finalized transcript text */
  onTranscript: (text: string) => void;
  /** Optional callback fired with the current non-final (interim) text while recording */
  onInterimTranscript?: (text: string) => void;
  /** Language code hint — 'ml-IN' or 'ml' enables Malayalam + English mixed mode */
  languageCode?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Size variant */
  size?: 'sm' | 'default' | 'icon';
  /** Additional class name */
  className?: string;
  /** Tooltip text */
  tooltip?: string;
}

/**
 * VoiceToTextButton — Real-time voice transcription via Soniox WebSocket API.
 *
 * Idle     → shows Mic icon
 * Connecting → shows spinner
 * Recording  → shows animated waveform bars (like WhatsApp)
 */
const VoiceToTextButton: React.FC<VoiceToTextButtonProps> = ({
  onTranscript,
  onInterimTranscript,
  languageCode = 'ml-IN',
  disabled = false,
  size = 'icon',
  className = '',
  tooltip = 'Voice to text (മലയാളം)',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const getLanguageHints = (langCode: string): string[] => {
    const base = langCode.split('-')[0].toLowerCase();
    return base === 'ml' ? ['ml', 'en'] : [base, 'en'];
  };

  const cleanup = useCallback((ws?: WebSocket | null) => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    const socket = ws ?? wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      // Empty binary frame = end-of-stream signal to Soniox
      socket.send(new ArrayBuffer(0));
    }
    wsRef.current = null;
    setIsRecording(false);
    setIsConnecting(false);
  }, []);

  const startRecording = useCallback(async () => {
    setIsConnecting(true);
    try {
      // 1. Get a short-lived temp key from backend
      const tokenRes = await speech.getSonioxToken();
      if (!tokenRes.success || !tokenRes.data?.api_key) {
        throw new Error(tokenRes.message || 'Failed to get Soniox token');
      }
      const tempKey = tokenRes.data.api_key;

      // 2. Acquire microphone BEFORE opening the socket so audio is ready to stream immediately
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true }
      });
      streamRef.current = stream;

      // 3. Set up MediaRecorder early so it can buffer audio while WS handshakes
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      // Collect pending chunks before WS is open
      const pendingChunks: Blob[] = [];
      let wsReady = false;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size === 0) return;
        if (wsReady && wsRef.current?.readyState === WebSocket.OPEN) {
          // Send Blob directly — no async arrayBuffer() needed
          wsRef.current.send(event.data);
        } else {
          pendingChunks.push(event.data);
        }
      };

      // Start capturing immediately — don't wait for WS
      mediaRecorder.start(100);

      // 4. Open Soniox WebSocket
      const ws = new WebSocket(SONIOX_WS_URL);
      wsRef.current = ws;
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        ws.send(JSON.stringify({
          api_key: tempKey,
          model: 'stt-rt-preview',
          audio_format: 'auto',
          language_hints: getLanguageHints(languageCode),
          enable_endpoint_detection: true,
          max_endpoint_delay_ms: 1500,
        }));

        // Flush any buffered chunks that arrived while WS was connecting
        wsReady = true;
        for (const chunk of pendingChunks) {
          if (ws.readyState === WebSocket.OPEN) ws.send(chunk);
        }
        pendingChunks.length = 0;

        setIsConnecting(false);
        setIsRecording(true);
      };

      // 5. Handle incoming tokens
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);

          if (msg.error_code) {
            console.error('Soniox error:', msg.error_message);
            cleanup(ws);
            return;
          }

          const tokens: Array<{ text: string; is_final: boolean }> = msg.tokens || [];

          // Filter out Soniox control tokens (e.g. "<end>", "<fin>") emitted by
          // endpoint detection — they are markers, not transcript text.
          const isControlToken = (t: string) => /^<[^>]*>$/.test(t.trim());

          const finalText = tokens
            .filter(t => t.is_final && !isControlToken(t.text))
            .map(t => t.text)
            .join('');
          if (finalText) onTranscript(finalText);

          if (onInterimTranscript) {
            const interim = tokens
              .filter(t => !t.is_final && !isControlToken(t.text))
              .map(t => t.text)
              .join('');
            onInterimTranscript(interim);
          }

          if (msg.finished) {
            if (onInterimTranscript) onInterimTranscript('');
            cleanup(ws);
          }
        } catch (e) {
          console.error('Failed to parse Soniox response:', e);
        }
      };

      ws.onerror = () => cleanup(ws);
      ws.onclose = () => {
        if (isRecording || isConnecting) cleanup(ws);
      };

    } catch (error: any) {
      console.error('Voice recording start failed:', error);
      cleanup();
      if (error.name === 'NotAllowedError') {
        alert('Microphone access denied. Please allow microphone access in your browser settings.');
      }
    }
  }, [languageCode, onTranscript, onInterimTranscript, cleanup, isRecording, isConnecting]);

  const stopRecording = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const handleToggle = useCallback(() => {
    if (isRecording) stopRecording();
    else startRecording();
  }, [isRecording, startRecording, stopRecording]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={isRecording ? 'destructive' : 'ghost'}
            size={size}
            onClick={handleToggle}
            disabled={disabled || isConnecting}
            className={className}
            aria-label={isRecording ? 'Stop recording' : tooltip}
          >
            {isConnecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isRecording ? (
              <WaveformBars />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isRecording ? 'Tap to stop' : tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default VoiceToTextButton;


