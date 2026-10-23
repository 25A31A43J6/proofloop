/**
 * ProofLoop Domain Types & Interfaces
 * Amazon Developer Hackathon 2026 — Alexa+ track
 */

export type TaskStatus =
  | 'not_started'
  | 'ready'
  | 'waiting_for_approval'
  | 'in_progress'
  | 'blocked'
  | 'failed'
  | 'verification_required'
  | 'verified_complete';

export type ApprovalStatus = 'not_required' | 'pending' | 'approved' | 'rejected';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface VerificationRecord {
  id: string;
  stepId: string;
  actionPerformed: string;
  executedAt: string;
  toolUsed: string;
  resultReturned: Record<string, unknown> | string;
  verificationMethod: string;
  evidenceReference: string;
  finalStatus: 'verified_complete' | 'failed';
  notes?: string;
  verifiedBy?: string;
}

export interface WorkflowStep {
  id: string;
  workflowId: string;
  order: number;
  title: string;
  description: string;
  status: TaskStatus;
  requiresApproval: boolean;
  approvalStatus: ApprovalStatus;
  actionType: string;
  toolRequired?: string;
  toolArgs?: Record<string, unknown>;
  dependencies: string[];
  verificationRecord?: VerificationRecord;
  failureReason?: string;
  recoverySuggestion?: string;
  retryCount: number;
  isSimulatedFailure?: boolean;
  completedAt?: string;
}

export interface Workflow {
  id: string;
  goal: string;
  category: string;
  deadline?: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'completed' | 'paused' | 'failed';
  steps: WorkflowStep[];
  progress: number; // 0 to 100
  summary?: string;
}

export type MemoryCategory =
  | 'user_preferences'
  | 'ongoing_goals'
  | 'workflow_history'
  | 'deadlines'
  | 'previous_failures'
  | 'successful_strategies'
  | 'pending_actions';

export interface MemoryRecord {
  id: string;
  category: MemoryCategory;
  content: string;
  source: string;
  confidence: number;
  userApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRecord {
  id: string;
  workflowId: string;
  stepId: string;
  actionType: string;
  actionDescription: string;
  riskLevel: RiskLevel;
  consequences: string;
  previewData: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

export interface Reminder {
  id: string;
  title: string;
  targetTime: string;
  associatedWorkflowId?: string;
  status: 'pending' | 'triggered' | 'dismissed';
  scheduledInBackend: boolean;
  createdAt: string;
  notes?: string;
}

export type ActivityType =
  | 'tool_execution'
  | 'verification'
  | 'approval_request'
  | 'approval_granted'
  | 'approval_rejected'
  | 'status_change'
  | 'failure'
  | 'recovery'
  | 'memory_update'
  | 'reminder_created';

export interface ActivityLogEntry {
  id: string;
  workflowId?: string;
  stepId?: string;
  type: ActivityType;
  timestamp: string;
  summary: string;
  details: Record<string, unknown>;
  status: 'success' | 'failure' | 'warning' | 'info';
}

export interface MCPToolParameterSchema {
  type: string;
  properties?: Record<string, { type: string; description?: string; enum?: string[] }>;
  required?: string[];
  description?: string;
}

export interface MCPToolInfo {
  name: string;
  description: string;
  inputSchema: MCPToolParameterSchema;
  requiresApproval?: boolean;
}

export type ApplicationStatus =
  | 'DRAFT_READY'
  | 'AWAITING_APPROVAL'
  | 'SENDING'
  | 'SENT'
  | 'SEND_FAILED'
  | 'CANCELLED';

export type SendingStatus = 'NOT_SENT' | 'SENDING' | 'SENT' | 'SEND_FAILED';

export interface AttachmentItem {
  id: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  source: string;
  selected: boolean;
  contentPreview?: string;
}

export interface InternshipApplicationData {
  id: string;
  workflowId: string;
  companyName: string;
  positionTitle: string;
  jobDescriptionExcerpt?: string;
  recipientEmail: string;
  emailSubject: string;
  emailBody: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone?: string;
  applicantPortfolio?: string;
  deadline?: string;
  attachments: AttachmentItem[];
  applicationStatus: ApplicationStatus;
  sendingStatus: SendingStatus;
  validationWarnings: string[];
  approvedHash?: string;
  approvedAt?: string;
  sentAt?: string;
  providerResponse?: {
    provider: string;
    messageId?: string;
    acceptedRecipients?: string[];
    rejectedRecipients?: string[];
    raw?: string;
  };
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system' | 'tool';
  text: string;
  timestamp: string;
  workflowId?: string;
  stepId?: string;
  toolCall?: {
    name: string;
    args: Record<string, unknown>;
    result?: unknown;
  };
  verification?: VerificationRecord;
  approvalRequest?: ApprovalRecord;
  applicationReview?: InternshipApplicationData;
  suggestedActions?: string[];
}
