/**
 * ProofLoop Human-in-the-Loop Approval Modal
 * Prevents unauthorized consequential execution.
 */

import React from 'react';
import { ShieldAlert, AlertTriangle, Check, X } from 'lucide-react';
import type { ApprovalRecord } from '../types/index.js';

interface ApprovalActionModalProps {
  approval: ApprovalRecord | null;
  onDecide: (id: string, status: 'approved' | 'rejected') => Promise<void>;
  onClose: () => void;
  isDeciding: boolean;
}

export const ApprovalActionModal: React.FC<ApprovalActionModalProps> = ({
  approval,
  onDecide,
  onClose,
  isDeciding,
}) => {
  if (!approval) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                Human Authorization Required
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Consequential Action Review
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

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          <div>
            <div className="text-neutral-500 dark:text-neutral-400 font-medium">Action Description</div>
            <div className="text-sm font-semibold text-neutral-900 dark:text-white mt-0.5">
              {approval.actionDescription}
            </div>
          </div>

          {/* Risk Level & Consequences */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 rounded-md flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-amber-900 dark:text-amber-300">
                Risk Level: {approval.riskLevel.toUpperCase()}
              </div>
              <p className="text-amber-800 dark:text-amber-300/90 leading-relaxed">
                {approval.consequences}
              </p>
            </div>
          </div>

          {/* Action Payload Preview */}
          <div className="space-y-1.5">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              Action Payload Preview
            </span>
            <pre className="p-3 bg-neutral-900 text-neutral-100 rounded text-[11px] font-mono overflow-x-auto max-h-40 border border-neutral-800">
              {JSON.stringify(approval.previewData, null, 2)}
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900 flex items-center justify-between gap-3">
          <button
            onClick={() => onDecide(approval.id, 'rejected')}
            disabled={isDeciding}
            data-explain="reject-action"
            className="px-4 py-2 text-xs font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors border border-rose-200 dark:border-rose-900"
          >
            Reject Action
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isDeciding}
              className="px-3.5 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onDecide(approval.id, 'approved')}
              disabled={isDeciding}
              data-explain="approve-action"
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors shadow-sm"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isDeciding ? 'Authorizing...' : 'Approve & Execute'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
