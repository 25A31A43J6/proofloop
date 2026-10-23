/**
 * ProofLoop Tasks Grid View
 * High-density table of all workflow tasks, valid status transitions, and verification evidence.
 */

import React, { useState, useMemo } from 'react';
import {
  CheckSquare,
  Play,
  RotateCcw,
  ShieldCheck,
  ShieldAlert,
  Clock,
  AlertTriangle,
  Lock,
  Search,
} from 'lucide-react';
import type { Workflow, WorkflowStep, VerificationRecord } from '../types/index.js';

interface TasksViewProps {
  workflows: Workflow[];
  onExecuteStep: (workflowId: string, stepId: string) => Promise<void>;
  onRecoverStep: (workflowId: string, stepId: string) => Promise<void>;
  onInspectVerification: (record: VerificationRecord) => void;
  onRequestApproval: (step: WorkflowStep) => void;
  executingStepId: string | null;
}

export const TasksView: React.FC<TasksViewProps> = ({
  workflows,
  onExecuteStep,
  onRecoverStep,
  onInspectVerification,
  onRequestApproval,
  executingStepId,
}) => {
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Memoized flattening of steps across workflows
  const allTasks = useMemo(() => {
    const list: { workflow: Workflow; step: WorkflowStep }[] = [];
    workflows.forEach((wf) => {
      wf.steps.forEach((step) => {
        list.push({ workflow: wf, step });
      });
    });
    return list;
  }, [workflows]);

  // Memoized filtering of tasks
  const filteredTasks = useMemo(() => {
    return allTasks.filter(({ workflow, step }) => {
      if (filter !== 'all' && step.status !== filter) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        step.title.toLowerCase().includes(q) ||
        step.description.toLowerCase().includes(q) ||
        workflow.goal.toLowerCase().includes(q)
      );
    });
  }, [allTasks, filter, searchQuery]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified_complete':
        return (
          <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-xs flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verified Complete</span>
          </span>
        );
      case 'in_progress':
        return (
          <span className="text-blue-700 dark:text-blue-400 font-semibold text-xs flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 animate-spin" />
            <span>In Progress</span>
          </span>
        );
      case 'waiting_for_approval':
        return (
          <span className="text-amber-700 dark:text-amber-400 font-semibold text-xs flex items-center gap-1">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Approval Required</span>
          </span>
        );
      case 'failed':
        return (
          <span className="text-rose-700 dark:text-rose-400 font-semibold text-xs flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Failed</span>
          </span>
        );
      case 'ready':
        return (
          <span className="text-indigo-700 dark:text-indigo-400 font-medium text-xs flex items-center gap-1">
            <Play className="w-3 h-3 fill-current" />
            <span>Ready</span>
          </span>
        );
      case 'blocked':
        return (
          <span className="text-neutral-500 text-xs flex items-center gap-1">
            <Lock className="w-3 h-3" />
            <span>Blocked</span>
          </span>
        );
      default:
        return <span className="text-neutral-400 text-xs">Not Started</span>;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-white">Task Registry</h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Atomic execution steps with verified outcomes and dependency tracking
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-x-auto">
          {[
            { id: 'all', label: 'All' },
            { id: 'ready', label: 'Ready' },
            { id: 'waiting_for_approval', label: 'Needs Approval' },
            { id: 'verified_complete', label: 'Verified Complete' },
            { id: 'failed', label: 'Failed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                filter === tab.id
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* High Density Table */}
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-900">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500 dark:text-neutral-400 font-semibold">
              <th className="py-2.5 px-4 w-12 text-center">#</th>
              <th className="py-2.5 px-4">Task Title & Context</th>
              <th className="py-2.5 px-4 hidden md:table-cell">Tool / Action</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-neutral-400 text-xs">
                  No tasks matching the selected filter.
                </td>
              </tr>
            ) : (
              filteredTasks.map(({ workflow, step }) => {
                const isExecuting = executingStepId === step.id;

                return (
                  <tr
                    key={step.id}
                    className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-neutral-400 text-center tabular-nums">
                      {step.order}
                    </td>

                    <td className="py-3 px-4 space-y-0.5">
                      <div className="font-medium text-neutral-900 dark:text-white">
                        {step.title}
                      </div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-1">
                        Workflow: {workflow.goal}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-neutral-600 dark:text-neutral-300 hidden md:table-cell">
                      {step.toolRequired || step.actionType}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      {getStatusBadge(step.status)}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {step.status === 'verified_complete' && step.verificationRecord && (
                          <button
                            onClick={() => onInspectVerification(step.verificationRecord!)}
                            className="px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded hover:bg-emerald-100 transition-colors"
                          >
                            Inspect Proof
                          </button>
                        )}

                        {step.status === 'ready' && (
                          <button
                            onClick={() => onExecuteStep(workflow.id, step.id)}
                            disabled={isExecuting}
                            className="px-2.5 py-1 text-[11px] font-medium text-white bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-800 rounded transition-colors"
                          >
                            {isExecuting ? 'Running...' : 'Run'}
                          </button>
                        )}

                        {step.status === 'waiting_for_approval' && (
                          <button
                            onClick={() => onRequestApproval(step)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded transition-colors"
                          >
                            Authorize
                          </button>
                        )}

                        {step.status === 'failed' && (
                          <button
                            onClick={() => onRecoverStep(workflow.id, step.id)}
                            disabled={isExecuting}
                            className="px-2.5 py-1 text-[11px] font-medium text-white bg-rose-600 hover:bg-rose-700 rounded transition-colors"
                          >
                            Recover
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
