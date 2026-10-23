/**
 * ProofLoop Client API Service
 * Strongly typed HTTP client for backend REST endpoints.
 */

import type {
  Workflow,
  WorkflowStep,
  ApprovalRecord,
  MemoryRecord,
  Reminder,
  VerificationRecord,
  ActivityLogEntry,
  MemoryCategory,
  InternshipApplicationData,
} from '../types/index.js';

export async function fetchHealth(): Promise<{ status: string; mcpConnected: boolean }> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function fetchWorkflows(): Promise<Workflow[]> {
  const res = await fetch('/api/workflows');
  if (!res.ok) throw new Error('Failed to fetch workflows');
  const data = await res.json();
  return data.workflows;
}

export async function fetchWorkflow(id: string): Promise<{ workflow: Workflow; verifications: VerificationRecord[] }> {
  const res = await fetch(`/api/workflows/${id}`);
  if (!res.ok) throw new Error('Failed to fetch workflow');
  return res.json();
}

export async function planWorkflowFromGoal(goal: string, category?: string, deadline?: string): Promise<any> {
  const res = await fetch('/api/workflows/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, category, deadline }),
  });
  if (!res.ok) throw new Error('Failed to plan workflow');
  const data = await res.json();
  return data.plan;
}

export async function createWorkflow(goal: string, category?: string, deadline?: string): Promise<Workflow> {
  const res = await fetch('/api/workflows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ goal, category, deadline }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create workflow');
  }
  const data = await res.json();
  return data.workflow;
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  const res = await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
  const data = await res.json();
  return data.success;
}

export async function executeStep(
  workflowId: string,
  stepId: string,
  simulateFailure = false
): Promise<{ success: boolean; step: WorkflowStep; verification?: VerificationRecord; error?: string; recoverySuggestion?: string }> {
  const res = await fetch(`/api/workflows/${workflowId}/execute-step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stepId, simulateFailure }),
  });
  return res.json();
}

export async function recoverStep(
  workflowId: string,
  stepId: string
): Promise<{ success: boolean; step: WorkflowStep; message: string }> {
  const res = await fetch(`/api/workflows/${workflowId}/recover-step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stepId }),
  });
  return res.json();
}

export async function runAllSteps(workflowId: string): Promise<{ workflow: Workflow; stepResults: any[] }> {
  const res = await fetch(`/api/workflows/${workflowId}/run-all`, {
    method: 'POST',
  });
  return res.json();
}

// Approvals
export async function fetchApprovals(status?: 'pending' | 'approved' | 'rejected'): Promise<ApprovalRecord[]> {
  const url = status ? `/api/approvals?status=${status}` : '/api/approvals';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch approvals');
  const data = await res.json();
  return data.approvals;
}

export async function decideApproval(id: string, status: 'approved' | 'rejected', decidedBy = 'Current User'): Promise<ApprovalRecord> {
  const res = await fetch(`/api/approvals/${id}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, decidedBy }),
  });
  if (!res.ok) throw new Error('Failed to decide approval');
  const data = await res.json();
  return data.approval;
}

// Memories
export async function fetchMemories(category?: MemoryCategory, query?: string): Promise<MemoryRecord[]> {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  if (query) params.append('query', query);
  const res = await fetch(`/api/memories?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch memories');
  const data = await res.json();
  return data.memories;
}

export async function createMemory(payload: {
  category: MemoryCategory;
  content: string;
  source?: string;
  userApproved?: boolean;
}): Promise<MemoryRecord> {
  const res = await fetch('/api/memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create memory');
  const data = await res.json();
  return data.memory;
}

export async function deleteMemory(id: string): Promise<boolean> {
  const res = await fetch(`/api/memories/${id}`, { method: 'DELETE' });
  const data = await res.json();
  return data.success;
}

export async function updateMemory(id: string, updates: Partial<MemoryRecord>): Promise<MemoryRecord> {
  const res = await fetch(`/api/memories/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  const data = await res.json();
  return data.memory;
}

// Reminders
export async function fetchReminders(): Promise<Reminder[]> {
  const res = await fetch('/api/reminders');
  if (!res.ok) throw new Error('Failed to fetch reminders');
  const data = await res.json();
  return data.reminders;
}

export async function createReminder(payload: {
  title: string;
  targetTime: string;
  associatedWorkflowId?: string;
  notes?: string;
}): Promise<Reminder> {
  const res = await fetch('/api/reminders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to create reminder');
  const data = await res.json();
  return data.reminder;
}

export async function deleteReminder(id: string): Promise<boolean> {
  const res = await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
  const data = await res.json();
  return data.success;
}

// Activity logs
export async function fetchActivityLogs(workflowId?: string, limit = 100): Promise<ActivityLogEntry[]> {
  const url = workflowId ? `/api/activity-logs?workflowId=${workflowId}&limit=${limit}` : `/api/activity-logs?limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch activity logs');
  const data = await res.json();
  return data.logs;
}

// Demo & Test Mode
export async function runDemoScenario(simulateRecoverableFailure = false): Promise<any> {
  const res = await fetch('/api/demo/run-scenario', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ simulateRecoverableFailure }),
  });
  if (!res.ok) throw new Error('Failed to run demo scenario');
  return res.json();
}

