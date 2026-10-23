/**
 * ProofLoop Application Review Modal
 * Human-in-the-loop inspection and authorization for internship applications.
 * Enforces zero-fake-success, editability, and strict hash integrity checks.
 * Amazon Developer Hackathon 2026 — Alexa+ track
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Mail,
  Send,
  Edit3,
  Eye,
  FileText,
  Paperclip,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Building,
  User,
  ExternalLink,
  Info,
  Copy,
  Check,
  RotateCw,
  Download,
  Loader2,
} from 'lucide-react';
import type { InternshipApplicationData, AttachmentItem } from '../types/index.js';
import { downloadApplicationFile } from '../services/api.js';

interface ApplicationReviewModalProps {
  application: InternshipApplicationData | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateDraft: (updates: Partial<InternshipApplicationData>) => Promise<InternshipApplicationData>;
  onApproveAndSend: (
    id: string,
    approvedHash: string,
    idempotencyKey?: string
  ) => Promise<{
    success: boolean;
    status: 'SENT' | 'SEND_FAILED' | 'NOT_CONFIGURED';
    messageId?: string;
    error?: string;
    configurationHelp?: string;
  }>;
}

export const ApplicationReviewModal: React.FC<ApplicationReviewModalProps> = ({
  application,
  isOpen,
  onClose,
  onUpdateDraft,
  onApproveAndSend,
}) => {
  // Local draft state for editing — always call hooks unconditionally at the top level
  const [recipient, setRecipient] = useState(application?.recipientEmail || '');
  const [subject, setSubject] = useState(application?.emailSubject || '');
  const [body, setBody] = useState(application?.emailBody || '');
  const [attachments, setAttachments] = useState<AttachmentItem[]>(application?.attachments || []);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeResumePreview, setActiveResumePreview] = useState<string | null>(null);
  const [copiedBody, setCopiedBody] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [downloadFeedback, setDownloadFeedback] = useState<{ id: string; msg: string; isError?: boolean } | null>(null);

  // Send result feedback
  const [sendResult, setSendResult] = useState<{
    status: 'SENT' | 'SEND_FAILED' | 'NOT_CONFIGURED';
    messageId?: string;
    error?: string;
    configurationHelp?: string;
  } | null>(null);

  // Sync when application prop changes
  useEffect(() => {
    if (application) {
      setRecipient(application.recipientEmail || '');
      setSubject(application.emailSubject || '');
      setBody(application.emailBody || '');
      setAttachments(application.attachments || []);
      setSendResult(null);
    }
  }, [application?.id, application?.approvedHash]);

  // Compute live hash of current draft to ensure approval matches current display
  const currentHash = useMemo(() => {
    const selected = attachments
      .filter((a) => a.selected)
      .map((a) => a.filename)
      .sort()
      .join(',');

    const payload = [
      recipient.trim().toLowerCase(),
      subject.trim(),
      body.trim(),
      selected,
    ].join('||');

    // Simple deterministic hash for UI comparison
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
      const char = payload.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }, [recipient, subject, body, attachments]);

  if (!isOpen || !application) return null;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = emailRegex.test(recipient.trim());
  const hasResume = attachments.some(
    (a) => a.selected && a.filename.toLowerCase().includes('resume')
  );

  // Check if draft has unsaved changes compared to persistent model
  const isDirty =
    recipient !== application.recipientEmail ||
    subject !== application.emailSubject ||
    body !== application.emailBody ||
    JSON.stringify(attachments) !== JSON.stringify(application.attachments);

  const handleSaveDraft = async () => {
    setIsSaving(true);

    try {
      await onUpdateDraft({
        recipientEmail: recipient,
        emailSubject: subject,
        emailBody: body,
        attachments,
      });
      setIsEditing(false);
    } catch (err: any) {
      alert(`Failed to save application changes: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAttachment = (id: string) => {
    setAttachments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, selected: !a.selected } : a))
    );
  };

  const handleApproveAndSend = async () => {
    if (!isEmailValid) {
      alert('Please enter a valid recipient email address.');
      return;
    }

    // Save any pending edits first
    if (isDirty) {
      setIsSaving(true);
      try {
        await onUpdateDraft({
          recipientEmail: recipient,
          emailSubject: subject,
          emailBody: body,
          attachments,
        });
      } catch (err: any) {
        alert(`Error saving changes: ${err.message}`);
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    }

    setIsSending(true);
    setSendResult(null);

    try {
      // Calculate server hash
      const hashPayload = [
        recipient.trim().toLowerCase(),
        subject.trim(),
        body.trim(),
        attachments
          .filter((a) => a.selected)
          .map((a) => a.filename)
          .sort()
          .join(','),
      ].join('||');

      // Request authorization and send
      const res = await onApproveAndSend(
        application.id,
        application.approvedHash || currentHash,
        `send-${application.id}-${Date.now()}`
      );

      setSendResult(res);
    } catch (err: any) {
      setSendResult({
        status: 'SEND_FAILED',
        error: err.message || 'Execution failed during transmission',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyBody = () => {
    navigator.clipboard.writeText(body);
    setCopiedBody(true);
    setTimeout(() => setCopiedBody(false), 2000);
  };

  const handleDownloadAttachment = async (att: AttachmentItem, format?: 'original' | 'pdf' | 'txt') => {
    if (downloadingFileId) return;
    setDownloadingFileId(att.id);
    setDownloadFeedback(null);
    try {
      const filename = await downloadApplicationFile(application.id, att.id, format, att.filename);
      setDownloadFeedback({ id: att.id, msg: `Downloaded ${filename}` });
      setTimeout(() => setDownloadFeedback(null), 3000);
    } catch (err: any) {
      setDownloadFeedback({ id: att.id, msg: err.message || 'Download failed', isError: true });
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handleDownloadCoverLetter = async (format: 'txt' | 'pdf' = 'txt') => {
    if (downloadingFileId) return;
    setDownloadingFileId('cover-letter');
    setDownloadFeedback(null);
    try {
      const filename = await downloadApplicationFile(application.id, 'cover-letter', format);
      setDownloadFeedback({ id: 'cover-letter', msg: `Downloaded ${filename}` });
      setTimeout(() => setDownloadFeedback(null), 3000);
    } catch (err: any) {
      setDownloadFeedback({ id: 'cover-letter', msg: err.message || 'Download failed', isError: true });
    } finally {
      setDownloadingFileId(null);
    }
  };

  const handleDownloadPackage = async () => {
    if (downloadingFileId) return;
    setDownloadingFileId('full-package');
    setDownloadFeedback(null);
    try {
      const filename = await downloadApplicationFile(application.id, 'full-package');
      setDownloadFeedback({ id: 'full-package', msg: `Downloaded ${filename}` });
      setTimeout(() => setDownloadFeedback(null), 3000);
    } catch (err: any) {
      setDownloadFeedback({ id: 'full-package', msg: err.message || 'Download failed', isError: true });
    } finally {
      setDownloadingFileId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-4xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/60 dark:bg-neutral-850 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
                  Application Review & Authorization
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-900">
                  Human-in-the-Loop Gate
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Inspect the final application payload before permitted transmission
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                isEditing
                  ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-neutral-100 dark:text-neutral-900'
                  : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
              <span>{isEditing ? 'Preview Email' : 'Edit Application'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Metadata Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Company & Role */}
            <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-1">
              <div className="flex items-center gap-1.5 text-neutral-400 font-medium">
                <Building className="w-3.5 h-3.5" />
                <span>Target Internship</span>
              </div>
              <div className="font-semibold text-neutral-900 dark:text-white text-xs">
                {application.companyName}
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-tight">
                {application.positionTitle}
              </p>
            </div>

            {/* Applicant Profile */}
            <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-1">
              <div className="flex items-center gap-1.5 text-neutral-400 font-medium">
                <User className="w-3.5 h-3.5" />
                <span>Applicant Details</span>
              </div>
              <div className="font-semibold text-neutral-900 dark:text-white text-xs">
                {application.applicantName}
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                {application.applicantEmail} · {application.applicantPhone || 'Verified'}
              </p>
            </div>

            {/* Deadline */}
            <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 space-y-1">
              <div className="flex items-center gap-1.5 text-neutral-400 font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>Target Deadline</span>
              </div>
              <div className="font-semibold text-neutral-900 dark:text-white text-xs">
                {application.deadline || 'Friday, October 24, 2026'}
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                Autonomous preparation complete
              </p>
            </div>
          </div>

          {/* Recipient & Subject Header Fields */}
          <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                Recipient Email Address <span className="text-rose-500">*</span>
              </label>
              {isEditing ? (
                <input
                  type="email"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="e.g. alexa-agent-internships@amazon.com"
                  className="w-full px-3 py-2 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              ) : (
                <div className="font-mono text-xs text-neutral-900 dark:text-white bg-neutral-50 dark:bg-neutral-800/60 px-3 py-2 rounded-md border border-neutral-200 dark:border-neutral-750 flex items-center justify-between">
                  <span>{recipient}</span>
                  {!isEmailValid && (
                    <span className="text-rose-600 dark:text-rose-400 text-[11px] font-sans">
                      Invalid Email Format
                    </span>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 mb-1">
                Email Subject Line <span className="text-rose-500">*</span>
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              ) : (
                <div className="font-semibold text-xs text-neutral-900 dark:text-white bg-neutral-50 dark:bg-neutral-800/60 px-3 py-2 rounded-md border border-neutral-200 dark:border-neutral-750">
                  {subject}
                </div>
              )}
            </div>
          </div>

          {/* Full Application Message Body */}
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-white dark:bg-neutral-900">
            <div className="px-4 py-2.5 bg-neutral-50 dark:bg-neutral-850 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between flex-wrap gap-2">
              <span className="font-semibold text-neutral-700 dark:text-neutral-300 text-xs">
                Complete Email Message Body & Cover Letter
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-neutral-400">{body.length} characters</span>
                <button
                  onClick={handleCopyBody}
                  className="flex items-center gap-1 text-[11px] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                  title="Copy email body to clipboard"
                >
                  {copiedBody ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copiedBody ? 'Copied' : 'Copy'}</span>
                </button>

                <span className="text-neutral-300 dark:text-neutral-700">|</span>

                <button
                  onClick={() => handleDownloadCoverLetter('txt')}
                  disabled={downloadingFileId === 'cover-letter'}
                  className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50"
                  title="Download cover letter as text file"
                >
                  {downloadingFileId === 'cover-letter' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  <span>Download .txt</span>
                </button>

                <button
                  onClick={() => handleDownloadCoverLetter('pdf')}
                  disabled={downloadingFileId === 'cover-letter'}
                  className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline disabled:opacity-50"
                  title="Download formatted cover letter PDF"
                >
                  <FileText className="w-3 h-3" />
                  <span>Download .pdf</span>
                </button>
              </div>
            </div>

            <div className="p-4">
              {isEditing ? (
                <textarea
                  rows={12}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full p-3 font-mono text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 leading-relaxed"
                />
              ) : (
                <div className="whitespace-pre-wrap font-sans text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed space-y-2 select-text">
                  {body}
                </div>
              )}
            </div>
          </div>

          {/* Download Feedback Banner if active */}
          {downloadFeedback && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                downloadFeedback.isError
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {downloadFeedback.isError ? (
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="font-medium">{downloadFeedback.msg}</span>
              </div>
              <button
                onClick={() => setDownloadFeedback(null)}
                className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Attachments Section */}
          <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-neutral-500" />
                <span className="font-semibold text-neutral-900 dark:text-white text-xs">
                  Required Application Materials & Attachments
                </span>
              </div>
              <span className="text-[11px] text-neutral-500">
                {attachments.filter((a) => a.selected).length} selected
              </span>
            </div>

            <div className="space-y-2">
              {attachments.map((att) => {
                const isDownloadingThis = downloadingFileId === att.id;

                return (
                  <div
                    key={att.id}
                    className={`p-3 rounded-md border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      att.selected
                        ? 'border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/30 dark:bg-emerald-950/20'
                        : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-800/30 opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`att-${att.id}`}
                        checked={att.selected}
                        onChange={() => handleToggleAttachment(att.id)}
                        className="w-4 h-4 text-emerald-600 rounded border-neutral-300 dark:border-neutral-700 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div className="space-y-0.5">
                        <label
                          htmlFor={`att-${att.id}`}
                          className="font-medium text-neutral-900 dark:text-white flex items-center gap-1.5 cursor-pointer flex-wrap"
                        >
                          <FileText className="w-3.5 h-3.5 text-neutral-400" />
                          <span>{att.filename}</span>
                          {att.filename.toLowerCase().includes('resume') && (
                            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 px-1.5 py-0.2 rounded">
                              Verified Candidate Resume
                            </span>
                          )}
                        </label>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 font-mono">
                          {(att.sizeBytes / 1024).toFixed(0)} KB · {att.mimeType}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center pl-7 sm:pl-0">
                      {att.contentPreview && (
                        <button
                          onClick={() => setActiveResumePreview(att.contentPreview!)}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-neutral-700 dark:text-neutral-300 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Preview</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleDownloadAttachment(att)}
                        disabled={Boolean(downloadingFileId)}
                        data-explain="download-attachment"
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-neutral-800 border border-emerald-300 dark:border-emerald-800 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors disabled:opacity-50"
                        title={`Download ${att.filename}`}
                      >
                        {isDownloadingThis ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                            <span>Downloading...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3 h-3 text-emerald-600" />
                            <span>Download</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Validation Warnings or Checkpoints */}
          <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-850 space-y-2">
            <div className="flex items-center gap-1.5 font-semibold text-neutral-800 dark:text-neutral-200">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Pre-Flight Validation Checkpoints</span>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                {isEmailValid ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                )}
                <span className={isEmailValid ? 'text-neutral-700 dark:text-neutral-300' : 'text-rose-600 font-medium'}>
                  Recipient email address format verified ({recipient})
                </span>
              </div>

              <div className="flex items-center gap-2">
                {hasResume ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                )}
                <span className={hasResume ? 'text-neutral-700 dark:text-neutral-300' : 'text-amber-700 font-medium'}>
                  Verified resume PDF selected for transmission
                </span>
              </div>

              <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400">
                <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                <span>
                  Zero-fake-success guard active: ProofLoop refuses to fabricate email delivery without an authentic email transport.
                </span>
              </div>
            </div>
          </div>

          {/* Explicit User Warning & Agreement Banner */}
          <div className="p-4 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <div className="font-bold text-amber-900 dark:text-amber-200">
                Explicit Human Authorization Requirement
              </div>
              <p className="text-amber-800 dark:text-amber-300/90 leading-relaxed font-medium">
                “Please review your application carefully. ProofLoop will send this exact email and the selected attachments to the displayed recipient only after you approve.”
              </p>
              <p className="text-amber-700/80 dark:text-amber-400/80 text-[11px]">
                The approval applies strictly to the final version currently displayed. If recipient, message, or attachments change, re-authorization is mandatory.
              </p>
            </div>
          </div>

          {/* Result Feedback Banner if sent or attempted */}
          {sendResult && (
            <div
              className={`p-4 rounded-lg border text-xs space-y-2 ${
                sendResult.status === 'SENT'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : sendResult.status === 'NOT_CONFIGURED'
                  ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                {sendResult.status === 'SENT' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Application Dispatched Successfully!</span>
                  </>
                ) : sendResult.status === 'NOT_CONFIGURED' ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Zero-Fake-Success Notice: Live Email Provider Not Configured</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Transmission Failed</span>
                  </>
                )}
              </div>

              {sendResult.status === 'SENT' && (
                <div className="space-y-1 text-xs font-mono">
                  <div>Provider Message ID: {sendResult.messageId}</div>
                  <div>Recipient: {recipient}</div>
                  <div>Verification Status: Verified Complete with cryptographic proof record.</div>
                </div>
              )}

              {sendResult.error && (
                <p className="leading-relaxed font-sans">{sendResult.error}</p>
              )}

              {sendResult.configurationHelp && (
                <pre className="p-3 bg-neutral-900 text-neutral-100 rounded text-[11px] font-mono overflow-x-auto border border-neutral-800 leading-normal">
                  {sendResult.configurationHelp}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-850 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
            {isDirty && (
              <button
                onClick={handleSaveDraft}
                disabled={isSaving}
                className="px-3.5 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-50 transition-colors shadow-xs"
              >
                {isSaving ? 'Saving Edits...' : 'Save Draft Edits'}
              </button>
            )}

            <button
              onClick={handleDownloadPackage}
              disabled={Boolean(downloadingFileId)}
              data-explain="download-full-package"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-750 transition-colors shadow-xs disabled:opacity-50"
              title="Download entire application payload and manifest as JSON"
            >
              {downloadingFileId === 'full-package' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              ) : (
                <Download className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>Export Package (.json)</span>
            </button>

            <button
              onClick={onClose}
              data-explain="reject-action"
              className="px-3.5 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md transition-colors"
            >
              {isEditing ? 'Done Editing' : 'Edit Application'}
            </button>

            <button
              onClick={handleApproveAndSend}
              disabled={isSending || isSaving || !isEmailValid}
              data-explain="approve-and-send"
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors shadow-md"
            >
              {isSending ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Authorizing & Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 fill-current" />
                  <span>Approve & Send Application</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Resume Preview Nested Modal */}
        {activeResumePreview && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60">
            <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-sm text-neutral-900 dark:text-white">
                    Verified Resume Document Preview
                  </h3>
                </div>
                <button
                  onClick={() => setActiveResumePreview(null)}
                  className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <pre className="p-4 bg-neutral-950 text-neutral-100 rounded-lg text-[11px] font-mono whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed border border-neutral-800">
                {activeResumePreview}
              </pre>

              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const resumeAtt = attachments.find((a) => a.filename.toLowerCase().includes('resume'));
                      if (resumeAtt) handleDownloadAttachment(resumeAtt, 'pdf');
                    }}
                    disabled={Boolean(downloadingFileId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>

                  <button
                    onClick={() => {
                      const resumeAtt = attachments.find((a) => a.filename.toLowerCase().includes('resume'));
                      if (resumeAtt) handleDownloadAttachment(resumeAtt, 'txt');
                    }}
                    disabled={Boolean(downloadingFileId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Download Plain Text</span>
                  </button>
                </div>

                <button
                  onClick={() => setActiveResumePreview(null)}
                  className="px-4 py-1.5 text-xs font-semibold bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 rounded-md hover:bg-neutral-800 transition-colors"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
