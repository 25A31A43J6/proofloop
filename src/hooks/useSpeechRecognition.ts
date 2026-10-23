/**
 * ProofLoop Speech Recognition Hook
 * Integrates Web Speech API (SpeechRecognition / webkitSpeechRecognition)
 * Supports en-US, en-IN, te-IN, hi-IN with permission handling, live transcription,
 * clean restart lifecycle, bounded backoff, and clean instance management.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export type SpeechLocale = 'en-US' | 'en-IN' | 'te-IN' | 'hi-IN';

export interface SupportedLocaleOption {
  code: SpeechLocale;
  label: string;
  nativeLabel: string;
}

export const SUPPORTED_LOCALES: SupportedLocaleOption[] = [
  { code: 'en-IN', label: 'English (India)', nativeLabel: 'English (India)' },
  { code: 'en-US', label: 'English (US)', nativeLabel: 'English (US)' },
  { code: 'te-IN', label: 'Telugu', nativeLabel: 'తెలుగు (India)' },
  { code: 'hi-IN', label: 'Hindi', nativeLabel: 'हिन्दी (India)' },
];

export type RecognitionStatus =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'permission-denied'
  | 'unsupported'
  | 'error';

interface UseSpeechRecognitionOptions {
  locale?: SpeechLocale;
  continuous?: boolean;
  interimResults?: boolean;
  maxRetries?: number;
  onFinalTranscript?: (transcript: string) => void;
  onError?: (errorMessage: string) => void;
}

export interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  status: RecognitionStatus;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  fullTranscript: string;
  error: string | null;
  locale: SpeechLocale;
  setLocale: (loc: SpeechLocale) => void;
  setTranscript: (text: string) => void;
  startListening: () => Promise<void>;
  stopListening: () => void;
  cancelListening: () => void;
  resetTranscript: () => void;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const {
    locale: initialLocale = 'en-IN',
    continuous = true,
    interimResults = true,
    maxRetries = 5,
    onFinalTranscript,
    onError,
  } = options;

  const [locale, setLocaleState] = useState<SpeechLocale>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('proofloop_voice_locale');
      if (saved && ['en-IN', 'en-US', 'te-IN', 'hi-IN'].includes(saved)) {
        return saved as SpeechLocale;
      }
    }
    return initialLocale;
  });

  const [isSupported, setIsSupported] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  });

  const [status, setStatus] = useState<RecognitionStatus>(() => (isSupported ? 'idle' : 'unsupported'));
  const [transcript, setTranscript] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const isExplicitStopRef = useRef<boolean>(false);
  const sessionGenerationRef = useRef<number>(0);
  const retryCountRef = useRef<number>(0);
  const restartTimerRef = useRef<any>(null);
  const finalTranscriptRef = useRef<string>('');
  const localeRef = useRef<SpeechLocale>(locale);
  localeRef.current = locale;

  // Persist locale changes
  const setLocale = useCallback((newLocale: SpeechLocale) => {
    setLocaleState(newLocale);
    localeRef.current = newLocale;
    if (typeof window !== 'undefined') {
      localStorage.setItem('proofloop_voice_locale', newLocale);
    }
    if (recognitionRef.current) {
      recognitionRef.current.lang = newLocale;
    }
  }, []);

  const onFinalTranscriptRef = useRef(onFinalTranscript);
  useEffect(() => {
    onFinalTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  const onErrorRef = useRef(onError);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  // Clean instance abortion helper
  const abortCurrentRecognition = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
  }, []);

  // Spawn fresh speech recognition instance
  const spawnRecognition = useCallback(
    (generation: number) => {
      if (typeof window === 'undefined') return;

      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognitionClass) {
        setStatus('unsupported');
        setError('Web Speech recognition is not supported in this browser. Please use text input.');
        onErrorRef.current?.('Speech recognition unsupported');
        return;
      }

      abortCurrentRecognition();

      try {
        const recognition = new SpeechRecognitionClass();
        recognition.lang = localeRef.current;
        recognition.continuous = continuous;
        recognition.interimResults = interimResults;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
          if (generation !== sessionGenerationRef.current || isExplicitStopRef.current) return;
          setStatus('listening');
          setError(null);
        };

        recognition.onresult = (event: any) => {
          if (generation !== sessionGenerationRef.current || isExplicitStopRef.current) return;

          let interim = '';
          let finalized = finalTranscriptRef.current;

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const result = event.results[i];
            const text = result[0]?.transcript || '';
            if (result.isFinal) {
              const cleanSegment = text.trim();
              if (cleanSegment) {
                finalized = finalized ? `${finalized} ${cleanSegment}` : cleanSegment;
              }
            } else {
              interim += text;
            }
          }

          finalTranscriptRef.current = finalized;
          setTranscript(finalized);
          setInterimTranscript(interim);

          if (finalized) {
            retryCountRef.current = 0;
            onFinalTranscriptRef.current?.(finalized);
          }
        };

        recognition.onerror = (event: any) => {
          if (generation !== sessionGenerationRef.current || isExplicitStopRef.current) return;

          const errorType = event.error;

          if (
            errorType === 'not-allowed' ||
            errorType === 'service-not-allowed' ||
            errorType === 'permission-denied'
          ) {
            setStatus('permission-denied');
            const msg = 'Microphone permission was denied. Please allow microphone access in your browser settings.';
            setError(msg);
            onErrorRef.current?.(msg);
            isExplicitStopRef.current = true;
          } else if (errorType === 'audio-capture') {
            setStatus('error');
            const msg = "I couldn't access a microphone. Please check your device.";
            setError(msg);
            onErrorRef.current?.(msg);
          } else if (errorType === 'no-speech') {
            // Silence is normal in continuous background mode; don't report as user error
            if (!continuous) {
              setStatus('idle');
            }
          } else if (errorType === 'network') {
            setStatus('error');
            const msg = 'Speech recognition encountered a connection problem. You can retry or type your command.';
            setError(msg);
            onErrorRef.current?.(msg);
          } else if (errorType !== 'aborted') {
            setStatus('error');
            const msg = `Speech error: ${errorType}`;
            setError(msg);
            onErrorRef.current?.(msg);
          }
        };

        recognition.onend = () => {
          if (generation !== sessionGenerationRef.current || isExplicitStopRef.current) {
            setStatus('idle');
            recognitionRef.current = null;
            return;
          }

          // In continuous mode, when the browser finishes an audio slice, restart with bounded backoff
          if (continuous && !isExplicitStopRef.current) {
            if (retryCountRef.current < maxRetries) {
              retryCountRef.current += 1;
              const delay = Math.min(300 * retryCountRef.current, 2500);

              restartTimerRef.current = setTimeout(() => {
                if (generation === sessionGenerationRef.current && !isExplicitStopRef.current) {
                  spawnRecognition(generation);
                }
              }, delay);
              return;
            }
          }

          setStatus('idle');
          recognitionRef.current = null;
        };

        recognitionRef.current = recognition;
        recognition.start();
      } catch (err: any) {
        setStatus('error');
        const msg = err.message || 'Failed to initialize microphone';
        setError(msg);
        onErrorRef.current?.(msg);
      }
    },
    [continuous, interimResults, maxRetries, abortCurrentRecognition]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortCurrentRecognition();
    };
  }, [abortCurrentRecognition]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    finalTranscriptRef.current = '';
    setError(null);
  }, []);

  const startListening = useCallback(async () => {
    if (typeof window === 'undefined') return;

    sessionGenerationRef.current += 1;
    const currentGeneration = sessionGenerationRef.current;
    isExplicitStopRef.current = false;
    retryCountRef.current = 0;

    spawnRecognition(currentGeneration);
  }, [spawnRecognition]);

  const stopListening = useCallback(() => {
    isExplicitStopRef.current = true;
    sessionGenerationRef.current += 1;
    retryCountRef.current = 0;
    abortCurrentRecognition();
    setStatus('idle');
  }, [abortCurrentRecognition]);

  const cancelListening = useCallback(() => {
    isExplicitStopRef.current = true;
    sessionGenerationRef.current += 1;
    retryCountRef.current = 0;
    abortCurrentRecognition();
    setStatus('idle');
    setInterimTranscript('');
  }, [abortCurrentRecognition]);

  const fullTranscript = (
    transcript + (interimTranscript ? ` ${interimTranscript}` : '')
  ).trim();

  return {
    isSupported,
    status,
    isListening: status === 'listening',
    transcript,
    interimTranscript,
    fullTranscript,
    error,
    locale,
    setLocale,
    setTranscript: (text: string) => {
      finalTranscriptRef.current = text;
      setTranscript(text);
    },
    startListening,
    stopListening,
    cancelListening,
    resetTranscript,
  };
}
