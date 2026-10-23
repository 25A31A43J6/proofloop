/**
 * ProofLoop Background Voice Controller & Context
 * Amazon Developer Hackathon 2026 — Alexa+ Track
 *
 * Provides a persistent, application-level voice controller that runs entirely
 * in the background without opening separate modals, drawers, or dashboards.
 *
 * Supports 4 Voice Modes:
 * - Mode A: Push-to-Talk (record, review/edit transcript inline, submit)
 * - Mode B: Hands-Free Conversation (continuous multi-turn dialog, slot-filling, auto-resumes after TTS)
 * - Mode C: Wake Phrase ("Hey ProofLoop", passive detection during active session, honest capability notice)
 * - Mode D: Background Workflow Continuation (query progress, "What is left?", "Tell me the result", "Why did it fail?", "Retry that", "Run all")
 *
 * Features:
 * - Exact status labels: Idle, Listening, Processing, Working, Awaiting Approval, Speaking, Paused, Error
 * - Default locale: en-IN (English - India), supporting en-US, te-IN, hi-IN
 * - Multi-turn conversational slot filling for goals (e.g., target company, role title)
 * - Cryptographic draft hash verification for consequential voice approvals
 * - Self-transcription prevention while speech synthesis is active
 * - Tab visibility and backgrounding resilience
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import {
  useSpeechRecognition,
  type SpeechLocale,
  type RecognitionStatus,
  SUPPORTED_LOCALES,
} from '../hooks/useSpeechRecognition.js';
import {
  useSpeechSynthesis,
  cleanTextForSpeech,
} from '../hooks/useSpeechSynthesis.js';
import {
  resolveOptionFromElement,
  detectQuestionIntent,
  answerQuestionAboutOption,
  EXPLAINABLE_OPTIONS,
  type ExplainableOption,
  type QuestionIntent,
} from '../services/optionExplanationService.js';
import { classifyCommandIntent, executeCommand } from '../services/commandRouter.js';
import * as api from '../services/api.js';
import type {
  Workflow,
  WorkflowStep,
  InternshipApplicationData,
  ApprovalRecord,
} from '../types/index.js';

export type VoiceMode = 'hands-free' | 'push-to-talk' | 'wake-phrase';

export type VoiceStatus =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'thinking' // backward compat alias for processing
  | 'working'
  | 'awaiting-approval'
  | 'speaking'
  | 'paused'
  | 'error'
  | 'permission-denied'
  | 'unsupported';

export type ExactDisplayStatus =
  | 'Idle'
  | 'Listening'
  | 'Processing'
  | 'Working'
  | 'Awaiting Approval'
  | 'Speaking'
  | 'Paused'
  | 'Error';

export interface PendingVoiceApproval {
  type: 'application_dispatch' | 'generic_step';
  applicationId?: string;
  workflowId?: string;
  stepId?: string;
  draftHash?: string;
  recipientEmail?: string;
  companyName?: string;
  summary: string;
}

export type ConversationSlot =
  | 'asking_company'
  | 'asking_role'
  | 'asking_resume_ready'
  | 'asking_resume_choice'
  | null;

export interface ConversationSlotContext {
  activeSlot: ConversationSlot;
  companyName?: string;
  previousCompanyName?: string;
  roleTitle?: string;
  previousRoleTitle?: string;
  resumeStatus?: 'ready' | 'not_ready';
  resumeChoice?: 'existing' | 'new';
  originalGoal?: string;
  lastQuestion?: string;
  lastTopic?: string;
  turnsCount?: number;
}

export interface VoiceContextValue {
  // Voice engine state
  status: VoiceStatus;
  statusLabel: ExactDisplayStatus;
  isActive: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isPaused: boolean;
  isSupported: boolean;
  continuousMode: boolean;
  setContinuousMode: (val: boolean) => void;
  voiceMode: VoiceMode;
  setVoiceMode: (mode: VoiceMode) => void;
  wakePhrase: string;
  setWakePhrase: (phrase: string) => void;
  locale: SpeechLocale;
  setLocale: (loc: SpeechLocale) => void;
  speakAloudEnabled: boolean;
  setSpeakAloudEnabled: (val: boolean) => void;
  rate: number;
  setRate: (rate: number) => void;
  voices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  setSelectedVoice: (voice: SpeechSynthesisVoice | null) => void;
  speak: (text: string, options?: { onEnd?: () => void; overrideSpeakAloud?: boolean }) => void;

  // Real-time voice data
  transcript: string;
  interimTranscript: string;
  lastAssistantMessage: string | null;
  errorMessage: string | null;

  // Context-Aware Click-to-Explain
  clickToExplainEnabled: boolean;
  setClickToExplainEnabled: (enabled: boolean) => void;
  lastExplainedOption: ExplainableOption | null;
  explanationFallbackHint: string | null;
  explainOption: (option: ExplainableOption | string, options?: { forceSpeak?: boolean }) => void;
  clearExplainedOption: () => void;

  // Mode A: Push to Talk staged transcript preview & review
  stagedTranscript: string | null;
  setStagedTranscript: (text: string | null) => void;
  submitStagedTranscript: () => Promise<void>;
  clearStagedTranscript: () => void;

  // Multi-turn conversational slot context
  slotContext: ConversationSlotContext;
  resetConversation: () => void;

  // Conversational approval state
  pendingApproval: PendingVoiceApproval | null;

  // Controls
  toggleVoice: () => Promise<void>;
  startVoice: () => Promise<void>;
  stopVoice: () => void;
  muteOrStopAudio: () => void;
  clearError: () => void;

  // Manual approval trigger / fallbacks
  confirmVoiceApproval: () => Promise<void>;
  cancelVoiceApproval: () => void;

  // Direct utterance execution
  processSpokenCommand: (commandText: string) => Promise<void>;

  // App sync & navigation
  registerNavigationHandler: (navigateFn: (tab: string) => void) => () => void;
  registerCommandExecutor: (executorFn: (cmd: string) => Promise<any>) => () => void;
  registerWorkflowSync: (syncFn: () => Promise<void>) => () => void;
  setActiveWorkflowContext: (
    workflow: Workflow | null,
    application: InternshipApplicationData | null
  ) => void;
}

const VoiceContext = createContext<VoiceContextValue | undefined>(undefined);

export interface VoiceProviderProps {
  children: ReactNode;
}

export const VoiceProvider: React.FC<VoiceProviderProps> = ({ children }) => {
  // Voice mode preference: defaults to 'push-to-talk' (Mode A)
  const [voiceMode, setVoiceModeState] = useState<VoiceMode>(() => {
    if (typeof window === 'undefined') return 'push-to-talk';
    const saved = localStorage.getItem('proofloop_voice_mode');
    if (saved === 'push-to-talk' || saved === 'wake-phrase' || saved === 'hands-free') {
      return saved;
    }
    return 'push-to-talk';
  });

  const [wakePhrase, setWakePhraseState] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Hey ProofLoop';
    return localStorage.getItem('proofloop_wake_phrase') || 'Hey ProofLoop';
  });

  // Continuous mode state
  const [continuousMode, setContinuousModeState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('proofloop_voice_continuous');
    return saved === null ? false : saved === 'true';
  });

  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [lastAssistantMessage, setLastAssistantMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<PendingVoiceApproval | null>(null);

  // Click-to-Explain preference: defaults to ON (true) to preserve intended baseline behavior
  const [clickToExplainEnabled, setClickToExplainEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('proofloop_click_to_explain');
    return saved === null ? true : saved === 'true';
  });

  const setClickToExplainEnabled = useCallback((enabled: boolean) => {
    setClickToExplainEnabledState(enabled);
    if (!enabled) {
      setExplanationFallbackHint(null);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('proofloop_click_to_explain', String(enabled));
    }
  }, []);

  const clickToExplainEnabledRef = useRef<boolean>(clickToExplainEnabled);
  clickToExplainEnabledRef.current = clickToExplainEnabled;

  // Click-to-Explain state
  const [lastExplainedOption, setLastExplainedOption] = useState<ExplainableOption | null>(null);
  const [explanationFallbackHint, setExplanationFallbackHint] = useState<string | null>(null);
  const lastExplainedOptionRef = useRef<ExplainableOption | null>(null);
  lastExplainedOptionRef.current = lastExplainedOption;
  const lastExplainedTimeRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });
  const hintTimeoutRef = useRef<any>(null);

  // Staged transcript for Push to Talk mode
  const [stagedTranscript, setStagedTranscript] = useState<string | null>(null);

  // Multi-turn conversational slots
  const [slotContext, setSlotContext] = useState<ConversationSlotContext>({
    activeSlot: null,
  });

  // Internal references
  const navigationHandlerRef = useRef<((tab: string) => void) | null>(null);
  const commandExecutorRef = useRef<((cmd: string) => Promise<any>) | null>(null);
  const syncCallbacksRef = useRef<Set<() => Promise<void>>>(new Set());
  const currentWorkflowRef = useRef<Workflow | null>(null);
  const currentApplicationRef = useRef<InternshipApplicationData | null>(null);
  const isExecutingRef = useRef<boolean>(false);
  const lastProcessedTranscriptRef = useRef<string>('');
  const lastProcessedTimeRef = useRef<number>(0);
  const isSelfSpeakingRef = useRef<boolean>(false);
  const voiceModeRef = useRef<VoiceMode>(voiceMode);
  voiceModeRef.current = voiceMode;
  const wakePhraseRef = useRef<string>(wakePhrase);
  wakePhraseRef.current = wakePhrase;
  const slotContextRef = useRef<ConversationSlotContext>(slotContext);
  slotContextRef.current = slotContext;
  const pendingApprovalRef = useRef<PendingVoiceApproval | null>(pendingApproval);
  pendingApprovalRef.current = pendingApproval;
  const startListeningRef = useRef<() => Promise<void>>(async () => {});

  // Initialize Speech Synthesis
  const {
    isSupported: isSynthSupported,
    isSpeaking,
    speakAloudEnabled,
    setSpeakAloudEnabled,
    rate,
    setRate,
    voices,
    selectedVoice,
    setSelectedVoice,
    error: synthError,
    clearError: clearSynthError,
    speak: synthSpeak,
    stop: synthStop,
  } = useSpeechSynthesis();

  // Track speech synthesis to prevent self-transcription
  useEffect(() => {
    isSelfSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    if (synthError) {
      setErrorMessage(synthError);
    }
  }, [synthError]);

  const isListeningRef = useRef<boolean>(false);

  // Safe speak function with automatic state transition
  // Within Hands-Free Conversation, resume listening after each spoken response ONLY when that mode is already enabled.
  // Do not activate the microphone automatically if it is disabled.
  const speakAloud = useCallback(
    (text: string, options?: { onEnd?: () => void; resumeListening?: boolean }) => {
      const cleaned = cleanTextForSpeech(text);
      if (!cleaned) return;

      setLastAssistantMessage(cleaned);
      if (!speakAloudEnabled) {
        options?.onEnd?.();
        return;
      }

      // Explicitly determine whether mic should resume after speaking
      const wasListening = isListeningRef.current;
      const shouldResumeMic =
        options?.resumeListening !== undefined
          ? options.resumeListening
          : wasListening && voiceModeRef.current === 'hands-free';

      setVoiceStatus('speaking');
      synthSpeak(cleaned, {
        onEnd: () => {
          options?.onEnd?.();
          // After speaking finishes, determine the next state
          if (pendingApprovalRef.current) {
            setVoiceStatus('awaiting-approval');
            if (shouldResumeMic && voiceModeRef.current === 'hands-free') {
              startListeningRef.current?.().catch(() => {});
            }
          } else if (slotContextRef.current.activeSlot) {
            // Waiting for conversational slot answer
            if (shouldResumeMic && voiceModeRef.current === 'hands-free') {
              setVoiceStatus('listening');
              startListeningRef.current?.().catch(() => {});
            } else {
              setVoiceStatus('idle');
            }
          } else if (shouldResumeMic && voiceModeRef.current === 'hands-free') {
            setVoiceStatus('listening');
            startListeningRef.current?.().catch(() => {});
          } else {
            setVoiceStatus('idle');
          }
        },
        onError: (err) => {
          setErrorMessage(err);
          setVoiceStatus('error');
        },
      });
    },
    [speakAloudEnabled, synthSpeak]
  );

  // Trigger app data sync
  const triggerAppSync = useCallback(async () => {
    const promises = Array.from(syncCallbacksRef.current).map((cb) => cb());
    await Promise.allSettled(promises);
  }, []);

  // Update voice mode
  const setVoiceMode = useCallback((mode: VoiceMode) => {
    setVoiceModeState(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('proofloop_voice_mode', mode);
    }
  }, []);

  // Update wake phrase
  const setWakePhrase = useCallback((phrase: string) => {
    setWakePhraseState(phrase);
    if (typeof window !== 'undefined') {
      localStorage.setItem('proofloop_wake_phrase', phrase);
    }
  }, []);

  // Persist continuous mode
  const setContinuousMode = useCallback((enabled: boolean) => {
    setContinuousModeState(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('proofloop_voice_continuous', String(enabled));
    }
  }, []);

  // Reset conversation slots
  const resetConversation = useCallback(() => {
    setSlotContext({ activeSlot: null });
  }, []);

  // Forward declarations for mutual references
  const processSpokenCommandRef = useRef<(cmd: string) => Promise<void>>(async () => {});

  // Speech Recognition Hook
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
    locale: 'en-IN',
    continuous: true,
    interimResults: true,
    maxRetries: 5,
    onFinalTranscript: (finalText) => {
      // 1. Guard against self-transcription
      if (isSelfSpeakingRef.current) return;
      const text = finalText.trim();
      if (!text) return;

      const currentMode = voiceModeRef.current;

      // Mode A: Push-to-Talk
      if (currentMode === 'push-to-talk') {
        // Stage for user review and inline edit instead of auto-submitting
        setStagedTranscript(text);
        setVoiceStatus('idle');
        return;
      }

      // Mode C: Wake Phrase
      if (currentMode === 'wake-phrase') {
        // If actively in approval or slot-filling question, do not require repeating wake phrase
        const isConversationalFollowup =
          Boolean(pendingApprovalRef.current) || Boolean(slotContextRef.current.activeSlot);

        if (!isConversationalFollowup) {
          const wp = wakePhraseRef.current.toLowerCase().trim();
          const lower = text.toLowerCase();
          const wpVariants = [
            wp,
            'hey proofloop',
            'hey proof loop',
            'proofloop',
            'alexa',
          ];
          const matchedVariant = wpVariants.find((v) => lower.includes(v));

          if (!matchedVariant) {
            // Ignore speech that does not contain wake phrase
            return;
          }

          // Strip wake phrase from utterance
          const regex = new RegExp(`^.*?${matchedVariant}[,\\s]*`, 'i');
          const commandAfterWake = text.replace(regex, '').trim();

          if (!commandAfterWake) {
            // User just said the wake phrase
            speakAloud("I'm listening. How can I help you?");
            return;
          }

          processSpokenCommandRef.current(commandAfterWake);
          return;
        }
      }

      // Mode B: Hands-Free Continuous Conversation (or follow-up)
      processSpokenCommandRef.current(text);
    },
    onError: (err) => {
      setErrorMessage(err);
      if (recStatus === 'permission-denied') {
        setVoiceStatus('permission-denied');
      } else {
        setVoiceStatus('error');
      }
    },
  });

  isListeningRef.current = isListening;
  startListeningRef.current = startListening;
  const isSupported = isRecSupported && isSynthSupported;

  // Context-Aware Click-to-Explain Handler
  const explainOption = useCallback(
    (optionOrKey: ExplainableOption | string, options?: { forceSpeak?: boolean }) => {
      let option: ExplainableOption | null = null;
      if (typeof optionOrKey === 'string') {
        option = EXPLAINABLE_OPTIONS[optionOrKey] || null;
      } else {
        option = optionOrKey;
      }

      if (!option) {
        // Section 6 Reliable Fallback:
        // If the assistant cannot determine what an option does, say that its function could not be determined
        const fallbackText = 'The function of this option could not be determined from the current interface context.';
        const isVoiceActive = isSynthSupported && voiceStatus !== 'paused' && voiceStatus !== 'error';
        if (speakAloudEnabled && isVoiceActive) {
          speakAloud(fallbackText, {
            resumeListening: isListeningRef.current && voiceModeRef.current === 'hands-free',
          });
        } else {
          setExplanationFallbackHint(fallbackText);
          if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
          hintTimeoutRef.current = setTimeout(() => {
            setExplanationFallbackHint(null);
          }, 6000);
        }
        return;
      }

      const now = Date.now();
      // Do not repeatedly explain the same option if it has already been explained during current interaction within 3.5s
      if (
        !options?.forceSpeak &&
        lastExplainedTimeRef.current.id === option.id &&
        now - lastExplainedTimeRef.current.time < 3500
      ) {
        return;
      }

      lastExplainedTimeRef.current = { id: option.id, time: now };
      setLastExplainedOption(option);

      // Check whether voice assistant is active and unmuted
      // Active: speech synthesis is supported and assistant is not paused or errored
      // Unmuted: speakAloudEnabled is true
      const isVoiceActive = isSynthSupported && voiceStatus !== 'paused' && voiceStatus !== 'error';
      const isUnmuted = speakAloudEnabled;

      if (isVoiceActive && isUnmuted) {
        // Speak the explanation aloud without opening a separate panel or navigating away
        // Preserve current mic state: do NOT activate mic automatically if it was disabled
        speakAloud(option.conciseExplanation, {
          resumeListening: isListeningRef.current && voiceModeRef.current === 'hands-free',
        });
      } else {
        // Fallback accessible interface hint when voice is inactive or muted
        const hint = `${option.title}: ${option.conciseExplanation}`;
        setExplanationFallbackHint(hint);
        if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
        hintTimeoutRef.current = setTimeout(() => {
          setExplanationFallbackHint(null);
        }, 6000);
      }
    },
    [speakAloudEnabled, isSynthSupported, voiceStatus, speakAloud]
  );

  const clearExplainedOption = useCallback(() => {
    setLastExplainedOption(null);
    setExplanationFallbackHint(null);
  }, []);

  const explainOptionRef = useRef(explainOption);
  explainOptionRef.current = explainOption;

  // Safe, non-interfering delegated document click handler for Click-to-Explain
  // Attached once with zero listener churn on re-renders
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleDocumentClick = (event: MouseEvent) => {
      // If Click-to-Explain is toggled OFF, bypass automatic click explanations completely
      if (!clickToExplainEnabledRef.current) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      // Identify selected option without blocking normal click execution
      const option = resolveOptionFromElement(target);
      if (option) {
        explainOptionRef.current(option);
      }
    };

    // Capture phase ensures we intercept before any child stopPropagation,
    // while passive: true guarantees zero interference with forms, buttons, links, or navigation
    document.addEventListener('click', handleDocumentClick, { capture: true, passive: true });
    return () => {
      document.removeEventListener('click', handleDocumentClick, { capture: true });
    };
  }, []);

  // Execute approval confirmation
  const confirmVoiceApproval = useCallback(async () => {
    const approval = pendingApprovalRef.current;
    if (!approval) return;

    setVoiceStatus('working');
    isExecutingRef.current = true;

    try {
      if (approval.type === 'application_dispatch') {
        const appId = approval.applicationId;
        const draftHash = approval.draftHash;

        if (!appId || !draftHash) {
          throw new Error('Missing verification signature for application dispatch.');
        }

        const res = await api.approveAndSendApplication(appId, draftHash);
        await triggerAppSync();

        setPendingApproval(null);

        if (res.success) {
          speakAloud(
            `Application successfully verified and sent to ${approval.recipientEmail || 'recipient'}. Provider confirmation recorded.`
          );
        } else if (res.status === 'NOT_CONFIGURED') {
          speakAloud(
            'Draft is verified and preserved. Email provider credentials are not configured in environment, so dispatch was safely stopped.'
          );
        } else {
          speakAloud(`Dispatch could not be completed: ${res.error || 'Check details'}. Your draft remains intact.`);
        }
      } else if (approval.type === 'generic_step') {
        const { workflowId, stepId } = approval;
        if (workflowId && stepId) {
          const res = await api.executeStep(workflowId, stepId);
          await triggerAppSync();
          setPendingApproval(null);

          if (res.success) {
            speakAloud('Action approved and verified successfully.');
          } else {
            speakAloud(`Step execution failed: ${res.error || 'Check step details'}.`);
          }
        }
      }
    } catch (err: any) {
      setPendingApproval(null);
      speakAloud(`Approval execution failed: ${err.message}. Your work has been preserved.`);
    } finally {
      isExecutingRef.current = false;
      if (voiceModeRef.current !== 'hands-free') {
        stopListening();
      }
    }
  }, [triggerAppSync, speakAloud, stopListening]);

  // Cancel approval
  const cancelVoiceApproval = useCallback(() => {
    setPendingApproval(null);
    speakAloud('Action cancelled. The draft and workflow remain safely preserved.');
  }, [speakAloud]);

  // Submit staged transcript (Mode A: Push-to-Talk review)
  const submitStagedTranscript = useCallback(async () => {
    if (!stagedTranscript) return;
    const textToSubmit = stagedTranscript;
    setStagedTranscript(null);
    await processSpokenCommandRef.current(textToSubmit);
  }, [stagedTranscript]);

  const clearStagedTranscript = useCallback(() => {
    setStagedTranscript(null);
  }, []);

  // Helper: query remaining workflow milestones (Mode D)
  const handleQueryRemainingSteps = useCallback(async () => {
    try {
      const workflows: Workflow[] = await api.fetchWorkflows();
      const activeWf =
        workflows.find((w: Workflow) => w.status === 'active') ||
        (currentWorkflowRef.current?.id
          ? workflows.find((w: Workflow) => w.id === currentWorkflowRef.current?.id)
          : null) ||
        workflows[0];

      if (!activeWf || !activeWf.steps || activeWf.steps.length === 0) {
        speakAloud('There are no active workflows or milestones right now.');
        return;
      }

      const remaining = activeWf.steps.filter((s: WorkflowStep) => s.status !== 'verified_complete');
      if (remaining.length === 0) {
        speakAloud(
          `All ${activeWf.steps.length} milestones in the workflow "${activeWf.goal}" are completed and verified.`
        );
      } else {
        const stepTitles = remaining.map((s: WorkflowStep) => s.title).slice(0, 3).join(', ');
        const andMore = remaining.length > 3 ? `, and ${remaining.length - 3} more` : '';
        speakAloud(
          `There are ${remaining.length} milestones left: ${stepTitles}${andMore}.`
        );
      }
    } catch (err: any) {
      speakAloud(`Could not retrieve workflow progress: ${err.message}`);
    }
  }, [speakAloud]);

  // Helper: query workflow result (Mode D)
  const handleQueryWorkflowResult = useCallback(async () => {
    try {
      const workflows: Workflow[] = await api.fetchWorkflows();
      const activeWf =
        (currentWorkflowRef.current?.id
          ? workflows.find((w: Workflow) => w.id === currentWorkflowRef.current?.id)
          : null) || workflows[0];

      if (!activeWf) {
        speakAloud('No workflows have been executed yet.');
        return;
      }

      const completed = activeWf.steps.filter((s: WorkflowStep) => s.status === 'verified_complete').length;
      const total = activeWf.steps.length;

      if (activeWf.status === 'completed') {
        speakAloud(
          `Workflow completed successfully. All ${total} milestones have cryptographic outcome proofs recorded.`
        );
      } else if (activeWf.status === 'failed') {
        speakAloud(
          `Workflow is paused. Completed ${completed} of ${total} milestones with a failure.`
        );
      } else {
        speakAloud(
          `Workflow "${activeWf.goal}" is active. Completed ${completed} of ${total} milestones.`
        );
      }
    } catch (err: any) {
      speakAloud(`Could not retrieve results: ${err.message}`);
    }
  }, [speakAloud]);

  // Helper: query failure reason (Mode D)
  const handleQueryFailureReason = useCallback(async () => {
    try {
      const workflows: Workflow[] = await api.fetchWorkflows();
      const activeWf =
        (currentWorkflowRef.current?.id
          ? workflows.find((w: Workflow) => w.id === currentWorkflowRef.current?.id)
          : null) || workflows[0];

      if (!activeWf) {
        speakAloud('No workflows found.');
        return;
      }

      const failedStep = activeWf.steps.find(
        (s: WorkflowStep) => s.status === 'failed' || Boolean(s.failureReason)
      );

      if (!failedStep) {
        speakAloud('There are no failed milestones in the active workflow.');
      } else {
        speakAloud(
          `Milestone "${failedStep.title}" failed. Reason: ${failedStep.failureReason || 'Tool execution error'}. You can say "Retry that" to recover.`
        );
      }
    } catch (err: any) {
      speakAloud(`Error checking failure: ${err.message}`);
    }
  }, [speakAloud]);

  // Helper: retry failed step (Mode D)
  const handleRetryFailedStep = useCallback(async () => {
    try {
      const workflows: Workflow[] = await api.fetchWorkflows();
      const activeWf =
        (currentWorkflowRef.current?.id
          ? workflows.find((w: Workflow) => w.id === currentWorkflowRef.current?.id)
          : null) || workflows[0];

      if (!activeWf) {
        speakAloud('No active workflow found to retry.');
        return;
      }

      const failedStep = activeWf.steps.find((s: WorkflowStep) => s.status === 'failed');
      if (!failedStep) {
        speakAloud('There are no failed milestones to retry.');
        return;
      }

      setVoiceStatus('working');
      isExecutingRef.current = true;
      speakAloud(`Retrying milestone "${failedStep.title}" now.`);

      const res = await api.recoverStep(activeWf.id, failedStep.id);
      await triggerAppSync();

      if (res.success) {
        speakAloud(`Milestone "${failedStep.title}" recovered and verified successfully.`);
      } else {
        speakAloud(`Retry failed: ${res.message || 'Check step details'}.`);
      }
    } catch (err: any) {
      speakAloud(`Retry failed: ${err.message}`);
    } finally {
      isExecutingRef.current = false;
    }
  }, [speakAloud, triggerAppSync]);

  // Helper: run all milestones (Mode D)
  const handleRunAllMilestones = useCallback(async () => {
    try {
      const workflows: Workflow[] = await api.fetchWorkflows();
      const activeWf =
        (currentWorkflowRef.current?.id
          ? workflows.find((w: Workflow) => w.id === currentWorkflowRef.current?.id)
          : null) || workflows[0];

      if (!activeWf) {
        speakAloud('No workflow available to execute.');
        return;
      }

      setVoiceStatus('working');
      isExecutingRef.current = true;
      speakAloud(`Running all milestones for workflow "${activeWf.goal}".`);

      await api.runAllSteps(activeWf.id);
      await triggerAppSync();
      speakAloud('Milestones executed and verified with cryptographic evidence.');
    } catch (err: any) {
      speakAloud(`Execution error: ${err.message}`);
    } finally {
      isExecutingRef.current = false;
    }
  }, [speakAloud, triggerAppSync]);

  // Autonomous internship goal execution helper
  const startInternshipWorkflowPreparation = useCallback(
    async (
      goalDescription: string,
      company?: string,
      role?: string,
      resumeChoice?: 'existing' | 'new'
    ) => {
      setVoiceStatus('working');
      isExecutingRef.current = true;
      const targetCompany = company || 'target company';
      const targetRole = role || 'internship';

      speakAloud(`Preparing your ${targetRole} application for ${targetCompany} now.`);

      try {
        const newWf = await api.createWorkflow(goalDescription);
        currentWorkflowRef.current = newWf;
        await triggerAppSync();

        const prepRes = await api.autoPrepareWorkflow(newWf.id);
        currentWorkflowRef.current = prepRes.workflow;
        currentApplicationRef.current = prepRes.application || null;

        const app = prepRes.application;
        if (app) {
          // Customize application details if explicit company or role provided
          if (company || role) {
            try {
              const updates: any = {};
              if (company) updates.companyName = company;
              if (role) updates.positionTitle = role;
              const refreshedApp = await api.updateApplication(app.id, updates);
              currentApplicationRef.current = refreshedApp;
            } catch {}
          }

          const activeApp = currentApplicationRef.current || app;
          if (activeApp.approvedHash) {
            setPendingApproval({
              type: 'application_dispatch',
              applicationId: activeApp.id,
              workflowId: newWf.id,
              draftHash: activeApp.approvedHash,
              recipientEmail: activeApp.recipientEmail,
              companyName: activeApp.companyName,
              summary: `Internship application for ${activeApp.applicantName} to ${activeApp.companyName} (${activeApp.recipientEmail})`,
            });
            setVoiceStatus('awaiting-approval');

            // Exact requested confirmation question
            speakAloud('Your internship application is ready. Would you like me to send it?');
          } else {
            speakAloud('Internship workflow milestones prepared and verified.');
          }
        } else {
          speakAloud('Internship workflow milestones prepared and verified.');
        }

        await triggerAppSync();
      } catch (err: any) {
        speakAloud(`Could not complete preparation: ${err.message}`);
      } finally {
        isExecutingRef.current = false;
      }
    },
    [speakAloud, triggerAppSync]
  );

  // Main natural command and multi-turn dialogue processor
  const processSpokenCommand = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text) return;

      // Duplicate prevention within 2 seconds
      const now = Date.now();
      if (
        text.toLowerCase() === lastProcessedTranscriptRef.current.toLowerCase() &&
        now - lastProcessedTimeRef.current < 2000
      ) {
        return;
      }
      lastProcessedTranscriptRef.current = text;
      lastProcessedTimeRef.current = now;

      resetTranscript();
      const lower = text.toLowerCase();

      // 1. Voice controls: Stop / Mute / Cancel / Pause
      if (
        lower === 'stop' ||
        lower === 'mute' ||
        lower === 'pause' ||
        lower === 'quiet' ||
        lower === 'shut up'
      ) {
        synthStop();
        stopListening();
        setVoiceStatus('idle');
        setSlotContext({ activeSlot: null });
        return;
      }

      // 2. Check if awaiting consequential approval
      if (pendingApprovalRef.current) {
        // Positive approval
        if (
          lower === 'yes' ||
          lower.includes('yes send') ||
          lower.includes('yes, send') ||
          lower.includes('send it') ||
          lower.includes('approve') ||
          lower.includes('confirm') ||
          lower.includes('authorize') ||
          lower.includes('go ahead')
        ) {
          await confirmVoiceApproval();
          return;
        }

        // Cancellation / rejection
        if (
          lower === 'no' ||
          lower.includes("don't send") ||
          lower.includes('dont send') ||
          lower.includes('do not send') ||
          lower.includes('cancel') ||
          lower.includes('reject') ||
          lower.includes('stop')
        ) {
          cancelVoiceApproval();
          return;
        }

        // Return to edit / change
        if (
          lower.includes('change the subject') ||
          lower.includes('edit') ||
          lower.includes('change') ||
          lower.includes('modify')
        ) {
          setPendingApproval(null);
          speakAloud(
            'Draft is open for editing in the application workspace. You can modify any fields before sending.'
          );
          return;
        }

        // Contextual "Why?" during approval
        if (lower === 'why' || lower.includes('why do i need') || lower.includes('why is this needed')) {
          speakAloud(
            "ProofLoop requires your explicit sign-off before sending any emails or submitting applications so that no consequential action is taken without your review. Say 'Yes, send it' to approve, or 'Cancel' to hold."
          );
          return;
        }

        // Clarification prompt
        speakAloud(
          "I didn't quite catch that. Please say 'Yes, send it' to approve, or 'No, don't send it' to cancel."
        );
        return;
      }

      // 3. Natural Questions About Options (Click-to-Explain Follow-ups)
      const questionIntent = detectQuestionIntent(lower);
      if (questionIntent !== 'unknown') {
        // Check if an option was explicitly named in the utterance
        let targetOption: ExplainableOption | null = null;
        for (const opt of Object.values(EXPLAINABLE_OPTIONS)) {
          if (lower.includes(opt.title.toLowerCase())) {
            targetOption = opt;
            break;
          }
          if (opt.keywords?.some((kw) => lower.includes(kw.toLowerCase()))) {
            targetOption = opt;
            break;
          }
        }

        // If not named, use the most recently selected/clicked option
        if (!targetOption && lastExplainedOptionRef.current) {
          targetOption = lastExplainedOptionRef.current;
        }

        if (targetOption) {
          setLastExplainedOption(targetOption);
          const answer = answerQuestionAboutOption(targetOption, questionIntent);
          speakAloud(answer);
          return;
        }

        // If no option was recently selected and none named
        speakAloud(
          'Which option would you like me to explain? You can click any button, workflow card, or setting in ProofLoop, or ask about it by name.'
        );
        return;
      }

      // 4. Contextual Follow-up phrases:
      // "Why?"
      if (lower === 'why' || lower === 'why?' || lower.includes('why is that') || lower.includes('why do you need that')) {
        const slot = slotContextRef.current;
        if (slot.activeSlot === 'asking_company') {
          speakAloud(
            'ProofLoop needs the target company so it can look up specific job requirements, guidelines, and tailor your application materials. Which company are you applying to?'
          );
          return;
        }
        if (slot.activeSlot === 'asking_role') {
          speakAloud(
            'Knowing your target role allows ProofLoop to highlight the exact technical skills and project experiences that match the job description. Which role interests you?'
          );
          return;
        }
        if (slot.activeSlot === 'asking_resume_ready' || slot.activeSlot === 'asking_resume_choice') {
          speakAloud(
            'ProofLoop checks for your resume so it can either extract your verified qualifications or generate fresh materials tailored to the role. Would you like to use your existing resume or prepare a new one?'
          );
          return;
        }
        if (lastExplainedOptionRef.current) {
          speakAloud(lastExplainedOptionRef.current.whyUseIt);
          return;
        }
        if (currentWorkflowRef.current) {
          speakAloud(
            'Milestones are verified with cryptographic proofs to ensure every task was authentically executed by MCP tools before advancing.'
          );
          return;
        }
        speakAloud('ProofLoop operates on verified multi-step milestones so each action has verifiable evidence.');
        return;
      }

      // "Tell me more" / "Tell me more about this"
      if (
        lower === 'tell me more' ||
        lower.includes('tell me more') ||
        lower.includes('more details') ||
        lower.includes('elaborate')
      ) {
        if (lastExplainedOptionRef.current) {
          speakAloud(
            `${lastExplainedOptionRef.current.conciseExplanation} ${lastExplainedOptionRef.current.howItWorks}`
          );
          return;
        }
        const slot = slotContextRef.current;
        if (slot.activeSlot) {
          speakAloud(
            'ProofLoop automates the preparation of your internship application by extracting verified credentials, formatting attachments, computing cryptographic hashes, and pausing for your human authorization before anything is sent.'
          );
          return;
        }
        if (currentWorkflowRef.current) {
          const wf = currentWorkflowRef.current;
          speakAloud(
            `Workflow "${wf.goal}" has ${wf.steps.length} milestones. ${wf.summary || 'Verifications are tracked in SQLite.'}`
          );
          return;
        }
        speakAloud(
          'ProofLoop is an autonomous agent engine integrating the Model Context Protocol with cryptographic verification and human approvals.'
        );
        return;
      }

      // "What happens next?"
      if (
        lower.includes('what happens next') ||
        lower.includes('whats next') ||
        lower.includes("what's next") ||
        lower.includes('what will happen next')
      ) {
        const slot = slotContextRef.current;
        if (slot.activeSlot) {
          speakAloud(
            'Once we gather your preferences, ProofLoop will autonomously prepare the application draft, attach your verified resume, and present the draft for your review and approval before sending.'
          );
          return;
        }
        if (currentWorkflowRef.current) {
          const wf = currentWorkflowRef.current;
          const nextStep = wf.steps.find((s) => s.status !== 'verified_complete');
          if (nextStep) {
            speakAloud(`Next milestone is "${nextStep.title}". You can say "Continue" or "Run all" to execute it.`);
            return;
          }
        }
        speakAloud(
          'You can start an internship application, explore memories, or click any option in the interface to learn what it does.'
        );
        return;
      }

      // "Continue"
      if (lower === 'continue' || lower === 'proceed' || lower === 'keep going') {
        const slot = slotContextRef.current;
        if (slot.activeSlot && slot.lastQuestion) {
          speakAloud(slot.lastQuestion);
          return;
        }
        await handleRunAllMilestones();
        return;
      }

      // "I changed my mind"
      if (
        lower === 'i changed my mind' ||
        lower.includes('changed my mind') ||
        lower.includes('change my mind')
      ) {
        const slot = slotContextRef.current;
        if (slot.activeSlot) {
          setSlotContext((prev) => ({
            ...prev,
            activeSlot: 'asking_company',
            lastQuestion: 'Which company would you like to apply to instead?',
          }));
          speakAloud('No problem! Which company would you like to apply to instead?');
          return;
        }
        speakAloud('No problem! What would you like to do instead?');
        return;
      }

      // "Use the previous one"
      if (
        lower.includes('use the previous one') ||
        lower.includes('use previous one') ||
        lower.includes('use previous') ||
        lower.includes('previous one')
      ) {
        const slot = slotContextRef.current;
        if (slot.activeSlot === 'asking_company' && slot.previousCompanyName) {
          const prevCompany = slot.previousCompanyName;
          setSlotContext((prev) => ({
            ...prev,
            activeSlot: 'asking_role',
            companyName: prevCompany,
            lastQuestion: 'Which role interests you?',
          }));
          speakAloud(`Using previous company, ${prevCompany}. Which role interests you?`);
          return;
        }
        if (slot.activeSlot === 'asking_role' && slot.previousRoleTitle) {
          const prevRole = slot.previousRoleTitle;
          setSlotContext((prev) => ({
            ...prev,
            activeSlot: 'asking_resume_ready',
            roleTitle: prevRole,
            lastQuestion: 'Do you have a resume ready?',
          }));
          speakAloud(`Using previous role, ${prevRole}. Do you have a resume ready?`);
          return;
        }
        if (slot.activeSlot === 'asking_resume_ready' || slot.activeSlot === 'asking_resume_choice') {
          const company = slot.companyName || 'the target company';
          const role = slot.roleTitle || 'software intern';
          setSlotContext({ activeSlot: null });
          speakAloud(`Great, using your existing verified resume. Preparing your ${role} application for ${company} now.`);
          await startInternshipWorkflowPreparation(
            `Prepare internship application for ${role} at ${company}`,
            company,
            role,
            'existing'
          );
          return;
        }
        speakAloud('Using previous configuration from your recent workflow.');
        return;
      }

      // 5. Multi-turn Slot Filling State Machine
      const currentSlot = slotContextRef.current;

      // Slot 1: Asking Company
      if (currentSlot.activeSlot === 'asking_company') {
        if (lower === 'cancel' || lower === 'start over' || lower === 'reset') {
          setSlotContext({ activeSlot: null });
          speakAloud('Conversation cancelled. How else can I help?');
          return;
        }

        // Extract company name
        const company = text.replace(/^(to|for|at|it's|it is)\s+/i, '').trim();
        setSlotContext((prev) => ({
          ...prev,
          activeSlot: 'asking_role',
          previousCompanyName: prev.companyName,
          companyName: company,
          lastQuestion: 'Which role interests you?',
        }));

        speakAloud('Great. Which role interests you?');
        return;
      }

      // Slot 2: Asking Role
      if (currentSlot.activeSlot === 'asking_role') {
        if (lower === 'cancel' || lower === 'start over' || lower === 'reset') {
          setSlotContext({ activeSlot: null });
          speakAloud('Conversation cancelled. How else can I help?');
          return;
        }

        // Handle correction of company during role query
        if (lower.startsWith('actually ') || lower.startsWith('i mean ')) {
          const correctedCompany = text.replace(/^(actually|i mean)\s+/i, '').replace(/^(to|for|at)\s+/i, '').trim();
          setSlotContext((prev) => ({
            ...prev,
            companyName: correctedCompany,
            lastQuestion: 'Which role interests you?',
          }));
          speakAloud(`Got it, for ${correctedCompany}. Which role interests you?`);
          return;
        }

        const role = text.replace(/^(for|as|a|an|the)\s+/i, '').trim();
        setSlotContext((prev) => ({
          ...prev,
          activeSlot: 'asking_resume_ready',
          previousRoleTitle: prev.roleTitle,
          roleTitle: role,
          lastQuestion: 'Do you have a resume ready?',
        }));

        speakAloud('Do you have a resume ready?');
        return;
      }

      // Slot 3: Asking Resume Ready
      if (currentSlot.activeSlot === 'asking_resume_ready') {
        if (lower === 'cancel' || lower === 'start over' || lower === 'reset') {
          setSlotContext({ activeSlot: null });
          speakAloud('Conversation cancelled. How else can I help?');
          return;
        }

        // Positive answer to "Do you have a resume ready?"
        if (
          lower === 'yes' ||
          lower === 'yeah' ||
          lower === 'yup' ||
          lower === 'sure' ||
          lower.includes('yes') ||
          lower.includes('i do') ||
          lower.includes('ready')
        ) {
          setSlotContext((prev) => ({
            ...prev,
            activeSlot: 'asking_resume_choice',
            resumeStatus: 'ready',
            lastQuestion: 'Would you like to use your existing resume or prepare a new one?',
          }));
          speakAloud('Great. Would you like to use your existing resume or prepare a new one?');
          return;
        }

        // Negative answer: proceed to generate fresh tailored draft
        if (
          lower === 'no' ||
          lower === 'nope' ||
          lower === 'not yet' ||
          lower.includes('no') ||
          lower.includes("don't")
        ) {
          const company = currentSlot.companyName || 'the target company';
          const role = currentSlot.roleTitle || 'software intern';
          setSlotContext({ activeSlot: null });
          speakAloud(`No problem. I will generate a tailored resume draft and cover letter for ${company} based on your profile.`);
          await startInternshipWorkflowPreparation(
            `Prepare internship application for ${role} at ${company}`,
            company,
            role,
            'new'
          );
          return;
        }

        // Direct choice provided
        if (lower.includes('existing') || lower.includes('previous')) {
          const company = currentSlot.companyName || 'the target company';
          const role = currentSlot.roleTitle || 'software intern';
          setSlotContext({ activeSlot: null });
          speakAloud(`Great, using your existing verified resume. Preparing your ${role} application for ${company} now.`);
          await startInternshipWorkflowPreparation(
            `Prepare internship application for ${role} at ${company}`,
            company,
            role,
            'existing'
          );
          return;
        }
      }

      // Slot 4: Asking Resume Choice (Existing vs New)
      if (currentSlot.activeSlot === 'asking_resume_choice') {
        if (lower === 'cancel' || lower === 'start over' || lower === 'reset') {
          setSlotContext({ activeSlot: null });
          speakAloud('Conversation cancelled. How else can I help?');
          return;
        }

        const company = currentSlot.companyName || 'the target company';
        const role = currentSlot.roleTitle || 'software intern';

        if (
          lower.includes('existing') ||
          lower.includes('previous') ||
          lower.includes('current') ||
          lower.includes('use my')
        ) {
          setSlotContext({ activeSlot: null });
          speakAloud(`Great, using your existing verified resume. Preparing your ${role} application for ${company} now.`);
          await startInternshipWorkflowPreparation(
            `Prepare internship application for ${role} at ${company}`,
            company,
            role,
            'existing'
          );
          return;
        }

        if (
          lower.includes('new') ||
          lower.includes('prepare') ||
          lower.includes('fresh') ||
          lower.includes('create')
        ) {
          setSlotContext({ activeSlot: null });
          speakAloud(`Understood. I will prepare a fresh resume draft and cover letter tailored for ${company}.`);
          await startInternshipWorkflowPreparation(
            `Prepare internship application for ${role} at ${company}`,
            company,
            role,
            'new'
          );
          return;
        }

        speakAloud('Would you like to use your existing resume or prepare a new one?');
        return;
      }

      // 6. Mode D: Progress Queries
      if (
        lower.includes('what is left') ||
        lower.includes("what's left") ||
        lower.includes('what is remaining') ||
        lower.includes('remaining tasks') ||
        lower.includes('remaining milestones')
      ) {
        setVoiceStatus('processing');
        await handleQueryRemainingSteps();
        return;
      }

      if (
        lower.includes('tell me the result') ||
        lower.includes('what happened') ||
        lower.includes('workflow status') ||
        lower.includes('current status')
      ) {
        setVoiceStatus('processing');
        await handleQueryWorkflowResult();
        return;
      }

      if (
        lower.includes('why did it fail') ||
        lower.includes('what failed') ||
        lower.includes('why failed') ||
        lower.includes('what went wrong')
      ) {
        setVoiceStatus('processing');
        await handleQueryFailureReason();
        return;
      }

      if (
        lower === 'retry' ||
        lower.includes('retry that') ||
        lower.includes('retry failed') ||
        lower.includes('retry step')
      ) {
        await handleRetryFailedStep();
        return;
      }

      if (
        lower.includes('run all') ||
        lower.includes('execute all')
      ) {
        await handleRunAllMilestones();
        return;
      }

      // Hackathon demo scenario trigger
      if (lower.includes('run demo') || lower.includes('hackathon demo')) {
        setVoiceStatus('working');
        isExecutingRef.current = true;
        speakAloud('Executing Amazon Hackathon demo scenario with full proof verification.');
        try {
          await api.runDemoScenario(false);
          await triggerAppSync();
          speakAloud('Hackathon demo completed. All milestone proofs recorded in database.');
        } catch (err: any) {
          speakAloud(`Demo failed: ${err.message}`);
        } finally {
          isExecutingRef.current = false;
        }
        return;
      }

      // 7. Internship Goal Triggers & Natural Multi-Turn Entry
      const isInternshipGoal =
        !lower.includes('memory') &&
        !lower.includes('search') &&
        !lower.startsWith('find') &&
        !lower.startsWith('create a workflow') &&
        !lower.startsWith('create workflow') &&
        (lower.startsWith('prepare my internship') ||
          lower.startsWith('prepare an internship') ||
          lower.startsWith('prepare internship') ||
          lower.startsWith('apply for an internship') ||
          lower.startsWith('apply for internship') ||
          lower.startsWith('help me apply') ||
          lower === 'prepare my internship application' ||
          lower === 'internship application' ||
          lower === 'job application');

      if (isInternshipGoal) {
        // Check if company and role were already fully specified in utterance
        // e.g. "Prepare my internship application for software engineer at Microsoft"
        const companyMatch = text.match(/(?:at|for|to)\s+([A-Z][a-zA-Z0-9\s]+?)(?:\s+(?:before|by|role|as)|$)/i);
        const hasCompany = Boolean(companyMatch && companyMatch[1].trim());

        if (!hasCompany) {
          // Enter multi-turn dialogue starting with company inquiry
          setSlotContext({
            activeSlot: 'asking_company',
            originalGoal: text,
            lastQuestion: 'Which company are you applying to?',
          });
          speakAloud('Sure! Which company are you applying to?');
          return;
        }

        const company = companyMatch![1].trim();
        // Check if role is present
        const roleMatch = text.match(/(?:role|position|as|for)\s+([A-Za-z\s]+?)(?:\s+(?:at|before|by)|$)/i);
        if (!roleMatch) {
          setSlotContext({
            activeSlot: 'asking_role',
            companyName: company,
            originalGoal: text,
            lastQuestion: 'Which role interests you?',
          });
          speakAloud(`Great. Which role interests you at ${company}?`);
          return;
        }

        const role = roleMatch[1].trim();
        setSlotContext({
          activeSlot: 'asking_resume_ready',
          companyName: company,
          roleTitle: role,
          originalGoal: text,
          lastQuestion: 'Do you have a resume ready?',
        });
        speakAloud('Do you have a resume ready?');
        return;
      }

      // 8. Intent-First Command Router Dispatch
      setVoiceStatus('processing');
      isExecutingRef.current = true;
      try {
        if (commandExecutorRef.current) {
          const res = await commandExecutorRef.current(text);
          if (res?.spokenResponse) {
            speakAloud(res.spokenResponse);
          }
        } else {
          // Direct fallback execution if App is not yet mounted or in isolated testing
          const fallbackContext = {
            navigateTab: (tab: string) => {
              navigationHandlerRef.current?.(tab);
            },
            setClickToExplain: setClickToExplainEnabled,
            setSpeakAloud: setSpeakAloudEnabled,
            selectedWorkflow: currentWorkflowRef.current,
            currentApplication: currentApplicationRef.current,
            speakAloud: (spoken: string) => speakAloud(spoken),
            createWorkflow: async (goal: string) => {
              const wf = await api.createWorkflow(goal);
              currentWorkflowRef.current = wf;
              return wf;
            },
          };
          const res = await executeCommand(text, fallbackContext);
          if (res?.spokenResponse) {
            speakAloud(res.spokenResponse);
          }
        }
        await triggerAppSync();
      } catch (err: any) {
        speakAloud(`Command failed: ${err.message}`);
      } finally {
        isExecutingRef.current = false;
      }
    },
    [
      resetTranscript,
      synthStop,
      stopListening,
      confirmVoiceApproval,
      cancelVoiceApproval,
      speakAloud,
      handleQueryRemainingSteps,
      handleQueryWorkflowResult,
      handleQueryFailureReason,
      handleRetryFailedStep,
      handleRunAllMilestones,
      startInternshipWorkflowPreparation,
      triggerAppSync,
      setClickToExplainEnabled,
      setSpeakAloudEnabled,
    ]
  );

  // Link mutable ref to processor
  processSpokenCommandRef.current = processSpokenCommand;

  // Toggle voice
  const toggleVoice = useCallback(async () => {
    setErrorMessage(null);

    // If currently speaking, clicking interrupts speech
    if (isSpeaking) {
      synthStop();
      return;
    }

    if (isListening) {
      stopListening();
      setVoiceStatus('idle');
    } else {
      resetTranscript();
      try {
        await startListening();
        setVoiceStatus('listening');
      } catch (err: any) {
        setErrorMessage(err.message || 'Microphone access failed');
        setVoiceStatus('permission-denied');
      }
    }
  }, [isSpeaking, isListening, synthStop, stopListening, resetTranscript, startListening]);

  const startVoice = useCallback(async () => {
    setErrorMessage(null);
    resetTranscript();
    try {
      await startListening();
      setVoiceStatus('listening');
    } catch (err: any) {
      setErrorMessage(err.message || 'Microphone access failed');
      setVoiceStatus('permission-denied');
    }
  }, [resetTranscript, startListening]);

  const stopVoice = useCallback(() => {
    stopListening();
    synthStop();
    setVoiceStatus('idle');
  }, [stopListening, synthStop]);

  const muteOrStopAudio = useCallback(() => {
    synthStop();
    if (voiceStatus === 'speaking') {
      setVoiceStatus(pendingApproval ? 'awaiting-approval' : isListening ? 'listening' : 'idle');
    }
  }, [synthStop, voiceStatus, pendingApproval, isListening]);

  const clearError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  const registerNavigationHandler = useCallback((fn: (tab: string) => void) => {
    navigationHandlerRef.current = fn;
    return () => {
      navigationHandlerRef.current = null;
    };
  }, []);

  const registerCommandExecutor = useCallback((fn: (cmd: string) => Promise<any>) => {
    commandExecutorRef.current = fn;
    return () => {
      commandExecutorRef.current = null;
    };
  }, []);

  const registerWorkflowSync = useCallback((syncFn: () => Promise<void>) => {
    syncCallbacksRef.current.add(syncFn);
    return () => {
      syncCallbacksRef.current.delete(syncFn);
    };
  }, []);

  const setActiveWorkflowContext = useCallback(
    (workflow: Workflow | null, application: InternshipApplicationData | null) => {
      currentWorkflowRef.current = workflow;
      currentApplicationRef.current = application;
    },
    []
  );

  // Map voiceStatus to exact required display status label
  const statusLabel: ExactDisplayStatus = useMemo(() => {
    if (voiceStatus === 'listening') return 'Listening';
    if (voiceStatus === 'processing' || voiceStatus === 'thinking') return 'Processing';
    if (voiceStatus === 'working') return 'Working';
    if (voiceStatus === 'awaiting-approval') return 'Awaiting Approval';
    if (voiceStatus === 'speaking') return 'Speaking';
    if (voiceStatus === 'paused') return 'Paused';
    if (
      voiceStatus === 'error' ||
      voiceStatus === 'permission-denied' ||
      voiceStatus === 'unsupported'
    ) {
      return 'Error';
    }
    return 'Idle';
  }, [voiceStatus]);

  // Tab visibility handling
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (isListening) {
          stopListening();
          setVoiceStatus('paused');
        }
      } else {
        if (voiceStatus === 'paused' && (voiceMode === 'hands-free' || continuousMode)) {
          startListening().catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isListening, voiceStatus, voiceMode, continuousMode, startListening, stopListening]);

  const value: VoiceContextValue = useMemo(
    () => ({
      status: voiceStatus,
      statusLabel,
      isActive:
        isListening ||
        isSpeaking ||
        voiceStatus === 'working' ||
        voiceStatus === 'processing' ||
        voiceStatus === 'thinking',
      isListening,
      isSpeaking,
      isPaused: voiceStatus === 'paused',
      isSupported,
      continuousMode,
      setContinuousMode,
      voiceMode,
      setVoiceMode,
      wakePhrase,
      setWakePhrase,
      locale,
      setLocale,
      speakAloudEnabled,
      setSpeakAloudEnabled,
      rate,
      setRate,
      voices,
      selectedVoice,
      setSelectedVoice,
      speak: synthSpeak,
      transcript,
      interimTranscript,
      lastAssistantMessage,
      errorMessage,
      clickToExplainEnabled,
      setClickToExplainEnabled,
      lastExplainedOption,
      explanationFallbackHint,
      explainOption,
      clearExplainedOption,
      stagedTranscript,
      setStagedTranscript,
      submitStagedTranscript,
      clearStagedTranscript,
      slotContext,
      resetConversation,
      pendingApproval,
      toggleVoice,
      startVoice,
      stopVoice,
      muteOrStopAudio,
      clearError,
      confirmVoiceApproval,
      cancelVoiceApproval,
      processSpokenCommand,
      registerNavigationHandler,
      registerCommandExecutor,
      registerWorkflowSync,
      setActiveWorkflowContext,
    }),
    [
      voiceStatus,
      statusLabel,
      isListening,
      isSpeaking,
      isSupported,
      continuousMode,
      setContinuousMode,
      voiceMode,
      setVoiceMode,
      wakePhrase,
      setWakePhrase,
      locale,
      setLocale,
      speakAloudEnabled,
      setSpeakAloudEnabled,
      rate,
      setRate,
      voices,
      selectedVoice,
      setSelectedVoice,
      synthSpeak,
      transcript,
      interimTranscript,
      lastAssistantMessage,
      errorMessage,
      clickToExplainEnabled,
      setClickToExplainEnabled,
      lastExplainedOption,
      explanationFallbackHint,
      explainOption,
      clearExplainedOption,
      stagedTranscript,
      submitStagedTranscript,
      clearStagedTranscript,
      slotContext,
      resetConversation,
      pendingApproval,
      toggleVoice,
      startVoice,
      stopVoice,
      muteOrStopAudio,
      clearError,
      confirmVoiceApproval,
      cancelVoiceApproval,
      processSpokenCommand,
      registerNavigationHandler,
      registerCommandExecutor,
      registerWorkflowSync,
      setActiveWorkflowContext,
    ]
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
};

export function useVoice(): VoiceContextValue {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
}
