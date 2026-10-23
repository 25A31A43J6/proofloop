/**
 * ProofLoop Memory Center View
 * Persistent memory management: user preferences, deadlines, history, and strategies.
 * Amazon Developer Hackathon 2026 — Alexa+ track
 */

import React, { useState, useMemo } from 'react';
import {
  Brain,
  Plus,
  Trash2,
  Edit2,
  Search,
  CheckCircle2,
  Bookmark,
  Calendar,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';
import type { MemoryRecord, MemoryCategory } from '../types/index.js';

interface MemoryViewProps {
  memories: MemoryRecord[];
  onAddMemory: (payload: {
    category: MemoryCategory;
    content: string;
    source?: string;
  }) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
  onUpdateMemory: (id: string, content: string) => Promise<void>;
}

export const MemoryView: React.FC<MemoryViewProps> = ({
  memories,
  onAddMemory,
  onDeleteMemory,
  onUpdateMemory,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // Form states
  const [formCategory, setFormCategory] = useState<MemoryCategory>('user_preferences');
  const [formContent, setFormContent] = useState('');
  const [formSource, setFormSource] = useState('User Manual Entry');

  const categories: { id: string; label: string; icon: any }[] = [
    { id: 'all', label: 'All Categories', icon: Brain },
    { id: 'user_preferences', label: 'User Preferences', icon: Bookmark },
    { id: 'deadlines', label: 'Deadlines', icon: Calendar },
    { id: 'successful_strategies', label: 'Successful Strategies', icon: Lightbulb },
    { id: 'ongoing_goals', label: 'Ongoing Goals', icon: CheckCircle2 },
    { id: 'previous_failures', label: 'Previous Failures', icon: AlertCircle },
    { id: 'workflow_history', label: 'Workflow History', icon: Brain },
    { id: 'pending_actions', label: 'Pending Actions', icon: CheckCircle2 },
  ];

  const filteredMemories = useMemo(() => {
    return memories.filter((m) => {
      if (selectedCategory !== 'all' && m.category !== selectedCategory) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return m.content.toLowerCase().includes(q) || m.source.toLowerCase().includes(q);
    });
  }, [memories, selectedCategory, searchQuery]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formContent.trim()) return;
    await onAddMemory({
      category: formCategory,
      content: formContent.trim(),
      source: formSource.trim() || 'User Profile',
    });
    setFormContent('');
    setShowAddModal(false);
  };

  const handleStartEdit = (m: MemoryRecord) => {
    setEditingId(m.id);
    setEditingContent(m.content);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingContent.trim()) return;
    await onUpdateMemory(id, editingContent.trim());
    setEditingId(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
            Persistent Memory Center
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Retained facts, preferences, and verified strategies preserved across sessions and restarts.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          data-explain="add-memory"
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors shadow-xs shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Memory</span>
        </button>
      </div>

      {/* Filter Chips & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-x-auto">
          {categories.slice(0, 5).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-explain="search-memory"
            placeholder="Search memories..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Memory Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredMemories.length === 0 ? (
          <div className="col-span-2 p-12 text-center border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50/50 dark:bg-neutral-800/20 text-xs text-neutral-400">
            No memories found matching the filter.
          </div>
        ) : (
          filteredMemories.map((mem) => {
            const isEditing = editingId === mem.id;

            return (
              <div
                key={mem.id}
                className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col justify-between gap-3 shadow-xs"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-neutral-400">
                    <span className="font-mono uppercase text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                      {mem.category.replace('_', ' ')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleStartEdit(mem)}
                        className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                        title="Edit Memory"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteMemory(mem.id)}
                        className="p-1 text-neutral-400 hover:text-rose-600 transition-colors"
                        title="Delete Memory"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        rows={3}
                        className="w-full p-2 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2.5 py-1 text-xs text-neutral-600 hover:bg-neutral-100 rounded"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(mem.id)}
                          className="px-3 py-1 text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded font-medium"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed font-medium">
                      {mem.content}
                    </p>
                  )}
                </div>

                {/* Metadata */}
                <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <span className="truncate max-w-[200px]">Source: {mem.source}</span>
                  <span className="font-mono tabular-nums">
                    {new Date(mem.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Memory Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-neutral-900 dark:text-white">
              Add User-Approved Memory
            </h3>
            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as MemoryCategory)}
                  className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                >
                  <option value="user_preferences">User Preferences</option>
                  <option value="deadlines">Deadlines</option>
                  <option value="successful_strategies">Successful Strategies</option>
                  <option value="ongoing_goals">Ongoing Goals</option>
                  <option value="previous_failures">Previous Failures</option>
                  <option value="workflow_history">Workflow History</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Memory Fact / Preference
                </label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="e.g. Preferred format for reports is 3 key bullet points."
                  rows={3}
                  className="w-full p-2.5 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  Source Reference
                </label>
                <input
                  type="text"
                  value={formSource}
                  onChange={(e) => setFormSource(e.target.value)}
                  className="w-full p-2 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formContent.trim()}
                  className="px-4 py-1.5 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md"
                >
                  Persist Memory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
