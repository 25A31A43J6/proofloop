/**
 * ProofLoop Dedicated Voice Assistant Mode
 * Full conversational voice-first workspace with live audio waveform,
 * real-time transcription, state transitions, interruption handling, and safety approval gates.
 */

import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Play,
  Send,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Globe,
  CornerDownLeft,
} from 'lucide-react';
import {
  useSpeechRecognition,
  SUPPORTED_LOCALES,
  type SpeechLocale,
} from '../hooks/useSpeechRecognition.js';
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis.js';
import type { Workflow, InternshipApplicationData } from '../types/index.js';

export type VoiceAssistantState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'working'
  | 'awaiting-approval'
  | 'speaking';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitGoal: (goal: string) => Promise<void>;
  currentWorkflow: Workflow | null;
  currentApplication: InternshipApplicationData | null;
  onOpenApplicationReview?: () => void;
  onApproveApplication?: () => Promise<void>;
  isPlanning: boolean;
  isAutoPreparing?: boolean;
}

export const VoiceAssistantModal: React.FC<VoiceAssistantModalProps> = ({
  isOpen,
  onClose,
  onSubmitGoal,
  currentWorkflow,
  currentApplication,
  onOpenApplicationReview,
  onApproveApplication,
  isPlanning,
  isAutoPreparing,
}) => {
  const [editedTranscript, setEditedTranscript] = useState('');
  const [lastAssistantMessage, setLastAssistantMessage] = useState<string>(
    "I'm listening. Tell me what goal to follow through on."
  );

  const {
    isSupported: isRecSupported,
    status: recStatus,
    isListening,
    transcript,
    interimTranscript,
    fullTranscript,
    error: recError,
    locale,
    setLocale,
    startListening,
    stopListening,
    cancelListening,
    resetTranscript,
  } = useSpeechRecognition({
    continuous: true,
    interimResults: true,
  });

  const {
    isSupported: isSynthSupported,
    isSpeaking,
    speakAloudEnabled,
    setSpeakAloudEnabled,
    speak,
    stop: stopSpeaking,
  } = useSpeechSynthesis();

  // Sync speech recognition transcript into editable text
  useEffect(() => {
    if (fullTranscript) {
      setEditedTranscript(fullTranscript);
    }
  }, [fullTranscript]);

  // Derive conversational state
  let voiceState: VoiceAssistantState = 'idle';
  if (isSpeaking) {
    voiceState = 'speaking';
  } else if (isPlanning || isAutoPreparing) {
    voiceState = 'thinking';
  } else if (currentWorkflow?.status === 'active' && currentWorkflow.progress < 100) {
    // If we have an application waiting for approval
    if (
      currentApplication &&
      (currentApplication.applicationStatus === 'DRAFT_READY' || currentApplication.applicationStatus === 'AWAITING_APPROVAL')
    ) {
      voiceState = 'awaiting-approval';
    } else {
      voiceState = 'working';
    }
  } else if (isListening) {
    voiceState = 'listening';
  }

  // Handle auto-speak on state change
  useEffect(() => {
    if (isAutoPreparing) {
      const msg = 'I have created your workflow and am preparing your internship application materials.';
      setLastAssistantMessage(msg);
      speak(msg);
    }
  }, [isAutoPreparing, speak]);

  useEffect(() => {
    if (
      currentApplication &&
      currentApplication.applicationStatus === 'AWAITING_APPROVAL' &&
      voiceState === 'awaiting-approval'
    ) {
      const msg =
        'Your application draft is ready. Please review and approve it before I dispatch the email.';
      setLastAssistantMessage(msg);
      speak(msg);
    }
  }, [currentApplication?.applicationStatus, voiceState, speak]);

  // Start listening automatically when modal opens if supported
  useEffect(() => {
    if (isOpen && isRecSupported && !isListening) {
      resetTranscript();
      setEditedTranscript('');
      startListening();
      speak("ProofLoop voice assistant ready. How can I help you?");
    }
    return () => {
      stopListening();
      stopSpeaking();
    };
  }, [isOpen, isRecSupported]);

  if (!isOpen) return null;

  const handleMicToggle = async () => {
    if (isSpeaking) {
      // Interruption: stop speech and start listening
      stopSpeaking();
      await startListening();
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      setEditedTranscript('');
      await startListening();
    }
  };

  const handleSendTranscript = async () => {
    const textToSend = editedTranscript.trim();
    if (!textToSend) return;

    stopListening();
    stopSpeaking();
    resetTranscript();
    setEditedTranscript('');

    // Check if user is speaking an approval confirmation
    const lower = textToSend.toLowerCase();
    if (
      voiceState === 'awaiting-approval' &&
      (lower.includes('approve and send') ||
        lower.includes('confirm and send') ||
        lower.includes('yes send') ||
        lower.includes('approve'))
    ) {
      if (onApproveApplication) {
        speak('Submitting your verified application with human sign-off.');
        await onApproveApplication();
        return;
      }
    }

    // Otherwise, submit as a goal or task update
    setLastAssistantMessage(`Processing: "${textToSend}"...`);
    speak(`Got it. Decomposing workflow for ${textToSend}`);
    await onSubmitGoal(textToSend);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              PL
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <span>ProofLoop Voice Assistant</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-mono font-normal">
                  Alexa+ Voice Engine
                </span>
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Spoken instructions connect directly to verified MCP tools.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Locale selector */}
            <div className="relative flex items-center">
              <Globe className="w-3.5 h-3.5 text-neutral-400 absolute left-2 pointer-events-none" />
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as SpeechLocale)}
                className="pl-7 pr-3 py-1 text-xs rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 focus:outline-hidden"
                title="Select Speech Recognition Language"
              >
                {SUPPORTED_LOCALES.map((loc) => (
                  <option key={loc.code} value={loc.code}>
                    {loc.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Speak Aloud Toggle */}
            <button
              type="button"
              onClick={() => setSpeakAloudEnabled(!speakAloudEnabled)}
              className={`p-2 rounded-lg border transition-colors ${
                speakAloudEnabled
                  ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                  : 'border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
              }`}
              title={speakAloudEnabled ? 'Mute AI Spoken Replies' : 'Enable AI Spoken Replies'}
            >
              {speakAloudEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Close */}
            <button
              onClick={() => {
                stopListening();
                stopSpeaking();
                onClose();
              }}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Central Stage: Animated Mic & Waveform */}
        <div className="p-8 flex flex-col items-center justify-center space-y-6 bg-gradient-to-b from-neutral-50/50 to-transparent dark:from-neutral-900/50">
          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                voiceState === 'listening'
                  ? 'bg-emerald-500 animate-ping'
                  : voiceState === 'thinking'
                  ? 'bg-violet-500 animate-pulse'
                  : voiceState === 'working'
                  ? 'bg-blue-500 animate-spin'
                  : voiceState === 'awaiting-approval'
                  ? 'bg-amber-500 animate-pulse'
                  : voiceState === 'speaking'
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-neutral-400'
              }`}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
              {voiceState === 'listening' && 'Listening to you...'}
              {voiceState === 'thinking' && 'Decomposing Goal & Checking Tools...'}
              {voiceState === 'working' && 'Executing MCP Workflow Steps...'}
              {voiceState === 'awaiting-approval' && 'Awaiting Human Approval'}
              {voiceState === 'speaking' && 'Speaking Response Aloud'}
              {voiceState === 'idle' && 'Microphone Idle'}
            </span>
          </div>

          {/* Large Central Interactive Mic Button */}
          <div className="relative group">
            {/* Waveform rings when active */}
            {(isListening || isSpeaking) && (
              <div
                className={`absolute inset-0 rounded-full animate-ping opacity-25 scale-125 ${
                  isSpeaking ? 'bg-emerald-400' : 'bg-emerald-600'
                }`}
              />
            )}

            <button
              type="button"
              onClick={handleMicToggle}
              className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center shadow-lg transition-transform transform active:scale-95 ${
                isListening
                  ? 'bg-emerald-600 text-white ring-4 ring-emerald-200 dark:ring-emerald-900'
                  : isSpeaking
                  ? 'bg-emerald-500 text-white ring-4 ring-emerald-300 dark:ring-emerald-800'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
              title={
                isSpeaking
                  ? 'Click to Interrupt and Speak'
                  : isListening
                  ? 'Click to Stop Listening'
                  : 'Click to Start Voice Input'
              }
            >
              {isSpeaking ? (
                <Volume2 className="w-10 h-10 animate-bounce" />
              ) : isListening ? (
                <Mic className="w-10 h-10 animate-pulse" />
              ) : (
                <MicOff className="w-10 h-10" />
              )}
            </button>
          </div>

          {/* Subtitle / Interaction Guidance */}
          <div className="text-center max-w-md space-y-1">
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              {isSpeaking ? (
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  Assistant is speaking. Tap microphone or start speaking to interrupt.
                </span>
              ) : isListening ? (
                <span>Speak naturally. Your words are transcribed live below.</span>
              ) : (
                <span>Tap the microphone to speak, or type your goal in the box.</span>
              )}
            </p>
          </div>

          {/* Spoken AI Message Bubble */}
          {lastAssistantMessage && (
            <div className="w-full p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-100/70 dark:bg-neutral-800/60 text-xs text-neutral-800 dark:text-neutral-200 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-neutral-900 dark:text-white text-[11px] uppercase tracking-wider">
                    ProofLoop Spoken Output
                  </div>
                  <p className="mt-0.5 leading-relaxed">{lastAssistantMessage}</p>
                </div>
              </div>
              {isSpeaking && (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="px-2 py-1 text-[11px] font-medium bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded text-neutral-800 dark:text-neutral-200 shrink-0"
                >
                  Stop Audio
                </button>
              )}
            </div>
          )}

          {/* Consequential Approval Alert in Voice Mode */}
          {voiceState === 'awaiting-approval' && currentApplication && (
            <div className="w-full p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/40 space-y-2">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 flex-1">
                  <div className="font-bold text-amber-900 dark:text-amber-200 text-xs">
                    Approval Required Before Email Dispatch
                  </div>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    Draft prepared for <span className="font-semibold">{currentApplication.applicantName}</span> to{' '}
                    <span className="font-semibold">{currentApplication.recipientEmail}</span> ({currentApplication.companyName}).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                {onOpenApplicationReview && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenApplicationReview();
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md bg-white dark:bg-neutral-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100 transition-colors"
                  >
                    Open Application Review Panel
                  </button>
                )}
                {onApproveApplication && (
                  <button
                    type="button"
                    onClick={async () => {
                      speak('Human approval received. Executing verified email dispatch.');
                      await onApproveApplication();
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                  >
                    Approve & Dispatch Now
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Live Transcription & Editable Input Box */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-neutral-700 dark:text-neutral-300">
              Live Transcription (Editable):
            </span>
            {recStatus === 'permission-denied' && (
              <span className="text-rose-600 dark:text-rose-400 font-medium">
                Mic permission denied. Please allow mic or type below.
              </span>
            )}
            {!isRecSupported && (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                Speech recognition unavailable in this browser. Use text input.
              </span>
            )}
          </div>

          <div className="relative">
            <textarea
              rows={2}
              value={editedTranscript}
              onChange={(e) => setEditedTranscript(e.target.value)}
              placeholder="Spoken words will appear here. You can also edit or type manually..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-sans"
            />
          </div>

          {/* Sample voice command chips */}
          <div className="flex items-center gap-2 overflow-x-auto text-[11px] pb-1">
            <span className="text-neutral-400 shrink-0 font-medium">Try saying:</span>
            <button
              type="button"
              onClick={() => {
                setEditedTranscript('Help me prepare and submit my internship application before Friday.');
              }}
              className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-medium rounded-md border border-emerald-200 dark:border-emerald-800 whitespace-nowrap transition-colors"
            >
              “Help me prepare and submit my internship application before Friday.”
            </button>
            <button
              type="button"
              onClick={() => {
                setEditedTranscript('Check if my resume and cover letter are ready.');
              }}
              className="px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-md border border-neutral-200 dark:border-neutral-700 whitespace-nowrap transition-colors"
            >
              “Check if my resume and cover letter are ready.”
            </button>
          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => {
                resetTranscript();
                setEditedTranscript('');
              }}
              className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              Clear
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSendTranscript}
                disabled={!editedTranscript.trim() || isPlanning}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span>Execute Voice Intent</span>
                <CornerDownLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
