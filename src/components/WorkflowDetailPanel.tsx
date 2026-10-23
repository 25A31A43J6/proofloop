/**
 * ProofLoop Right-Side Workflow Details Panel
 * Shows active workflow timeline, dependencies, execution controls, and proof links.
 * Amazon Developer Hackathon 2026 — Alexa+ track
 */

import React from 'react';
import {
  X,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Lock,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  Download,
  Loader2,
  FileDown,
} from 'lucide-react';
import type { Workflow, WorkflowStep, VerificationRecord } from '../types/index.js';
import { downloadWorkflowReport } from '../services/api.js';

interface WorkflowDetailPanelProps {
  workflow: Workflow | null;
  onClose: () => void;
  onExecuteStep: (stepId: string) => Promise<void>;
  onRecoverStep: (stepId: string) => Promise<void>;
  onRunAll: () => Promise<void>;
  onInspectVerification: (record: VerificationRecord) => void;
  onRequestApproval: (step: WorkflowStep) => void;
  onOpenApplicationReview?: (applicationId?: string) => void;
  executingStepId: string | null;
  isRunAllLoading: boolean;
}

export const WorkflowDetailPanel: React.FC<WorkflowDetailPanelProps> = ({
  workflow,
  onClose,
  onExecuteStep,
  onRecoverStep,
  onRunAll,
  onInspectVerification,
  onRequestApproval,
  onOpenApplicationReview,
  executingStepId,
  isRunAllLoading,
}) => {
  const [downloadingFormat, setDownloadingFormat] = React.useState<'markdown' | 'pdf' | 'json' | null>(null);
  const [downloadMsg, setDownloadMsg] = React.useState<string | null>(null);

  if (!workflow) return null;

  const handleDownloadReport = async (format: 'markdown' | 'pdf' | 'json' = 'markdown') => {
    if (downloadingFormat) return;
    setDownloadingFormat(format);
    setDownloadMsg(null);
    try {
      const filename = await downloadWorkflowReport(workflow.id, format);
      setDownloadMsg(`Downloaded ${filename}`);
      setTimeout(() => setDownloadMsg(null), 3000);
    } catch (err: any) {
      setDownloadMsg(`Error: ${err.message || 'Download failed'}`);
      setTimeout(() => setDownloadMsg(null), 4000);
    } finally {
      setDownloadingFormat(null);
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'verified_complete':
        return {
          label: 'Verified Complete',
          className: 'text-emerald-700 dark:text-emerald-400 font-semibold',
          icon: CheckCircle2,
        };
      case 'in_progress':
        return {
          label: 'In Progress',
          className: 'text-blue-700 dark:text-blue-400 font-semibold',
          icon: Clock,
        };
      case 'waiting_for_approval':
        return {
          label: 'Waiting for Approval',
          className: 'text-amber-700 dark:text-amber-400 font-semibold',
          icon: Lock,
        };
      case 'failed':
        return {
          label: 'Failed',
          className: 'text-rose-700 dark:text-rose-400 font-semibold',
          icon: AlertTriangle,
        };
      case 'blocked':
        return {
          label: 'Blocked',
          className: 'text-neutral-500 dark:text-neutral-400',
          icon: Lock,
        };
      case 'ready':
        return {
          label: 'Ready to Run',
          className: 'text-indigo-700 dark:text-indigo-400 font-medium',
          icon: Play,
        };
      default:
        return {
          label: 'Not Started',
          className: 'text-neutral-400 dark:text-neutral-500',
          icon: Clock,
        };
    }
  };

  return (
    <aside className="w-80 md:w-96 border-l border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col h-full shrink-0 z-10">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-mono uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
            Workflow Details
          </span>
          <span className="text-xs text-neutral-600 dark:text-neutral-400 font-mono">
            {workflow.id}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-md transition-colors"
          title="Close Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Goal Summary */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 space-y-3">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white leading-snug">
          {workflow.goal}
        </h3>

        {/* Clean unboxed metadata */}
        <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <span className="capitalize">{workflow.category}</span>
          <span aria-hidden="true">·</span>
          <span>{workflow.steps.length} Steps</span>
          {workflow.deadline && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Due {new Date(workflow.deadline).toLocaleDateString()}
              </span>
            </>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-600 dark:text-neutral-400">Verified Progress</span>
            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {workflow.progress}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${workflow.progress}%` }}
            />
          </div>
        </div>

        {/* Run All Button */}
        {workflow.progress < 100 && (
          <button
            onClick={onRunAll}
            disabled={isRunAllLoading}
            data-explain="run-all-steps"
            className="w-full flex items-center justify-center gap-2 py-1.5 px-3 text-xs font-semibold text-white bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 rounded-md hover:bg-neutral-800 dark:hover:bg-white transition-colors disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{isRunAllLoading ? 'Executing Workflow...' : 'Execute Available Steps'}</span>
          </button>
        )}

        {/* Download Audit Report Buttons */}
        <div className="pt-1 flex items-center justify-between gap-1.5 flex-wrap">
          <span className="text-[11px] text-neutral-500 font-medium">Audit Report:</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleDownloadReport('markdown')}
              disabled={Boolean(downloadingFormat)}
              data-explain="download-report-markdown"
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors disabled:opacity-50"
              title="Download full workflow audit report as Markdown"
            >
              {downloadingFormat === 'markdown' ? (
                <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
              ) : (
                <Download className="w-3 h-3 text-emerald-600" />
              )}
              <span>.md</span>
            </button>

            <button
              onClick={() => handleDownloadReport('pdf')}
              disabled={Boolean(downloadingFormat)}
              data-explain="download-report-pdf"
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors disabled:opacity-50"
              title="Download workflow report as PDF"
            >
              {downloadingFormat === 'pdf' ? (
                <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
              ) : (
                <FileText className="w-3 h-3 text-emerald-600" />
              )}
              <span>.pdf</span>
            </button>

            <button
              onClick={() => handleDownloadReport('json')}
              disabled={Boolean(downloadingFormat)}
              data-explain="download-report-json"
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors disabled:opacity-50"
              title="Download workflow data as JSON"
            >
              {downloadingFormat === 'json' ? (
                <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
              ) : (
                <Download className="w-3 h-3 text-neutral-500" />
              )}
              <span>.json</span>
            </button>
          </div>
        </div>

        {downloadMsg && (
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded text-[11px] text-emerald-800 dark:text-emerald-300">
            {downloadMsg}
          </div>
        )}
      </div>

      {/* Steps Timeline */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          Execution Timeline & Dependencies
        </div>

        <div className="space-y-2.5">
          {workflow.steps.map((step, idx) => {
            const statusInfo = getStatusDisplay(step.status);
            const StatusIcon = statusInfo.icon;
            const isExecuting = executingStepId === step.id;

            return (
              <div
                key={step.id}
                className={`p-3 rounded-md border text-xs transition-colors ${
                  step.status === 'verified_complete'
                    ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/20'
                    : step.status === 'failed'
                    ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/20'
                    : step.status === 'waiting_for_approval'
                    ? 'border-amber-200 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/20'
                    : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/30 dark:bg-neutral-800/20'
                }`}
              >
                {/* Step title and order */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-neutral-400 dark:text-neutral-500 tabular-nums">
                      {String(step.order).padStart(2, '0')}.
                    </span>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {step.title}
                    </span>
                  </div>
                </div>

                <p className="mt-1 text-neutral-600 dark:text-neutral-400 pl-6 leading-relaxed">
                  {step.description}
                </p>

                {/* Status line */}
                <div className="mt-2.5 pl-6 flex items-center justify-between text-[11px]">
                  <div className={`flex items-center gap-1.5 ${statusInfo.className}`}>
                    <StatusIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>{statusInfo.label}</span>
                  </div>

                  {/* Actions depending on state */}
                  <div className="flex items-center gap-2">
                    {/* View Proof of Completion */}
                    {step.status === 'verified_complete' && step.verificationRecord && (
                      <button
                        onClick={() => onInspectVerification(step.verificationRecord!)}
                        data-explain="proof-verified"
                        className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 hover:underline font-medium"
                        title="Inspect cryptographic proof and tool return evidence"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Proof</span>
                      </button>
                    )}

                    {/* Waiting for approval */}
                    {step.status === 'waiting_for_approval' && (
                      <button
                        onClick={() => {
                          if (
                            onOpenApplicationReview &&
                            (step.actionType === 'dispatch' ||
                              step.title.toLowerCase().includes('application') ||
                              step.title.toLowerCase().includes('approve') ||
                              step.title.toLowerCase().includes('send'))
                          ) {
                            onOpenApplicationReview();
                          } else {
                            onRequestApproval(step);
                          }
                        }}
                        data-explain="approve-action"
                        className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded font-medium transition-colors"
                      >
                        Review
                      </button>
                    )}

                    {/* Ready to run */}
                    {step.status === 'ready' && (
                      <button
                        onClick={() => onExecuteStep(step.id)}
                        disabled={isExecuting}
                        data-explain="execute-step"
                        className="flex items-center gap-1 px-2 py-0.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 rounded font-medium transition-colors"
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>{isExecuting ? 'Running...' : 'Run'}</span>
                      </button>
                    )}

                    {/* Failed -> Recover */}
                    {step.status === 'failed' && (
                      <button
                        onClick={() => onRecoverStep(step.id)}
                        disabled={isExecuting}
                        data-explain="recover-step"
                        className="flex items-center gap-1 px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-medium transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Recover</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Failure explanation & recovery note if failed */}
                {step.status === 'failed' && step.failureReason && (
                  <div className="mt-2 ml-6 p-2 bg-rose-100/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded text-[11px] text-rose-800 dark:text-rose-300">
                    <div className="font-semibold">Failure Diagnostic:</div>
                    <div>{step.failureReason}</div>
                    {step.recoverySuggestion && (
                      <div className="mt-1 text-rose-700 dark:text-rose-400 font-medium">
                        Alternative: {step.recoverySuggestion}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};
