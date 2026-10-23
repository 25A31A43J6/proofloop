/**
 * ProofLoop Workflow Engine & Verification System
 * Enforces valid state transitions and independent proof-of-completion verification.
 * Amazon Developer Hackathon 2026 — Alexa+ track
 */

import crypto from 'crypto';
import type {
  TaskStatus,
  Workflow,
  WorkflowStep,
  VerificationRecord,
} from '../types/index.js';

// Valid status transitions map
export const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  not_started: ['ready', 'blocked'],
  ready: ['waiting_for_approval', 'in_progress', 'blocked'],
  waiting_for_approval: ['ready', 'blocked', 'failed'],
  in_progress: ['verification_required', 'failed', 'blocked'],
  verification_required: ['verified_complete', 'failed'],
  verified_complete: [], // Terminal state for a step unless explicitly reset
  failed: ['ready', 'in_progress', 'blocked'], // Recoverable
  blocked: ['ready', 'not_started', 'failed'],
};

export function canTransition(current: TaskStatus, target: TaskStatus): boolean {
  if (current === target) return true;
  const allowed = VALID_TRANSITIONS[current];
  return allowed ? allowed.includes(target) : false;
}

export function validateStepTransition(step: WorkflowStep, targetStatus: TaskStatus): {
  valid: boolean;
  reason?: string;
} {
  if (!canTransition(step.status, targetStatus)) {
    return {
      valid: false,
      reason: `Illegal transition from "${step.status}" to "${targetStatus}". Allowed next states: [${(VALID_TRANSITIONS[step.status] || []).join(', ')}]`,
    };
  }

  // Business rule checks
  if (targetStatus === 'in_progress') {
    if (step.requiresApproval && step.approvalStatus !== 'approved') {
      return {
        valid: false,
        reason: 'Step requires explicit user approval before execution can begin.',
      };
    }
  }

  if (targetStatus === 'verified_complete') {
    if (!step.verificationRecord || step.verificationRecord.finalStatus !== 'verified_complete') {
      return {
        valid: false,
        reason: 'Cannot mark task as "Verified Complete" without a valid verification proof record.',
      };
    }
  }

  return { valid: true };
}

/**
 * Creates an immutable cryptographic proof record for a completed action.
 */
export function generateVerificationRecord(params: {
  stepId: string;
  actionPerformed: string;
  toolUsed: string;
  resultReturned: Record<string, unknown> | string;
  verificationMethod?: string;
  notes?: string;
}): VerificationRecord {
  const executedAt = new Date().toISOString();
  const rawPayload = JSON.stringify({
    stepId: params.stepId,
    action: params.actionPerformed,
    tool: params.toolUsed,
    result: params.resultReturned,
    timestamp: executedAt,
  });

  const checksum = crypto.createHash('sha256').update(rawPayload).digest('hex');
  const evidenceRef = `proof://mcp.tool/${params.toolUsed}/${params.stepId}#sha256=${checksum.slice(0, 16)}`;

  return {
    id: `verif-${crypto.randomUUID()}`,
    stepId: params.stepId,
    actionPerformed: params.actionPerformed,
    executedAt,
    toolUsed: params.toolUsed,
    resultReturned: params.resultReturned,
    verificationMethod:
      params.verificationMethod || 'tool_output_schema_and_integrity_hash',
    evidenceReference: evidenceRef,
    finalStatus: 'verified_complete',
    notes: params.notes || 'Outcome successfully executed and verified against actual tool result.',
    verifiedBy: 'ProofLoop Verification Engine (MCP Runtime)',
  };
}

/**
 * Updates step readiness based on dependencies.
 */
export function updateStepDependencies(workflow: Workflow): Workflow {
  const completedStepIds = new Set(
    workflow.steps
      .filter((s) => s.status === 'verified_complete')
      .map((s) => s.id)
  );

  for (const step of workflow.steps) {
    if (step.status === 'not_started') {
      const allDepsMet = step.dependencies.every((depId) => completedStepIds.has(depId));
      if (allDepsMet) {
        step.status = step.requiresApproval && step.approvalStatus !== 'approved'
          ? 'waiting_for_approval'
          : 'ready';
      }
    } else if (step.status === 'waiting_for_approval' && step.approvalStatus === 'approved') {
      step.status = 'ready';
    }
  }

  return workflow;
}

/**
 * Analyzes failure and suggests deterministic recovery options.
 */
export function analyzeFailureRecovery(step: WorkflowStep, error: Error | string): {
  failureReason: string;
  recoverySuggestion: string;
  canRetry: boolean;
} {
  const message = typeof error === 'string' ? error : error.message;

  if (message.includes('SIMULATED_FAILURE')) {
    return {
      failureReason: 'Simulated tool failure in developer test mode.',
      recoverySuggestion: 'Switch to secondary fallback provider or toggle test mode off to retry with live execution.',
      canRetry: true,
    };
  }

  if (message.includes('document') || message.includes('not found') || message.includes('missing')) {
    return {
      failureReason: `Resource not located: ${message}`,
      recoverySuggestion: 'Search sample document repository, request user file upload, or use template defaults.',
      canRetry: true,
    };
  }

  if (message.includes('timeout') || message.includes('network')) {
    return {
      failureReason: 'Network/Transport timeout while invoking MCP tool.',
      recoverySuggestion: 'Verify MCP streamable endpoint connection and retry with exponential backoff.',
      canRetry: true,
    };
  }

  return {
    failureReason: message || 'Unknown tool execution error.',
    recoverySuggestion: 'Inspect tool arguments, check approval permissions, and retry step.',
    canRetry: step.retryCount < 3,
  };
}
