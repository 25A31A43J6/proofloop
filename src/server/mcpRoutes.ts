/**
 * ProofLoop MCP Server Express Routes
 * Handles Streamable HTTP transport and MCP client API
 * Amazon Developer Hackathon 2026 — Alexa+ track
 */

import { Router, Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  createProofLoopMcpServer,
  REGISTERED_MCP_TOOLS,
  isTestModeSimulateFailure,
  setTestModeSimulateFailure,
} from './mcpServer.js';
import { db } from './db.js';
import { searchDemoDocuments } from './sampleDocs.js';
import { generateVerificationRecord, validateStepTransition, updateStepDependencies } from './workflowEngine.js';
import type { TaskStatus, MemoryCategory, WorkflowStep } from '../types/index.js';
import crypto from 'crypto';

export const mcpRouter = Router();

// Keep active transports map for Streamable HTTP sessions
const activeTransports = new Map<string, StreamableHTTPServerTransport>();

// Streamable HTTP endpoint for MCP specification
mcpRouter.all('/mcp', async (req: Request, res: Response) => {
  const sessionId = (req.headers['mcp-session-id'] as string) || (req.query.sessionId as string) || crypto.randomUUID();

  let transport = activeTransports.get(sessionId);
  if (!transport) {
    transport = new StreamableHTTPServerTransport();
    const server = createProofLoopMcpServer();
    await server.connect(transport);
    activeTransports.set(sessionId, transport);

    transport.onclose = () => {
      activeTransports.delete(sessionId);
    };
  }

  try {
    await transport.handleRequest(req, res, req.body);
  } catch (err: any) {
    console.error('[MCP Transport Error]', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'MCP Transport error', message: err.message });
    }
  }
});

// SSE endpoint for alternative MCP clients
mcpRouter.get('/mcp/sse', async (req: Request, res: Response) => {
  const sessionId = crypto.randomUUID();
  const transport = new StreamableHTTPServerTransport();
  const server = createProofLoopMcpServer();
  await server.connect(transport);
  activeTransports.set(sessionId, transport);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('mcp-session-id', sessionId);

  try {
    await transport.handleRequest(req, res);
  } catch (err: any) {
    console.error('[MCP SSE Error]', err);
  }
});

/**
 * Direct MCP Discovery & Invocation APIs
 * Used by the built-in MCP Client in the frontend and external tools.
 */

// Tool Discovery
mcpRouter.get('/api/mcp/tools', (req: Request, res: Response) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const derivedOrigin = `${proto}://${host}`;

  const publicEndpoint =
    process.env.MCP_ENDPOINT_URL ||
    (process.env.APP_URL ? `${process.env.APP_URL}/mcp` : `${derivedOrigin}/mcp`);

  res.json({
    status: 'connected',
    protocolVersion: '2025-11-25',
    serverInfo: {
      name: 'proofloop-agent-server',
      version: '1.0.0',
      description: 'ProofLoop Model Context Protocol Server (Streamable HTTP)',
      endpoint: publicEndpoint,
      isLocalServer: true,
      envConfigured: Boolean(process.env.MCP_ENDPOINT_URL),
    },
    toolsCount: REGISTERED_MCP_TOOLS.length,
    tools: REGISTERED_MCP_TOOLS,
  });
});

