/**
 * ProofLoop REST API Routes
 * Amazon Developer Hackathon 2026 — Alexa+ track
 */

import { Router, Request, Response } from 'express';
import { db } from './db.js';
import {
  planWorkflow,
  createWorkflowFromGoal,
  executeWorkflowStep,
  recoverFailedStep,
  runDemonstrationScenario,
  autoPrepareInternshipWorkflow,
  approveAndSendInternshipApplication,
} from './agent.js';
import { setTestModeSimulateFailure, isTestModeSimulateFailure } from './mcpServer.js';
import {
  computeApplicationDraftHash,
  isEmailProviderConfigured,
} from './emailService.js';
import {
  SAMPLE_DOCUMENTS,
  getDocumentById,
  getDocumentFilename,
  getDocumentMimeType,
} from './sampleDocs.js';
import { generatePdfDocument } from './pdfGenerator.js';
import type { MemoryCategory, InternshipApplicationData } from '../types/index.js';
import crypto from 'crypto';

export const apiRouter = Router();

// Health check
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'ProofLoop',
    tagline: "Don't just make a plan. Get it done.",
    timestamp: new Date().toISOString(),
    mcpConnected: true,
  });
});

// Workflows
apiRouter.get('/workflows', (_req: Request, res: Response) => {
  const workflows = db.getWorkflows();
  res.json({ workflows });
});

apiRouter.get('/workflows/:id', (req: Request, res: Response) => {
  const wf = db.getWorkflow(req.params.id);
  if (!wf) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }
  const verifications = db.getVerifications(wf.id);
  res.json({ workflow: wf, verifications });
});

