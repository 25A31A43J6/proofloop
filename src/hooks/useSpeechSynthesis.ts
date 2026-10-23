/**
 * ProofLoop Speech Synthesis (TTS) Hook
 * Integrates browser window.speechSynthesis
 * High-performance, low-latency, zero-churn TTS engine with module-level voice caching,
 * stale utterance cancellation guards, and concise speech formatting.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseSpeechSynthesisOptions {
  defaultRate?: number;
  defaultPitch?: number;
}

export interface UseSpeechSynthesisReturn {
  isSupported: boolean;
  isSpeaking: boolean;
  isPaused: boolean;
  speakAloudEnabled: boolean;
  setSpeakAloudEnabled: (enabled: boolean) => void;
  rate: number;
  setRate: (rate: number) => void;
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  setSelectedVoice: (voice: SpeechSynthesisVoice | null) => void;
  error: string | null;
  clearError: () => void;
  speak: (
    text: string,
    options?: { onEnd?: () => void; onError?: (err: string) => void; overrideSpeakAloud?: boolean }
  ) => void;
  speakProgress: (message: string) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
}

// Module-level pre-compiled regexes for zero-allocation fast speech cleaning
const RE_CODE_BLOCKS = /```[\s\S]*?```/g;
const RE_INLINE_CODE = /`([^`]+)`/g;
const RE_MD_LINKS = /\[([^\]]+)\]\([^)]+\)/g;
const RE_MD_HEADERS = /^#{1,6}\s+/gm;
const RE_MD_BULLETS = /^\s*[-*+]\s+/gm;
const RE_MD_BOLD_ITALIC = /[*_]{1,3}([^*_]+)[*_]{1,3}/g;
const RE_JSON_LIKE = /\{[\s\S]*?\}/g;
const RE_WHITESPACE = /\s+/g;
const RE_SENTENCES = /[^.!?]+[.!?]+/g;

/**
 * Filter out large raw dumps, JSON, stack traces, and code blocks
 * to produce concise, natural spoken voice announcements.
 */
export function cleanTextForSpeech(rawText: string): string {
  if (!rawText) return '';

  let cleaned = rawText
    .replace(RE_CODE_BLOCKS, ' [code block omitted] ')
    .replace(RE_INLINE_CODE, '$1')
    .replace(RE_MD_LINKS, '$1')
    .replace(RE_MD_HEADERS, '')
    .replace(RE_MD_BULLETS, '')
    .replace(RE_MD_BOLD_ITALIC, '$1')
    .replace(RE_JSON_LIKE, '')
    .replace(RE_WHITESPACE, ' ')
    .trim();

  // If text is still very long (> 280 characters), give a natural summary of the first two sentences
  if (cleaned.length > 280) {
    const sentences = cleaned.match(RE_SENTENCES);
    if (sentences && sentences.length > 0) {
      cleaned = sentences.slice(0, 2).join(' ').trim();
    } else {
      cleaned = cleaned.slice(0, 260) + '...';
    }
  }

  return cleaned;
}

// Global cached voice list for instantaneous access on component mount
let globalVoicesCache: SpeechSynthesisVoice[] = [];
let isVoiceInitialized = false;

function findPreferredVoice(available: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!available || available.length === 0) return null;
  return (
    available.find(
      (v) =>
        v.lang.startsWith('en') &&
        (v.name.includes('Natural') ||
          v.name.includes('Google') ||
          v.name.includes('Samantha') ||
          v.name.includes('Daniel') ||
          v.name.includes('Karen'))
    ) ||
    available.find((v) => v.lang.startsWith('en')) ||
    available[0]
  );
}

// Attempt eager voice extraction at module load if window is ready
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  try {
    const initial = window.speechSynthesis.getVoices();
    if (initial && initial.length > 0) {
      globalVoicesCache = initial;
      isVoiceInitialized = true;
    }
  } catch {}
}