// Server Status & Diagnostics
mcpRouter.get('/api/mcp/status', (req: Request, res: Response) => {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const derivedOrigin = `${proto}://${host}`;

  const publicEndpoint =
    process.env.MCP_ENDPOINT_URL ||
    (process.env.APP_URL ? `${process.env.APP_URL}/mcp` : `${derivedOrigin}/mcp`);

  res.json({
    connected: true,
    server: 'ProofLoop MCP Server (Streamable HTTP)',
    specVersion: '2025-11-25',
    endpoint: publicEndpoint,
    isLocalServer: true,
    envConfigured: Boolean(process.env.MCP_ENDPOINT_URL),
    activeSessions: activeTransports.size,
    isTestModeSimulateFailure,
    toolsCount: REGISTERED_MCP_TOOLS.length,
    registeredTools: REGISTERED_MCP_TOOLS.map((t) => t.name),
    health: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Tool Invocation
mcpRouter.post('/api/mcp/call', async (req: Request, res: Response) => {
  const { toolName, args } = req.body;

  if (!toolName) {
    res.status(400).json({ error: 'Missing required field: toolName' });
    return;
  }

  const toolDef = REGISTERED_MCP_TOOLS.find((t) => t.name === toolName);
  if (!toolDef) {
    res.status(404).json({ error: `Tool "${toolName}" is not registered on this MCP server.` });
    return;
  }

  // Validate required inputs
  const required = toolDef.inputSchema.required || [];
  const missing = required.filter((param) => args?.[param] === undefined || args?.[param] === null);
  if (missing.length > 0) {
    res.status(400).json({
      error: `Missing required arguments for tool "${toolName}": ${missing.join(', ')}`,
      required,
    });
    return;
  }

  const startTime = Date.now();

  try {
    let result: Record<string, unknown> = {};

    switch (toolName) {
      case 'create_workflow': {
        const wfId = `wf-${crypto.randomUUID().slice(0, 8)}`;
        const now = new Date().toISOString();

        let steps: WorkflowStep[] = [];
        if (args.steps && Array.isArray(args.steps) && args.steps.length > 0) {
          steps = args.steps.map((s: any, idx: number) => ({
            id: `step-${wfId}-${idx + 1}`,
            workflowId: wfId,
            order: idx + 1,
            title: s.title || `Task ${idx + 1}`,
            description: s.description || s.title || '',
            status: idx === 0 ? ('ready' as TaskStatus) : ('not_started' as TaskStatus),
            requiresApproval: Boolean(s.requiresApproval),
            approvalStatus: s.requiresApproval ? ('pending' as const) : ('not_required' as const),
            actionType: s.actionType || 'task',
            toolRequired: s.toolRequired,
            toolArgs: s.toolArgs,
            dependencies: s.dependencies || (idx === 0 ? [] : [`step-${wfId}-${idx}`]),
            retryCount: 0,
          }));
        } else {
          steps = [
            {
              id: `step-${wfId}-1`,
              workflowId: wfId,
              order: 1,
              title: 'Audit & Extract Requirements',
              description: `Examine constraints for goal: ${args.goal}`,
              status: 'ready' as TaskStatus,
              requiresApproval: false,
              approvalStatus: 'not_required' as const,
              actionType: 'document_search',
              toolRequired: 'search_demo_documents',
              toolArgs: { query: args.goal },
              dependencies: [],
              retryCount: 0,
            },
            {
              id: `step-${wfId}-2`,
              workflowId: wfId,
              order: 2,
              title: 'Draft Execution Payload',
              description: 'Prepare materials or documentation',
              status: 'not_started' as TaskStatus,
              requiresApproval: false,
              approvalStatus: 'not_required' as const,
              actionType: 'draft',
              dependencies: [`step-${wfId}-1`],
              retryCount: 0,
            },
            {
              id: `step-${wfId}-3`,
              workflowId: wfId,
              order: 3,
              title: 'Request Human Authorization',
              description: 'Obtain user approval before final action',
              status: 'not_started' as TaskStatus,
              requiresApproval: true,
              approvalStatus: 'pending' as const,
              actionType: 'approval_request',
              dependencies: [`step-${wfId}-2`],
              retryCount: 0,
            },
            {
              id: `step-${wfId}-4`,
              workflowId: wfId,
              order: 4,
              title: 'Record Proof of Completion Ledger',
              description: 'Store verification cryptographic proof',
              status: 'not_started' as TaskStatus,
              requiresApproval: false,
              approvalStatus: 'not_required' as const,
              actionType: 'verification',
              toolRequired: 'record_verification',
              dependencies: [`step-${wfId}-3`],
              retryCount: 0,
            },
          ];
        }

        const wf = db.saveWorkflow({
          id: wfId,
          goal: args.goal,
          category: args.category || 'general',
          deadline: args.deadline,
          createdAt: now,
          updatedAt: now,
          status: 'active',
          steps,
          progress: 0,
        });

        result = { success: true, workflow: wf };
        break;
      }

      case 'get_workflow': {
        const wf = db.getWorkflow(args.workflowId);
        if (!wf) {
          res.status(404).json({ error: `Workflow "${args.workflowId}" not found.` });
          return;
        }
        const verifications = db.getVerifications(args.workflowId);
        result = { success: true, workflow: wf, verifications };
        break;
      }

      case 'update_task_status': {
        const wf = db.getWorkflow(args.workflowId);
        if (!wf) {
          res.status(404).json({ error: `Workflow "${args.workflowId}" not found.` });
          return;
        }
        const step = wf.steps.find((s) => s.id === args.stepId);
        if (!step) {
          res.status(404).json({ error: `Step "${args.stepId}" not found.` });
          return;
        }

        const valid = validateStepTransition(step, args.targetStatus);
        if (!valid.valid) {
          res.status(400).json({ error: valid.reason, currentStatus: step.status });
          return;
        }

        const prev = step.status;
        step.status = args.targetStatus;
        if (args.notes) step.failureReason = args.notes;
        if (args.targetStatus === 'verified_complete') {
          step.completedAt = new Date().toISOString();
        }

        updateStepDependencies(wf);
        db.saveWorkflow(wf);

        result = {
          success: true,
          stepId: step.id,
          previousStatus: prev,
          currentStatus: step.status,
          workflowProgress: wf.progress,
        };
        break;
      }

      case 'save_memory': {
        const mem = db.saveMemory({
          id: `mem-${crypto.randomUUID().slice(0, 8)}`,
          category: args.category as MemoryCategory,
          content: args.content,
          source: args.source || 'MCP Client Tool Call',
          confidence: 1.0,
          userApproved: args.userApproved !== false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        result = { success: true, memory: mem };
        break;
      }

      case 'search_memory': {
        const memories = db.getMemories(args.category, args.query);
        result = { success: true, count: memories.length, memories };
        break;
      }

      case 'create_reminder': {
        const rem = db.saveReminder({
          id: `rem-${crypto.randomUUID().slice(0, 8)}`,
          title: args.title,
          targetTime: args.targetTime,
          associatedWorkflowId: args.associatedWorkflowId,
          status: 'pending',
          scheduledInBackend: true,
          createdAt: new Date().toISOString(),
        });
        result = {
          success: true,
          reminder: rem,
          notice: 'Reminder persisted and displayed in ProofLoop dashboard.',
        };
        break;
      }

      case 'draft_email': {
        const draft = {
          draftId: `draft-${crypto.randomUUID().slice(0, 8)}`,
          recipient: args.recipient,
          subject: args.subject,
          body: args.body,
          status: 'draft_created',
          isSent: false,
          notice: 'Draft produced locally. Sending requires explicit human authorization.',
          createdAt: new Date().toISOString(),
        };
        result = { success: true, draft };
        break;
      }

      case 'search_demo_documents': {
        if (args.simulateFailure || (isTestModeSimulateFailure && args.query?.includes('fail_test'))) {
          res.status(502).json({
            error: 'SIMULATED_FAILURE: Document network source temporarily unreachable (Developer Test Mode).',
            recoveryOptions: [
              'Search offline cached sample document store',
              'Request user to upload submission materials',
              'Use standard Alexa+ track template guidelines',
            ],
          });
          return;
        }
        const docs = searchDemoDocuments(args.query, args.category);
        result = { success: true, query: args.query, count: docs.length, documents: docs };
        break;
      }

      case 'record_verification': {
        const wf = db.getWorkflow(args.workflowId);
        if (!wf) {
          res.status(404).json({ error: `Workflow "${args.workflowId}" not found.` });
          return;
        }
        const step = wf.steps.find((s) => s.id === args.stepId);
        if (!step) {
          res.status(404).json({ error: `Step "${args.stepId}" not found.` });
          return;
        }

        const record = generateVerificationRecord({
          stepId: args.stepId,
          actionPerformed: args.actionPerformed,
          toolUsed: args.toolUsed,
          resultReturned: args.resultReturned,
          verificationMethod: args.verificationMethod,
          notes: args.notes,
        });

        db.saveVerification(record);
        step.verificationRecord = record;
        step.status = 'verified_complete';
        step.completedAt = record.executedAt;
        updateStepDependencies(wf);
        db.saveWorkflow(wf);

        result = { success: true, verificationRecord: record, workflowProgress: wf.progress };
        break;
      }

      case 'get_activity_log': {
        const logs = db.getActivityLogs(args.workflowId, args.limit || 50);
        result = { success: true, count: logs.length, logs };
        break;
      }

      default:
        res.status(400).json({ error: `Unhandled tool: ${toolName}` });
        return;
    }

    const durationMs = Date.now() - startTime;
    res.json({
      success: true,
      toolName,
      durationMs,
      result,
    });
  } catch (err: any) {
    console.error(`[MCP Tool Execution Error] ${toolName}:`, err);
    res.status(500).json({
      success: false,
      toolName,
      error: err.message || 'Tool execution failed',
    });
  }
});
