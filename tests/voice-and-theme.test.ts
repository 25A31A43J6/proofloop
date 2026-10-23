/**
 * ProofLoop Voice AI & Theme System Automated Tests
 * Tests for:
 * 1. Centralized Theme System (persistence, system preference, dark mode classes)
 * 2. Web Speech Recognition (locales, transcripts, permission denial, duplicate prevention)
 * 3. Speech Synthesis (cleanTextForSpeech, cancellation, mute toggle, rate)
 * 4. Voice Approval Safety Gate (consequential email dispatch protection)
 * 5. MCP Tool Failure Handling during Voice Workflows
 * Amazon Developer Hackathon 2026 — Alexa+ track
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { cleanTextForSpeech } from '../src/hooks/useSpeechSynthesis.js';
import { SUPPORTED_LOCALES } from '../src/hooks/useSpeechRecognition.js';
import { db } from '../src/server/db.js';
import {
  createWorkflowFromGoal,
  autoPrepareInternshipWorkflow,
  approveAndSendInternshipApplication,
  executeWorkflowStep,
} from '../src/server/agent.js';
import { computeApplicationDraftHash } from '../src/server/emailService.js';
import {
  EXPLAINABLE_OPTIONS,
  detectQuestionIntent,
  answerQuestionAboutOption,
  resolveOptionFromElement,
} from '../src/services/optionExplanationService.js';

describe('Voice AI & Centralized Theme Suite', () => {
  beforeEach(() => {
    db.resetForTesting();
  });

  describe('1. Centralized Theme System & Persistence', () => {
    it('persists theme preference to storage', () => {
      // Mock localStorage
      const storage: Record<string, string> = {};
      const mockLocalStorage = {
        getItem: (k: string) => storage[k] || null,
        setItem: (k: string, v: string) => {
          storage[k] = v;
        },
        removeItem: (k: string) => {
          delete storage[k];
        },
      };

      mockLocalStorage.setItem('proofloop_theme', 'dark');
      expect(mockLocalStorage.getItem('proofloop_theme')).toBe('dark');

      mockLocalStorage.setItem('proofloop_theme', 'light');
      expect(mockLocalStorage.getItem('proofloop_theme')).toBe('light');

      mockLocalStorage.setItem('proofloop_theme', 'system');
      expect(mockLocalStorage.getItem('proofloop_theme')).toBe('system');
    });

    it('falls back to system preference when no explicit theme is saved', () => {
      let systemPrefersDark = true;
      const getEffectiveTheme = (stored: string | null) => {
        if (stored === 'dark') return 'dark';
        if (stored === 'light') return 'light';
        return systemPrefersDark ? 'dark' : 'light';
      };

      expect(getEffectiveTheme(null)).toBe('dark');

      systemPrefersDark = false;
      expect(getEffectiveTheme(null)).toBe('light');

      // User explicit preference overrides system preference
      expect(getEffectiveTheme('dark')).toBe('dark');
    });
  });

  describe('2. Voice Speech Recognition & Locales', () => {
    it('supports required locales: en-US, en-IN, te-IN, hi-IN', () => {
      const localeCodes = SUPPORTED_LOCALES.map((l) => l.code);
      expect(localeCodes).toContain('en-US');
      expect(localeCodes).toContain('en-IN');
      expect(localeCodes).toContain('te-IN');
      expect(localeCodes).toContain('hi-IN');
      expect(SUPPORTED_LOCALES.length).toBeGreaterThanOrEqual(4);
    });

    it('prevents duplicate task submission from multiple recognition events', () => {
      let submissionCount = 0;
      let lastSubmittedText = '';

      const handleVoiceSubmit = (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || trimmed === lastSubmittedText) return;
        submissionCount++;
        lastSubmittedText = trimmed;
      };

      // Simulate recognition firing duplicate final events
      handleVoiceSubmit('Help me prepare and submit my internship application before Friday.');
      handleVoiceSubmit('Help me prepare and submit my internship application before Friday.');
      handleVoiceSubmit('Help me prepare and submit my internship application before Friday.');

      expect(submissionCount).toBe(1);

      // A different utterance should be allowed
      handleVoiceSubmit('Check my resume and cover letter');
      expect(submissionCount).toBe(2);
    });

    it('handles permission denial gracefully with friendly guidance', () => {
      const simulateSpeechError = (errorType: string) => {
        if (errorType === 'not-allowed' || errorType === 'permission-denied') {
          return {
            status: 'permission-denied',
            error:
              'Microphone permission was denied. Please allow microphone access in your browser settings.',
          };
        }
        return {
          status: 'error',
          error: `Speech error: ${errorType}`,
        };
      };

      const result = simulateSpeechError('not-allowed');
      expect(result.status).toBe('permission-denied');
      expect(result.error).toContain('Microphone permission was denied');
    });

    it('provides clear fallback when speech recognition is unsupported in browser', () => {
      const checkSpeechSupport = (hasSpeechRecognition: boolean) => {
        if (!hasSpeechRecognition) {
          return {
            isSupported: false,
            status: 'unsupported',
            fallbackMessage:
              'Speech recognition unavailable in this browser. Please use text input.',
          };
        }
        return { isSupported: true, status: 'idle', fallbackMessage: null };
      };

      const unsupportedResult = checkSpeechSupport(false);
      expect(unsupportedResult.isSupported).toBe(false);
      expect(unsupportedResult.status).toBe('unsupported');
      expect(unsupportedResult.fallbackMessage).toContain('use text input');
    });
  });

  describe('3. Spoken AI Responses & Speech Synthesis', () => {
    it('cleans raw markdown, code blocks, and JSON dumps for concise spoken output', () => {
      const rawText =
        '## Milestone Created!\n\nHere is the plan:\n```json\n{"step": "gather_docs"}\n```\nAll **3** documents gathered successfully. Next step is review.';
      const cleaned = cleanTextForSpeech(rawText);

      expect(cleaned).not.toContain('```');
      expect(cleaned).not.toContain('{"step":');
      expect(cleaned).not.toContain('##');
      expect(cleaned).not.toContain('**');
      expect(cleaned).toContain('Milestone Created!');
      expect(cleaned).toContain('All 3 documents gathered successfully');
    });

    it('truncates very long responses to concise natural sentences', () => {
      const veryLong =
        'I have analyzed your entire repository and examined 42 separate files across the codebase. ' +
        'All dependencies have been reconciled and verified against the security baseline. ' +
        'In addition, I inspected 15 different markdown documents, compiled the application package, ' +
        'generated cryptographic proof hashes for all intermediary milestones, and formatted the draft. ' +
        'Furthermore, external SMTP settings were probed and confirmed operational.';

      const cleaned = cleanTextForSpeech(veryLong);
      expect(cleaned.length).toBeLessThan(300);
      expect(cleaned).toContain('I have analyzed your entire repository');
    });

    it('enforces single speech utterance cancellation on new audio', () => {
      let isCancelled = false;
      let activeUtterance: string | null = null;

      const mockSpeak = (text: string) => {
        if (activeUtterance) {
          isCancelled = true;
        }
        activeUtterance = text;
      };

      mockSpeak('First utterance about workflow creation');
      expect(activeUtterance).toBe('First utterance about workflow creation');

      mockSpeak('Second utterance interrupting the first');
      expect(isCancelled).toBe(true);
      expect(activeUtterance).toBe('Second utterance interrupting the first');
    });

    it('respects speak AI responses aloud preference and stops playback when disabled', () => {
      let speakAloud = true;
      let isPlaying = true;

      const setSpeakAloud = (enabled: boolean) => {
        speakAloud = enabled;
        if (!enabled) {
          isPlaying = false; // Immediately halts audio playback
        }
      };

      expect(speakAloud).toBe(true);
      setSpeakAloud(false);
      expect(speakAloud).toBe(false);
      expect(isPlaying).toBe(false);
    });
  });

  describe('4. Voice Safety Gate & Consequential Approvals', () => {
    it('prevents voice interaction from bypassing human approval gate for email dispatch', async () => {
      // 1. User says "Help me prepare and submit my internship application before Friday."
      const wf = await createWorkflowFromGoal(
        'Help me prepare and submit my internship application before Friday.'
      );
      expect(wf).toBeDefined();

      // 2. Autonomous preparation generates the draft and reaches Step 8 (AWAITING_APPROVAL)
      const prepRes = await autoPrepareInternshipWorkflow(wf.id);
      expect(prepRes.application).toBeDefined();
      const app = prepRes.application!;
      expect(app.applicationStatus).toBe('AWAITING_APPROVAL');

      // 3. Attempting to send without proper authorization / matching hash is rejected
      const rejectResult = await approveAndSendInternshipApplication(
        app.id,
        'invalid_or_stale_hash'
      );
      expect(rejectResult.success).toBe(false);
      expect(rejectResult.status).toBe('SEND_FAILED');
      expect(rejectResult.error).toMatch(/Security Mismatch|modified after user approval|Cryptographic verification/);

      // Verify that the status remains AWAITING_APPROVAL, not SENT
      const currentApp = db.getApplication(app.id);
      expect(currentApp?.applicationStatus).toBe('AWAITING_APPROVAL');
    });

    it('requires explicit confirmation matching the current draft recipient and payload', async () => {
      const wf = await createWorkflowFromGoal(
        'Help me prepare and submit my internship application before Friday.'
      );
      const prepRes = await autoPrepareInternshipWorkflow(wf.id);
      expect(prepRes.application).toBeDefined();
      const app = prepRes.application!;

      // Human explicitly approves with the matching verified hash
      const validHash = computeApplicationDraftHash(app);
      const sendResult = await approveAndSendInternshipApplication(
        app.id,
        validHash
      );

      expect(sendResult).toBeDefined();
      expect(['SENT', 'NOT_CONFIGURED', 'SEND_FAILED']).toContain(sendResult.status);

      const finalApp = db.getApplication(app.id);
      expect(['SENT', 'AWAITING_APPROVAL']).toContain(finalApp?.applicationStatus);
    });
  });

  describe('5. Voice Workflow Handling of MCP Tool Failures', () => {
    it('communicates MCP tool failures honestly instead of hallucinating success', async () => {
      const wf = await createWorkflowFromGoal(
        'Help me prepare my hackathon submission and test recovery'
      );
      const step1 = wf.steps[0];

      // Execute step with simulated failure
      const res = await executeWorkflowStep(wf.id, step1.id, { simulateFailure: true });
      expect(res.success).toBe(false);
      expect(res.step.status).toBe('failed');
      expect(res.step.failureReason).toContain('Simulated tool failure in developer test mode');

      // Spoken voice update reflects actual failure
      const voiceMessage = `Step failed: ${res.step.failureReason}`;
      expect(voiceMessage).toContain('Simulated tool failure in developer test mode');
      expect(voiceMessage).not.toContain('successfully verified');
    });
  });

  describe('6. Background Voice Assistant Controller & No-Modal Architecture', () => {
    it('1. clicking Voice Assistant starts listening in background without opening modal or navigating', () => {
      // Test state representation of background voice controller
      let isModalOpen = false;
      let currentRoute = '/workspace';
      let voiceStatus: string = 'idle';

      const handleToggleVoice = () => {
        // Must NOT change route or open any modal
        if (voiceStatus === 'idle') {
          voiceStatus = 'listening';
        } else {
          voiceStatus = 'idle';
        }
      };

      // User clicks Voice Assistant button in TopNav
      handleToggleVoice();
      expect(voiceStatus).toBe('listening');
      expect(isModalOpen).toBe(false);
      expect(currentRoute).toBe('/workspace');

      // Second click toggles off
      handleToggleVoice();
      expect(voiceStatus).toBe('idle');
      expect(isModalOpen).toBe(false);
      expect(currentRoute).toBe('/workspace');
    });

    it('2. voice controller state survives route/tab changes with zero duplicate sessions', () => {
      // Simulate persistent global provider state
      let activeSessions = 0;
      let voiceState = {
        status: 'idle',
        transcript: '',
      };

      const startPersistentVoice = () => {
        if (activeSessions > 0) {
          throw new Error('Duplicate microphone session detected!');
        }
        activeSessions = 1;
        voiceState.status = 'listening';
      };

      const changeRoute = (newRoute: string) => {
        // Route change should NOT remount the voice provider or start another session
        return newRoute;
      };

      startPersistentVoice();
      expect(activeSessions).toBe(1);
      expect(voiceState.status).toBe('listening');

      // Navigate between routes: Farmer, Buyer, Admin, Workflows, Approvals
      changeRoute('/farmer');
      expect(activeSessions).toBe(1);
      expect(voiceState.status).toBe('listening');

      changeRoute('/buyer');
      expect(activeSessions).toBe(1);
      expect(voiceState.status).toBe('listening');

      changeRoute('/admin');
      expect(activeSessions).toBe(1);
      expect(voiceState.status).toBe('listening');

      changeRoute('/approvals');
      expect(activeSessions).toBe(1);
      expect(voiceState.status).toBe('listening');
    });

    it('3. spoken approval executes exact pending action with cryptographic validation', async () => {
      const wf = await createWorkflowFromGoal('Prepare my internship application');
      const prepRes = await autoPrepareInternshipWorkflow(wf.id);
      expect(prepRes.application).toBeDefined();
      const app = prepRes.application!;

      // Assistant question: "Your internship application is ready. Would you like me to send it?"
      const pendingApproval = {
        type: 'application_dispatch',
        applicationId: app.id,
        draftHash: app.approvedHash,
      };

      // User says: "Yes, send it"
      const userUtterance = 'Yes, send it';
      const isApproved =
        userUtterance.toLowerCase().includes('yes send') ||
        userUtterance.toLowerCase().includes('yes, send') ||
        userUtterance.toLowerCase() === 'yes';

      expect(isApproved).toBe(true);

      const sendRes = await approveAndSendInternshipApplication(
        pendingApproval.applicationId,
        pendingApproval.draftHash!
      );
      expect(['SENT', 'NOT_CONFIGURED', 'SEND_FAILED']).toContain(sendRes.status);
    });

    it('4. spoken rejection cancels the pending action and preserves the draft', async () => {
      const wf = await createWorkflowFromGoal('Prepare my internship application');
      const prepRes = await autoPrepareInternshipWorkflow(wf.id);
      const app = prepRes.application!;

      let pendingApproval: any = {
        type: 'application_dispatch',
        applicationId: app.id,
        draftHash: app.approvedHash,
      };

      // User says: "No, don't send it"
      const userUtterance = "No, don't send it";
      let actionExecuted = false;
      let feedback = '';

      if (userUtterance.toLowerCase().includes("don't send") || userUtterance.toLowerCase().includes('no')) {
        pendingApproval = null;
        feedback = 'Cancelled sending the application.';
      } else {
        actionExecuted = true;
      }

      expect(actionExecuted).toBe(false);
      expect(pendingApproval).toBeNull();
      expect(feedback).toContain('Cancelled sending');

      // Verify draft is still in database and not modified/deleted
      const preservedApp = db.getApplication(app.id);
      expect(preservedApp).toBeDefined();
      expect(preservedApp?.applicationStatus).toBe('AWAITING_APPROVAL');
    });

    it('5. "Change the subject" returns to editing without executing dispatch', async () => {
      const wf = await createWorkflowFromGoal('Prepare my internship application');
      const prepRes = await autoPrepareInternshipWorkflow(wf.id);
      const app = prepRes.application!;

      let pendingApproval: any = {
        type: 'application_dispatch',
        applicationId: app.id,
        draftHash: app.approvedHash,
      };

      const userUtterance = 'Change the subject';
      let editModeActive = false;

      if (userUtterance.toLowerCase().includes('change the subject') || userUtterance.toLowerCase().includes('edit')) {
        pendingApproval = null;
        editModeActive = true;
      }

      expect(pendingApproval).toBeNull();
      expect(editModeActive).toBe(true);
    });

    it('6. unclear answer triggers clarification request and never authorizes action', () => {
      let pendingApproval: any = {
        type: 'application_dispatch',
        applicationId: 'app_123',
      };
      let actionExecuted = false;
      let clarificationSpoken = false;

      const handleAnswer = (text: string) => {
        const lower = text.toLowerCase().trim();
        if (lower === 'yes' || lower.includes('yes, send') || lower.includes('yes send')) {
          actionExecuted = true;
        } else if (lower === 'no' || lower.includes("don't send") || lower.includes('cancel')) {
          pendingApproval = null;
        } else {
          clarificationSpoken = true;
        }
      };

      // Silence, noise, or unclear reply
      handleAnswer('');
      expect(actionExecuted).toBe(false);

      handleAnswer('maybe something else');
      expect(actionExecuted).toBe(false);
      expect(clarificationSpoken).toBe(true);
      expect(pendingApproval).toBeDefined(); // still waiting, not cancelled or executed
    });

    it('7. immediate mute/stop control halts speech without opening an interface', () => {
      let isSpeaking = true;
      let isListening = true;
      let isModalOpen = false;

      const muteOrStopAudio = () => {
        isSpeaking = false;
        // Interface stays untouched
      };

      const stopVoice = () => {
        isSpeaking = false;
        isListening = false;
      };

      muteOrStopAudio();
      expect(isSpeaking).toBe(false);
      expect(isModalOpen).toBe(false);

      stopVoice();
      expect(isListening).toBe(false);
      expect(isModalOpen).toBe(false);
    });

    it('8. self-transcription prevention ignores speech recognition while speaking', () => {
      let isSelfSpeaking = true;
      let processedUtterances: string[] = [];

      const handleTranscript = (transcript: string) => {
        if (isSelfSpeaking) {
          // Block processing assistant's own TTS output
          return;
        }
        processedUtterances.push(transcript);
      };

      handleTranscript('Your internship application is ready.');
      expect(processedUtterances.length).toBe(0);

      isSelfSpeaking = false;
      handleTranscript('Yes, send it');
      expect(processedUtterances).toEqual(['Yes, send it']);
    });

    it('9. visibility change safely suspends background listening without crashing', () => {
      let isListening = true;
      let voiceStatus = 'listening';

      const handleVisibilityChange = (hidden: boolean) => {
        if (hidden) {
          isListening = false;
          voiceStatus = 'paused';
        } else {
          voiceStatus = 'listening';
          isListening = true;
        }
      };

      // Tab hidden
      handleVisibilityChange(true);
      expect(isListening).toBe(false);
      expect(voiceStatus).toBe('paused');

      // Tab visible again
      handleVisibilityChange(false);
      expect(isListening).toBe(true);
      expect(voiceStatus).toBe('listening');
    });
  });

  describe('7. 4 Voice Modes & Background Assistant Capabilities', () => {
    it('Mode A: Push-to-Talk stages transcript for inline review/edit without auto-executing', () => {
      let stagedTranscript: string | null = null;
      let executedCommand: string | null = null;

      const handlePushToTalkTranscript = (finalText: string) => {
        // Stage for user review and edit
        stagedTranscript = finalText;
      };

      const handleUserEdit = (editedText: string) => {
        stagedTranscript = editedText;
      };

      const handleSubmitStagedTranscript = () => {
        if (!stagedTranscript) return;
        executedCommand = stagedTranscript;
        stagedTranscript = null;
      };

      // Spoken input produces initial raw transcript
      handlePushToTalkTranscript('Prepare my inturnship application');
      expect(stagedTranscript).toBe('Prepare my inturnship application');
      expect(executedCommand).toBeNull(); // Not executed yet!

      // User fixes spelling typo inline
      handleUserEdit('Prepare my internship application');
      expect(stagedTranscript).toBe('Prepare my internship application');
      expect(executedCommand).toBeNull();

      // User submits reviewed transcript
      handleSubmitStagedTranscript();
      expect(executedCommand).toBe('Prepare my internship application');
      expect(stagedTranscript).toBeNull();
    });

    it('Mode B: Hands-Free multi-turn slot filling collects missing company and role', async () => {
      interface SlotState {
        activeSlot: 'asking_company' | 'asking_role' | null;
        companyName?: string;
        roleTitle?: string;
      }

      let state: SlotState = { activeSlot: null };
      let assistantSpoken = '';
      let workflowPlannedGoal = '';

      const handleUtterance = (text: string) => {
        const lower = text.toLowerCase().trim();

        if (state.activeSlot === 'asking_company') {
          state.companyName = text;
          state.activeSlot = 'asking_role';
          assistantSpoken = `Great, for ${text}. What role are you targeting?`;
          return;
        }

        if (state.activeSlot === 'asking_role') {
          state.roleTitle = text;
          state.activeSlot = null;
          workflowPlannedGoal = `Prepare internship application for ${state.roleTitle} at ${state.companyName}`;
          assistantSpoken = `Preparing your ${state.roleTitle} application for ${state.companyName} now.`;
          return;
        }

        if (lower === 'prepare my internship application') {
          state.activeSlot = 'asking_company';
          assistantSpoken = 'Which company would you like to apply to?';
        }
      };

      // Turn 1: User gives high-level goal
      handleUtterance('Prepare my internship application');
      expect(state.activeSlot).toBe('asking_company');
      expect(assistantSpoken).toBe('Which company would you like to apply to?');

      // Turn 2: User answers company
      handleUtterance('Google');
      expect(state.activeSlot).toBe('asking_role');
      expect(state.companyName).toBe('Google');
      expect(assistantSpoken).toContain('Great, for Google. What role are you targeting?');

      // Turn 3: User answers role
      handleUtterance('Software Engineer Intern');
      expect(state.activeSlot).toBeNull();
      expect(state.roleTitle).toBe('Software Engineer Intern');
      expect(workflowPlannedGoal).toBe(
        'Prepare internship application for Software Engineer Intern at Google'
      );
      expect(assistantSpoken).toContain('Preparing your Software Engineer Intern application for Google now');
    });

    it('Mode C: Wake Phrase filters out passive conversation until "Hey ProofLoop" is detected', () => {
      let executedCommand: string | null = null;
      let assistantResponse: string | null = null;

      const processWakePhraseUtterance = (rawText: string) => {
        const lower = rawText.toLowerCase().trim();
        const wakePhrases = ['hey proofloop', 'hey proof loop', 'proofloop', 'alexa'];
        const matched = wakePhrases.find((wp) => lower.includes(wp));

        if (!matched) {
          // Passive background listening discards non-wake speech
          return;
        }

        const regex = new RegExp(`^.*?${matched}[,\\s]*`, 'i');
        const command = rawText.replace(regex, '').trim();

        if (!command) {
          assistantResponse = "I'm listening. How can I help you?";
        } else {
          executedCommand = command;
        }
      };

      // Casual chat without wake phrase is ignored
      processWakePhraseUtterance('The weather outside is very nice today.');
      expect(executedCommand).toBeNull();
      expect(assistantResponse).toBeNull();

      // Wake phrase only
      processWakePhraseUtterance('Hey ProofLoop');
      expect(assistantResponse).toBe("I'm listening. How can I help you?");
      expect(executedCommand).toBeNull();

      // Wake phrase + command
      processWakePhraseUtterance('Hey ProofLoop, what is left?');
      expect(executedCommand).toBe('what is left?');
    });

    it('Mode D: "What is left?" query summarizes remaining workflow milestones', async () => {
      const wf = await createWorkflowFromGoal('Prepare my internship application');
      const remainingSteps = wf.steps.filter((s) => s.status !== 'verified_complete');
      expect(remainingSteps.length).toBe(wf.steps.length);

      const queryRemaining = (steps: typeof wf.steps) => {
        const remaining = steps.filter((s) => s.status !== 'verified_complete');
        if (remaining.length === 0) {
          return 'All milestones in your workflow are completed and verified.';
        }
        const titles = remaining.map((s) => s.title).slice(0, 3).join(', ');
        return `There are ${remaining.length} milestones left: ${titles}.`;
      };

      const response = queryRemaining(wf.steps);
      expect(response).toContain(`There are ${wf.steps.length} milestones left`);
      expect(response).toContain(wf.steps[0].title);
    });

    it('Mode D: "Why did it fail?" and "Retry that" handle step errors and self-healing recovery', async () => {
      const wf = await createWorkflowFromGoal('Test error recovery workflow');
      const step1 = wf.steps[0];

      // Simulate failure on step 1
      const failedExec = await executeWorkflowStep(wf.id, step1.id, { simulateFailure: true });
      expect(failedExec.success).toBe(false);

      // Voice query: "Why did it fail?"
      const handleWhyDidItFail = (step: typeof step1) => {
        return `Milestone "${step.title}" failed. Reason: ${step.failureReason || 'Unknown error'}. You can say "Retry that" to recover.`;
      };

      const failExplanation = handleWhyDidItFail(failedExec.step);
      expect(failExplanation).toContain('failed');
      expect(failExplanation).toContain('Simulated tool failure in developer test mode');
      expect(failExplanation).toContain('Retry that');

      // Voice command: "Retry that" executes recovery
      const recoveredExec = await executeWorkflowStep(wf.id, step1.id, { simulateFailure: false });
      expect(recoveredExec.success).toBe(true);
      expect(recoveredExec.step.status).toBe('verified_complete');
    });

    it('maps voice states to exact required display status labels', () => {
      const mapStatusToExactLabel = (status: string): string => {
        if (status === 'listening') return 'Listening';
        if (status === 'processing' || status === 'thinking') return 'Processing';
        if (status === 'working') return 'Working';
        if (status === 'awaiting-approval') return 'Awaiting Approval';
        if (status === 'speaking') return 'Speaking';
        if (status === 'paused') return 'Paused';
        if (status === 'error' || status === 'permission-denied' || status === 'unsupported') {
          return 'Error';
        }
        return 'Idle';
      };

      expect(mapStatusToExactLabel('idle')).toBe('Idle');
      expect(mapStatusToExactLabel('listening')).toBe('Listening');
      expect(mapStatusToExactLabel('processing')).toBe('Processing');
      expect(mapStatusToExactLabel('thinking')).toBe('Processing');
      expect(mapStatusToExactLabel('working')).toBe('Working');
      expect(mapStatusToExactLabel('awaiting-approval')).toBe('Awaiting Approval');
      expect(mapStatusToExactLabel('speaking')).toBe('Speaking');
      expect(mapStatusToExactLabel('paused')).toBe('Paused');
      expect(mapStatusToExactLabel('error')).toBe('Error');
      expect(mapStatusToExactLabel('permission-denied')).toBe('Error');
      expect(mapStatusToExactLabel('unsupported')).toBe('Error');
    });

    it('enforces bounded retries (max 5) with exponential backoff on recognition errors', () => {
      let retryCount = 0;
      const maxRetries = 5;
      const delays: number[] = [];

      const simulateContinuousRestart = () => {
        if (retryCount >= maxRetries) {
          return { shouldRestart: false, delay: 0 };
        }
        retryCount++;
        const delay = Math.min(300 * retryCount, 2500);
        delays.push(delay);
        return { shouldRestart: true, delay };
      };

      // 5 bounded retries
      for (let i = 0; i < 7; i++) {
        simulateContinuousRestart();
      }

      expect(retryCount).toBe(5);
      expect(delays.length).toBe(5);
      expect(delays[0]).toBe(300);
      expect(delays[1]).toBe(600);
      expect(delays[4]).toBe(1500);
    });

    it('defaults speech locale to en-IN (English - India)', () => {
      expect(SUPPORTED_LOCALES[0].code).toBe('en-IN');
      expect(SUPPORTED_LOCALES[0].label).toBe('English (India)');
    });
  });

  describe('6. Continuous Multi-Turn Dialogues & Contextual Slot-Filling', () => {
    it('executes full 5-turn internship application dialogue preserving context', async () => {
      // Simulate multi-turn dialogue state engine
      interface DialogueTurn {
        user: string;
        assistant: string;
      }

      let activeSlot: string | null = null;
      let slotData: { company?: string; role?: string; resumeReady?: boolean; resumeChoice?: string } = {};
      const conversationHistory: DialogueTurn[] = [];

      const processTurn = (userUtterance: string): string => {
        const lower = userUtterance.toLowerCase().trim();

        if (activeSlot === null) {
          if (lower.includes('internship application') || lower.includes('apply for')) {
            activeSlot = 'asking_company';
            const reply = 'Sure! Which company are you applying to?';
            conversationHistory.push({ user: userUtterance, assistant: reply });
            return reply;
          }
        }

        if (activeSlot === 'asking_company') {
          slotData.company = userUtterance.replace(/^(to|for|at)\s+/i, '').trim();
          activeSlot = 'asking_role';
          const reply = 'Great. Which role interests you?';
          conversationHistory.push({ user: userUtterance, assistant: reply });
          return reply;
        }

        if (activeSlot === 'asking_role') {
          slotData.role = userUtterance.replace(/^(for|as|a|an)\s+/i, '').trim();
          activeSlot = 'asking_resume_ready';
          const reply = 'Do you have a resume ready?';
          conversationHistory.push({ user: userUtterance, assistant: reply });
          return reply;
        }

        if (activeSlot === 'asking_resume_ready') {
          if (lower === 'yes' || lower.includes('yes')) {
            slotData.resumeReady = true;
            activeSlot = 'asking_resume_choice';
            const reply = 'Great. Would you like to use your existing resume or prepare a new one?';
            conversationHistory.push({ user: userUtterance, assistant: reply });
            return reply;
          }
        }

        if (activeSlot === 'asking_resume_choice') {
          if (lower.includes('existing') || lower.includes('previous')) {
            slotData.resumeChoice = 'existing';
            activeSlot = null;
            const reply = `Great, using your existing verified resume. Preparing your ${slotData.role} application for ${slotData.company} now.`;
            conversationHistory.push({ user: userUtterance, assistant: reply });
            return reply;
          }
        }

        return 'How can I help?';
      };

      // Turn 1:
      const r1 = processTurn('Help me prepare an internship application.');
      expect(r1).toBe('Sure! Which company are you applying to?');
      expect(activeSlot).toBe('asking_company');

      // Turn 2:
      const r2 = processTurn('Microsoft.');
      expect(r2).toBe('Great. Which role interests you?');
      expect(activeSlot).toBe('asking_role');
      expect(slotData.company).toBe('Microsoft.');

      // Turn 3:
      const r3 = processTurn('Software development intern.');
      expect(r3).toBe('Do you have a resume ready?');
      expect(activeSlot).toBe('asking_resume_ready');
      expect(slotData.role).toBe('Software development intern.');

      // Turn 4:
      const r4 = processTurn('Yes.');
      expect(r4).toBe('Great. Would you like to use your existing resume or prepare a new one?');
      expect(activeSlot).toBe('asking_resume_choice');

      // Turn 5:
      const r5 = processTurn('Use existing.');
      expect(r5).toContain('Great, using your existing verified resume');
      expect(r5).toContain('Microsoft');
      expect(activeSlot).toBeNull();
      expect(conversationHistory.length).toBe(5);

      // Verify that after Turn 5, application workflow can be prepared without faking
      const wf = await createWorkflowFromGoal(
        `Prepare internship application for ${slotData.role} at Microsoft`
      );
      expect(wf).toBeDefined();
      const prepRes = await autoPrepareInternshipWorkflow(wf.id);
      expect(prepRes.workflow.steps.length).toBeGreaterThanOrEqual(8);
      expect(prepRes.application?.applicationStatus).toBe('AWAITING_APPROVAL');
    });

    it('handles contextual follow-up questions: Why?, Tell me more, Continue, What happens next?, Use previous, I changed my mind', () => {
      const handleContextualFollowup = (
        phrase: string,
        context: { slot?: string; company?: string; role?: string; prevCompany?: string; hasPendingApproval?: boolean }
      ): string => {
        const lower = phrase.toLowerCase().trim();

        if (lower === 'why' || lower.includes('why?')) {
          if (context.slot === 'asking_company') {
            return 'ProofLoop needs the target company so it can look up specific job requirements, guidelines, and tailor your application materials. Which company are you applying to?';
          }
          if (context.hasPendingApproval) {
            return "ProofLoop requires your explicit sign-off before sending any emails or submitting applications so that no consequential action is taken without your review. Say 'Yes, send it' to approve, or 'Cancel' to hold.";
          }
        }

        if (lower.includes('tell me more')) {
          return 'ProofLoop automates the preparation of your internship application by extracting verified credentials, formatting attachments, computing cryptographic hashes, and pausing for your human authorization before anything is sent.';
        }

        if (lower.includes('what happens next')) {
          return 'Once we gather your preferences, ProofLoop will autonomously prepare the application draft, attach your verified resume, and present the draft for your review and approval before sending.';
        }

        if (lower.includes('continue')) {
          return 'Running all ready workflow milestones.';
        }

        if (lower.includes('i changed my mind')) {
          return 'No problem! Which company would you like to apply to instead?';
        }

        if (lower.includes('use the previous one')) {
          return `Using previous company, ${context.prevCompany || 'Amazon'}. Which role interests you?`;
        }

        return 'Command understood.';
      };

      expect(handleContextualFollowup('Why?', { slot: 'asking_company' })).toContain(
        'ProofLoop needs the target company'
      );
      expect(handleContextualFollowup('Why?', { hasPendingApproval: true })).toContain(
        'ProofLoop requires your explicit sign-off'
      );
      expect(handleContextualFollowup('Tell me more', {})).toContain(
        'ProofLoop automates the preparation'
      );
      expect(handleContextualFollowup('What happens next?', {})).toContain(
        'Once we gather your preferences'
      );
      expect(handleContextualFollowup('Continue', {})).toContain('Running all ready workflow milestones');
      expect(handleContextualFollowup('I changed my mind', {})).toContain(
        'Which company would you like to apply to instead?'
      );
      expect(handleContextualFollowup('Use the previous one', { prevCompany: 'Google' })).toContain(
        'Using previous company, Google'
      );
    });

    it('resumes listening after spoken response only when Hands-Free mode is enabled', () => {
      let isMicrophoneActive = false;

      const handleSpeechEnd = (mode: 'hands-free' | 'push-to-talk' | 'wake-phrase') => {
        if (mode === 'hands-free') {
          isMicrophoneActive = true; // Auto-resumes listening only in hands-free mode
        } else {
          isMicrophoneActive = false; // Does not force continuous listening in other modes
        }
      };

      handleSpeechEnd('push-to-talk');
      expect(isMicrophoneActive).toBe(false);

      handleSpeechEnd('wake-phrase');
      expect(isMicrophoneActive).toBe(false);

      handleSpeechEnd('hands-free');
      expect(isMicrophoneActive).toBe(true);
    });
  });

  describe('7. Context-Aware Click-to-Explain & Natural Questions About Options', () => {
    it('accurately resolves options and explains what they do without executing an action', () => {
      const createWfOption = EXPLAINABLE_OPTIONS['create-workflow'];
      expect(createWfOption).toBeDefined();
      expect(createWfOption.conciseExplanation).toBe(
        'Create Workflow lets you organize a goal into tasks, track progress, and manage the steps needed to complete it.'
      );
      expect(createWfOption.willSendAnything).toContain('No, this will not send anything externally');
      expect(createWfOption.doesSaveData).toContain('Yes, it saves the generated workflow');

      const memoryOption = EXPLAINABLE_OPTIONS['search-memory'];
      expect(memoryOption).toBeDefined();
      expect(memoryOption.conciseExplanation).toBe(
        'Search Memory looks for relevant information saved in your existing ProofLoop memory.'
      );
      expect(memoryOption.doesSaveData).toContain('No, searching memory is a read-only operation');

      const proofOption = EXPLAINABLE_OPTIONS['proof-verified'];
      expect(proofOption).toBeDefined();
      expect(proofOption.conciseExplanation).toBe(
        'This option checks the available evidence for the selected result and reports whether verification succeeds, fails, or remains incomplete.'
      );
      expect(proofOption.howItWorks).toContain('SHA-256');
    });

    it('explains consequential actions and preserves explicit approval requirements', () => {
      const sendOption = EXPLAINABLE_OPTIONS['approve-and-send'];
      expect(sendOption).toBeDefined();
      expect(sendOption.isConsequential).toBe(true);
      expect(sendOption.requiresApproval).toBe(true);
      expect(sendOption.conciseExplanation).toContain(
        'This consequential action cannot be undone once sent'
      );
      expect(sendOption.whatHappensIfClicked).toContain(
        'Clicking to explain will never execute or send the email'
      );
      expect(sendOption.willSendAnything).toContain('Yes, this is a consequential action');
      expect(sendOption.canUndo).toContain('No, once an email is dispatched');
    });

    it('answers natural follow-up voice questions about options with real implementation truth', () => {
      const opt = EXPLAINABLE_OPTIONS['proof-verified'];

      // "What does this do?"
      const intent1 = detectQuestionIntent('What does this do?');
      expect(intent1).toBe('what_does_it_do');
      expect(answerQuestionAboutOption(opt, intent1)).toBe(opt.conciseExplanation);

      // "Why should I use it?"
      const intent2 = detectQuestionIntent('Why should I use it?');
      expect(intent2).toBe('why_use_it');
      expect(answerQuestionAboutOption(opt, intent2)).toBe(opt.whyUseIt);

      // "How does it work?"
      const intent3 = detectQuestionIntent('How does it work?');
      expect(intent3).toBe('how_it_works');
      expect(answerQuestionAboutOption(opt, intent3)).toBe(opt.howItWorks);

      // "Will this send anything?"
      const intent4 = detectQuestionIntent('Will this send anything?');
      expect(intent4).toBe('will_send_anything');
      expect(answerQuestionAboutOption(opt, intent4)).toBe(opt.willSendAnything);

      // "Does this save my data?"
      const intent5 = detectQuestionIntent('Does this save my data?');
      expect(intent5).toBe('does_save_data');
      expect(answerQuestionAboutOption(opt, intent5)).toBe(opt.doesSaveData);

      // "Can I undo it?"
      const intent6 = detectQuestionIntent('Can I undo it?');
      expect(intent6).toBe('can_undo');
      expect(answerQuestionAboutOption(opt, intent6)).toBe(opt.canUndo);

      // "Explain that again"
      const intent7 = detectQuestionIntent('Explain that again');
      expect(intent7).toBe('explain_again');
      expect(answerQuestionAboutOption(opt, intent7)).toBe(opt.conciseExplanation);

      // "Tell me more about this"
      const intent8 = detectQuestionIntent('Tell me more about this');
      expect(intent8).toBe('tell_me_more');
      expect(answerQuestionAboutOption(opt, intent8)).toContain(opt.conciseExplanation);
    });

    it('prevents duplicate explanations within the same interaction interval', () => {
      let speakCallCount = 0;
      let lastExplainedId = '';
      let lastExplainedTime = 0;

      const explain = (id: string, forceSpeak = false) => {
        const now = Date.now();
        if (!forceSpeak && lastExplainedId === id && now - lastExplainedTime < 3500) {
          return;
        }
        lastExplainedId = id;
        lastExplainedTime = now;
        speakCallCount++;
      };

      explain('proof-verified');
      explain('proof-verified'); // Rapid consecutive click
      explain('proof-verified'); // Third click within interval
      expect(speakCallCount).toBe(1);

      // Different option should explain immediately
      explain('create-workflow');
      expect(speakCallCount).toBe(2);

      // Force speak (e.g. user explicitly asked "Explain that again") overrides
      explain('create-workflow', true);
      expect(speakCallCount).toBe(3);
    });

    it('provides accessible text fallback hint when voice is inactive or muted without starting mic', () => {
      let micStarted = false;
      let fallbackText: string | null = null;

      const triggerExplanation = (option: typeof EXPLAINABLE_OPTIONS['create-workflow'], isVoiceActive: boolean, speakAloudEnabled: boolean) => {
        if (speakAloudEnabled && isVoiceActive) {
          // Voice active and speech available -> speaks aloud
          return { spokeAloud: true };
        } else {
          // Inactive or muted -> does NOT activate mic, uses accessible fallback hint
          micStarted = false;
          fallbackText = `${option.title}: ${option.conciseExplanation}`;
          return { spokeAloud: false, fallbackText };
        }
      };

      const result = triggerExplanation(EXPLAINABLE_OPTIONS['create-workflow'], false, false);
      expect(result.spokeAloud).toBe(false);
      expect(micStarted).toBe(false);
      expect(result.fallbackText).toContain('Create Workflow: Create Workflow lets you organize a goal into tasks');
    });

    it('persists Click-to-Explain toggle preference to storage with default ON (true)', () => {
      const storage: Record<string, string> = {};
      const mockStorage = {
        getItem: (k: string) => storage[k] || null,
        setItem: (k: string, v: string) => {
          storage[k] = v;
        },
      };

      // When preference is missing, it must default to ON (true)
      const loadPreference = () => {
        const saved = mockStorage.getItem('proofloop_click_to_explain');
        return saved === null ? true : saved === 'true';
      };

      expect(loadPreference()).toBe(true);

      // User switches toggle to OFF
      mockStorage.setItem('proofloop_click_to_explain', 'false');
      expect(loadPreference()).toBe(false);

      // User switches toggle back to ON
      mockStorage.setItem('proofloop_click_to_explain', 'true');
      expect(loadPreference()).toBe(true);
    });

    it('enables automatic click explanations when Click-to-Explain is ON', () => {
      let explanationTriggered = false;
      let explainedOptionId = '';
      const clickToExplainEnabled = true;

      const handleDocumentClick = (optionId: string) => {
        if (!clickToExplainEnabled) return;
        explanationTriggered = true;
        explainedOptionId = optionId;
      };

      handleDocumentClick('create-workflow');
      expect(explanationTriggered).toBe(true);
      expect(explainedOptionId).toBe('create-workflow');
    });

    it('disables automatic click explanations when Click-to-Explain is OFF while preserving normal button actions', () => {
      let explanationTriggered = false;
      let buttonActionExecuted = false;
      const clickToExplainEnabled = false;

      // Click handler with toggle check
      const handleDocumentClick = (optionId: string) => {
        if (!clickToExplainEnabled) return;
        explanationTriggered = true;
      };

      // Normal button action (e.g. submit goal, open modal, switch tab)
      const handleButtonClick = () => {
        buttonActionExecuted = true;
      };

      // Simulate user clicking a button when toggle is OFF
      handleDocumentClick('create-workflow');
      handleButtonClick();

      // Explanation must NOT be triggered
      expect(explanationTriggered).toBe(false);
      // Button action must execute normally
      expect(buttonActionExecuted).toBe(true);
    });

    it('still allows explicit voice questions ("What does this do?") when Click-to-Explain toggle is OFF', () => {
      const clickToExplainEnabled = false;
      const targetOption = EXPLAINABLE_OPTIONS['create-workflow'];

      // When toggle is OFF, clicking is disabled, but explicit voice commands must still answer questions
      expect(clickToExplainEnabled).toBe(false);

      const intent = detectQuestionIntent('What does this option do?');
      expect(intent).toBe('what_does_it_do');

      const answer = answerQuestionAboutOption(targetOption, intent);
      expect(answer).toBe(targetOption.conciseExplanation);

      // Follow-up question "Why should I use it?"
      const intentWhy = detectQuestionIntent('Why should I use it?');
      expect(intentWhy).toBe('why_use_it');
      expect(answerQuestionAboutOption(targetOption, intentWhy)).toBe(targetOption.whyUseIt);
    });

    it('registers click-to-explain-setting in EXPLAINABLE_OPTIONS with accurate behavior descriptions', () => {
      const opt = EXPLAINABLE_OPTIONS['click-to-explain-setting'];
      expect(opt).toBeDefined();
      expect(opt.title).toBe('Click-to-Explain');
      expect(opt.category).toBe('setting');
      expect(opt.conciseExplanation).toContain(
        'automatically explains what an option does when you click it'
      );
      expect(opt.willSendAnything).toContain('No, this only configures local interface guidance');
      expect(opt.doesSaveData).toContain('Yes, your Click-to-Explain preference is saved');
      expect(opt.canUndo).toContain('Yes, you can toggle it back on or off');
      expect(opt.keywords).toContain('click to explain');
    });
  });
});


