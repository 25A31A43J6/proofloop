/**
 * ProofLoop Sidebar Navigation
 * Anti-slop: clean typography, unboxed counters, WCAG AA compliant.
 * Amazon Developer Hackathon 2026 — Alexa+ track
 */

import React from 'react';
import {
  LayoutDashboard,
  Bot,
  GitFork,
  CheckSquare,
  ShieldAlert,
  Brain,
  History,
  Terminal,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  pendingApprovalsCount: number;
  activeWorkflowsCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  pendingApprovalsCount,
  activeWorkflowsCount,
}) => {
  const navItems = [
    { id: 'home', label: 'Home', icon: LayoutDashboard },
    { id: 'workspace', label: 'Agent Workspace', icon: Bot },
    {
      id: 'workflows',
      label: 'My Workflows',
      icon: GitFork,
      count: activeWorkflowsCount > 0 ? activeWorkflowsCount : undefined,
    },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    {
      id: 'approvals',
      label: 'Approvals',
      icon: ShieldAlert,
      count: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
      alert: pendingApprovalsCount > 0,
    },
    { id: 'memory', label: 'Memory', icon: Brain },
    { id: 'activity', label: 'Activity Log', icon: History },
    { id: 'mcp', label: 'MCP Tools', icon: Terminal },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside
      className={`border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/70 flex flex-col justify-between transition-all duration-200 shrink-0 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="p-3">
        {/* Navigation list */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                data-explain={`nav-${item.id}`}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-md transition-colors text-left ${
                  isActive
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 hover:text-neutral-900 dark:hover:text-white'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!isCollapsed && (
                  <span className="truncate flex-1">{item.label}</span>
                )}
                {!isCollapsed && item.count !== undefined && (
                  <span
                    className={`text-xs font-mono tabular-nums px-1.5 py-0.2 rounded ${
                      item.alert
                        ? 'bg-amber-500 text-white font-bold'
                        : isActive
                        ? 'bg-neutral-700 dark:bg-neutral-200 text-white dark:text-neutral-900'
                        : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info & Collapse Toggle */}
      <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
        {!isCollapsed && (
          <div className="px-3 py-2 rounded-md bg-neutral-100 dark:bg-neutral-800/50 text-xs text-neutral-500 dark:text-neutral-400">
            <div className="flex items-center gap-1.5 font-medium text-neutral-700 dark:text-neutral-300">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>ProofLoop Engine</span>
            </div>
            <p className="mt-1 leading-relaxed text-[11px]">
              Every outcome independently verified before marking complete.
            </p>
          </div>
        )}

        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center p-2 text-xs font-medium text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white rounded-md hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 transition-colors"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <div className="flex items-center gap-2">
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse Sidebar</span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
};
