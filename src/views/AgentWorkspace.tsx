/**
 * ProofLoop Agent Workspace
 * Conversational goal-to-outcome reasoning interface with real-time Voice AI,
 * audio playback, live speech recognition transcription, and approval safeguards.
 * Amazon Developer Hackathon 2026 — Alexa+ track
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Sparkles,
  Play,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Clock,
  ArrowRight,
  Bot,
  User,
  Wrench,
  AlertTriangle,
  Mail,
  FileText,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Download,
  Loader2,
} from 'lucide-react';
import type {
  Workflow,
  WorkflowStep,
  VerificationRecord,
  ApprovalRecord,
  InternshipApplicationData,
} from '../types/index.js';
import { useVoice } from '../context/VoiceContext.js';
import { downloadWorkflowReport, downloadApplicationFile } from '../services/api.js';

interface AgentWorkspaceProps {
  currentWorkflow: Workflow | null;
  currentApplication?: InternshipApplicationData | null;
  onPlanGoal: (goal: string) => Promise<void>;
  onExecuteStep: (stepId: string) => Promise<void>;
  onRecoverStep: (stepId: string) => Promise<void>;
  onRunAll: () => Promise<void>;
  onInspectVerification: (record: VerificationRecord) => void;
  onRequestApproval: (step: WorkflowStep) => void;
  onOpenApplicationReview?: () => void;
  onAutoPrepareApplication?: () => Promise<void>;
  onOpenVoiceMode?: () => void;
  executingStepId: string | null;
  isPlanning: boolean;
  isAutoPreparing?: boolean;
}

export const AgentWorkspace: React.FC<AgentWorkspaceProps> = ({
  currentWorkflow,
  currentApplication,
  onPlanGoal,
  onExecuteStep,
  onRecoverStep,
  onRunAll,
  onInspectVerification,
  onRequestApproval,
  onOpenApplicationReview,
  onAutoPrepareApplication,
  onOpenVoiceMode,
  executingStepId,
  isPlanning,
  isAutoPreparing,
}) => {
  const [inputText, setInputText] = useState('');
  const [downloadingReport, setDownloadingReport] = useState<boolean>(false);
  const [downloadingResume, setDownloadingResume] = useState<boolean>(false);
  const [workspaceDownloadMsg, setWorkspaceDownloadMsg] = useState<string | null>(null);
  const lastAnnouncedRef = useRef<string | null>(null);

  // Global persistent background Voice controller
  const {
    isListening,
    isSpeaking,
    speakAloudEnabled,
    setSpeakAloudEnabled,
    transcript,
    interimTranscript,
    errorMessage: speechError,
    toggleVoice: toggleMic,
    muteOrStopAudio: stopSpeaking,
    clearError: resetTranscript,
    speak,
  } = useVoice();

  const fullTranscript = (
    transcript + (interimTranscript ? ` ${interimTranscript}` : '')
  ).trim();


  // Keep input text updated when speech recognition produces text
  useEffect(() => {
    if (isListening && fullTranscript) {
      setInputText(fullTranscript);
    }
  }, [isListening, fullTranscript]);

  // Stable ref for speak to avoid triggering re-runs when voice state updates
  const speakRef = useRef(speak);
  useEffect(() => {
    speakRef.current = speak;
  }, [speak]);

  // Voice progress announcements during workflow lifecycle
  useEffect(() => {
    if (isPlanning && lastAnnouncedRef.current !== 'planning') {
      lastAnnouncedRef.current = 'planning';
      speakRef.current('Analyzing your request and consulting project tools.');
    } else if (isAutoPreparing && lastAnnouncedRef.current !== 'preparing') {
      lastAnnouncedRef.current = 'preparing';
      speakRef.current('I am checking available application documents and preparing your draft.');
    } else if (
      currentApplication &&
      currentApplication.applicationStatus === 'AWAITING_APPROVAL' &&
      lastAnnouncedRef.current !== 'awaiting_approval'
    ) {
      lastAnnouncedRef.current = 'awaiting_approval';
      speakRef.current(
        'Your application draft is ready. Please review it in the Application Review panel before I send it.'
      );
    } else if (
      currentWorkflow &&
      currentWorkflow.progress === 100 &&
      lastAnnouncedRef.current !== 'completed'
    ) {
      lastAnnouncedRef.current = 'completed';
      speakRef.current('Workflow completed successfully with cryptographic outcome verification.');
    }
  }, [
    isPlanning,
    isAutoPreparing,
    currentApplication?.applicationStatus,
    currentWorkflow?.progress,
  ]);


  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isPlanning) return;
    const goal = inputText.trim();
    setInputText('');
    if (isListening) {
      toggleMic();
    }
    onPlanGoal(goal);
  };

  const handleDownloadWorkflowReport = async (format: 'markdown' | 'pdf' = 'markdown') => {
    if (!currentWorkflow || downloadingReport) return;
    setDownloadingReport(true);
    setWorkspaceDownloadMsg(null);
    try {
      const filename = await downloadWorkflowReport(currentWorkflow.id, format);
      setWorkspaceDownloadMsg(`Downloaded ${filename}`);
      setTimeout(() => setWorkspaceDownloadMsg(null), 3000);
    } catch (err: any) {
      setWorkspaceDownloadMsg(`Download error: ${err.message || 'Failed'}`);
      setTimeout(() => setWorkspaceDownloadMsg(null), 4000);
    } finally {
      setDownloadingReport(false);
    }
  };

  const handleDownloadApplicationResume = async () => {
    if (!currentApplication || downloadingResume) return;
    setDownloadingResume(true);
    setWorkspaceDownloadMsg(null);
    try {
      const filename = await downloadApplicationFile(currentApplication.id, 'resume', 'pdf');
      setWorkspaceDownloadMsg(`Downloaded ${filename}`);
      setTimeout(() => setWorkspaceDownloadMsg(null), 3000);
    } catch (err: any) {
      setWorkspaceDownloadMsg(`Download error: ${err.message || 'Failed'}`);
      setTimeout(() => setWorkspaceDownloadMsg(null), 4000);
    } finally {
      setDownloadingResume(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* Workspace Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl w-full mx-auto">
        {/* Intro Banner */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xs flex items-start justify-between gap-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
              <Bot className="w-4 h-4" />
            </div>
            <div className="space-y-1 text-xs">
              <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>ProofLoop Conversational Agent</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-mono">
                  Voice & MCP Active
                </span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                Describe any high-level outcome or speak your request. The agent interprets constraints, decomposes actionable steps, checks permissions, executes tools via MCP, and produces cryptographic proof records.
              </p>
            </div>
          </div>

          {/* Quick Voice Mode Launcher Button */}
          {onOpenVoiceMode && (
            <button
              type="button"
              onClick={onOpenVoiceMode}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 transition-colors shrink-0 shadow-2xs"
            >
              <Mic className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Full Voice Mode</span>
            </button>
          )}
        </div>

        {/* Current Active Workflow Card if present */}
        {currentWorkflow && (
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Active Workflow · {currentWorkflow.id}
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {currentWorkflow.goal}
                </h2>
                {currentWorkflow.summary && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {currentWorkflow.summary}
                  </p>
                )}

                {/* Workflow Download Report Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-slate-500 font-medium">Download Report:</span>
                  <button
                    onClick={() => handleDownloadWorkflowReport('markdown')}
                    disabled={downloadingReport}
                    data-explain="download-report-markdown"
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors disabled:opacity-50"
                    title="Download Workflow Audit Report as Markdown"
                  >
                    {downloadingReport ? (
                      <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                    ) : (
                      <Download className="w-3 h-3 text-emerald-600" />
                    )}
                    <span>.md</span>
                  </button>

                  <button
                    onClick={() => handleDownloadWorkflowReport('pdf')}
                    disabled={downloadingReport}
                    data-explain="download-report-pdf"
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors disabled:opacity-50"
                    title="Download Workflow Audit Report as PDF"
                  >
                    <FileText className="w-3 h-3 text-emerald-600" />
                    <span>.pdf</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col items-end shrink-0">
                <span className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {currentWorkflow.progress}%
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">Verified</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-300"
                style={{ width: `${currentWorkflow.progress}%` }}
              />
            </div>

            {/* Workspace Download Notification Banner */}
            {workspaceDownloadMsg && (
              <div className="p-2.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
                <span>{workspaceDownloadMsg}</span>
                <button
                  onClick={() => setWorkspaceDownloadMsg(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Application Review Callout Banner if currentApplication is present */}
            {currentApplication && (
              <div className="p-4 rounded-xl border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/25 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                        {currentApplication.companyName}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-700 dark:text-slate-300 text-xs">
                        {currentApplication.positionTitle}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                          currentApplication.applicationStatus === 'SENT'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                            : currentApplication.applicationStatus === 'AWAITING_APPROVAL'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border-amber-300 dark:border-amber-800 animate-pulse'
                            : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {currentApplication.applicationStatus.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Recipient: <span className="font-mono text-slate-800 dark:text-slate-200">{currentApplication.recipientEmail}</span> · Resume:{' '}
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        {currentApplication.attachments.find((a) => a.selected && a.filename.includes('Resume'))?.filename || 'Resume.pdf'} (Verified)
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 sm:self-center self-end flex-wrap">
                  <button
                    onClick={handleDownloadApplicationResume}
                    disabled={downloadingResume}
                    data-explain="download-resume-pdf"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-md transition-colors shadow-2xs disabled:opacity-50"
                    title="Download verified resume PDF"
                  >
                    {downloadingResume ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    <span>Download Resume</span>
                  </button>

                  {onAutoPrepareApplication && currentWorkflow.progress < 70 && (
                    <button
                      onClick={onAutoPrepareApplication}
                      disabled={isAutoPreparing}
                      data-explain="auto-prepare"
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-md transition-colors shadow-2xs"
                    >
                      {isAutoPreparing ? 'Preparing Materials...' : 'Auto-Prepare Draft'}
                    </button>
                  )}

                  {onOpenApplicationReview && (
                    <button
                      onClick={onOpenApplicationReview}
                      data-explain="approve-and-send"
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors shadow-2xs"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>
                        {currentApplication.applicationStatus === 'SENT'
                          ? 'View Sent Application'
                          : 'Review & Authorize Application'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Workflow Steps Interactive List */}
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Actionable Milestones
              </div>

              <div className="space-y-2">
                {currentWorkflow.steps.map((step) => {
                  const isExecuting = executingStepId === step.id;

                  return (
                    <div
                      key={step.id}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-400 dark:text-slate-500 tabular-nums">
                            {String(step.order).padStart(2, '0')}.
                          </span>
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {step.title}
                          </span>
                          {step.requiresApproval && (
                            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                              (Requires Approval)
                            </span>
                          )}
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 pl-6 text-[11px]">
                          {step.description}
                        </p>
                      </div>

                      {/* Status & Controls */}
                      <div className="flex items-center gap-2.5 sm:self-center self-end pl-6 sm:pl-0">
                        {step.status === 'verified_complete' && step.verificationRecord && (
                          <button
                            onClick={() => onInspectVerification(step.verificationRecord!)}
                            data-explain="proof-verified"
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-md font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Proof Verified</span>
                          </button>
                        )}

                        {step.status === 'waiting_for_approval' && (
                          <button
                            onClick={() => onRequestApproval(step)}
                            data-explain="approve-action"
                            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-md transition-colors"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Authorize</span>
                          </button>
                        )}

                        {step.status === 'ready' && (
                          <button
                            onClick={() => onExecuteStep(step.id)}
                            disabled={isExecuting}
                            data-explain="execute-step"
                            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-slate-900 dark:bg-slate-100 dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 rounded-md transition-colors"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>{isExecuting ? 'Running...' : 'Execute'}</span>
                          </button>
                        )}

                        {step.status === 'failed' && (
                          <button
                            onClick={() => onRecoverStep(step.id)}
                            disabled={isExecuting}
                            data-explain="recover-step"
                            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Recover</span>
                          </button>
                        )}

                        {step.status === 'not_started' && (
                          <span className="text-slate-400 dark:text-slate-500 text-[11px]">
                            Waiting on dependencies
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Run all available steps button */}
              {currentWorkflow.progress < 100 && (
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={onRunAll}
                    data-explain="run-all-steps"
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors shadow-2xs"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Available Steps</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {isPlanning && (
          <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
            <Sparkles className="w-4 h-4 text-emerald-600 animate-spin" />
            <span>Analyzing goal, consulting persistent memories, and generating verified milestone graph...</span>
          </div>
        )}

        {/* Live Speech Recognition Feedback Card */}
        {isListening && (
          <div className="p-3.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-3 animate-pulse shadow-xs">
            <div className="flex items-center gap-2.5">
              <Radio className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-spin" />
              <div>
                <span className="font-bold">Listening to your voice... </span>
                <span className="italic">{fullTranscript || 'Speak your request now'}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleMic}
              className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 shrink-0"
            >
              Done Speaking
            </button>
          </div>
        )}

        {speechError && (
          <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-900/80 bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
            <span>{speechError}</span>
            <button
              type="button"
              onClick={resetTranscript}
              className="underline text-[11px] ml-2"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 space-y-2">
        {/* Quick Suggestion Chips */}
        <div className="max-w-4xl mx-auto flex items-center gap-2 overflow-x-auto text-[11px]">
          <span className="shrink-0 font-semibold text-slate-400 dark:text-slate-500">Suggestions:</span>
          <button
            type="button"
            onClick={() => {
              setInputText('Help me prepare and submit my internship application before Friday.');
              onPlanGoal('Help me prepare and submit my internship application before Friday.');
            }}
            className="shrink-0 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-medium rounded-md border border-emerald-200 dark:border-emerald-800 transition-colors"
          >
            “Help me prepare and submit my internship application before Friday.”
          </button>
          <button
            type="button"
            onClick={() => {
              setInputText('Help me prepare my hackathon submission and make sure it is ready before the deadline.');
              onPlanGoal('Help me prepare my hackathon submission and make sure it is ready before the deadline.');
            }}
            className="shrink-0 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md border border-slate-200 dark:border-slate-700 transition-colors"
          >
            Hackathon Submission
          </button>
        </div>

        <form onSubmit={handleSend} className="max-w-4xl mx-auto flex items-center gap-2">
          {/* Microphone Button with States */}
          <button
            type="button"
            onClick={toggleMic}
            className={`p-2.5 rounded-lg border transition-all shrink-0 flex items-center justify-center ${
              isListening
                ? 'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-300 dark:ring-emerald-800 animate-pulse'
                : isSpeaking
                ? 'bg-emerald-500 text-white border-emerald-600 ring-2 ring-emerald-200'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
            }`}
            title={
              isListening
                ? 'Stop Voice Input'
                : isSpeaking
                ? 'Stop Audio Playback'
                : 'Speak to ProofLoop (Web Speech API)'
            }
          >
            {isSpeaking ? (
              <Volume2 className="w-4 h-4 animate-bounce" />
            ) : isListening ? (
              <Mic className="w-4 h-4 text-white" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isPlanning}
            placeholder={
              isListening
                ? 'Listening to speech...'
                : "Tell ProofLoop what goal to achieve (e.g. 'Help me prepare my hackathon submission')..."
            }
            className="flex-1 px-4 py-2.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 transition-colors"
          />

          {/* Speak AI Toggle */}
          <button
            type="button"
            onClick={() => setSpeakAloudEnabled(!speakAloudEnabled)}
            className={`p-2.5 rounded-lg border transition-colors shrink-0 ${
              speakAloudEnabled
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                : 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400'
            }`}
            title={speakAloudEnabled ? 'Spoken AI replies are ON (Click to mute)' : 'Spoken AI replies are OFF (Click to unmute)'}
          >
            {speakAloudEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            type="submit"
            disabled={!inputText.trim() || isPlanning}
            className="px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 shadow-2xs"
          >
            <span>Plan & Execute</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
