import React, { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { speech } from '@/lib/api';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface VoiceToTextButtonProps {
  /** Callback when transcription is available - appends text to existing value */
  onTranscript: (text: string) => void;
  /** Language code for speech recognition (default: ml-IN for Malayalam) */
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
 * VoiceToTextButton - Records voice and converts to Malayalam text
 * 
 * Uses Web Speech API (browser native) as primary method for real-time transcription,
 * falls back to Google Cloud Speech-to-Text API for unsupported browsers.
 */
const VoiceToTextButton: React.FC<VoiceToTextButtonProps> = ({
  onTranscript,
  languageCode = 'ml-IN',
  disabled = false,
  size = 'icon',
  className = '',
  tooltip = 'Voice to Malayalam text (മലയാളം)',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const [useWebSpeechAPI, setUseWebSpeechAPI] = useState<boolean | null>(null);

  // Check if Web Speech API is available
  const checkWebSpeechAPI = useCallback(() => {
    if (useWebSpeechAPI !== null) return useWebSpeechAPI;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const available = !!SpeechRecognition;
    setUseWebSpeechAPI(available);
    return available;
  }, [useWebSpeechAPI]);

  // Web Speech API approach (real-time, browser native)
  const startWebSpeechRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.lang = languageCode;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let fullTranscript = '';

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript;
          fullTranscript += (fullTranscript ? ' ' : '') + text;
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        alert('Microphone access denied. Please allow microphone access in your browser settings.');
      }
      setIsRecording(false);
      // If Web Speech API fails, fall back to Google API
      if (event.error === 'no-speech' || event.error === 'network') {
        setUseWebSpeechAPI(false);
      }
    };

    recognition.onend = async () => {
      if (fullTranscript.trim()) {
        // Send through backend for Gemini AI correction
        setIsProcessing(true);
        try {
          const response = await speech.transcribe('', {
            languageCode,
            rawText: fullTranscript.trim()
          });
          if (response.success && response.data?.text) {
            onTranscript(response.data.text);
          } else {
            onTranscript(fullTranscript.trim());
          }
        } catch {
          // Fallback to raw transcript if correction fails
          onTranscript(fullTranscript.trim());
        } finally {
          setIsProcessing(false);
        }
      }
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [languageCode, onTranscript]);

  const stopWebSpeechRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  // Google Cloud Speech-to-Text fallback approach
  const startGoogleRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          channelCount: 1, 
          sampleRate: 48000 
        } 
      });
      streamRef.current = stream;
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          // Convert to base64
          const reader = new FileReader();
          const base64Audio = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(audioBlob);
          });

          // Send to API
          const response = await speech.transcribe(base64Audio, {
            encoding: 'WEBM_OPUS',
            sampleRateHertz: 48000,
            languageCode
          });

          if (response.success && response.data?.text) {
            onTranscript(response.data.text);
          } else if (!response.data?.text) {
            // No speech detected - show subtle feedback
            console.warn('No speech detected in audio');
          }
        } catch (error) {
          console.error('Transcription error:', error);
        } finally {
          setIsProcessing(false);
          // Clean up stream
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect in 1-second chunks
      setIsRecording(true);
    } catch (error: any) {
      console.error('Microphone access error:', error);
      if (error.name === 'NotAllowedError') {
        alert('Microphone access denied. Please allow microphone access in your browser settings.');
      } else {
        alert('Could not access microphone. Please check your device settings.');
      }
    }
  }, [languageCode, onTranscript]);

  const stopGoogleRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  }, []);

  // Toggle recording
  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      // Stop recording
      if (checkWebSpeechAPI() && recognitionRef.current) {
        stopWebSpeechRecognition();
      } else {
        stopGoogleRecording();
      }
    } else {
      // Start recording
      if (checkWebSpeechAPI()) {
        startWebSpeechRecognition();
      } else {
        startGoogleRecording();
      }
    }
  }, [isRecording, checkWebSpeechAPI, startWebSpeechRecognition, stopWebSpeechRecognition, startGoogleRecording, stopGoogleRecording]);

  const buttonContent = () => {
    if (isProcessing) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (isRecording) {
      return <Square className="h-3.5 w-3.5 fill-current" />;
    }
    return <Mic className="h-4 w-4" />;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={isRecording ? 'destructive' : 'outline'}
            size={size}
            onClick={handleToggleRecording}
            disabled={disabled || isProcessing}
            className={`relative ${isRecording ? 'animate-pulse' : ''} ${className}`}
            aria-label={isRecording ? 'Stop recording' : tooltip}
          >
            {buttonContent()}
            {isRecording && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 animate-ping" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">
            {isProcessing ? 'Processing audio...' : isRecording ? 'Click to stop recording' : tooltip}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default VoiceToTextButton;