export async function toggleSimulatedFailure(enabled?: boolean): Promise<boolean> {
  const res = await fetch('/api/demo/simulate-failure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  const data = await res.json();
  return data.isTestModeSimulateFailure;
}

export async function fetchSimulatedFailureState(): Promise<boolean> {
  const res = await fetch('/api/demo/simulate-failure');
  const data = await res.json();
  return data.isTestModeSimulateFailure;
}

// Applications & Email
export async function fetchApplications(): Promise<InternshipApplicationData[]> {
  const res = await fetch('/api/applications');
  if (!res.ok) throw new Error('Failed to fetch applications');
  const data = await res.json();
  return data.applications;
}

export async function fetchApplication(id: string): Promise<InternshipApplicationData> {
  const res = await fetch(`/api/applications/${id}`);
  if (!res.ok) throw new Error('Failed to fetch application');
  const data = await res.json();
  return data.application;
}

export async function fetchApplicationByWorkflow(workflowId: string): Promise<InternshipApplicationData | null> {
  const res = await fetch(`/api/applications/workflow/${workflowId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to fetch application for workflow');
  const data = await res.json();
  return data.application;
}

export async function updateApplication(
  id: string,
  updates: Partial<InternshipApplicationData>
): Promise<InternshipApplicationData> {
  const res = await fetch(`/api/applications/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update application');
  const data = await res.json();
  return data.application;
}

export async function approveAndSendApplication(
  id: string,
  approvedHash: string,
  idempotencyKey?: string
): Promise<{
  success: boolean;
  application: InternshipApplicationData;
  workflow?: Workflow;
  status: 'SENT' | 'SEND_FAILED' | 'NOT_CONFIGURED';
  messageId?: string;
  providerResponse?: any;
  error?: string;
  configurationHelp?: string;
}> {
  const res = await fetch(`/api/applications/${id}/approve-and-send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approvedHash, idempotencyKey }),
  });
  return res.json();
}

export async function autoPrepareWorkflow(workflowId: string): Promise<{ workflow: Workflow; application?: InternshipApplicationData }> {
  const res = await fetch(`/api/workflows/${workflowId}/auto-prepare`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to auto-prepare workflow');
  return res.json();
}

export async function fetchEmailProviderStatus(): Promise<{
  configured: boolean;
  provider: 'SMTP' | 'NONE';
  missingEnv: string[];
}> {
  const res = await fetch('/api/email/status');
  if (!res.ok) throw new Error('Failed to check email provider status');
  return res.json();
}

// ==========================================
// FILE DOWNLOAD & EXPORT CLIENT HELPERS
// ==========================================

export interface DownloadableDocumentMeta {
  id: string;
  title: string;
  category: string;
  source: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  lastUpdated: string;
}

export function extractFilenameFromHeader(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const match = header.match(/filename="?([^";]+)"?/i);
  return match && match[1] ? match[1].trim() : fallback;
}

export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) {
      a.parentNode.removeChild(a);
    }
    URL.revokeObjectURL(url);
  }, 200);
}

export async function fetchDocuments(): Promise<DownloadableDocumentMeta[]> {
  const res = await fetch('/api/documents');
  if (!res.ok) throw new Error('Failed to fetch document library');
  const data = await res.json();
  return data.documents;
}

export async function downloadDocument(id: string, format?: 'original' | 'pdf', fallbackFilename?: string): Promise<string> {
  const url = `/api/documents/${encodeURIComponent(id)}/download${format === 'pdf' ? '?format=pdf' : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to download document ${id}`);
  }
  const filename = extractFilenameFromHeader(
    res.headers.get('Content-Disposition'),
    fallbackFilename || `${id}.${format === 'pdf' ? 'pdf' : 'txt'}`
  );
  const blob = await res.blob();
  triggerBrowserDownload(blob, filename);
  return filename;
}

export async function downloadVerificationCertificate(
  id: string,
  format: 'json' | 'txt' | 'pdf' = 'json'
): Promise<string> {
  const url = `/api/verifications/${encodeURIComponent(id)}/download?format=${format}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to download verification certificate ${id}`);
  }
  const filename = extractFilenameFromHeader(
    res.headers.get('Content-Disposition'),
    `proofloop-verification-${id}.${format}`
  );
  const blob = await res.blob();
  triggerBrowserDownload(blob, filename);
  return filename;
}

export async function downloadApplicationFile(
  applicationId: string,
  fileType: string,
  format?: 'original' | 'pdf' | 'txt',
  fallbackFilename?: string
): Promise<string> {
  const url = `/api/applications/${encodeURIComponent(applicationId)}/download/${encodeURIComponent(fileType)}${
    format ? `?format=${format}` : ''
  }`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to download file "${fileType}"`);
  }
  const filename = extractFilenameFromHeader(
    res.headers.get('Content-Disposition'),
    fallbackFilename || `${fileType}.${format === 'pdf' ? 'pdf' : 'txt'}`
  );
  const blob = await res.blob();
  triggerBrowserDownload(blob, filename);
  return filename;
}

export async function downloadWorkflowReport(
  workflowId: string,
  format: 'markdown' | 'json' | 'pdf' = 'markdown'
): Promise<string> {
  const url = `/api/workflows/${encodeURIComponent(workflowId)}/download-report?format=${format}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to download report for workflow ${workflowId}`);
  }
  const ext = format === 'markdown' ? 'md' : format;
  const filename = extractFilenameFromHeader(
    res.headers.get('Content-Disposition'),
    `proofloop-workflow-${workflowId}-report.${ext}`
  );
  const blob = await res.blob();
  triggerBrowserDownload(blob, filename);
  return filename;
}

export async function exportActivityLogs(
  format: 'csv' | 'json' = 'csv',
  workflowId?: string
): Promise<string> {
  const params = new URLSearchParams({ format });
  if (workflowId) params.append('workflowId', workflowId);
  const url = `/api/activity-logs/export?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to export activity logs');
  }
  const filename = extractFilenameFromHeader(
    res.headers.get('Content-Disposition'),
    `proofloop-activity-audit-${new Date().toISOString().slice(0, 10)}.${format}`
  );
  const blob = await res.blob();
  triggerBrowserDownload(blob, filename);
  return filename;
}


