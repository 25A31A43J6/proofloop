/**
 * ProofLoop Activity Log & Audit Trail View
 * Chronological log of tool invocations, verifications, approvals, and state changes.
 */

import React, { useState, useMemo } from 'react';
import {
  History,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  Wrench,
  CheckCircle2,
  Clock,
  Filter,
  Download,
  Loader2,
  Check,
} from 'lucide-react';
import type { ActivityLogEntry } from '../types/index.js';
import { exportActivityLogs } from '../services/api.js';

interface ActivityLogViewProps {
  logs: ActivityLogEntry[];
}

export const ActivityLogView: React.FC<ActivityLogViewProps> = ({ logs }) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [exportingFormat, setExportingFormat] = useState<'csv' | 'json' | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async (format: 'csv' | 'json') => {
    if (exportingFormat) return;
    setExportingFormat(format);
    setExportError(null);
    setExportSuccess(null);
    try {
      const filename = await exportActivityLogs(format);
      setExportSuccess(`Exported ${filename}`);
      setTimeout(() => setExportSuccess(null), 3500);
    } catch (err: any) {
      setExportError(err.message || 'Export failed');
    } finally {
      setExportingFormat(null);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterType === 'all') return true;
      return log.type === filterType;
    });
  }, [logs, filterType]);

  const getLogIcon = (type: string, status: string) => {
    switch (type) {
      case 'verification':
        return <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'approval_request':
        return <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'approval_granted':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'approval_rejected':
        return <AlertTriangle className="w-4 h-4 text-rose-600" />;
      case 'failure':
        return <AlertTriangle className="w-4 h-4 text-rose-600" />;
      case 'recovery':
        return <RotateCcw className="w-4 h-4 text-indigo-600" />;
      default:
        return <Wrench className="w-4 h-4 text-neutral-500" />;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Activity Audit Trail</h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Immutable event log of agent reasoning, tool executions, verifications, and approvals.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => handleExport('csv')}
            disabled={Boolean(exportingFormat)}
            data-explain="export-activity-csv"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-750 transition-colors shadow-2xs disabled:opacity-50"
            title="Download activity log as CSV spreadsheet"
          >
            {exportingFormat === 'csv' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
            ) : (
              <Download className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => handleExport('json')}
            disabled={Boolean(exportingFormat)}
            data-explain="export-activity-json"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-md hover:bg-neutral-50 dark:hover:bg-neutral-750 transition-colors shadow-2xs disabled:opacity-50"
            title="Download activity log as structured JSON"
          >
            {exportingFormat === 'json' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
            ) : (
              <Download className="w-3.5 h-3.5 text-neutral-500" />
            )}
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Export Feedback Banner */}
      {exportSuccess && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-md text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{exportSuccess}</span>
        </div>
      )}
      {exportError && (
        <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-md text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{exportError}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-x-auto w-fit">
        {[
          { id: 'all', label: 'All Events' },
          { id: 'verification', label: 'Verifications' },
          { id: 'tool_execution', label: 'Tool Calls' },
          { id: 'approval_granted', label: 'Approvals' },
          { id: 'failure', label: 'Failures & Retries' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              filterType === tab.id
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Event List */}
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-800">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-neutral-400 text-xs">
            No events found for this filter.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="p-4 flex items-start gap-3.5 text-xs">
              <div className="p-1.5 rounded-md bg-neutral-100 dark:bg-neutral-800 shrink-0 mt-0.5">
                {getLogIcon(log.type, log.status)}
              </div>

              <div className="flex-1 space-y-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="font-semibold text-neutral-900 dark:text-white">
                    {log.summary}
                  </span>
                  <span className="font-mono text-neutral-400 text-[11px] tabular-nums shrink-0">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>

                {log.workflowId && (
                  <div className="text-[11px] font-mono text-neutral-400">
                    Workflow: {log.workflowId} {log.stepId ? `· Step: ${log.stepId}` : ''}
                  </div>
                )}

                {log.details && Object.keys(log.details).length > 0 && (
                  <pre className="p-2 bg-neutral-50 dark:bg-neutral-850 rounded text-[11px] font-mono text-neutral-600 dark:text-neutral-300 overflow-x-auto max-h-28 border border-neutral-200/50 dark:border-neutral-800">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
