/**
 * ProofLoop Verification Proof Inspector Modal
 * Signature Feature: Shows immutable verification evidence and cryptographic hash.
 */

import React, { useState } from 'react';
import { ShieldCheck, X, Copy, Check, ExternalLink, Hash, Clock, Wrench, Download, FileText, Loader2, AlertCircle } from 'lucide-react';
import type { VerificationRecord } from '../types/index.js';
import { downloadVerificationCertificate } from '../services/api.js';

interface VerificationProofModalProps {
  record: VerificationRecord | null;
  onClose: () => void;
}

export const VerificationProofModal: React.FC<VerificationProofModalProps> = ({
  record,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<'json' | 'pdf' | 'txt' | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (!record) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(record.evidenceReference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async (format: 'json' | 'pdf' | 'txt') => {
    if (downloadingFormat) return; // prevent duplicate clicks
    setDownloadingFormat(format);
    setDownloadError(null);
    setDownloadSuccess(null);

    try {
      const filename = await downloadVerificationCertificate(record.id, format);
      setDownloadSuccess(`Downloaded ${filename}`);
      setTimeout(() => setDownloadSuccess(null), 3000);
    } catch (err: any) {
      setDownloadError(err.message || 'Download failed');
    } finally {
      setDownloadingFormat(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                Proof of Completion Ledger
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Verified Outcome & Cryptographic Evidence
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Action & Status */}
          <div className="p-3.5 bg-neutral-50 dark:bg-neutral-800/40 rounded-md border border-neutral-200/80 dark:border-neutral-800">
            <div className="text-neutral-500 dark:text-neutral-400 font-medium">Action Performed</div>
            <div className="text-sm font-semibold text-neutral-900 dark:text-white mt-0.5">
              {record.actionPerformed}
            </div>
            <div className="mt-2 flex items-center gap-2 text-neutral-500 dark:text-neutral-400">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider text-[11px]">
                {record.finalStatus === 'verified_complete' ? 'Verified Complete' : 'Failed'}
              </span>
              <span>·</span>
              <span>Verified by {record.verifiedBy || 'ProofLoop Verification Engine'}</span>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
                <Wrench className="w-3.5 h-3.5" />
                <span>Tool Used</span>
              </div>
              <div className="font-mono font-medium text-neutral-900 dark:text-neutral-200 text-xs">
                {record.toolUsed}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
                <Clock className="w-3.5 h-3.5" />
                <span>Execution Timestamp</span>
              </div>
              <div className="font-mono text-neutral-900 dark:text-neutral-200 tabular-nums text-xs">
                {new Date(record.executedAt).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Evidence Reference */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-neutral-400" />
                Evidence Reference URI & Checksum
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy URI'}</span>
              </button>
            </div>
            <div className="p-2.5 bg-neutral-100 dark:bg-neutral-800 rounded font-mono text-[11px] text-neutral-800 dark:text-neutral-200 break-all select-all">
              {record.evidenceReference}
            </div>
          </div>

          {/* Verification Method */}
          <div className="space-y-1">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              Verification Method
            </span>
            <div className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
              {record.verificationMethod} — Evaluated actual tool return values against execution schema, computed deterministic SHA-256 payload digest, and confirmed prerequisite invariants.
            </div>
          </div>

          {/* Tool Result Data */}
          <div className="space-y-1.5">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              Tool Return Payload
            </span>
            <pre className="p-3 bg-neutral-900 text-neutral-100 rounded text-[11px] font-mono overflow-x-auto max-h-48 border border-neutral-800">
              {typeof record.resultReturned === 'string'
                ? record.resultReturned
                : JSON.stringify(record.resultReturned, null, 2)}
            </pre>
          </div>

          {/* Download Notification Banner */}
          {downloadSuccess && (
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{downloadSuccess}</span>
            </div>
          )}
          {downloadError && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded text-rose-800 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{downloadError}</span>
            </div>
          )}
        </div>

        {/* Footer with Real Download Actions */}
        <div className="px-6 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium mr-1">
              Export Proof:
            </span>

            <button
              onClick={() => handleDownload('json')}
              disabled={Boolean(downloadingFormat)}
              data-explain="download-certificate-json"
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-750 transition-colors disabled:opacity-50"
              title="Download cryptographic JSON proof certificate"
            >
              {downloadingFormat === 'json' ? (
                <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
              ) : (
                <Download className="w-3 h-3 text-emerald-600" />
              )}
              <span>JSON Proof</span>
            </button>

            <button
              onClick={() => handleDownload('pdf')}
              disabled={Boolean(downloadingFormat)}
              data-explain="download-certificate-pdf"
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-750 transition-colors disabled:opacity-50"
              title="Download formal PDF audit certificate"
            >
              {downloadingFormat === 'pdf' ? (
                <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
              ) : (
                <FileText className="w-3 h-3 text-emerald-600" />
              )}
              <span>PDF Certificate</span>
            </button>

            <button
              onClick={() => handleDownload('txt')}
              disabled={Boolean(downloadingFormat)}
              data-explain="download-certificate-txt"
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded hover:bg-neutral-100 dark:hover:bg-neutral-750 transition-colors disabled:opacity-50"
              title="Download plain text ledger certificate"
            >
              {downloadingFormat === 'txt' ? (
                <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
              ) : (
                <Download className="w-3 h-3 text-neutral-500" />
              )}
              <span>Text</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
