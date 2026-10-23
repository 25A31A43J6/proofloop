/**
 * ProofLoop Approval Center View
 * Human-in-the-loop review for consequential and external actions.
 */

import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, XCircle, AlertTriangle, Check, X, Clock, Mail } from 'lucide-react';
import type { ApprovalRecord } from '../types/index.js';

interface ApprovalsViewProps {
  approvals: ApprovalRecord[];
  onDecide: (id: string, status: 'approved' | 'rejected') => Promise<void>;
  onOpenApplicationReview?: (applicationId?: string) => void;
  isDeciding: boolean;
}

export const ApprovalsView: React.FC<ApprovalsViewProps> = ({
  approvals,
  onDecide,
  onOpenApplicationReview,
  isDeciding,
}) => {
  const [tab, setTab] = useState<'pending' | 'history'>('pending');

  const pendingList = approvals.filter((a) => a.status === 'pending');
  const historyList = approvals.filter((a) => a.status !== 'pending');

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
          Human-in-the-Loop Approvals
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Consequential operations (emails, submissions, external changes) require explicit authorization before execution.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg w-fit">
        <button
          onClick={() => setTab('pending')}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            tab === 'pending'
              ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
          }`}
        >
          <span>Pending Authorization</span>
          {pendingList.length > 0 && (
            <span className="font-mono text-[11px] bg-amber-500 text-white px-1.5 py-0.2 rounded-full font-bold">
              {pendingList.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setTab('history')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            tab === 'history'
              ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
          }`}
        >
          Decision Audit History ({historyList.length})
        </button>
      </div>

      {tab === 'pending' ? (
        <div className="space-y-4">
          {pendingList.length === 0 ? (
            <div className="p-12 text-center border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50/50 dark:bg-neutral-800/20 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <div className="text-sm font-semibold text-neutral-900 dark:text-white">
                All Clear — Zero Pending Approvals
              </div>
              <p className="text-xs text-neutral-500">
                Any consequential actions planned by the agent will pause here for your review.
              </p>
            </div>
          ) : (
            pendingList.map((appr) => (
              <div
                key={appr.id}
                className="p-5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-neutral-900 shadow-xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-100 dark:border-neutral-800 pb-3">
                  <div className="space-y-0.5">
                    <span className="text-[11px] font-mono text-neutral-400 uppercase">
                      Approval Request · {appr.id}
                    </span>
                    <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
                      {appr.actionDescription}
                    </h3>
                  </div>

                  <div className="text-xs font-mono text-neutral-500 dark:text-neutral-400">
                    Requested {new Date(appr.requestedAt).toLocaleTimeString()}
                  </div>
                </div>

                {/* Risk and consequences banner */}
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 rounded-lg flex items-start gap-2.5 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-semibold text-amber-900 dark:text-amber-300">
                      Risk Level: {appr.riskLevel.toUpperCase()}
                    </div>
                    <p className="text-amber-800 dark:text-amber-400/90 leading-relaxed">
                      {appr.consequences}
                    </p>
                  </div>
                </div>

                {/* Action Payload Preview */}
                <div className="space-y-1 text-xs">
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">
                    Payload & Target Data Preview
                  </span>
                  <pre className="p-3 bg-neutral-900 text-neutral-100 rounded text-[11px] font-mono overflow-x-auto max-h-48 border border-neutral-800">
                    {JSON.stringify(appr.previewData, null, 2)}
                  </pre>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  {onOpenApplicationReview &&
                  (appr.previewData?.applicationId ||
                    appr.actionDescription.toLowerCase().includes('application')) ? (
                    <button
                      onClick={() =>
                        onOpenApplicationReview(
                          appr.previewData?.applicationId as string | undefined
                        )
                      }
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors shadow-xs"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Open Application Review Panel</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center gap-3 ml-auto">
                    <button
                      onClick={() => onDecide(appr.id, 'rejected')}
                      disabled={isDeciding}
                      data-explain="reject-action"
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-md transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Reject Action</span>
                    </button>

                    <button
                      onClick={() => {
                        if (
                          onOpenApplicationReview &&
                          (appr.previewData?.applicationId ||
                            appr.actionDescription.toLowerCase().includes('application'))
                        ) {
                          onOpenApplicationReview(
                            appr.previewData?.applicationId as string | undefined
                          );
                        } else {
                          onDecide(appr.id, 'approved');
                        }
                      }}
                      disabled={isDeciding}
                      data-explain="approve-action"
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {appr.previewData?.applicationId
                          ? 'Review & Authorize'
                          : 'Approve & Authorize'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* History */
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-800">
          {historyList.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-400">
              No previous approval decisions yet.
            </div>
          ) : (
            historyList.map((appr) => (
              <div key={appr.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="font-medium text-neutral-900 dark:text-white">
                    {appr.actionDescription}
                  </div>
                  <div className="text-neutral-500 text-[11px]">
                    Decided by {appr.decidedBy || 'User'} on{' '}
                    {appr.decidedAt ? new Date(appr.decidedAt).toLocaleString() : 'N/A'}
                  </div>
                </div>

                <div>
                  {appr.status === 'approved' ? (
                    <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approved</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Rejected</span>
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