export function useSpeechSynthesis(
  _options: UseSpeechSynthesisOptions = {}
): UseSpeechSynthesisReturn {
  const isBrowserSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [isSupported] = useState<boolean>(isBrowserSupported);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => globalVoicesCache);
  const [selectedVoice, setSelectedVoiceState] = useState<SpeechSynthesisVoice | null>(() =>
    findPreferredVoice(globalVoicesCache)
  );

  // Default speak aloud to true (or saved preference)
  const [speakAloudEnabled, setSpeakAloudEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem('proofloop_voice_speak_aloud');
    return stored === null ? true : stored === 'true';
  });

  const [rate, setRateState] = useState<number>(() => {
    if (typeof window === 'undefined') return 1.0;
    const stored = localStorage.getItem('proofloop_voice_rate');
    const parsed = stored ? parseFloat(stored) : 1.0;
    return isNaN(parsed) ? 1.0 : parsed;
  });

  const [error, setError] = useState<string | null>(null);

  // Stable refs to prevent speak function recreation and dependency cascading
  const speakAloudEnabledRef = useRef(speakAloudEnabled);
  speakAloudEnabledRef.current = speakAloudEnabled;
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(selectedVoice);
  selectedVoiceRef.current = selectedVoice;

  // Stale utterance ID tracker to prevent race conditions during rapid interrupts
  const currentUtteranceIdRef = useRef<number>(0);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const setSelectedVoice = useCallback((voice: SpeechSynthesisVoice | null) => {
    selectedVoiceRef.current = voice;
    setSelectedVoiceState(voice);
  }, []);

  const setSpeakAloudEnabled = useCallback((enabled: boolean) => {
    setSpeakAloudEnabledState(enabled);
    speakAloudEnabledRef.current = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('proofloop_voice_speak_aloud', String(enabled));
      if (!enabled && window.speechSynthesis) {
        currentUtteranceIdRef.current++;
        try {
          window.speechSynthesis.cancel();
        } catch {}
        setIsSpeaking(false);
      }
    }
  }, []);

  const setRate = useCallback((newRate: number) => {
    setRateState(newRate);
    rateRef.current = newRate;
    if (typeof window !== 'undefined') {
      localStorage.setItem('proofloop_voice_rate', String(newRate));
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  // Initialize browser voices with cached fast-path
  useEffect(() => {
    if (!isBrowserSupported) return;

    const updateVoices = () => {
      try {
        const available = window.speechSynthesis.getVoices();
        if (available && available.length > 0) {
          globalVoicesCache = available;
          isVoiceInitialized = true;
          setVoices(available);

          if (!selectedVoiceRef.current) {
            const preferred = findPreferredVoice(available);
            selectedVoiceRef.current = preferred;
            setSelectedVoiceState(preferred);
          }
        }
      } catch {}
    };

    if (!isVoiceInitialized || globalVoicesCache.length === 0) {
      updateVoices();
    }

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
      if (window.speechSynthesis.onvoiceschanged === updateVoices) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [isBrowserSupported]);

  const stop = useCallback(() => {
    if (!isBrowserSupported) return;
    currentUtteranceIdRef.current++;
    try {
      window.speechSynthesis.cancel();
    } catch {}
    activeUtteranceRef.current = null;
    setIsSpeaking(false);
    setIsPaused(false);
  }, [isBrowserSupported]);

  const pause = useCallback(() => {
    if (!isBrowserSupported) return;
    try {
      window.speechSynthesis.pause();
      setIsPaused(true);
    } catch {}
  }, [isBrowserSupported]);

  const resume = useCallback(() => {
    if (!isBrowserSupported) return;
    try {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } catch {}
  }, [isBrowserSupported]);

  // High-performance speak method: stable reference, immediate dispatch, stale callback protection
  const speak = useCallback(
    (
      text: string,
      options?: { onEnd?: () => void; onError?: (err: string) => void; overrideSpeakAloud?: boolean }
    ) => {
      if (!isBrowserSupported) return;

      const shouldSpeak = options?.overrideSpeakAloud ?? speakAloudEnabledRef.current;
      if (!shouldSpeak) {
        options?.onEnd?.();
        return;
      }

      const cleaned = cleanTextForSpeech(text);
      if (!cleaned) return;

      // Assign new utterance ID to immediately invalidate callbacks of previous utterances
      const utteranceId = ++currentUtteranceIdRef.current;

      const wasSpeaking = window.speechSynthesis.speaking || window.speechSynthesis.pending;
      if (wasSpeaking) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }

      // Resume pipeline if paused
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch {}

      const executeUtterance = () => {
        // If another utterance has superseded this one while waiting for cancel queue, abort
        if (currentUtteranceIdRef.current !== utteranceId) {
          return;
        }

        try {
          const utterance = new SpeechSynthesisUtterance(cleaned);
          utterance.rate = rateRef.current;
          if (selectedVoiceRef.current) {
            utterance.voice = selectedVoiceRef.current;
          }

          utterance.onstart = () => {
            if (currentUtteranceIdRef.current !== utteranceId) return;
            setIsSpeaking(true);
            setIsPaused(false);
            setError(null);
          };

          utterance.onend = () => {
            if (currentUtteranceIdRef.current !== utteranceId) return;
            setIsSpeaking(false);
            setIsPaused(false);
            activeUtteranceRef.current = null;
            options?.onEnd?.();
          };

          utterance.onerror = (e) => {
            if (currentUtteranceIdRef.current !== utteranceId) return;
            // 'canceled' or 'interrupted' errors are normal when interrupted by new audio
            if (e.error !== 'canceled' && e.error !== 'interrupted') {
              const msg = `Speech playback failed: ${e.error || 'Audio error'}`;
              setError(msg);
              options?.onError?.(msg);
            }
            setIsSpeaking(false);
            setIsPaused(false);
            activeUtteranceRef.current = null;
          };

          activeUtteranceRef.current = utterance;
          window.speechSynthesis.speak(utterance);
        } catch (err: any) {
          if (currentUtteranceIdRef.current !== utteranceId) return;
          const msg = err?.message || 'Failed to start speech';
          setError(msg);
          options?.onError?.(msg);
          setIsSpeaking(false);
        }
      };

      // If we had to cancel an actively speaking utterance, a tiny 10ms micro-pause allows Chrome's
      // internal audio engine to clear its queue, preventing the new utterance from being dropped
      if (wasSpeaking) {
        setTimeout(executeUtterance, 10);
      } else {
        executeUtterance();
      }
    },
    [isBrowserSupported]
  );

  const speakProgress = useCallback(
    (message: string) => {
      speak(message, { overrideSpeakAloud: speakAloudEnabledRef.current });
    },
    [speak]
  );

  return {
    isSupported,
    isSpeaking,
    isPaused,
    speakAloudEnabled,
    setSpeakAloudEnabled,
    rate,
    setRate,
    voices,
    selectedVoice,
    setSelectedVoice,
    error,
    clearError,
    speak,
    speakProgress,
    stop,
    pause,
    resume,
  };
}
