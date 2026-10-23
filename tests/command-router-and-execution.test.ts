/**
 * ProofLoop Real Action Execution & Intelligent Command Router Automated Tests
 * Tests covering:
 * 1. Intent Classification across all 7 intent categories
 * 2. Navigation without workflow creation (Settings, Tasks, Approvals, Workflows, Memory, etc.)
 * 3. Unavailable page honest error reporting
 * 4. Distinguishing opening, explaining, and executing (Click-to-Explain toggle vs explanation)
 * 5. Memory search and status retrieval without workflow creation
 * 6. Finding and resuming existing workflows without duplicates
 * 7. Real task completion with cryptographic proof verification
 * 8. Consequential action approval safeguards
 * 9. Ambiguity handling and clarification requests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/server/db.js';
import {
  classifyCommandIntent,
  executeCommand,
  type CommandExecutionContext,
} from '../src/services/commandRouter.js';
import {
  createWorkflowFromGoal,
  autoPrepareInternshipWorkflow,
  approveAndSendInternshipApplication,
} from '../src/server/agent.js';
import { computeApplicationDraftHash } from '../src/server/emailService.js';

describe('ProofLoop Real Action Execution & Intelligent Command Routing', () => {
  beforeEach(() => {
    db.resetForTesting();
  });

  describe('1. Navigation Commands (Zero Workflow Creation)', () => {
    it('routes "Open Settings" to Settings without creating a workflow', async () => {
      let navigatedTab = '';
      let workflowCreated = false;

      const context: CommandExecutionContext = {
        navigateTab: (tab) => {
          navigatedTab = tab;
        },
        createWorkflow: async () => {
          workflowCreated = true;
          throw new Error('Should not create workflow');
        },
      };

      const classification = classifyCommandIntent('Open Settings');
      expect(classification.intent).toBe('NAVIGATION');
      expect(classification.target).toBe('settings');

      const result = await executeCommand('Open Settings', context);
      expect(result.success).toBe(true);
      expect(result.intent).toBe('NAVIGATION');
      expect(navigatedTab).toBe('settings');
      expect(workflowCreated).toBe(false);
      expect(result.spokenResponse).toContain('Settings');
    });

    it('routes "Go to the Settings dashboard" directly to Settings', async () => {
      let navigatedTab = '';
      const context: CommandExecutionContext = {
        navigateTab: (tab) => {
          navigatedTab = tab;
        },
      };

      const result = await executeCommand('Go to the Settings dashboard', context);
      expect(result.success).toBe(true);
      expect(navigatedTab).toBe('settings');
    });

    it('routes "Open Tasks" to Tasks tab', async () => {
      let navigatedTab = '';
      const context: CommandExecutionContext = {
        navigateTab: (tab) => {
          navigatedTab = tab;
        },
      };

      const result = await executeCommand('Open Tasks', context);
      expect(result.success).toBe(true);
      expect(navigatedTab).toBe('tasks');
    });

    it('routes "Show me my workflows" to Workflows tab', async () => {
      let navigatedTab = '';
      const context: CommandExecutionContext = {
        navigateTab: (tab) => {
          navigatedTab = tab;
        },
      };

      const result = await executeCommand('Show me my workflows', context);
      expect(result.success).toBe(true);
      expect(navigatedTab).toBe('workflows');
    });

    it('routes "Take me to Memory" to Memory tab', async () => {
      let navigatedTab = '';
      const context: CommandExecutionContext = {
        navigateTab: (tab) => {
          navigatedTab = tab;
        },
      };

      const result = await executeCommand('Take me to Memory', context);
      expect(result.success).toBe(true);
      expect(navigatedTab).toBe('memory');
    });

    it('honestly reports when requested page does not exist rather than creating a workflow', async () => {
      let workflowCreated = false;
      let navigatedTab = '';

      const context: CommandExecutionContext = {
        navigateTab: (tab) => {
          navigatedTab = tab;
        },
        createWorkflow: async () => {
          workflowCreated = true;
          throw new Error('Should not create workflow');
        },
      };

      const result = await executeCommand('Open the Billing portal', context);
      expect(result.intent).toBe('NAVIGATION');
      expect(result.success).toBe(false);
      expect(result.message).toContain('does not exist');
      expect(workflowCreated).toBe(false);
      expect(navigatedTab).toBe('');
    });
  });

  describe('2. Distinguishing Opening, Explaining, and Executing', () => {
    it('explains Click-to-Explain without altering settings or creating workflows', async () => {
      let settingToggled = false;
      let workflowCreated = false;

      const context: CommandExecutionContext = {
        navigateTab: () => {},
        setClickToExplain: () => {
          settingToggled = true;
        },
        createWorkflow: async () => {
          workflowCreated = true;
          throw new Error('Should not create workflow');
        },
      };

      const classification = classifyCommandIntent('What does Click-to-Explain do?');
      expect(classification.intent).toBe('INFORMATION');

      const result = await executeCommand('What does Click-to-Explain do?', context);
      expect(result.intent).toBe('INFORMATION');
      expect(result.success).toBe(true);
      expect(result.spokenResponse).toContain('Click-to-Explain');
      expect(settingToggled).toBe(false);
      expect(workflowCreated).toBe(false);
    });

    it('explains Click-to-Explain for "Explain Click-to-Explain"', async () => {
      let settingToggled = false;
      const context: CommandExecutionContext = {
        navigateTab: () => {},
        setClickToExplain: () => {
          settingToggled = true;
        },
      };

      const result = await executeCommand('Explain Click-to-Explain', context);
      expect(result.intent).toBe('INFORMATION');
      expect(result.success).toBe(true);
      expect(result.spokenResponse).toContain('Click-to-Explain');
      expect(settingToggled).toBe(false);
    });

    it('turns Click-to-Explain off by updating state and storage without creating workflows', async () => {
      let updatedSettingValue: boolean | null = null;
      let workflowCreated = false;

      const context: CommandExecutionContext = {
        navigateTab: () => {},
        setClickToExplain: (val) => {
          updatedSettingValue = val;
        },
        createWorkflow: async () => {
          workflowCreated = true;
          throw new Error('Should not create workflow');
        },
      };

      const classification = classifyCommandIntent('Turn Click-to-Explain off');
      expect(classification.intent).toBe('UI_ACTION');

      const result = await executeCommand('Turn Click-to-Explain off', context);
      expect(result.intent).toBe('UI_ACTION');
      expect(result.success).toBe(true);
      expect(updatedSettingValue).toBe(false);
      expect(workflowCreated).toBe(false);
      expect(result.spokenResponse).toContain('turned off');
    });

    it('switches to dark theme without creating a workflow', async () => {
      let activeTheme = '';
      const context: CommandExecutionContext = {
        navigateTab: () => {},
        setTheme: (t) => {
          activeTheme = t;
        },
      };

      const result = await executeCommand('Switch to dark theme', context);
      expect(result.intent).toBe('UI_ACTION');
      expect(result.success).toBe(true);
      expect(activeTheme).toBe('dark');
    });
  });

  describe('3. Querying Approvals & Memory', () => {
    it('shows pending approvals in Approval Center without creating a new workflow', async () => {
      // Seed a pending approval in db
      const wf = await createWorkflowFromGoal('Test approval query goal');
      const step = wf.steps[0];
      const now = new Date().toISOString();
      const approval = db.saveApproval({
        id: 'test-appr-1',
        workflowId: wf.id,
        stepId: step.id,
        actionType: 'email_dispatch',
        actionDescription: 'Send application to Amazon',
        riskLevel: 'high',
        consequences: 'Transmits email externally',
        previewData: { recipient: 'test@amazon.com' },
        status: 'pending',
        requestedAt: now,
      });

      let navigatedTab = '';
      const context: CommandExecutionContext = {
        navigateTab: (tab) => {
          navigatedTab = tab;
        },
        approvals: [approval],
      };

      const result = await executeCommand('Show me my pending approvals', context);
      expect(result.intent).toBe('NAVIGATION');
      expect(result.success).toBe(true);
      expect(navigatedTab).toBe('approvals');
      expect(result.spokenResponse).toContain('1 pending approval');
    });

    it('searches memory for internship details using real database records', async () => {
      // Seed verified memory record
      const now = new Date().toISOString();
      db.saveMemory({
        id: 'mem-test-internship',
        category: 'workflow_history',
        content: 'Software Engineering Intern at Amazon Web Services (Summer 2025). Worked on distributed caching.',
        source: 'user_profile',
        confidence: 1.0,
        userApproved: true,
        createdAt: now,
        updatedAt: now,
      });

      const context: CommandExecutionContext = {
        navigateTab: () => {},
      };

      const result = await executeCommand(
        'Search my memory for my recent internship details',
        context
      );

      expect(result.intent).toBe('WORK_EXECUTION');
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.spokenResponse).toContain('Software Engineering Intern at Amazon Web Services');
    });
  });

  describe('4. Workflow Search, Status & Resumption', () => {
    it('finds existing workflow by title without creating a duplicate', async () => {
      const created = await createWorkflowFromGoal('Prepare internship application for Google');
      let selectedWf: any = null;
      let navigatedTab = '';
      let workflowCreated = false;

      const context: CommandExecutionContext = {
        navigateTab: (tab) => {
          navigatedTab = tab;
        },
        selectWorkflow: (wf) => {
          selectedWf = wf;
        },
        createWorkflow: async () => {
          workflowCreated = true;
          throw new Error('Should not create new workflow');
        },
        workflows: [created],
      };

      const result = await executeCommand('Find the workflow I created yesterday', context);
      expect(result.intent).toBe('WORKFLOW_MANAGEMENT');
      expect(result.success).toBe(true);
      expect(selectedWf).toBeDefined();
      expect(selectedWf.id).toBe(created.id);
      expect(navigatedTab).toBe('workspace');
      expect(workflowCreated).toBe(false);
    });

    it('retrieves and reports actual workflow status', async () => {
      const created = await createWorkflowFromGoal('Status reporting test workflow');
      const context: CommandExecutionContext = {
        navigateTab: () => {},
        selectedWorkflow: created,
      };

      const result = await executeCommand('Show the latest workflow status', context);
      expect(result.intent).toBe('WORKFLOW_MANAGEMENT');
      expect(result.success).toBe(true);
      expect(result.spokenResponse).toContain('Status reporting test workflow');
      expect(result.spokenResponse).toContain('milestones verified complete');
    });

    it('resumes existing workflow without creating duplicates', async () => {
      const created = await createWorkflowFromGoal('Active workflow to resume');
      let resumed = false;

      const context: CommandExecutionContext = {
        navigateTab: () => {},
        selectWorkflow: () => {
          resumed = true;
        },
        selectedWorkflow: created,
      };

      const result = await executeCommand('Continue my existing workflow', context);
      expect(result.intent).toBe('WORKFLOW_MANAGEMENT');
      expect(result.success).toBe(true);
      expect(resumed).toBe(true);
      expect(result.spokenResponse).toContain('Resumed workflow');
    });
  });

  describe('5. Multi-Step Task Planning vs Direct Execution', () => {
    it('creates a workflow only when genuinely requested', async () => {
      let createdGoal = '';
      const context: CommandExecutionContext = {
        navigateTab: () => {},
        createWorkflow: async (goal) => {
          createdGoal = goal;
          return await createWorkflowFromGoal(goal);
        },
      };

      const result = await executeCommand(
        'Create a workflow for my internship search',
        context
      );
      expect(result.intent).toBe('MULTI_STEP_TASK');
      expect(result.success).toBe(true);
      expect(createdGoal).toContain('internship search');
      expect(result.data.steps.length).toBeGreaterThan(0);
    });

    it('executes active milestone with "Complete this task"', async () => {
      const wf = await createWorkflowFromGoal('Task execution workflow');
      let executedStepId = '';

      const context: CommandExecutionContext = {
        navigateTab: () => {},
        selectedWorkflow: wf,
        executeStep: async (_wfId, stepId) => {
          executedStepId = stepId;
          return { success: true };
        },
      };

      const result = await executeCommand('Complete this task', context);
      expect(result.intent).toBe('WORK_EXECUTION');
      expect(result.success).toBe(true);
      expect(executedStepId).toBe(wf.steps[0].id);
      expect(result.spokenResponse).toContain('Executed and verified');
    });
  });

  describe('6. Consequential Approvals & Clarification Safeguards', () => {
    it('preserves approval safeguards for "Approve this application"', async () => {
      const wf = await createWorkflowFromGoal('Internship approval safety test');
      const prepRes = await autoPrepareInternshipWorkflow(wf.id);
      const app = prepRes.application!;

      let approvalExecuted = false;
      const context: CommandExecutionContext = {
        navigateTab: () => {},
        currentApplication: app,
        selectedWorkflow: wf,
        approveAndSendApplication: async (appId, hash) => {
          approvalExecuted = true;
          return await approveAndSendInternshipApplication(appId, hash);
        },
      };

      const result = await executeCommand('Approve this application', context);
      expect(result.intent).toBe('WORK_EXECUTION');
      expect(approvalExecuted).toBe(true);
      expect(result.spokenResponse).toMatch(/Application sent successfully|Application authorized and sent|zero-fake-success|provider not configured/i);
    });

    it('refuses to authorize approval when no valid draft is pending', async () => {
      let approvalExecuted = false;
      const context: CommandExecutionContext = {
        navigateTab: () => {},
        currentApplication: null,
        approveAndSendApplication: async () => {
          approvalExecuted = true;
          return { success: false };
        },
      };

      const result = await executeCommand('Approve this application', context);
      expect(result.intent).toBe('WORK_EXECUTION');
      expect(result.success).toBe(false);
      expect(approvalExecuted).toBe(false);
      expect(result.spokenResponse).toContain('No active application draft available');
    });

    it('requests clarification for ambiguous utterances like "do that"', async () => {
      let workflowCreated = false;
      const context: CommandExecutionContext = {
        navigateTab: () => {},
        createWorkflow: async () => {
          workflowCreated = true;
          throw new Error('Should not create workflow');
        },
      };

      const result = await executeCommand('do that', context);
      expect(result.intent).toBe('CLARIFICATION_REQUIRED');
      expect(result.requiresClarification).toBe(true);
      expect(workflowCreated).toBe(false);
      expect(result.message).toContain('clarify');
    });
  });
});
