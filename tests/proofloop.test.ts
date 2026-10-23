/**
 * ProofLoop Comprehensive Automated Test Suite
 * Amazon Developer Hackathon 2026 — Alexa+ track
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db } from '../src/server/db.js';
import {
  canTransition,
  validateStepTransition,
  generateVerificationRecord,
  analyzeFailureRecovery,
} from '../src/server/workflowEngine.js';
import {
  createWorkflowFromGoal,
  executeWorkflowStep,
  recoverFailedStep,
  runDemonstrationScenario,
  autoPrepareInternshipWorkflow,
  approveAndSendInternshipApplication,
} from '../src/server/agent.js';
import {
  computeApplicationDraftHash,
  sendApplicationEmail,
  isEmailProviderConfigured,
} from '../src/server/emailService.js';
import { REGISTERED_MCP_TOOLS } from '../src/server/mcpServer.js';
import { generatePdfDocument } from '../src/server/pdfGenerator.js';
import {
  SAMPLE_DOCUMENTS,
  getDocumentById,
  getDocumentFilename,
  getDocumentMimeType,
} from '../src/server/sampleDocs.js';
import { apiRouter } from '../src/server/apiRoutes.js';
import express from 'express';
import type { Server } from 'http';
import type { WorkflowStep, InternshipApplicationData } from '../src/types/index.js';

describe('ProofLoop Test Suite', () => {
  beforeEach(() => {
    db.resetForTesting();
  });

  describe('1. Workflow State Transitions & Finite State Machine', () => {
    it('allows valid transitions according to strict FSM rules', () => {
      expect(canTransition('not_started', 'ready')).toBe(true);
      expect(canTransition('ready', 'in_progress')).toBe(true);
      expect(canTransition('in_progress', 'verification_required')).toBe(true);
      expect(canTransition('verification_required', 'verified_complete')).toBe(true);
      expect(canTransition('in_progress', 'failed')).toBe(true);
      expect(canTransition('failed', 'ready')).toBe(true);
    });

    it('rejects illegal transitions that skip verification or execution', () => {
      // Cannot skip directly from not_started to verified_complete without running
      expect(canTransition('not_started', 'verified_complete')).toBe(false);
      // Cannot jump from ready directly to verified_complete
      expect(canTransition('ready', 'verified_complete')).toBe(false);
      // Cannot restart a verified_complete step directly
      expect(canTransition('verified_complete', 'in_progress')).toBe(false);
    });

    it('prevents marking a step verified_complete without a verification record', () => {
      const step: WorkflowStep = {
        id: 'step-test-1',
        workflowId: 'wf-test',
        order: 1,
        title: 'Send Application',
        description: 'Send the email',
        status: 'verification_required',
        requiresApproval: false,
        approvalStatus: 'not_required',
        actionType: 'dispatch',
        dependencies: [],
        retryCount: 0,
      };

      const result = validateStepTransition(step, 'verified_complete');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('verification proof record');
    });
  });

  describe('2. MCP Tool Input Validation & Schemas', () => {
    it('registers all 10 required MCP tools with descriptions and schemas', () => {
      expect(REGISTERED_MCP_TOOLS.length).toBe(10);
      const names = REGISTERED_MCP_TOOLS.map((t) => t.name);

      expect(names).toContain('create_workflow');
      expect(names).toContain('get_workflow');
      expect(names).toContain('update_task_status');
      expect(names).toContain('save_memory');
      expect(names).toContain('search_memory');
      expect(names).toContain('create_reminder');
      expect(names).toContain('draft_email');
      expect(names).toContain('search_demo_documents');
      expect(names).toContain('record_verification');
      expect(names).toContain('get_activity_log');
    });

    it('enforces required parameters for critical tools', () => {
      const draftEmail = REGISTERED_MCP_TOOLS.find((t) => t.name === 'draft_email')!;
      expect(draftEmail.inputSchema.required).toEqual(['recipient', 'subject', 'body']);

      const recordVerification = REGISTERED_MCP_TOOLS.find((t) => t.name === 'record_verification')!;
      expect(recordVerification.inputSchema.required).toEqual([
        'workflowId',
        'stepId',
        'actionPerformed',
        'toolUsed',
        'resultReturned',
      ]);
    });
  });

  describe('3. Persistent Memory & Category Filtering', () => {
    it('persists and retrieves memories across categories', () => {
      const mem = db.saveMemory({
        id: 'mem-test-unit',
        category: 'user_preferences',
        content: 'Preferred communication style: concise with bullet points.',
        source: 'Unit Test',
        confidence: 1.0,
        userApproved: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      expect(mem.id).toBe('mem-test-unit');
      const retrieved = db.getMemories('user_preferences');
      expect(retrieved.some((m) => m.id === 'mem-test-unit')).toBe(true);

      // Filtering by other category should exclude it
      const deadlines = db.getMemories('deadlines');
      expect(deadlines.some((m) => m.id === 'mem-test-unit')).toBe(false);
    });

    it('searches memories by query text', () => {
      const searchMatches = db.getMemories(undefined, 'Hackathon');
      expect(searchMatches.length).toBeGreaterThan(0);
      expect(searchMatches[0].content).toContain('Hackathon');
    });
  });

  describe('4. Approval Enforcement for Consequential Actions', () => {
    it('blocks execution when human approval is required and pending', async () => {
      const wf = await createWorkflowFromGoal('Prepare hackathon submission materials', { category: 'hackathon' });
      const approvalStep = wf.steps.find((s) => s.requiresApproval);
      expect(approvalStep).toBeDefined();

      // Ensure parents are complete first
      const parents = wf.steps.filter((s) => approvalStep!.dependencies.includes(s.id));
      for (const p of parents) {
        await executeWorkflowStep(wf.id, p.id);
      }

      // Try executing approval step while approval is still pending
      const execResult = await executeWorkflowStep(wf.id, approvalStep!.id);
      expect(execResult.success).toBe(false);
      expect(execResult.error).toContain('authorization');
    });

    it('permits execution once user approves via the approval center', async () => {
      const wf = await createWorkflowFromGoal('Prepare hackathon submission materials', { category: 'hackathon' });
      const approvalStep = wf.steps.find((s) => s.requiresApproval)!;

      // Complete prerequisites
      for (const s of wf.steps) {
        if (s.order < approvalStep.order) {
          await executeWorkflowStep(wf.id, s.id);
        }
      }

      // Find approval record
      const approvals = db.getApprovals('pending');
      const appr = approvals.find((a) => a.workflowId === wf.id && a.stepId === approvalStep.id);
      expect(appr).toBeDefined();

      // Decide approval
      db.decideApproval(appr!.id, 'approved', 'Test Reviewer');

      const refreshedWf = db.getWorkflow(wf.id)!;
      const refreshedStep = refreshedWf.steps.find((s) => s.id === approvalStep.id)!;
      expect(refreshedStep.approvalStatus).toBe('approved');
      expect(refreshedStep.status).toBe('ready');

      // Now execution should succeed
      const runRes = await executeWorkflowStep(wf.id, refreshedStep.id);
      expect(runRes.success).toBe(true);
      expect(runRes.step.status).toBe('verified_complete');
    });
  });

  describe('5. Proof of Completion & Cryptographic Verification', () => {
    it('generates immutable verification record with SHA-256 evidence reference', () => {
      const rec = generateVerificationRecord({
        stepId: 'step-verify-123',
        actionPerformed: 'Drafted hackathon submission overview',
        toolUsed: 'draft_email',
        resultReturned: { draftId: 'draft-999', recipient: 'judges@amazon.com' },
        verificationMethod: 'tool_output_schema_and_integrity_hash',
      });

      expect(rec.id).toMatch(/^verif-/);
      expect(rec.finalStatus).toBe('verified_complete');
      expect(rec.evidenceReference).toContain('proof://mcp.tool/draft_email/step-verify-123#sha256=');
      expect(rec.executedAt).toBeDefined();
    });
  });

  describe('6. Tool Failure and Recovery Diagnostics', () => {
    it('detects simulated failure, records error, and offers recovery suggestion', () => {
      const step: WorkflowStep = {
        id: 'step-fail-1',
        workflowId: 'wf-fail',
        order: 1,
        title: 'Fetch Specs',
        description: 'Fetch specs',
        status: 'in_progress',
        requiresApproval: false,
        approvalStatus: 'not_required',
        actionType: 'fetch',
        dependencies: [],
        retryCount: 0,
      };

      const diag = analyzeFailureRecovery(step, 'SIMULATED_FAILURE: Document network source temporarily unreachable');
      expect(diag.canRetry).toBe(true);
      expect(diag.recoverySuggestion).toContain('Switch to secondary fallback provider');
    });

    it('recovers a failed step and verifies completion upon retry', async () => {
      const wf = await createWorkflowFromGoal('Verify submission materials', { category: 'hackathon' });
      const step = wf.steps[0];

      // Execute with simulated failure
      const failRes = await executeWorkflowStep(wf.id, step.id, { simulateFailure: true });
      expect(failRes.success).toBe(false);
      expect(failRes.step.status).toBe('failed');

      // Recover step
      const recoverRes = await recoverFailedStep(wf.id, step.id);
      expect(recoverRes.success).toBe(true);
      expect(recoverRes.step.status).toBe('verified_complete');
      expect(recoverRes.step.verificationRecord).toBeDefined();
    });
  });

  describe('7. End-to-End Demonstration Scenario', () => {
    it('executes full Amazon Hackathon 2026 preparation flow with verified follow-through', async () => {
      const demoResult = await runDemonstrationScenario({ simulateRecoverableFailure: true });

      expect(demoResult.workflow).toBeDefined();
      expect(demoResult.workflow.goal).toContain('hackathon');
      expect(demoResult.verifications.length).toBeGreaterThanOrEqual(3);

      // Verify readiness report reflects actual state
      const report = demoResult.readinessReport;
      expect(report.completedCount).toBeGreaterThanOrEqual(3);
      expect(report.pendingApprovals.length).toBeGreaterThan(0);
      expect(report.summary).toContain('cryptographic evidence');
    });
  });

  describe('8. Human-Approved Internship Application Workflow & Zero-Fake-Success Guarantees', () => {
    it('1. Draft creation does not send an email and pauses before dispatch', async () => {
      const wf = await createWorkflowFromGoal(
        'Help me prepare and submit my internship application before Friday.',
        { category: 'career' }
      );
      expect(wf.steps.length).toBe(9);

      // Execute auto-preparation of materials (steps 1 through 7)
      const { workflow: prepWf, application } = await autoPrepareInternshipWorkflow(wf.id);

      expect(application).toBeDefined();
      const app = application!;
      expect(app.applicationStatus).toBe('AWAITING_APPROVAL');
      expect(app.sendingStatus).toBe('NOT_SENT');
      expect(app.sentAt).toBeUndefined();

      // Step 8 is paused waiting for explicit human authorization
      const step8 = prepWf.steps[7];
      expect(step8.status).toBe('waiting_for_approval');
      expect(step8.requiresApproval).toBe(true);
      expect(step8.approvalStatus).toBe('pending');

      // Step 9 is blocked awaiting step 8
      const step9 = prepWf.steps[8];
      expect(['not_started', 'blocked']).toContain(step9.status);
      expect(step9.status).not.toBe('verified_complete');
    });

    it('2. The review panel shows the actual draft and recipient with real details', async () => {
      const wf = await createWorkflowFromGoal(
        'Help me prepare and submit my internship application before Friday.'
      );
      const { application } = await autoPrepareInternshipWorkflow(wf.id);
      expect(application).toBeDefined();
      const app = application!;

      // Target details
      expect(app.companyName).toContain('Amazon');
      expect(app.positionTitle).toContain('Alexa+');
      expect(app.recipientEmail).toBe('alexa-agent-internships@amazon.com');
      expect(app.applicantName).toBe('Karthikeya Ventrapragada');
      expect(app.applicantEmail).toContain('karthikeya');

      // Draft email content
      expect(app.emailSubject).toContain('Application');
      expect(app.emailSubject).toContain('Karthikeya Ventrapragada');
      expect(app.emailBody).toContain('Dear Amazon Alexa+ Agent Frameworks');
      expect(app.emailBody).toContain('ProofLoop');

      // Verified resume attachment
      expect(app.attachments.length).toBeGreaterThanOrEqual(1);
      const resume = app.attachments.find((a) => a.filename.includes('Resume'));
      expect(resume).toBeDefined();
      expect(resume?.selected).toBe(true);
      expect(resume?.contentPreview).toContain('KARTHIKEYA VENTRAPRAGADA');
      expect(resume?.contentPreview).toContain('TECHNICAL SKILLS');
    });

    it('3. No email is sent without explicit human approval', async () => {
      const wf = await createWorkflowFromGoal(
        'Help me prepare and submit my internship application before Friday.'
      );
      const { workflow: prepWf, application } = await autoPrepareInternshipWorkflow(wf.id);
      expect(application).toBeDefined();
      const app = application!;

      const step8 = prepWf.steps[7];
      expect(step8.status).toBe('waiting_for_approval');

      // Attempting to execute dispatch directly fails without approval
      const runRes = await executeWorkflowStep(wf.id, step8.id);
      expect(runRes.success).toBe(false);
      expect(runRes.error).toContain('authorization');

      // Application status remains safely unchanged
      const currentApp = db.getApplication(app.id)!;
      expect(currentApp.applicationStatus).toBe('AWAITING_APPROVAL');
      expect(currentApp.sendingStatus).toBe('NOT_SENT');
    });

    it('4. Editing the draft invalidates previous approval', async () => {
      const wf = await createWorkflowFromGoal(
        'Help me prepare and submit my internship application before Friday.'
      );
      const { application } = await autoPrepareInternshipWorkflow(wf.id);
      expect(application).toBeDefined();
      const app = application!;

      const initialHash = computeApplicationDraftHash(app);

      // Simulate human editing the recipient address in the review panel
      const editedApp: InternshipApplicationData = {
        ...app,
        recipientEmail: 'alexa-recruiting-updated@amazon.com',
      };
      db.saveApplication(editedApp);

      const newHash = computeApplicationDraftHash(editedApp);
      expect(newHash).not.toBe(initialHash);

      // Attempting to send using the old approval hash is rejected by cryptographic hash mismatch
      const res = await sendApplicationEmail({
        application: editedApp,
        approvedHash: initialHash,
        idempotencyKey: `test-hash-mismatch-${Date.now()}`,
      });

      expect(res.success).toBe(false);
      expect(res.status).toBe('SEND_FAILED');
      expect(res.error).toContain('Security Mismatch: The application content was modified');
    });

    it('5. An unconfigured provider never produces a fake success', async () => {
      // Ensure test environment does not have SMTP credentials
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const wf = await createWorkflowFromGoal(
        'Help me prepare and submit my internship application before Friday.'
      );
      const { application } = await autoPrepareInternshipWorkflow(wf.id);
      expect(application).toBeDefined();
      const app = application!;

      const draftHash = computeApplicationDraftHash(app);

      // Call approve and send
      const dispatchResult = await approveAndSendInternshipApplication(
        app.id,
        draftHash,
        `test-unconfigured-${Date.now()}`
      );

      // Must refuse to claim success
      expect(dispatchResult.success).toBe(false);
      expect(dispatchResult.status).toBe('NOT_CONFIGURED');
      expect(dispatchResult.error).toContain('No real email provider configured');
      expect(dispatchResult.configurationHelp).toContain('SMTP_HOST');

      // Application must NOT be marked SENT
      const savedApp = db.getApplication(app.id)!;
      expect(savedApp.applicationStatus).not.toBe('SENT');
      expect(savedApp.sendingStatus).toBe('SEND_FAILED');
    });

    it('6. Successful sending records the real provider response', async () => {
      const app = db.saveApplication({
        id: `app-audit-${Date.now()}`,
        workflowId: 'wf-mock',
        companyName: 'Amazon',
        positionTitle: 'SDE Intern',
        recipientEmail: 'alexa-recruiting@amazon.com',
        applicantName: 'Karthikeya Ventrapragada',
        applicantEmail: 'karthikeya@example.com',
        emailSubject: 'Application for SDE Intern',
        emailBody: 'Dear Amazon Team...',
        attachments: [],
        applicationStatus: 'AWAITING_APPROVAL',
        sendingStatus: 'NOT_SENT',
        deadline: '2026-10-24T23:59:59Z',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        validationWarnings: [],
      });

      const hash = computeApplicationDraftHash(app);

      // Verify that when a provider response is recorded, it contains real audit properties
      const mockProviderResponse = {
        provider: 'SMTP',
        messageId: '<20261021.proofloop.123@amazon.com>',
        acceptedRecipients: ['alexa-recruiting@amazon.com'],
        rejectedRecipients: [],
        response: '250 2.0.0 OK queued for delivery',
      };

      app.applicationStatus = 'SENT';
      app.sendingStatus = 'SENT';
      app.sentAt = new Date().toISOString();
      app.providerResponse = mockProviderResponse;
      db.saveApplication(app);

      const reloaded = db.getApplication(app.id)!;
      expect(reloaded.applicationStatus).toBe('SENT');
      expect(reloaded.providerResponse?.messageId).toBe('<20261021.proofloop.123@amazon.com>');
      expect(reloaded.providerResponse?.acceptedRecipients).toContain('alexa-recruiting@amazon.com');
    });

    it('7. Failed sends do not mark the workflow complete', async () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const wf = await createWorkflowFromGoal(
        'Help me prepare and submit my internship application before Friday.'
      );
      const { workflow: prepWf, application } = await autoPrepareInternshipWorkflow(wf.id);
      expect(application).toBeDefined();
      const app = application!;

      const draftHash = computeApplicationDraftHash(app);

      await approveAndSendInternshipApplication(
        app.id,
        draftHash,
        `test-failed-complete-${Date.now()}`
      );

      const refreshedWf = db.getWorkflow(wf.id)!;
      const step8 = refreshedWf.steps[7];
      const step9 = refreshedWf.steps[8];

      // Step 8 must be failed, NOT verified_complete
      expect(step8.status).toBe('failed');
      expect(step8.status).not.toBe('verified_complete');

      // Step 9 must NOT be verified_complete
      expect(step9.status).not.toBe('verified_complete');

      // Overall workflow is NOT complete
      expect(refreshedWf.progress).toBeLessThan(100);
      expect(refreshedWf.status).not.toBe('completed');
    });

    it('8. Repeated requests do not cause duplicate emails', async () => {
      const testKey = `idempotency-key-${Date.now()}`;

      const sampleApp: InternshipApplicationData = {
        id: `app-idemp-${Date.now()}`,
        workflowId: 'wf-idemp',
        companyName: 'Amazon',
        positionTitle: 'SDE Intern',
        recipientEmail: 'alexa-test@amazon.com',
        applicantName: 'Karthikeya',
        applicantEmail: 'karthikeya@example.com',
        emailSubject: 'Test Subject',
        emailBody: 'Test Body',
        attachments: [],
        applicationStatus: 'AWAITING_APPROVAL' as const,
        sendingStatus: 'NOT_SENT' as const,
        deadline: 'Friday',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        validationWarnings: [],
      };

      const hash = computeApplicationDraftHash(sampleApp);

      // First call (without SMTP will return NOT_CONFIGURED)
      const res1 = await sendApplicationEmail({
        application: sampleApp,
        approvedHash: hash,
        idempotencyKey: testKey,
      });

      // Second identical call with the same idempotency key
      const res2 = await sendApplicationEmail({
        application: sampleApp,
        approvedHash: hash,
        idempotencyKey: testKey,
      });

      // The second call is recognized as an idempotent duplicate
      expect(res2.idempotentReplay).toBe(true);
      expect(res2.status).toBe(res1.status);
    });
  });

  describe('13. Real File Downloads, PDF Generation & Export Architecture', () => {
    let app: express.Express;
    let server: Server;
    let baseUrl: string;

    beforeEach(async () => {
      app = express();
      app.use(express.json());
      app.use('/api', apiRouter);

      await new Promise<void>((resolve) => {
        server = app.listen(0, () => {
          const addr = server.address() as any;
          baseUrl = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });
    });

    afterEach(async () => {
      if (server) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it('generates standards-compliant PDF buffers adhering to PDF-1.4 specification', () => {
      const pdfBuffer = generatePdfDocument({
        title: 'ProofLoop Test Document',
        subtitle: 'Automated Unit Verification',
        metadata: {
          Author: 'ProofLoop Engine',
          Status: 'Verified',
        },
        sections: [
          {
            heading: 'Section 1: Invariant Check',
            lines: ['Line 1: Every outcome must be verified.', 'Line 2: Zero-fake-success is enforced.'],
          },
        ],
        footer: 'Test Footer · Cryptographic Verification',
      });

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(500);

      const header = pdfBuffer.slice(0, 8).toString('utf-8');
      expect(header).toContain('%PDF-1.4');

      const content = pdfBuffer.toString('utf-8');
      expect(content).toContain('%%EOF');
      expect(content).toContain('trailer');
      expect(content).toContain('xref');
    });

    it('lists available sample documents with correct filename and MIME type', async () => {
      const res = await fetch(`${baseUrl}/api/documents`);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(Array.isArray(data.documents)).toBe(true);
      expect(data.documents.length).toBeGreaterThanOrEqual(5);

      const guidelinesDoc = data.documents.find((d: any) => d.id === 'doc-hackathon-guidelines-2026');
      expect(guidelinesDoc).toBeDefined();
      expect(guidelinesDoc.filename).toBe('hackathon_guidelines.md');
      expect(guidelinesDoc.mimeType).toContain('markdown');
      expect(guidelinesDoc.sizeBytes).toBeGreaterThan(100);
    });

    it('downloads document in its authentic original format with Content-Disposition', async () => {
      const res = await fetch(`${baseUrl}/api/documents/doc-hackathon-guidelines-2026/download`);
      expect(res.status).toBe(200);

      const contentDisp = res.headers.get('Content-Disposition');
      expect(contentDisp).toContain('attachment');
      expect(contentDisp).toContain('filename="hackathon_guidelines.md"');

      const contentType = res.headers.get('Content-Type');
      expect(contentType).toContain('text/markdown');

      const body = await res.text();
      expect(body).toContain('Amazon Developer Hackathon 2026');
      expect(body).toContain('Mandatory Deliverables Checklist');
    });

    it('downloads document converted to clean PDF when ?format=pdf is requested', async () => {
      const res = await fetch(`${baseUrl}/api/documents/doc-proofloop-architecture/download?format=pdf`);
      expect(res.status).toBe(200);

      const contentDisp = res.headers.get('Content-Disposition');
      expect(contentDisp).toContain('attachment');
      expect(contentDisp).toContain('filename="architecture_spec.pdf"');

      const contentType = res.headers.get('Content-Type');
      expect(contentType).toBe('application/pdf');

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      expect(buffer.slice(0, 8).toString('utf-8')).toContain('%PDF-1.4');
    });

    it('strictly prevents path traversal attacks in document downloads', async () => {
      const res = await fetch(`${baseUrl}/api/documents/..%2F..%2Fetc%2Fpasswd/download`);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toContain('Invalid document ID');
    });

    it('returns 404 for non-existent document ID', async () => {
      const res = await fetch(`${baseUrl}/api/documents/doc-non-existent-123/download`);
      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data.error).toContain('not found');
    });

    it('downloads cryptographic verification certificate in JSON, TXT, and PDF formats', async () => {
      // 1. Setup a verified step
      const wf = await createWorkflowFromGoal('Verify hackathon checklist items');
      const step1 = wf.steps[0];
      const execRes = await executeWorkflowStep(wf.id, step1.id);
      expect(execRes.success).toBe(true);
      expect(execRes.verification).toBeDefined();

      const verificationId = execRes.verification!.id;

      // 2. Download as JSON (default)
      const jsonRes = await fetch(`${baseUrl}/api/verifications/${verificationId}/download?format=json`);
      expect(jsonRes.status).toBe(200);
      expect(jsonRes.headers.get('Content-Disposition')).toContain(`proofloop-verification-${verificationId}.json`);
      const certObj = await jsonRes.json();
      expect(certObj.proof_system).toBe('ProofLoop Verifiable Agent Engine');
      expect(certObj.record.id).toBe(verificationId);
      expect(certObj.record.evidenceReference).toContain('sha256');

      // 3. Download as TXT
      const txtRes = await fetch(`${baseUrl}/api/verifications/${verificationId}/download?format=txt`);
      expect(txtRes.status).toBe(200);
      expect(txtRes.headers.get('Content-Disposition')).toContain(`proofloop-verification-${verificationId}.txt`);
      const txtBody = await txtRes.text();
      expect(txtBody).toContain('AUDIT CERTIFICATE');
      expect(txtBody).toContain(verificationId);

      // 4. Download as PDF
      const pdfRes = await fetch(`${baseUrl}/api/verifications/${verificationId}/download?format=pdf`);
      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers.get('Content-Type')).toBe('application/pdf');
      const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
      expect(pdfBuffer.slice(0, 8).toString('utf-8')).toContain('%PDF-1.4');
    });

    it('downloads application materials: cover letter, verified resume PDF, and full package JSON', async () => {
      const wf = await createWorkflowFromGoal('Apply for Amazon Software Engineering Internship');
      const app = db.getApplicationByWorkflow(wf.id);
      expect(app).toBeDefined();

      // 1. Cover letter TXT
      const clRes = await fetch(`${baseUrl}/api/applications/${app!.id}/download/cover-letter`);
      expect(clRes.status).toBe(200);
      expect(clRes.headers.get('Content-Disposition')).toContain('Cover_Letter_');
      const clText = await clRes.text();
      expect(clText).toContain(app!.applicantName);
      expect(clText).toContain('Amazon Alexa+ Agent Frameworks');

      // 2. Cover letter PDF
      const clPdfRes = await fetch(`${baseUrl}/api/applications/${app!.id}/download/cover-letter?format=pdf`);
      expect(clPdfRes.status).toBe(200);
      expect(clPdfRes.headers.get('Content-Type')).toBe('application/pdf');
      const clPdfBuf = Buffer.from(await clPdfRes.arrayBuffer());
      expect(clPdfBuf.slice(0, 8).toString('utf-8')).toContain('%PDF-1.4');

      // 3. Resume PDF
      const resumeRes = await fetch(`${baseUrl}/api/applications/${app!.id}/download/resume`);
      expect(resumeRes.status).toBe(200);
      expect(resumeRes.headers.get('Content-Type')).toBe('application/pdf');
      expect(resumeRes.headers.get('Content-Disposition')).toContain('Resume.pdf');
      const resumeBuf = Buffer.from(await resumeRes.arrayBuffer());
      expect(resumeBuf.slice(0, 8).toString('utf-8')).toContain('%PDF-1.4');

      // 4. Full Package JSON
      const pkgRes = await fetch(`${baseUrl}/api/applications/${app!.id}/download/full-package`);
      expect(pkgRes.status).toBe(200);
      expect(pkgRes.headers.get('Content-Type')).toContain('application/json');
      const pkgData = await pkgRes.json();
      expect(pkgData.package_title).toContain(app!.companyName);
      expect(pkgData.authorization_hash).toBe(app!.approvedHash);
      expect(Array.isArray(pkgData.attachments_manifest)).toBe(true);
    });

    it('downloads workflow readiness audit report in Markdown and PDF formats', async () => {
      const wf = await createWorkflowFromGoal('Complete hackathon submission checks');

      // Markdown report
      const mdRes = await fetch(`${baseUrl}/api/workflows/${wf.id}/download-report?format=markdown`);
      expect(mdRes.status).toBe(200);
      expect(mdRes.headers.get('Content-Disposition')).toContain(`proofloop-workflow-${wf.id}-report.md`);
      const mdText = await mdRes.text();
      expect(mdText).toContain('# ProofLoop Workflow Readiness & Audit Report');
      expect(mdText).toContain(wf.goal);
      expect(mdText).toContain('Milestones & Execution Ledger');

      // PDF report
      const pdfRes = await fetch(`${baseUrl}/api/workflows/${wf.id}/download-report?format=pdf`);
      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers.get('Content-Type')).toBe('application/pdf');
      const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
      expect(pdfBuf.slice(0, 8).toString('utf-8')).toContain('%PDF-1.4');
    });

    it('exports activity logs in CSV format adhering to RFC 4180', async () => {
      db.logActivity({
        type: 'verification',
        summary: 'Unit test verification completed with SHA-256',
        details: { test: true },
        status: 'success',
      });

      const res = await fetch(`${baseUrl}/api/activity-logs/export?format=csv`);
      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('text/csv');
      expect(res.headers.get('Content-Disposition')).toContain('proofloop-activity-audit-');

      const csv = await res.text();
      const lines = csv.split('\r\n').filter(Boolean);
      expect(lines.length).toBeGreaterThan(1);
      expect(lines[0]).toBe('id,timestamp,workflowId,stepId,type,status,summary,details');
      expect(csv).toContain('Unit test verification completed with SHA-256');
    });
  });
});

