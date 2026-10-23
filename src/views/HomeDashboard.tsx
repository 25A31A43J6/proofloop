/**
 * ProofLoop Home Dashboard
 * Core entry point with prominent goal input, metric strips, active workflows, and demo scenario launcher.
 * Amazon Developer Hackathon 2026 — Alexa+ track
 */

import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Play,
  Calendar,
  AlertTriangle,
  FileCheck,
} from 'lucide-react';
import type { Workflow, ApprovalRecord, ActivityLogEntry } from '../types/index.js';

interface HomeDashboardProps {
  workflows: Workflow[];
  approvals: ApprovalRecord[];
  activityLogs: ActivityLogEntry[];
  onSubmitGoal: (goal: string) => void;
  onOpenWorkflow: (wf: Workflow) => void;
  onRunDemo: () => void;
  isDemoRunning: boolean;
  onSelectTab: (tab: string) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  workflows,
  approvals,
  activityLogs,
  onSubmitGoal,
  onOpenWorkflow,
  onRunDemo,
  isDemoRunning,
  onSelectTab,
}) => {
  const [goalInput, setGoalInput] = useState('');

  const sampleGoals = [
    'Help me prepare my hackathon submission and make sure it is ready before the deadline.',
    'Help me prepare and submit my internship application before Friday.',
    'Prepare a project presentation, identify missing information, and create a submission checklist.',
    'Create a study plan for my upcoming examinations and track my progress.',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalInput.trim()) return;
    onSubmitGoal(goalInput.trim());
    setGoalInput('');
  };

  const pendingApprovals = approvals.filter((a) => a.status === 'pending');
  const activeWorkflows = workflows.filter((w) => w.status === 'active');
  const verifiedTasksCount = workflows.reduce(
    (acc, w) => acc + w.steps.filter((s) => s.status === 'verified_complete').length,
    0
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Hero & Tagline */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>ProofLoop Execution Agent</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-neutral-900 dark:text-white">
          Don't just make a plan. Get it done.
        </h1>
        <p className="text-sm md:text-base text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed">
          ProofLoop turns ambitious goals into verified outcomes. It decomposes requirements into structured workflows, executes permitted tools, checks real evidence, and remembers progress.
        </p>
      </div>

      {/* Prominent Goal Input */}
      <div className="p-5 md:p-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor="goal-input" className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
            What goal do you want to accomplish and verify?
          </label>
          <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
            <input
              id="goal-input"
              type="text"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              placeholder="e.g. Help me prepare my hackathon submission and make sure it is ready before the deadline."
              className="flex-1 px-4 py-3 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              data-explain="create-workflow"
              title="Create Workflow: Enter a goal and click to decompose into verifiable tasks"
              className={`px-5 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center justify-center gap-2 shrink-0 shadow-sm ${
                !goalInput.trim() ? 'opacity-85 hover:opacity-100 cursor-pointer' : ''
              }`}
            >
              <span>Follow Through</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>

        {/* Quick Sample Goal Buttons */}
        <div className="space-y-1.5">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Quick start templates:</span>
          <div className="flex flex-wrap gap-2">
            {sampleGoals.map((sample, idx) => (
              <button
                key={idx}
                onClick={() => setGoalInput(sample)}
                className="text-left text-xs text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 px-3 py-1.5 rounded-md transition-colors"
              >
                {sample}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* High-Density Metric Strip (Zero-Pill, Tabular Figures) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          data-explain="nav-workflows"
          onClick={() => onSelectTab('workflows')}
          className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 cursor-pointer hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
          title="Click to view all workflows"
        >
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Active Workflows</div>
          <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white tabular-nums mt-1">
            {activeWorkflows.length}
          </div>
          <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            {workflows.length} total created
          </div>
        </div>

        <div
          data-explain="proof-verified"
          className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 cursor-pointer hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
          title="Click to explain Proof Verified"
        >
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Verified Completions</div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
            {verifiedTasksCount}
          </div>
          <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            With cryptographic proof
          </div>
        </div>

        <div
          data-explain="nav-approvals"
          onClick={() => onSelectTab('approvals')}
          className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 cursor-pointer hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors"
          title="Click to view pending approvals"
        >
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Pending Approvals</div>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 tabular-nums mt-1">
            {pendingApprovals.length}
          </div>
          <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            Consequential actions
          </div>
        </div>

        <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Upcoming Deadline</div>
          <div className="text-sm font-semibold font-mono text-neutral-900 dark:text-white tabular-nums mt-2">
            Oct 24, 2026
          </div>
          <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            Amazon Hackathon (Alexa+)
          </div>
        </div>
      </div>

      {/* Featured End-to-End Demo Scenario Card */}
      <div className="p-5 md:p-6 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
            <FileCheck className="w-4 h-4" />
            <span>Featured Demonstration Scenario</span>
          </div>
          <h2 className="text-base font-bold text-neutral-900 dark:text-white">
            Amazon Developer Hackathon 2026 Submission Readiness
          </h2>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-xl leading-relaxed">
            Decomposes official Alexa+ requirements, searches sample architecture docs, drafts submission email, halts for human approval, and generates verifiable proof records.
          </p>
        </div>
        <button
          onClick={onRunDemo}
          disabled={isDemoRunning}
          data-explain="run-demo"
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg transition-colors shrink-0 shadow-sm"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>{isDemoRunning ? 'Executing Demo Workflow...' : 'Run Hackathon Demo'}</span>
        </button>
      </div>

      {/* Active Workflows Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-white">Active Workflows</h2>
          <button
            onClick={() => onSelectTab('workflows')}
            className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-medium"
          >
            View all ({workflows.length})
          </button>
        </div>

        {activeWorkflows.length === 0 ? (
          <div className="p-8 text-center border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50/50 dark:bg-neutral-800/20 text-xs text-neutral-500 dark:text-neutral-400">
            No active workflows right now. Enter a goal above or run the Hackathon Demo!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeWorkflows.slice(0, 4).map((wf) => (
              <div
                key={wf.id}
                onClick={() => onOpenWorkflow(wf)}
                className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-400 dark:hover:border-neutral-600 transition-colors cursor-pointer space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white line-clamp-1">
                    {wf.goal}
                  </h3>
                  <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {wf.progress}%
                  </span>
                </div>

                <div className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600"
                    style={{ width: `${wf.progress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                  <div className="flex items-center gap-2">
                    <span className="capitalize">{wf.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{wf.steps.length} Steps</span>
                  </div>
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">Inspect &rarr;</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity Log Snippet */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-white">Recent Follow-Through Activity</h2>
          <button
            onClick={() => onSelectTab('activity')}
            className="text-xs text-neutral-500 dark:text-neutral-400 hover:underline"
          >
            Audit Log &rarr;
          </button>
        </div>

        <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-800">
          {activityLogs.slice(0, 5).map((log) => (
            <div key={log.id} className="p-3.5 flex items-center justify-between text-xs gap-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-neutral-400 dark:text-neutral-500 tabular-nums text-[11px]">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-neutral-800 dark:text-neutral-200 font-medium">
                  {log.summary}
                </span>
              </div>
              <span className="font-mono text-[11px] text-neutral-400 dark:text-neutral-500 uppercase">
                {log.type.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
