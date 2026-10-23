/**
 * ProofLoop Persistence Layer
 * Real SQLite storage engine using sql.js with binary disk persistence (data/proofloop.sqlite).
 * Amazon Developer Hackathon 2026 — Alexa+ track
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import type {
  Workflow,
  WorkflowStep,
  MemoryRecord,
  ApprovalRecord,
  Reminder,
  VerificationRecord,
  ActivityLogEntry,
  TaskStatus,
  ApprovalStatus,
  MemoryCategory,
  InternshipApplicationData,
} from '../types/index.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const SQLITE_FILE = path.join(DATA_DIR, 'proofloop.sqlite');
const BACKUP_JSON = path.join(DATA_DIR, 'proofloop_store.json');

class ProofLoopSqliteDatabase {
  private sqlDb: SqlJsDatabase | null = null;
  private isReady = false;
  private initPromise: Promise<void>;

  // In-memory cache for ultra-fast reads & synchronous API
  private memoryCache: {
    workflows: Record<string, Workflow>;
    memories: Record<string, MemoryRecord>;
    approvals: Record<string, ApprovalRecord>;
    reminders: Record<string, Reminder>;
    verifications: Record<string, VerificationRecord>;
    activityLogs: ActivityLogEntry[];
    applications: Record<string, InternshipApplicationData>;
  } = {
    workflows: {},
    memories: {},
    approvals: {},
    reminders: {},
    verifications: {},
    activityLogs: [],
    applications: {},
  };

  constructor() {
    this.initPromise = this.init();
  }

  public async ready(): Promise<void> {
    return this.initPromise;
  }

  private async init() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      const SQL = await initSqlJs();

      // Check if existing SQLite file exists
      if (fs.existsSync(SQLITE_FILE)) {
        try {
          const fileBuffer = fs.readFileSync(SQLITE_FILE);
          this.sqlDb = new SQL.Database(fileBuffer);
        } catch (e) {
          console.warn('[SQLite] Could not read existing binary sqlite file, creating fresh:', e);
          this.sqlDb = new SQL.Database();
        }
      } else {
        this.sqlDb = new SQL.Database();
      }

      this.createTables();

      // Load existing records from SQLite into memory cache
      this.hydrateFromSqlite();

      // If empty, check backup json or seed initial data
      if (Object.keys(this.memoryCache.memories).length === 0) {
        if (fs.existsSync(BACKUP_JSON)) {
          try {
            const raw = JSON.parse(fs.readFileSync(BACKUP_JSON, 'utf-8'));
            this.memoryCache = {
              workflows: raw.workflows || {},
              memories: raw.memories || {},
              approvals: raw.approvals || {},
              reminders: raw.reminders || {},
              verifications: raw.verifications || {},
              activityLogs: raw.activityLogs || [],
              applications: raw.applications || {},
            };
            this.syncCacheToSqlite();
          } catch {
            this.seedInitialData();
          }
        } else {
          this.seedInitialData();
        }
      }

      this.flushToDisk();
      this.isReady = true;
      if (typeof process !== 'undefined') {
        process.once('beforeExit', () => this.flushToDisk());
      }
      console.log('[SQLite] Persistent SQLite database initialized successfully at data/proofloop.sqlite');
    } catch (err) {
      console.error('[SQLite] Initialization error, falling back to in-memory state:', err);
      this.seedInitialData();
      this.isReady = true;
    }
  }

  private createTables() {
    if (!this.sqlDb) return;

    this.sqlDb.run(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        goal TEXT NOT NULL,
        category TEXT,
        deadline TEXT,
        status TEXT,
        progress INTEGER,
        summary TEXT,
        created_at TEXT,
        updated_at TEXT,
        raw_json TEXT
      );

      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT,
        confidence REAL,
        user_approved INTEGER,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        workflow_id TEXT,
        step_id TEXT,
        action_type TEXT,
        action_description TEXT,
        risk_level TEXT,
        consequences TEXT,
        preview_data TEXT,
        status TEXT,
        requested_at TEXT,
        decided_at TEXT,
        decided_by TEXT
      );

      CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        target_time TEXT NOT NULL,
        associated_workflow_id TEXT,
        status TEXT,
        scheduled_in_backend INTEGER,
        created_at TEXT,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS verifications (
        id TEXT PRIMARY KEY,
        step_id TEXT NOT NULL,
        action_performed TEXT,
        executed_at TEXT,
        tool_used TEXT,
        result_returned TEXT,
        verification_method TEXT,
        evidence_reference TEXT,
        final_status TEXT,
        notes TEXT,
        verified_by TEXT
      );

      CREATE TABLE IF NOT EXISTS activity_logs (
        id TEXT PRIMARY KEY,
        workflow_id TEXT,
        step_id TEXT,
        event_type TEXT,
        timestamp TEXT,
        summary TEXT,
        details TEXT,
        status TEXT
      );

      CREATE TABLE IF NOT EXISTS internship_applications (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        raw_json TEXT NOT NULL
      );
    `);
  }

  private hydrateFromSqlite() {
    if (!this.sqlDb) return;

    try {
      // Applications
      const internshipAppResults = this.sqlDb.exec('SELECT raw_json FROM internship_applications');
      if (internshipAppResults.length > 0 && internshipAppResults[0].values) {
        for (const row of internshipAppResults[0].values) {
          if (row[0]) {
            const app = JSON.parse(row[0] as string);
            this.memoryCache.applications[app.id] = app;
          }
        }
      }
      // Workflows
      const wfResults = this.sqlDb.exec('SELECT raw_json FROM workflows');
      if (wfResults.length > 0 && wfResults[0].values) {
        for (const row of wfResults[0].values) {
          if (row[0]) {
            const wf = JSON.parse(row[0] as string);
            this.memoryCache.workflows[wf.id] = wf;
          }
        }
      }

      // Memories
      const memResults = this.sqlDb.exec(
        'SELECT id, category, content, source, confidence, user_approved, created_at, updated_at FROM memories'
      );
      if (memResults.length > 0 && memResults[0].values) {
        for (const row of memResults[0].values) {
          const m: MemoryRecord = {
            id: row[0] as string,
            category: row[1] as MemoryCategory,
            content: row[2] as string,
            source: (row[3] as string) || 'Database',
            confidence: Number(row[4] ?? 1.0),
            userApproved: Boolean(row[5]),
            createdAt: row[6] as string,
            updatedAt: row[7] as string,
          };
          this.memoryCache.memories[m.id] = m;
        }
      }

      // Approvals
      const appResults = this.sqlDb.exec(
        'SELECT id, workflow_id, step_id, action_type, action_description, risk_level, consequences, preview_data, status, requested_at, decided_at, decided_by FROM approvals'
      );
      if (appResults.length > 0 && appResults[0].values) {
        for (const row of appResults[0].values) {
          const a: ApprovalRecord = {
            id: row[0] as string,
            workflowId: row[1] as string,
            stepId: row[2] as string,
            actionType: row[3] as string,
            actionDescription: row[4] as string,
            riskLevel: row[5] as any,
            consequences: row[6] as string,
            previewData: row[7] ? JSON.parse(row[7] as string) : {},
            status: row[8] as any,
            requestedAt: row[9] as string,
            decidedAt: (row[10] as string) || undefined,
            decidedBy: (row[11] as string) || undefined,
          };
          this.memoryCache.approvals[a.id] = a;
        }
      }

      // Reminders
      const remResults = this.sqlDb.exec(
        'SELECT id, title, target_time, associated_workflow_id, status, scheduled_in_backend, created_at, notes FROM reminders'
      );
      if (remResults.length > 0 && remResults[0].values) {
        for (const row of remResults[0].values) {
          const r: Reminder = {
            id: row[0] as string,
            title: row[1] as string,
            targetTime: row[2] as string,
            associatedWorkflowId: (row[3] as string) || undefined,
            status: row[4] as any,
            scheduledInBackend: Boolean(row[5]),
            createdAt: row[6] as string,
            notes: (row[7] as string) || undefined,
          };
          this.memoryCache.reminders[r.id] = r;
        }
      }

      // Verifications
      const verResults = this.sqlDb.exec(
        'SELECT id, step_id, action_performed, executed_at, tool_used, result_returned, verification_method, evidence_reference, final_status, notes, verified_by FROM verifications'
      );
      if (verResults.length > 0 && verResults[0].values) {
        for (const row of verResults[0].values) {
          const v: VerificationRecord = {
            id: row[0] as string,
            stepId: row[1] as string,
            actionPerformed: row[2] as string,
            executedAt: row[3] as string,
            toolUsed: row[4] as string,
            resultReturned: row[5] ? JSON.parse(row[5] as string) : {},
            verificationMethod: row[6] as string,
            evidenceReference: row[7] as string,
            finalStatus: row[8] as any,
            notes: (row[9] as string) || undefined,
            verifiedBy: (row[10] as string) || undefined,
          };
          this.memoryCache.verifications[v.id] = v;
        }
      }

      // Activity logs
      const logResults = this.sqlDb.exec(
        'SELECT id, workflow_id, step_id, event_type, timestamp, summary, details, status FROM activity_logs ORDER BY timestamp DESC LIMIT 200'
      );
      if (logResults.length > 0 && logResults[0].values) {
        for (const row of logResults[0].values) {
          const l: ActivityLogEntry = {
            id: row[0] as string,
            workflowId: (row[1] as string) || undefined,
            stepId: (row[2] as string) || undefined,
            type: row[3] as any,
            timestamp: row[4] as string,
            summary: row[5] as string,
            details: row[6] ? JSON.parse(row[6] as string) : {},
            status: row[7] as any,
          };
          this.memoryCache.activityLogs.push(l);
        }
      }
    } catch (e) {
      console.warn('[SQLite] Error hydrating from tables, using initial seed:', e);
    }
  }

  private syncCacheToSqlite() {
    if (!this.sqlDb) return;

    try {
      // Workflows
      for (const wf of Object.values(this.memoryCache.workflows)) {
        this.sqlDb.run(
          `INSERT OR REPLACE INTO workflows (id, goal, category, deadline, status, progress, summary, created_at, updated_at, raw_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            wf.id,
            wf.goal,
            wf.category,
            wf.deadline || null,
            wf.status,
            wf.progress,
            wf.summary || null,
            wf.createdAt,
            wf.updatedAt,
            JSON.stringify(wf),
          ]
        );
      }

      // Memories
      for (const m of Object.values(this.memoryCache.memories)) {
        this.sqlDb.run(
          `INSERT OR REPLACE INTO memories (id, category, content, source, confidence, user_approved, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            m.id,
            m.category,
            m.content,
            m.source,
            m.confidence,
            m.userApproved ? 1 : 0,
            m.createdAt,
            m.updatedAt,
          ]
        );
      }

      // Approvals
      for (const a of Object.values(this.memoryCache.approvals)) {
        this.sqlDb.run(
          `INSERT OR REPLACE INTO approvals (id, workflow_id, step_id, action_type, action_description, risk_level, consequences, preview_data, status, requested_at, decided_at, decided_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            a.id,
            a.workflowId,
            a.stepId,
            a.actionType,
            a.actionDescription,
            a.riskLevel,
            a.consequences,
            JSON.stringify(a.previewData),
            a.status,
            a.requestedAt,
            a.decidedAt || null,
            a.decidedBy || null,
          ]
        );
      }

      // Reminders
      for (const r of Object.values(this.memoryCache.reminders)) {
        this.sqlDb.run(
          `INSERT OR REPLACE INTO reminders (id, title, target_time, associated_workflow_id, status, scheduled_in_backend, created_at, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            r.id,
            r.title,
            r.targetTime,
            r.associatedWorkflowId || null,
            r.status,
            r.scheduledInBackend ? 1 : 0,
            r.createdAt,
            r.notes || null,
          ]
        );
      }

      // Verifications
      for (const v of Object.values(this.memoryCache.verifications)) {
        this.sqlDb.run(
          `INSERT OR REPLACE INTO verifications (id, step_id, action_performed, executed_at, tool_used, result_returned, verification_method, evidence_reference, final_status, notes, verified_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            v.id,
            v.stepId,
            v.actionPerformed,
            v.executedAt,
            v.toolUsed,
            JSON.stringify(v.resultReturned),
            v.verificationMethod,
            v.evidenceReference,
            v.finalStatus,
            v.notes || null,
            v.verifiedBy || null,
          ]
        );
      }
    } catch (e) {
      console.warn('[SQLite] Error syncing cache to sqlite tables:', e);
    }
  }

  private saveTimeout: NodeJS.Timeout | null = null;
  private isDirty = false;

  public flushToDisk() {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    this.writeNow();
  }

  private saveToDisk() {
    this.isDirty = true;
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.writeNow();
    }, 40);
  }

  private writeNow() {
    if (!this.isDirty) return;
    this.isDirty = false;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      // 1. Save binary SQLite database file
      if (this.sqlDb) {
        const data = this.sqlDb.export();
        const buffer = Buffer.from(data);
        const tempSqlite = `${SQLITE_FILE}.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        fs.writeFileSync(tempSqlite, buffer);
        fs.renameSync(tempSqlite, SQLITE_FILE);
      }

      // 2. Also keep compact JSON snapshot for fast parsing and lower disk I/O
      const tempJson = `${BACKUP_JSON}.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      fs.writeFileSync(tempJson, JSON.stringify(this.memoryCache), 'utf-8');
      fs.renameSync(tempJson, BACKUP_JSON);
    } catch (err) {
      console.error('[SQLite] Failed to persist database to disk:', err);
    }
  }

  private seedInitialData() {
    const now = new Date().toISOString();

    const m1: MemoryRecord = {
      id: 'mem-alexa-hackathon-deadline',
      category: 'deadlines',
      content:
        'Amazon Developer Hackathon 2026 (Alexa+ track) submission deadline is Friday, October 24, 2026 at 11:59 PM PDT.',
      source: 'Official Guidelines Document',
      confidence: 1.0,
      userApproved: true,
      createdAt: now,
      updatedAt: now,
    };

    const m2: MemoryRecord = {
      id: 'mem-user-pref-approval',
      category: 'user_preferences',
      content:
        'Always require human approval before submitting applications, sending emails, or triggering external irreversible actions.',
      source: 'User Default Safety Setting',
      confidence: 1.0,
      userApproved: true,
      createdAt: now,
      updatedAt: now,
    };

    const m3: MemoryRecord = {
      id: 'mem-alexa-track-requirements',
      category: 'successful_strategies',
      content:
        'Alexa+ track judges heavily evaluate real MCP tool execution, verifiable outcome records, and failure recovery demonstrations.',
      source: 'Amazon Hackathon Evaluation Rubric',
      confidence: 0.95,
      userApproved: true,
      createdAt: now,
      updatedAt: now,
    };

    const m4: MemoryRecord = {
      id: 'mem-email-signature',
      category: 'user_preferences',
      content:
        'Candidate preferred signature: "Best regards, Karthikeya Ventrapragada | ProofLoop AI Engineer".',
      source: 'User Profile Settings',
      confidence: 0.9,
      userApproved: true,
      createdAt: now,
      updatedAt: now,
    };

    this.memoryCache.memories[m1.id] = m1;
    this.memoryCache.memories[m2.id] = m2;
    this.memoryCache.memories[m3.id] = m3;
    this.memoryCache.memories[m4.id] = m4;

    const rem1: Reminder = {
      id: 'rem-hackathon-final-review',
      title: 'Review Amazon Hackathon Alexa+ Submission Checklist & Verification Proofs',
      targetTime: '2026-10-24T17:00:00Z',
      status: 'pending',
      scheduledInBackend: true,
      createdAt: now,
      notes: 'Final verification run before Friday submission deadline.',
    };
    this.memoryCache.reminders[rem1.id] = rem1;

    this.memoryCache.activityLogs.push({
      id: crypto.randomUUID(),
      type: 'memory_update',
      timestamp: now,
      summary: 'System initialized with verified Hackathon 2026 guidelines and safety preferences.',
      details: { memoriesCount: 4, remindersCount: 1, storageEngine: 'SQLite' },
      status: 'info',
    });

    this.syncCacheToSqlite();
  }

  // Workflows
  getWorkflows(): Workflow[] {
    return Object.values(this.memoryCache.workflows).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getWorkflow(id: string): Workflow | undefined {
    return this.memoryCache.workflows[id];
  }

  saveWorkflow(workflow: Workflow): Workflow {
    if (workflow.steps && workflow.steps.length > 0) {
      const verified = workflow.steps.filter((s) => s.status === 'verified_complete').length;
      workflow.progress = Math.round((verified / workflow.steps.length) * 100);
      if (verified === workflow.steps.length) {
        workflow.status = 'completed';
      }
    } else {
      workflow.progress = 0;
    }

    workflow.updatedAt = new Date().toISOString();
    this.memoryCache.workflows[workflow.id] = workflow;

    if (this.sqlDb) {
      try {
        this.sqlDb.run(
          `INSERT OR REPLACE INTO workflows (id, goal, category, deadline, status, progress, summary, created_at, updated_at, raw_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            workflow.id,
            workflow.goal,
            workflow.category,
            workflow.deadline || null,
            workflow.status,
            workflow.progress,
            workflow.summary || null,
            workflow.createdAt,
            workflow.updatedAt,
            JSON.stringify(workflow),
          ]
        );
      } catch (e) {
        console.warn('[SQLite] Error writing workflow to table:', e);
      }
    }

    this.saveToDisk();
    return workflow;
  }

  deleteWorkflow(id: string): boolean {
    if (this.memoryCache.workflows[id]) {
      delete this.memoryCache.workflows[id];
      if (this.sqlDb) {
        try {
          this.sqlDb.run('DELETE FROM workflows WHERE id = ?', [id]);
        } catch {}
      }
      this.saveToDisk();
      return true;
    }
    return false;
  }

  updateWorkflowStep(
    workflowId: string,
    stepId: string,
    updater: (step: WorkflowStep) => WorkflowStep
  ): WorkflowStep | undefined {
    const wf = this.memoryCache.workflows[workflowId];
    if (!wf) return undefined;

    const stepIndex = wf.steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) return undefined;

    const updatedStep = updater(wf.steps[stepIndex]);
    wf.steps[stepIndex] = updatedStep;
    this.saveWorkflow(wf);
    return updatedStep;
  }

  // Memories
  getMemories(category?: MemoryCategory, query?: string): MemoryRecord[] {
    let list = Object.values(this.memoryCache.memories);
    if (category) {
      list = list.filter((m) => m.category === category);
    }
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (m) => m.content.toLowerCase().includes(q) || m.source.toLowerCase().includes(q)
      );
    }
    return list.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  getMemory(id: string): MemoryRecord | undefined {
    return this.memoryCache.memories[id];
  }

  saveMemory(record: MemoryRecord): MemoryRecord {
    record.updatedAt = new Date().toISOString();
    this.memoryCache.memories[record.id] = record;

    if (this.sqlDb) {
      try {
        this.sqlDb.run(
          `INSERT OR REPLACE INTO memories (id, category, content, source, confidence, user_approved, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            record.id,
            record.category,
            record.content,
            record.source,
            record.confidence,
            record.userApproved ? 1 : 0,
            record.createdAt,
            record.updatedAt,
          ]
        );
      } catch (e) {
        console.warn('[SQLite] Error writing memory to table:', e);
      }
    }

    this.saveToDisk();
    return record;
  }

  deleteMemory(id: string): boolean {
    if (this.memoryCache.memories[id]) {
      delete this.memoryCache.memories[id];
      if (this.sqlDb) {
        try {
          this.sqlDb.run('DELETE FROM memories WHERE id = ?', [id]);
        } catch {}
      }
      this.saveToDisk();
      return true;
    }
    return false;
  }

  // Approvals
  getApprovals(status?: 'pending' | 'approved' | 'rejected'): ApprovalRecord[] {
    let list = Object.values(this.memoryCache.approvals);
    if (status) {
      list = list.filter((a) => a.status === status);
    }
    return list.sort(
      (a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
    );
  }

  getApproval(id: string): ApprovalRecord | undefined {
    return this.memoryCache.approvals[id];
  }

  saveApproval(approval: ApprovalRecord): ApprovalRecord {
    this.memoryCache.approvals[approval.id] = approval;

    if (this.sqlDb) {
      try {
        this.sqlDb.run(
          `INSERT OR REPLACE INTO approvals (id, workflow_id, step_id, action_type, action_description, risk_level, consequences, preview_data, status, requested_at, decided_at, decided_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            approval.id,
            approval.workflowId,
            approval.stepId,
            approval.actionType,
            approval.actionDescription,
            approval.riskLevel,
            approval.consequences,
            JSON.stringify(approval.previewData),
            approval.status,
            approval.requestedAt,
            approval.decidedAt || null,
            approval.decidedBy || null,
          ]
        );
      } catch (e) {
        console.warn('[SQLite] Error writing approval to table:', e);
      }
    }

    this.saveToDisk();
    return approval;
  }

  decideApproval(id: string, status: 'approved' | 'rejected', decidedBy = 'User'): ApprovalRecord | undefined {
    const approval = this.memoryCache.approvals[id];
    if (!approval) return undefined;

    approval.status = status;
    approval.decidedAt = new Date().toISOString();
    approval.decidedBy = decidedBy;
    this.saveApproval(approval);

    if (approval.workflowId && approval.stepId) {
      this.updateWorkflowStep(approval.workflowId, approval.stepId, (step) => {
        step.approvalStatus = status;
        if (status === 'approved') {
          step.status = 'ready';
        } else {
          step.status = 'blocked';
          step.failureReason = 'Action rejected by user during human-in-the-loop review.';
        }
        return step;
      });
    }

    return approval;
  }

  // Reminders
  getReminders(): Reminder[] {
    return Object.values(this.memoryCache.reminders).sort(
      (a, b) => new Date(a.targetTime).getTime() - new Date(b.targetTime).getTime()
    );
  }

  saveReminder(reminder: Reminder): Reminder {
    this.memoryCache.reminders[reminder.id] = reminder;

    if (this.sqlDb) {
      try {
        this.sqlDb.run(
          `INSERT OR REPLACE INTO reminders (id, title, target_time, associated_workflow_id, status, scheduled_in_backend, created_at, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            reminder.id,
            reminder.title,
            reminder.targetTime,
            reminder.associatedWorkflowId || null,
            reminder.status,
            reminder.scheduledInBackend ? 1 : 0,
            reminder.createdAt,
            reminder.notes || null,
          ]
        );
      } catch (e) {
        console.warn('[SQLite] Error writing reminder to table:', e);
      }
    }

    this.saveToDisk();
    return reminder;
  }

  deleteReminder(id: string): boolean {
    if (this.memoryCache.reminders[id]) {
      delete this.memoryCache.reminders[id];
      if (this.sqlDb) {
        try {
          this.sqlDb.run('DELETE FROM reminders WHERE id = ?', [id]);
        } catch {}
      }
      this.saveToDisk();
      return true;
    }
    return false;
  }

  // Verifications
  getVerifications(workflowId?: string): VerificationRecord[] {
    const list = Object.values(this.memoryCache.verifications);
    if (!workflowId) {
      return list.sort(
        (a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime()
      );
    }
    const wf = this.memoryCache.workflows[workflowId];
    if (!wf) return [];
    const stepIds = new Set(wf.steps.map((s) => s.id));
    return list
      .filter((v) => stepIds.has(v.stepId))
      .sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());
  }

  saveVerification(vr: VerificationRecord): VerificationRecord {
    this.memoryCache.verifications[vr.id] = vr;

    if (this.sqlDb) {
      try {
        this.sqlDb.run(
          `INSERT OR REPLACE INTO verifications (id, step_id, action_performed, executed_at, tool_used, result_returned, verification_method, evidence_reference, final_status, notes, verified_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            vr.id,
            vr.stepId,
            vr.actionPerformed,
            vr.executedAt,
            vr.toolUsed,
            JSON.stringify(vr.resultReturned),
            vr.verificationMethod,
            vr.evidenceReference,
            vr.finalStatus,
            vr.notes || null,
            vr.verifiedBy || null,
          ]
        );
      } catch (e) {
        console.warn('[SQLite] Error writing verification to table:', e);
      }
    }

    this.saveToDisk();
    return vr;
  }

  // Activity Logs
  getActivityLogs(workflowId?: string, limit = 100): ActivityLogEntry[] {
    let list = this.memoryCache.activityLogs;
    if (workflowId) {
      list = list.filter((l) => l.workflowId === workflowId);
    }
    return [...list]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  logActivity(entry: Omit<ActivityLogEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): ActivityLogEntry {
    const log: ActivityLogEntry = {
      id: entry.id || crypto.randomUUID(),
      timestamp: entry.timestamp || new Date().toISOString(),
      workflowId: entry.workflowId,
      stepId: entry.stepId,
      type: entry.type,
      summary: entry.summary,
      details: entry.details,
      status: entry.status,
    };
    this.memoryCache.activityLogs.unshift(log);
    if (this.memoryCache.activityLogs.length > 500) {
      this.memoryCache.activityLogs = this.memoryCache.activityLogs.slice(0, 500);
    }

    if (this.sqlDb) {
      try {
        this.sqlDb.run(
          `INSERT OR REPLACE INTO activity_logs (id, workflow_id, step_id, event_type, timestamp, summary, details, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            log.id,
            log.workflowId || null,
            log.stepId || null,
            log.type,
            log.timestamp,
            log.summary,
            JSON.stringify(log.details),
            log.status,
          ]
        );
      } catch (e) {
        console.warn('[SQLite] Error writing activity log to table:', e);
      }
    }

    this.saveToDisk();
    return log;
  }

  // Applications
  getApplications(): InternshipApplicationData[] {
    return Object.values(this.memoryCache.applications).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getApplication(id: string): InternshipApplicationData | undefined {
    return this.memoryCache.applications[id];
  }

  getApplicationByWorkflow(workflowId: string): InternshipApplicationData | undefined {
    return Object.values(this.memoryCache.applications).find(
      (a) => a.workflowId === workflowId
    );
  }

  saveApplication(app: InternshipApplicationData): InternshipApplicationData {
    app.updatedAt = new Date().toISOString();
    this.memoryCache.applications[app.id] = app;

    if (this.sqlDb) {
      try {
        this.sqlDb.run(
          `INSERT OR REPLACE INTO internship_applications (id, workflow_id, raw_json)
           VALUES (?, ?, ?)`,
          [app.id, app.workflowId, JSON.stringify(app)]
        );
      } catch (e) {
        console.warn('[SQLite] Error writing application to table:', e);
      }
    }

    this.saveToDisk();
    return app;
  }

  deleteApplication(id: string): boolean {
    if (this.memoryCache.applications[id]) {
      delete this.memoryCache.applications[id];
      if (this.sqlDb) {
        try {
          this.sqlDb.run('DELETE FROM internship_applications WHERE id = ?', [id]);
        } catch {}
      }
      this.saveToDisk();
      return true;
    }
    return false;
  }

  resetForTesting() {
    this.memoryCache = {
      workflows: {},
      memories: {},
      approvals: {},
      reminders: {},
      verifications: {},
      activityLogs: [],
      applications: {},
    };
    if (this.sqlDb) {
      try {
        this.sqlDb.run('DELETE FROM workflows');
        this.sqlDb.run('DELETE FROM memories');
        this.sqlDb.run('DELETE FROM approvals');
        this.sqlDb.run('DELETE FROM reminders');
        this.sqlDb.run('DELETE FROM verifications');
        this.sqlDb.run('DELETE FROM activity_logs');
        this.sqlDb.run('DELETE FROM internship_applications');
      } catch {}
    }
    this.seedInitialData();
    this.flushToDisk();
  }
}

export const db = new ProofLoopSqliteDatabase();