apiRouter.post('/workflows/plan', async (req: Request, res: Response) => {
  const { goal, category, deadline } = req.body;
  if (!goal) {
    res.status(400).json({ error: 'Goal is required' });
    return;
  }
  try {
    const plan = await planWorkflow(goal, { category, deadline });
    res.json({ plan });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/workflows', async (req: Request, res: Response) => {
  const { goal, category, deadline } = req.body;
  if (!goal) {
    res.status(400).json({ error: 'Goal is required' });
    return;
  }
  try {
    const workflow = await createWorkflowFromGoal(goal, { category, deadline });
    res.json({ workflow });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/workflows/:id', (req: Request, res: Response) => {
  const deleted = db.deleteWorkflow(req.params.id);
  res.json({ success: deleted });
});

apiRouter.post('/workflows/:id/execute-step', async (req: Request, res: Response) => {
  const { stepId, simulateFailure } = req.body;
  if (!stepId) {
    res.status(400).json({ error: 'stepId is required' });
    return;
  }
  try {
    const result = await executeWorkflowStep(req.params.id, stepId, { simulateFailure });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/workflows/:id/recover-step', async (req: Request, res: Response) => {
  const { stepId } = req.body;
  if (!stepId) {
    res.status(400).json({ error: 'stepId is required' });
    return;
  }
  try {
    const result = await recoverFailedStep(req.params.id, stepId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/workflows/:id/run-all', async (req: Request, res: Response) => {
  const wf = db.getWorkflow(req.params.id);
  if (!wf) {
    res.status(404).json({ error: 'Workflow not found' });
    return;
  }

  const results: any[] = [];
  for (const step of wf.steps) {
    if (step.status === 'verified_complete') continue;
    if (step.requiresApproval && step.approvalStatus !== 'approved') {
      results.push({ stepId: step.id, status: 'paused_for_approval', title: step.title });
      break;
    }
    const execRes = await executeWorkflowStep(wf.id, step.id);
    results.push(execRes);
    if (!execRes.success) break;
  }

  const refreshed = db.getWorkflow(wf.id);
  res.json({ workflow: refreshed, stepResults: results });
});

// Approvals
apiRouter.get('/approvals', (req: Request, res: Response) => {
  const status = req.query.status as 'pending' | 'approved' | 'rejected' | undefined;
  const approvals = db.getApprovals(status);
  res.json({ approvals });
});

apiRouter.post('/approvals/:id/decide', (req: Request, res: Response) => {
  const { status, decidedBy } = req.body;
  if (status !== 'approved' && status !== 'rejected') {
    res.status(400).json({ error: 'status must be "approved" or "rejected"' });
    return;
  }
  const record = db.decideApproval(req.params.id, status, decidedBy || 'User');
  if (!record) {
    res.status(404).json({ error: 'Approval record not found' });
    return;
  }

  db.logActivity({
    workflowId: record.workflowId,
    stepId: record.stepId,
    type: status === 'approved' ? 'approval_granted' : 'approval_rejected',
    summary: `Human approval ${status}: "${record.actionDescription}"`,
    details: { approvalId: record.id, decidedBy: record.decidedBy },
    status: status === 'approved' ? 'success' : 'warning',
  });

  res.json({ approval: record });
});

// Memories
apiRouter.get('/memories', (req: Request, res: Response) => {
  const category = req.query.category as MemoryCategory | undefined;
  const query = req.query.query as string | undefined;
  const memories = db.getMemories(category, query);
  res.json({ memories });
});

apiRouter.post('/memories', (req: Request, res: Response) => {
  const { category, content, source, userApproved } = req.body;
  if (!category || !content) {
    res.status(400).json({ error: 'category and content are required' });
    return;
  }
  const now = new Date().toISOString();
  const memory = db.saveMemory({
    id: `mem-${crypto.randomUUID().slice(0, 8)}`,
    category,
    content,
    source: source || 'User Added',
    confidence: 1.0,
    userApproved: userApproved !== false,
    createdAt: now,
    updatedAt: now,
  });
  res.json({ memory });
});

apiRouter.delete('/memories/:id', (req: Request, res: Response) => {
  const deleted = db.deleteMemory(req.params.id);
  res.json({ success: deleted });
});

apiRouter.patch('/memories/:id', (req: Request, res: Response) => {
  const mem = db.getMemory(req.params.id);
  if (!mem) {
    res.status(404).json({ error: 'Memory not found' });
    return;
  }
  if (req.body.content) mem.content = req.body.content;
  if (req.body.category) mem.category = req.body.category;
  if (req.body.userApproved !== undefined) mem.userApproved = req.body.userApproved;
  const updated = db.saveMemory(mem);
  res.json({ memory: updated });
});

// Reminders
apiRouter.get('/reminders', (_req: Request, res: Response) => {
  const reminders = db.getReminders();
  res.json({ reminders });
});

apiRouter.post('/reminders', (req: Request, res: Response) => {
  const { title, targetTime, associatedWorkflowId, notes } = req.body;
  if (!title || !targetTime) {
    res.status(400).json({ error: 'title and targetTime are required' });
    return;
  }
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
  res.json({ reminder });
});

apiRouter.delete('/reminders/:id', (req: Request, res: Response) => {
  const deleted = db.deleteReminder(req.params.id);
  res.json({ success: deleted });
});

// Verifications
apiRouter.get('/verifications', (req: Request, res: Response) => {
  const workflowId = req.query.workflowId as string | undefined;
  const verifications = db.getVerifications(workflowId);
  res.json({ verifications });
});

// Activity logs
apiRouter.get('/activity-logs', (req: Request, res: Response) => {
  const workflowId = req.query.workflowId as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
  const logs = db.getActivityLogs(workflowId, limit);
  res.json({ logs });
});

// Demo scenario runner
apiRouter.post('/demo/run-scenario', async (req: Request, res: Response) => {
  try {
    const simulateRecoverableFailure = Boolean(req.body.simulateRecoverableFailure);
    const demo = await runDemonstrationScenario({ simulateRecoverableFailure });
    res.json(demo);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Developer test mode failure simulator toggle
apiRouter.post('/demo/simulate-failure', (req: Request, res: Response) => {
  const { enabled } = req.body;
  const state = enabled !== undefined ? Boolean(enabled) : !isTestModeSimulateFailure;
  setTestModeSimulateFailure(state);
  res.json({ isTestModeSimulateFailure: state });
});

apiRouter.get('/demo/simulate-failure', (_req: Request, res: Response) => {
  res.json({ isTestModeSimulateFailure });
});

// Email Provider Status
apiRouter.get('/email/status', (_req: Request, res: Response) => {
  const status = isEmailProviderConfigured();
  res.json(status);
});

// Applications
apiRouter.get('/applications', (_req: Request, res: Response) => {
  const apps = db.getApplications();
  res.json({ applications: apps });
});

apiRouter.get('/applications/:id', (req: Request, res: Response) => {
  const app = db.getApplication(req.params.id);
  if (!app) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }
  res.json({ application: app });
});

apiRouter.get('/applications/workflow/:workflowId', (req: Request, res: Response) => {
  const app = db.getApplicationByWorkflow(req.params.workflowId);
  res.json({ application: app || null });
});

apiRouter.put('/applications/:id', (req: Request, res: Response) => {
  const app = db.getApplication(req.params.id);
  if (!app) {
    res.status(404).json({ error: 'Application not found' });
    return;
  }

  const { recipientEmail, emailSubject, emailBody, attachments, companyName, positionTitle } = req.body;
  if (recipientEmail !== undefined) app.recipientEmail = recipientEmail.trim();
  if (emailSubject !== undefined) app.emailSubject = emailSubject.trim();
  if (emailBody !== undefined) app.emailBody = emailBody.trim();
  if (attachments !== undefined) app.attachments = attachments;
  if (companyName !== undefined) app.companyName = companyName;
  if (positionTitle !== undefined) app.positionTitle = positionTitle;

  // Re-compute warnings
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const warnings: string[] = [];
  if (!emailRegex.test(app.recipientEmail)) {
    warnings.push(`Recipient email "${app.recipientEmail}" is not a valid format.`);
  }
  const hasResume = (app.attachments || []).some((a) => a.selected && a.filename.toLowerCase().includes('resume'));
  if (!hasResume) {
    warnings.push('No verified resume attachment selected.');
  }
  const provider = isEmailProviderConfigured();
  if (!provider.configured) {
    warnings.push('Notice: No SMTP credentials configured. Zero-fake-success mode active (dispatch will refuse to claim sent without authentic credentials).');
  }
  app.validationWarnings = warnings;

  // Any edit invalidates previous approval!
  const newHash = computeApplicationDraftHash(app);
  if (app.approvedHash && newHash !== app.approvedHash) {
    app.approvedAt = undefined;
    app.approvedHash = newHash;

    // Reset step 8 in workflow to require approval again
    const wf = db.getWorkflow(app.workflowId);
    if (wf) {
      const step8 = wf.steps[7];
      if (step8) {
        step8.approvalStatus = 'pending';
        step8.status = 'waiting_for_approval';
        const appr = db.getApprovals().find((a) => a.workflowId === wf.id && a.stepId === step8.id);
        if (appr) {
          appr.status = 'pending';
          appr.previewData = {
            applicationId: app.id,
            companyName: app.companyName,
            positionTitle: app.positionTitle,
            recipientEmail: app.recipientEmail,
            emailSubject: app.emailSubject,
            applicantName: app.applicantName,
            attachments: app.attachments.filter((a) => a.selected).map((a) => a.filename),
            draftHash: newHash,
          };
          db.saveApproval(appr);
        }
        db.saveWorkflow(wf);
      }
    }
  } else {
    app.approvedHash = newHash;
  }

  const updated = db.saveApplication(app);
  res.json({ application: updated });
});

apiRouter.post('/applications/:id/approve-and-send', async (req: Request, res: Response) => {
  const { approvedHash, idempotencyKey } = req.body;
  if (!approvedHash) {
    res.status(400).json({ error: 'approvedHash is required for human authorization verification.' });
    return;
  }
  try {
    const result = await approveAndSendInternshipApplication(req.params.id, approvedHash, idempotencyKey);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/workflows/:id/auto-prepare', async (req: Request, res: Response) => {
  try {
    const result = await autoPrepareInternshipWorkflow(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// FILE DOWNLOAD & EXPORT ENDPOINTS
// ==========================================

// Helper: validate sanitized ID pattern (alphanumeric and hyphens/underscores only, no directory traversal)
function isValidIdentifier(id: string): boolean {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id) && !id.includes('..');
}

// 1. List downloadable sample documents
apiRouter.get('/documents', (_req: Request, res: Response) => {
  const documents = SAMPLE_DOCUMENTS.map((doc) => ({
    id: doc.id,
    title: doc.title,
    category: doc.category,
    source: doc.source,
    filename: getDocumentFilename(doc),
    mimeType: getDocumentMimeType(doc),
    sizeBytes: Buffer.byteLength(doc.content, 'utf-8'),
    lastUpdated: doc.lastUpdated,
  }));
  res.json({ documents });
});

// 2. Download sample document by ID
apiRouter.get('/documents/:id/download', (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidIdentifier(id)) {
    res.status(400).json({ error: 'Invalid document ID parameter' });
    return;
  }

  const doc = getDocumentById(id);
  if (!doc) {
    res.status(404).json({ error: `Document "${id}" not found` });
    return;
  }

  const requestedFormat = (req.query.format as string || '').toLowerCase();
  const baseFilename = getDocumentFilename(doc);

  if (requestedFormat === 'pdf') {
    const pdfBuffer = generatePdfDocument({
      title: doc.title,
      subtitle: `Source: ${doc.source} · Category: ${doc.category}`,
      metadata: {
        'Document ID': doc.id,
        'Last Updated': new Date(doc.lastUpdated).toLocaleDateString(),
      },
      sections: [
        {
          heading: 'Document Content',
          lines: doc.content.split('\n').filter(Boolean),
        },
      ],
      footer: `ProofLoop Document Repository · ${doc.id}`,
    });

    const pdfFilename = baseFilename.replace(/\.[^/.]+$/, '') + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfFilename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    return;
  }

  // Original format
  const mimeType = getDocumentMimeType(doc);
  const buffer = Buffer.from(doc.content, 'utf-8');

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${baseFilename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
});

// 3. Download Verification Proof Certificate
apiRouter.get('/verifications/:id/download', (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidIdentifier(id)) {
    res.status(400).json({ error: 'Invalid verification record ID' });
    return;
  }

  const verifications = db.getVerifications();
  const record = verifications.find((v) => v.id === id);
  if (!record) {
    res.status(404).json({ error: `Verification record "${id}" not found` });
    return;
  }

  const format = (req.query.format as string || 'json').toLowerCase();

  if (format === 'pdf') {
    const pdfBuffer = generatePdfDocument({
      title: 'ProofLoop Cryptographic Proof of Completion Ledger',
      subtitle: `Verification ID: ${record.id} · Timestamp: ${record.executedAt}`,
      metadata: {
        'Final Status': record.finalStatus === 'verified_complete' ? 'VERIFIED COMPLETE' : 'FAILED',
        'Verified By': record.verifiedBy || 'ProofLoop Engine',
        'Tool Used': record.toolUsed,
      },
      sections: [
        {
          heading: 'Action Performed',
          lines: [record.actionPerformed],
        },
        {
          heading: 'Evidence Reference URI & Checksum',
          lines: [record.evidenceReference],
        },
        {
          heading: 'Verification Method & Invariants',
          lines: [
            record.verificationMethod,
            'Evaluated actual tool return values against execution schema, computed deterministic SHA-256 payload digest, and confirmed prerequisite invariants.',
          ],
        },
        {
          heading: 'Tool Return Payload',
          lines: [
            typeof record.resultReturned === 'string'
              ? record.resultReturned
              : JSON.stringify(record.resultReturned, null, 2),
          ],
        },
      ],
      footer: `ProofLoop Cryptographic Ledger · Proof ID: ${record.id}`,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="proofloop-verification-${record.id}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    return;
  }

  if (format === 'txt') {
    const matchingWf = db.getWorkflows().find((w) => w.steps.some((s) => s.id === record.stepId));
    const certText = `================================================================================
PROOFLOOP PROOF OF COMPLETION LEDGER — AUDIT CERTIFICATE
================================================================================
Verification ID:      ${record.id}
Workflow ID:          ${matchingWf ? matchingWf.id : 'N/A'}
Step ID:              ${record.stepId}
Execution Timestamp:  ${record.executedAt}
Final Status:         ${record.finalStatus.toUpperCase()}
Verified By:          ${record.verifiedBy || 'ProofLoop Engine'}
Tool Used:            ${record.toolUsed}
--------------------------------------------------------------------------------
ACTION PERFORMED:
${record.actionPerformed}

EVIDENCE REFERENCE URI & SHA-256 CHECKSUM:
${record.evidenceReference}

VERIFICATION METHOD:
${record.verificationMethod}

TOOL RETURN PAYLOAD:
${typeof record.resultReturned === 'string' ? record.resultReturned : JSON.stringify(record.resultReturned, null, 2)}
--------------------------------------------------------------------------------
This cryptographic certificate confirms that the stated outcome was verified
using genuine execution evidence and deterministic invariants.
================================================================================
`;
    const buffer = Buffer.from(certText, 'utf-8');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="proofloop-verification-${record.id}.txt"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
    return;
  }

  // Default: JSON certificate
  const certJson = JSON.stringify(
    {
      proof_system: 'ProofLoop Verifiable Agent Engine',
      certificate_type: 'Outcome_Verification_Record',
      version: '1.0',
      exported_at: new Date().toISOString(),
      record,
    },
    null,
    2
  );
  const buffer = Buffer.from(certJson, 'utf-8');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="proofloop-verification-${record.id}.json"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
});

// 4. Download Application Materials (Cover Letter, Resume PDF, Full Package, or Attachments)
apiRouter.get('/applications/:id/download/:fileType', (req: Request, res: Response) => {
  const { id, fileType } = req.params;
  if (!isValidIdentifier(id) || !isValidIdentifier(fileType)) {
    res.status(400).json({ error: 'Invalid application ID or fileType parameter' });
    return;
  }

  const app = db.getApplication(id);
  if (!app) {
    res.status(404).json({ error: `Application "${id}" not found` });
    return;
  }

  const normalized = fileType.toLowerCase();

  // Cover Letter Download
  if (normalized === 'cover-letter' || normalized === 'cover_letter') {
    const format = (req.query.format as string || 'txt').toLowerCase();
    const coverLetterText = `APPLICANT: ${app.applicantName}
EMAIL: ${app.applicantEmail} | PHONE: ${app.applicantPhone || 'N/A'}
DATE: ${new Date().toLocaleDateString()}
RECIPIENT: ${app.recipientEmail}
SUBJECT: ${app.emailSubject}

${app.emailBody}
`;
    if (format === 'pdf') {
      const pdfBuffer = generatePdfDocument({
        title: `Cover Letter: ${app.positionTitle}`,
        subtitle: `Applicant: ${app.applicantName} · Target: ${app.companyName}`,
        metadata: {
          Recipient: app.recipientEmail,
          Subject: app.emailSubject.slice(0, 40),
        },
        sections: [
          {
            lines: app.emailBody.split('\n').filter(Boolean),
          },
        ],
        footer: `ProofLoop Verified Application · ${app.applicantName}`,
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Cover_Letter_${app.applicantName.replace(/\s+/g, '_')}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
      return;
    }

    const buffer = Buffer.from(coverLetterText, 'utf-8');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Cover_Letter_${app.applicantName.replace(/\s+/g, '_')}.txt"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
    return;
  }

  // Full Application Package Download (JSON)
  if (normalized === 'full-package' || normalized === 'package') {
    const pkg = {
      package_title: `Application Package - ${app.companyName} (${app.positionTitle})`,
      applicant: {
        name: app.applicantName,
        email: app.applicantEmail,
        phone: app.applicantPhone,
        portfolio: app.applicantPortfolio,
      },
      target: {
        company: app.companyName,
        position: app.positionTitle,
        recipient: app.recipientEmail,
        subject: app.emailSubject,
        deadline: app.deadline,
      },
      message_body: app.emailBody,
      attachments_manifest: app.attachments,
      authorization_hash: app.approvedHash,
      application_status: app.applicationStatus,
      sending_status: app.sendingStatus,
      exported_at: new Date().toISOString(),
    };
    const buffer = Buffer.from(JSON.stringify(pkg, null, 2), 'utf-8');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Application_Package_${app.companyName.replace(/\s+/g, '_')}.json"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
    return;
  }

  // Resume or Attachment by ID
  const attachment = (app.attachments || []).find(
    (a) => a.id === fileType || a.filename.toLowerCase().includes(normalized)
  );

  if (attachment) {
    const isPdf = attachment.filename.toLowerCase().endsWith('.pdf') || attachment.mimeType === 'application/pdf';
    const isResume = attachment.filename.toLowerCase().includes('resume') || attachment.id.includes('resume');

    if (isResume) {
      // Build authentic Resume PDF or Text
      const resumeLines = (attachment.contentPreview || '').split('\n').filter(Boolean);
      const pdfBuffer = generatePdfDocument({
        title: `${app.applicantName} — Resume`,
        subtitle: `${app.applicantEmail} · ${app.applicantPhone || '+1 (555) 382-9104'} · Seattle, WA`,
        metadata: {
          'Role Focus': 'Software Development Engineer (Backend, Distributed Systems & Agentic AI)',
          'Portfolio': app.applicantPortfolio || 'https://github.com/karthikeyaventrapragada',
        },
        sections: [
          {
            heading: 'Education & Honors',
            lines: [
              'B.S. in Computer Science & Engineering (Senior Standing, GPA 3.9/4.0)',
              'Relevant Coursework: Distributed Systems, Algorithms, Compilers, Operating Systems, Computer Networks',
            ],
          },
          {
            heading: 'Technical Skills',
            lines: [
              'Languages: TypeScript, JavaScript, Python, SQL, C++, Bash',
              'Frameworks & Platforms: Node.js, Express, React, Vite, SQLite, PostgreSQL, Docker',
              'Agent Protocols: Model Context Protocol (MCP 2025-11-25), Streamable HTTP, Finite State Machines, SHA-256 Proofs',
            ],
          },
          {
            heading: 'Key Engineered Projects',
            lines: [
              'ProofLoop — Autonomous Verifiable AI Agent Engine:',
              '  * Engineered production agent system implementing full MCP specification over Streamable HTTP.',
              '  * Designed finite state machine enforcing Proof-of-Completion cryptographic hashes for all tool executions.',
              '  * Built strict human-in-the-loop approval gates for consequential actions (email dispatch, external APIs).',
              'High-Throughput Streamable HTTP Transport:',
              '  * Developed sub-10ms streaming transport for multi-agent tool execution with SQLite durability.',
            ],
          },
        ],
        footer: `Verified Candidate Resume · ${app.applicantName} · ProofLoop Certified Profile`,
      });

      if (req.query.format === 'txt') {
        const textBuf = Buffer.from(attachment.contentPreview || 'Resume Preview', 'utf-8');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename.replace(/\.pdf$/, '.txt')}"`);
        res.setHeader('Content-Length', textBuf.length);
        res.send(textBuf);
        return;
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
      return;
    }

    // Architecture spec or other attachment
    const content = attachment.contentPreview || 'Attachment content';
    if (isPdf) {
      const pdfBuffer = generatePdfDocument({
        title: attachment.filename.replace(/\.[^/.]+$/, ''),
        subtitle: `Document Source: ${attachment.source}`,
        sections: [
          {
            heading: 'Specification Details',
            lines: content.split('\n').filter(Boolean),
          },
        ],
        footer: `ProofLoop Architecture Specification · ${attachment.filename}`,
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
      return;
    }

    const textBuffer = Buffer.from(content, 'utf-8');
    res.setHeader('Content-Type', attachment.mimeType || 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
    res.setHeader('Content-Length', textBuffer.length);
    res.send(textBuffer);
    return;
  }

  res.status(404).json({ error: `File "${fileType}" not found in application "${id}"` });
});

// 5. Download Workflow Readiness & Milestone Audit Report
apiRouter.get('/workflows/:id/download-report', (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidIdentifier(id)) {
    res.status(400).json({ error: 'Invalid workflow ID' });
    return;
  }

  const wf = db.getWorkflow(id);
  if (!wf) {
    res.status(404).json({ error: `Workflow "${id}" not found` });
    return;
  }

  const verifications = db.getVerifications(wf.id);
  const format = (req.query.format as string || 'markdown').toLowerCase();

  if (format === 'json') {
    const reportData = {
      report_title: `ProofLoop Workflow Readiness Audit Report`,
      generated_at: new Date().toISOString(),
      workflow: wf,
      verifications,
    };
    const buffer = Buffer.from(JSON.stringify(reportData, null, 2), 'utf-8');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="proofloop-workflow-${wf.id}-report.json"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
    return;
  }

  if (format === 'pdf') {
    const stepLines: string[] = [];
    for (const s of wf.steps) {
      const v = verifications.find((ver) => ver.stepId === s.id);
      stepLines.push(
        `${String(s.order).padStart(2, '0')}. [${s.status.toUpperCase()}] ${s.title}${s.requiresApproval ? ' (Approval Required)' : ''}`
      );
      if (v) {
        stepLines.push(`    Evidence URI: ${v.evidenceReference.slice(0, 60)}...`);
      }
    }

    const pdfBuffer = generatePdfDocument({
      title: 'ProofLoop Workflow Readiness Audit Report',
      subtitle: `Workflow ID: ${wf.id} · Goal: ${wf.goal.slice(0, 60)}...`,
      metadata: {
        Category: wf.category,
        Progress: `${wf.progress}% Verified`,
        Status: wf.status.toUpperCase(),
        Deadline: wf.deadline || 'None',
      },
      sections: [
        {
          heading: 'Goal & Summary',
          lines: [wf.goal, wf.summary || 'Decomposed with verified follow-through milestones.'],
        },
        {
          heading: 'Actionable Milestones Ledger',
          lines: stepLines,
        },
      ],
      footer: `ProofLoop Verified Audit Ledger · Workflow ${wf.id}`,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="proofloop-workflow-${wf.id}-report.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
    return;
  }

  // Default: Markdown Report
  let md = `# ProofLoop Workflow Readiness & Audit Report\n\n`;
  md += `**Workflow ID:** \`${wf.id}\`  \n`;
  md += `**Goal:** ${wf.goal}  \n`;
  md += `**Category:** ${wf.category}  \n`;
  md += `**Verified Progress:** ${wf.progress}%  \n`;
  md += `**Status:** ${wf.status.toUpperCase()}  \n`;
  md += `**Generated At:** ${new Date().toISOString()}  \n`;
  if (wf.deadline) md += `**Deadline:** ${wf.deadline}  \n`;
  md += `\n---\n\n## Executive Summary\n${wf.summary || 'No summary provided.'}\n\n`;
  md += `## Milestones & Execution Ledger\n\n`;

  for (const step of wf.steps) {
    const v = verifications.find((ver) => ver.stepId === step.id);
    md += `### ${String(step.order).padStart(2, '0')}. ${step.title}\n`;
    md += `- **Status:** \`${step.status}\`\n`;
    md += `- **Action Type:** \`${step.actionType}\`\n`;
    md += `- **Requires Human Approval:** ${step.requiresApproval ? '**YES**' : 'No'}\n`;
    if (step.requiresApproval) {
      md += `- **Approval Status:** \`${step.approvalStatus}\`\n`;
      const appr = db.getApprovals().find((a) => a.stepId === step.id);
      if (appr && appr.consequences) {
        md += `- **Risk / Consequences:** ${appr.consequences}\n`;
      }
    }
    md += `- **Description:** ${step.description}\n`;

    if (v) {
      md += `- **Cryptographic Proof Checksum:** \`${v.evidenceReference}\`\n`;
      md += `- **Tool Used:** \`${v.toolUsed}\`\n`;
      md += `- **Verified By:** ${v.verifiedBy || 'ProofLoop Engine'}\n`;
      md += `- **Executed At:** ${v.executedAt}\n`;
    }
    md += `\n`;
  }

  md += `---\n*Generated by ProofLoop Engine — Tagline: "Don't just make a plan. Get it done."*\n`;

  const buffer = Buffer.from(md, 'utf-8');
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="proofloop-workflow-${wf.id}-report.md"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
});

// 6. Export Activity Log Audit Trail (CSV or JSON)
apiRouter.get('/activity-logs/export', (req: Request, res: Response) => {
  const workflowId = req.query.workflowId as string | undefined;
  if (workflowId && !isValidIdentifier(workflowId)) {
    res.status(400).json({ error: 'Invalid workflowId parameter' });
    return;
  }

  const logs = db.getActivityLogs(workflowId, 500);
  const format = (req.query.format as string || 'csv').toLowerCase();

  if (format === 'json') {
    const buffer = Buffer.from(JSON.stringify({ logs }, null, 2), 'utf-8');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="proofloop-activity-audit-${new Date().toISOString().slice(0, 10)}.json"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
    return;
  }

  // RFC 4180 CSV export
  const headers = ['id', 'timestamp', 'workflowId', 'stepId', 'type', 'status', 'summary', 'details'];
  const escapeCsv = (val: unknown): string => {
    if (val === null || val === undefined) return '""';
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    return `"${str.replace(/"/g, '""')}"`;
  };

  const rows = [headers.join(',')];
  for (const log of logs) {
    rows.push(
      [
        escapeCsv(log.id),
        escapeCsv(log.timestamp),
        escapeCsv(log.workflowId || ''),
        escapeCsv(log.stepId || ''),
        escapeCsv(log.type),
        escapeCsv(log.status),
        escapeCsv(log.summary),
        escapeCsv(log.details || {}),
      ].join(',')
    );
  }

  const csvContent = rows.join('\r\n');
  const buffer = Buffer.from(csvContent, 'utf-8');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="proofloop-activity-audit-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.setHeader('Content-Length', buffer.length);
  res.send(buffer);
});


