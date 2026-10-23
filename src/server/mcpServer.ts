/**
 * ProofLoop MCP Server (Model Context Protocol)
 * Spec version: 2025-11-25 compatible
 * Amazon Developer Hackathon 2026 — Alexa+ track
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import crypto from 'crypto';
import { db } from './db.js';
import { searchDemoDocuments } from './sampleDocs.js';
import {
  canTransition,
  validateStepTransition,
  generateVerificationRecord,
  updateStepDependencies,
} from './workflowEngine.js';
import type {
  Workflow,
  WorkflowStep,
  TaskStatus,
  MemoryCategory,
  MCPToolInfo,
} from '../types/index.js';

// Configuration state for test mode
export let isTestModeSimulateFailure = false;
export function setTestModeSimulateFailure(val: boolean) {
  isTestModeSimulateFailure = val;
}

/**
 * Creates and registers all 10 required tools with the official McpServer instance.
 */
export function createProofLoopMcpServer(): McpServer {
  const server = new McpServer({
    name: 'proofloop-agent-server',
    version: '1.0.0',
  });

  // 1. create_workflow
  server.tool(
    'create_workflow',
    'Creates a structured, verifiable workflow from a user goal with milestones, dependencies, and approval flags.',
    {
      goal: z.string().describe('The user outcome or goal to achieve'),
      category: z.string().optional().describe('Category (e.g., hackathon, career, project, general)'),
      deadline: z.string().optional().describe('Target ISO deadline or date string'),
      steps: z
        .array(
          z.object({
            title: z.string(),
            description: z.string(),
            actionType: z.string(),
            requiresApproval: z.boolean().default(false),
            toolRequired: z.string().optional(),
            toolArgs: z.record(z.string(), z.unknown()).optional(),
            dependencies: z.array(z.string()).default([]),
          })
        )
        .optional()
        .describe('Optional initial steps decomposed by agent'),
    },
    async ({ goal, category = 'general', deadline, steps }) => {
      const workflowId = `wf-${crypto.randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();

      let structuredSteps: WorkflowStep[] = [];

      if (steps && steps.length > 0) {
        structuredSteps = steps.map((s, idx) => ({
          id: `step-${workflowId}-${idx + 1}`,
          workflowId,
          order: idx + 1,
          title: s.title,
          description: s.description,
          status: idx === 0 ? 'ready' : 'not_started',
          requiresApproval: s.requiresApproval,
          approvalStatus: s.requiresApproval ? 'pending' : 'not_required',
          actionType: s.actionType,
          toolRequired: s.toolRequired,
          toolArgs: s.toolArgs,
          dependencies: s.dependencies,
          retryCount: 0,
        }));
      } else {
        // Default structured template if not provided
        structuredSteps = [
          {
            id: `step-${workflowId}-1`,
            workflowId,
            order: 1,
            title: 'Analyze Goal & Constraints',
            description: `Review requirements and missing data for: ${goal}`,
            status: 'ready',
            requiresApproval: false,
            approvalStatus: 'not_required',
            actionType: 'analysis',
            toolRequired: 'search_demo_documents',
            toolArgs: { query: goal },
            dependencies: [],
            retryCount: 0,
          },
          {
            id: `step-${workflowId}-2`,
            workflowId,
            order: 2,
            title: 'Prepare Action Artifacts',
            description: 'Draft necessary documents or execution payloads',
            status: 'not_started',
            requiresApproval: false,
            approvalStatus: 'not_required',
            actionType: 'artifact_generation',
            dependencies: [`step-${workflowId}-1`],
            retryCount: 0,
          },
          {
            id: `step-${workflowId}-3`,
            workflowId,
            order: 3,
            title: 'Request Human Authorization',
            description: 'Verify draft and obtain user sign-off for consequential dispatch',
            status: 'not_started',
            requiresApproval: true,
            approvalStatus: 'pending',
            actionType: 'approval_request',
            dependencies: [`step-${workflowId}-2`],
            retryCount: 0,
          },
          {
            id: `step-${workflowId}-4`,
            workflowId,
            order: 4,
            title: 'Execute & Record Proof of Completion',
            description: 'Dispatch permitted actions and store cryptographic verification proof',
            status: 'not_started',
            requiresApproval: false,
            approvalStatus: 'not_required',
            actionType: 'verification',
            toolRequired: 'record_verification',
            dependencies: [`step-${workflowId}-3`],
            retryCount: 0,
          },
        ];
      }

      const workflow: Workflow = {
        id: workflowId,
        goal,
        category,
        deadline: deadline || undefined,
        createdAt: now,
        updatedAt: now,
        status: 'active',
        steps: structuredSteps,
        progress: 0,
      };

      db.saveWorkflow(workflow);
      db.logActivity({
        workflowId,
        type: 'tool_execution',
        summary: `Created workflow "${goal.slice(0, 40)}..." with ${structuredSteps.length} steps.`,
        details: { workflowId, stepsCount: structuredSteps.length },
        status: 'success',
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                workflowId,
                goal,
                stepsCount: structuredSteps.length,
                steps: structuredSteps.map((s) => ({
                  id: s.id,
                  order: s.order,
                  title: s.title,
                  status: s.status,
                  requiresApproval: s.requiresApproval,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 2. get_workflow
  server.tool(
    'get_workflow',
    'Retrieves full workflow details, progress metrics, step statuses, and verification records.',
    {
      workflowId: z.string().describe('The unique workflow ID'),
    },
    async ({ workflowId }) => {
      const workflow = db.getWorkflow(workflowId);
      if (!workflow) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: `Workflow with ID "${workflowId}" not found.` }),
            },
          ],
        };
      }

      const verifications = db.getVerifications(workflowId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                workflow,
                verificationsCount: verifications.length,
                verifications,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 3. update_task_status
  server.tool(
    'update_task_status',
    'Updates a task status according to strict finite state machine transition rules.',
    {
      workflowId: z.string().describe('The workflow ID containing the task'),
      stepId: z.string().describe('The specific step ID to update'),
      targetStatus: z
        .enum([
          'not_started',
          'ready',
          'waiting_for_approval',
          'in_progress',
          'blocked',
          'failed',
          'verification_required',
          'verified_complete',
        ])
        .describe('The target status to transition to'),
      notes: z.string().optional().describe('Contextual notes or transition explanation'),
    },
    async ({ workflowId, stepId, targetStatus, notes }) => {
      const wf = db.getWorkflow(workflowId);
      if (!wf) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Workflow "${workflowId}" not found.` }],
        };
      }

      const step = wf.steps.find((s) => s.id === stepId);
      if (!step) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Step "${stepId}" not found in workflow.` }],
        };
      }

      const validation = validateStepTransition(step, targetStatus as TaskStatus);
      if (!validation.valid) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: validation.reason,
                currentStatus: step.status,
                targetStatus,
              }),
            },
          ],
        };
      }

      const previousStatus = step.status;
      step.status = targetStatus as TaskStatus;
      if (notes) step.failureReason = notes;
      if (targetStatus === 'verified_complete') {
        step.completedAt = new Date().toISOString();
      }

      // Re-evaluate downstream dependencies
      updateStepDependencies(wf);
      db.saveWorkflow(wf);

      db.logActivity({
        workflowId,
        stepId,
        type: 'status_change',
        summary: `Task "${step.title}" transitioned from ${previousStatus} to ${targetStatus}`,
        details: { previousStatus, newStatus: targetStatus, notes },
        status: targetStatus === 'failed' ? 'failure' : 'info',
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                stepId,
                previousStatus,
                currentStatus: step.status,
                workflowProgress: wf.progress,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 4. save_memory
  server.tool(
    'save_memory',
    'Persists user-approved facts, deadlines, successful strategies, or preferences for long-term recall.',
    {
      category: z
        .enum([
          'user_preferences',
          'ongoing_goals',
          'workflow_history',
          'deadlines',
          'previous_failures',
          'successful_strategies',
          'pending_actions',
        ])
        .describe('Memory category'),
      content: z.string().describe('Clear, factual statement to store'),
      source: z.string().optional().describe('Origin or context of this memory'),
      userApproved: z.boolean().default(true).describe('Whether explicitly confirmed by user'),
    },
    async ({ category, content, source = 'Workflow Agent', userApproved = true }) => {
      const now = new Date().toISOString();
      const record = db.saveMemory({
        id: `mem-${crypto.randomUUID().slice(0, 8)}`,
        category: category as MemoryCategory,
        content,
        source,
        confidence: 1.0,
        userApproved,
        createdAt: now,
        updatedAt: now,
      });

      db.logActivity({
        type: 'memory_update',
        summary: `Stored persistent memory: "${content.slice(0, 40)}..."`,
        details: { category, memoryId: record.id },
        status: 'success',
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, memory: record }, null, 2),
          },
        ],
      };
    }
  );

  // 5. search_memory
  server.tool(
    'search_memory',
    'Retrieves relevant persisted memories and preferences matching a search query or category.',
    {
      query: z.string().optional().describe('Keyword or phrase to match against memories'),
      category: z
        .enum([
          'user_preferences',
          'ongoing_goals',
          'workflow_history',
          'deadlines',
          'previous_failures',
          'successful_strategies',
          'pending_actions',
        ])
        .optional()
        .describe('Optional category filter'),
    },
    async ({ query, category }) => {
      const results = db.getMemories(category as MemoryCategory | undefined, query);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                count: results.length,
                memories: results,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 6. create_reminder
  server.tool(
    'create_reminder',
    'Creates a persisted reminder with a target deadline. Displays scheduled status honestly.',
    {
      title: z.string().describe('Description of what needs attention'),
      targetTime: z.string().describe('Target ISO timestamp or deadline'),
      associatedWorkflowId: z.string().optional().describe('Associated workflow ID if any'),
      notes: z.string().optional().describe('Additional context or instructions'),
    },
    async ({ title, targetTime, associatedWorkflowId, notes }) => {
      const reminder = db.saveReminder({
        id: `rem-${crypto.randomUUID().slice(0, 8)}`,
        title,
        targetTime,
        associatedWorkflowId,
        status: 'pending',
        scheduledInBackend: true,
        createdAt: new Date().toISOString(),
        notes,
      });

      db.logActivity({
        workflowId: associatedWorkflowId,
        type: 'reminder_created',
        summary: `Created reminder: "${title}" due at ${targetTime}`,
        details: { reminderId: reminder.id, targetTime },
        status: 'info',
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                reminder,
                notice:
                  'Reminder persisted in local database. Scheduled for notification in ProofLoop dashboard.',
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 7. draft_email
  server.tool(
    'draft_email',
    'Creates an editable email draft WITHOUT sending. Consequential transmission strictly requires human approval.',
    {
      recipient: z.string().describe('Target email address'),
      subject: z.string().describe('Email subject line'),
      body: z.string().describe('Email body text'),
      context: z.string().optional().describe('Context or intent'),
    },
    async ({ recipient, subject, body, context }) => {
      const draftId = `draft-${crypto.randomUUID().slice(0, 8)}`;
      const draft = {
        draftId,
        recipient,
        subject,
        body,
        context,
        status: 'draft_created',
        isSent: false,
        note: 'Email has been drafted locally. It will NOT be sent until explicit human approval is granted.',
        createdAt: new Date().toISOString(),
      };

      db.logActivity({
        type: 'tool_execution',
        summary: `Drafted email to ${recipient}: "${subject}"`,
        details: { draftId, recipient, subject },
        status: 'success',
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, emailDraft: draft }, null, 2),
          },
        ],
      };
    }
  );

  // 8. search_demo_documents
  server.tool(
    'search_demo_documents',
    'Searches clearly labeled sample documents, guidelines, templates, and specs.',
    {
      query: z.string().describe('Search query text'),
      category: z
        .enum(['hackathon_rules', 'project_spec', 'submission_materials', 'checklists'])
        .optional()
        .describe('Document category filter'),
      simulateFailure: z.boolean().optional().describe('Developer test mode failure flag'),
    },
    async ({ query, category, simulateFailure }) => {
      // Check test mode failure
      if (simulateFailure || (isTestModeSimulateFailure && query.toLowerCase().includes('fail_test'))) {
        db.logActivity({
          type: 'failure',
          summary: 'Document search failed: Network resource temporarily unreachable [SIMULATED_FAILURE]',
          details: { query, category, testMode: true },
          status: 'failure',
        });

        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'SIMULATED_FAILURE: Document network source temporarily unreachable (Developer Test Mode).',
                recoveryOptions: [
                  'Search offline cached sample document store',
                  'Request user to upload submission materials',
                  'Use standard Alexa+ track template guidelines',
                ],
              }),
            },
          ],
        };
      }

      const docs = searchDemoDocuments(query, category);

      db.logActivity({
        type: 'tool_execution',
        summary: `Searched sample documents for "${query}" (found ${docs.length} matching)`,
        details: { query, category, matchesCount: docs.length },
        status: 'success',
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                query,
                matchesCount: docs.length,
                documents: docs.map((d) => ({
                  id: d.id,
                  title: d.title,
                  category: d.category,
                  source: d.source,
                  excerpt: d.content.slice(0, 300) + '...',
                  fullContent: d.content,
                })),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 9. record_verification
  server.tool(
    'record_verification',
    'Creates and stores an immutable proof-of-completion record for a workflow step, validating real evidence.',
    {
      workflowId: z.string().describe('The workflow ID'),
      stepId: z.string().describe('The step ID to verify'),
      actionPerformed: z.string().describe('Exact description of what was completed'),
      toolUsed: z.string().describe('The tool that produced this result'),
      resultReturned: z.record(z.string(), z.unknown()).describe('Tool execution output data'),
      verificationMethod: z
        .string()
        .optional()
        .describe('Method (e.g. independent_hash_validation, file_integrity_check)'),
      notes: z.string().optional().describe('Verification audit notes'),
    },
    async ({
      workflowId,
      stepId,
      actionPerformed,
      toolUsed,
      resultReturned,
      verificationMethod,
      notes,
    }) => {
      const wf = db.getWorkflow(workflowId);
      if (!wf) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Workflow "${workflowId}" not found.` }],
        };
      }

      const step = wf.steps.find((s) => s.id === stepId);
      if (!step) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Step "${stepId}" not found.` }],
        };
      }

      // Generate verification record
      const record = generateVerificationRecord({
        stepId,
        actionPerformed,
        toolUsed,
        resultReturned,
        verificationMethod,
        notes,
      });

      // Save to database
      db.saveVerification(record);

      // Attach to step and mark complete
      step.verificationRecord = record;
      step.status = 'verified_complete';
      step.completedAt = record.executedAt;

      // Update downstream dependencies
      updateStepDependencies(wf);
      db.saveWorkflow(wf);

      db.logActivity({
        workflowId,
        stepId,
        type: 'verification',
        summary: `Verified Complete: "${step.title}" via ${toolUsed}`,
        details: {
          verificationId: record.id,
          evidenceReference: record.evidenceReference,
          toolUsed,
        },
        status: 'success',
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                stepId,
                status: 'verified_complete',
                verificationRecord: record,
                workflowProgress: wf.progress,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // 10. get_activity_log
  server.tool(
    'get_activity_log',
    'Retrieves chronological audit trail of tool invocations, verifications, approvals, and state changes.',
    {
      workflowId: z.string().optional().describe('Optional workflow ID filter'),
      limit: z.number().int().positive().max(200).default(50).describe('Max entries to return'),
    },
    async ({ workflowId, limit }) => {
      const logs = db.getActivityLogs(workflowId, limit);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                count: logs.length,
                logs,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}

/**
 * Returns metadata description of the 10 MCP tools for UI display and discovery.
 */
export const REGISTERED_MCP_TOOLS: MCPToolInfo[] = [
  {
    name: 'create_workflow',
    description: 'Creates a structured, verifiable workflow from a user goal with milestones, dependencies, and approval flags.',
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'The user outcome or goal to achieve' },
        category: { type: 'string', description: 'Category (e.g. hackathon, career, project)' },
        deadline: { type: 'string', description: 'Target ISO deadline or date' },
      },
      required: ['goal'],
    },
  },
  {
    name: 'get_workflow',
    description: 'Retrieves full workflow details, progress metrics, step statuses, and verification records.',
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'The unique workflow ID' },
      },
      required: ['workflowId'],
    },
  },
  {
    name: 'update_task_status',
    description: 'Updates a task status according to strict finite state machine transition rules.',
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'The workflow ID' },
        stepId: { type: 'string', description: 'The step ID' },
        targetStatus: {
          type: 'string',
          enum: [
            'not_started',
            'ready',
            'waiting_for_approval',
            'in_progress',
            'blocked',
            'failed',
            'verification_required',
            'verified_complete',
          ],
        },
        notes: { type: 'string', description: 'Contextual notes' },
      },
      required: ['workflowId', 'stepId', 'targetStatus'],
    },
  },
  {
    name: 'save_memory',
    description: 'Persists user-approved facts, deadlines, successful strategies, or preferences for long-term recall.',
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: [
            'user_preferences',
            'ongoing_goals',
            'workflow_history',
            'deadlines',
            'previous_failures',
            'successful_strategies',
            'pending_actions',
          ],
        },
        content: { type: 'string', description: 'Clear factual statement' },
        source: { type: 'string', description: 'Origin or context' },
        userApproved: { type: 'boolean', description: 'Confirmed by user' },
      },
      required: ['category', 'content'],
    },
  },
  {
    name: 'search_memory',
    description: 'Retrieves relevant persisted memories and preferences matching a search query or category.',
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keywords' },
        category: { type: 'string', description: 'Memory category filter' },
      },
    },
  },
  {
    name: 'create_reminder',
    description: 'Creates a persisted reminder with a target deadline. Displays scheduled status honestly.',
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Reminder description' },
        targetTime: { type: 'string', description: 'Target ISO timestamp' },
        associatedWorkflowId: { type: 'string', description: 'Associated workflow ID' },
      },
      required: ['title', 'targetTime'],
    },
  },
  {
    name: 'draft_email',
    description: 'Creates an editable email draft WITHOUT sending. Consequential transmission strictly requires human approval.',
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      properties: {
        recipient: { type: 'string', description: 'Recipient email' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body' },
      },
      required: ['recipient', 'subject', 'body'],
    },
  },
  {
    name: 'search_demo_documents',
    description: 'Searches clearly labeled sample documents, guidelines, templates, and specs.',
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        category: { type: 'string', description: 'Category filter' },
        simulateFailure: { type: 'boolean', description: 'Developer test failure simulator' },
      },
      required: ['query'],
    },
  },
  {
    name: 'record_verification',
    description: 'Creates and stores an immutable proof-of-completion record for a workflow step, validating real evidence.',
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'Workflow ID' },
        stepId: { type: 'string', description: 'Step ID' },
        actionPerformed: { type: 'string', description: 'Action performed' },
        toolUsed: { type: 'string', description: 'Tool used' },
        resultReturned: { type: 'object', description: 'Tool result data' },
      },
      required: ['workflowId', 'stepId', 'actionPerformed', 'toolUsed', 'resultReturned'],
    },
  },
  {
    name: 'get_activity_log',
    description: 'Retrieves chronological audit trail of tool invocations, verifications, approvals, and state changes.',
    requiresApproval: false,
    inputSchema: {
      type: 'object',
      properties: {
        workflowId: { type: 'string', description: 'Workflow ID' },
        limit: { type: 'number', description: 'Max entries' },
      },
    },
  },
];
