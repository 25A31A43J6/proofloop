/**
 * ProofLoop Workflows Management View
 * Listing, status filters, and management of user workflows.
 */

import React, { useState } from 'react';
import { GitFork, Plus, Trash2, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import type { Workflow } from '../types/index.js';

interface WorkflowsViewProps {
  workflows: Workflow[];
  onOpenWorkflow: (wf: Workflow) => void;
  onDeleteWorkflow: (id: string) => Promise<void>;
  onCreateWorkflow: (goal: string) => Promise<void>;
}

export const WorkflowsView: React.FC<WorkflowsViewProps> = ({
  workflows,
  onOpenWorkflow,
  onDeleteWorkflow,
  onCreateWorkflow,
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGoal, setNewGoal] = useState('');

  const filtered = workflows.filter((w) => {
    if (filter === 'active') return w.status === 'active';
    if (filter === 'completed') return w.status === 'completed';
    return true;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.trim()) return;
    await onCreateWorkflow(newGoal.trim());
    setNewGoal('');
    setShowCreateModal(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
            My Workflows
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Structured outcome pipelines with verified step milestones
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          data-explain="create-workflow"
          title="Create Workflow"
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors shadow-xs shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Workflow</span>
        </button>
      </div>

      {/* Interactive Filter Tabs (Functional Button Controls with Clean Styling) */}
      <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg w-fit">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            filter === 'all'
              ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
          }`}
        >
          All ({workflows.length})
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            filter === 'active'
              ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
          }`}
        >
          Active ({workflows.filter((w) => w.status === 'active').length})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            filter === 'completed'
              ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
          }`}
        >
          Completed ({workflows.filter((w) => w.status === 'completed').length})
        </button>
      </div>

      {/* Grid of Workflows */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50/50 dark:bg-neutral-800/20 space-y-3">
          <GitFork className="w-8 h-8 text-neutral-400 mx-auto" />
          <div className="text-sm font-medium text-neutral-900 dark:text-white">No workflows found</div>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto">
            Create a workflow to break down a goal into actionable, verifiable tasks.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            data-explain="create-workflow"
            className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 transition-colors"
          >
            Create First Workflow
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((wf) => {
            const verifiedCount = wf.steps.filter((s) => s.status === 'verified_complete').length;

            return (
              <div
                key={wf.id}
                className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-400 dark:hover:border-neutral-700 transition-colors flex flex-col justify-between gap-4 shadow-xs"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-mono text-xs text-neutral-400 uppercase">
                      {wf.id}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteWorkflow(wf.id);
                      }}
                      className="text-neutral-400 hover:text-rose-600 p-1 rounded transition-colors"
                      title="Delete Workflow"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-2">
                    {wf.goal}
                  </h3>

                  {/* Clean unboxed metadata */}
                  <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                    <span className="capitalize">{wf.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {verifiedCount}/{wf.steps.length} Verified
                    </span>
                    {wf.deadline && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          Due {new Date(wf.deadline).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono tabular-nums">
                      <span className="text-neutral-500">Progress</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {wf.progress}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600"
                        style={{ width: `${wf.progress}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => onOpenWorkflow(wf)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md transition-colors"
                  >
                    <span>Open Workflow</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Workflow Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              Create New Verifiable Workflow
            </h3>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  What is your goal?
                </label>
                <textarea
                  value={newGoal}
                  onChange={(e) => setNewGoal(e.target.value)}
                  placeholder="e.g. Prepare presentation, check missing requirements, and notify team..."
                  rows={3}
                  className="w-full p-2.5 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newGoal.trim()}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md"
                >
                  Create & Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
