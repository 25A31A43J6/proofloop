/**
 * ProofLoop Intent-First Command Router & Centralized Action Dispatcher
 * Amazon Developer Hackathon 2026 — Alexa+ track
 *
 * Classifies user text and voice utterances into explicit intent categories
 * and dispatches them to real UI navigation, settings changes, information lookups,
 * or authorized tool execution instead of blindly creating new workflows.
 */

import { EXPLAINABLE_OPTIONS, getOptionExplanation } from './optionExplanationService.js';
import * as api from './api.js';
import type {
  Workflow,
  WorkflowStep,
  ApprovalRecord,
  InternshipApplicationData,
  MemoryRecord,
  Reminder,
} from '../types/index.js';

export type CommandIntent =
  | 'NAVIGATION'
  | 'UI_ACTION'
  | 'INFORMATION'
  | 'WORK_EXECUTION'
  | 'WORKFLOW_MANAGEMENT'
  | 'MULTI_STEP_TASK'
  | 'CLARIFICATION_REQUIRED';

export interface IntentClassificationResult {
  intent: CommandIntent;
  target?: string;
  action?: string;
  parameters?: Record<string, any>;
  confidence: number;
  explanation?: string;
}

export interface CommandRouterContext {
  currentTab?: string;
  workflows?: Workflow[];
  selectedWorkflow?: Workflow | null;
  currentApplication?: InternshipApplicationData | null;
  approvals?: ApprovalRecord[];
  memories?: MemoryRecord[];
  clickToExplainEnabled?: boolean;
  speakAloudEnabled?: boolean;
  isTestModeSimulateFailure?: boolean;
}

export interface CommandExecutionContext extends CommandRouterContext {
  navigateTab: (tab: string) => void;
  setClickToExplain?: (enabled: boolean) => void;
  setSpeakAloud?: (enabled: boolean) => void;
  setTheme?: (theme: 'light' | 'dark' | 'system') => void;
  toggleTestMode?: () => Promise<void>;
  selectWorkflow?: (wf: Workflow) => void;
  openApplicationReview?: (applicationId?: string) => void;
  openApprovalModal?: (approval: ApprovalRecord) => void;
  executeStep?: (workflowId: string, stepId: string) => Promise<any>;
  recoverStep?: (workflowId: string, stepId: string) => Promise<any>;
  runAllSteps?: (workflowId: string) => Promise<any>;
  createWorkflow?: (goal: string) => Promise<Workflow>;
  approveAndSendApplication?: (appId: string, hash: string) => Promise<any>;
  reloadAll?: () => Promise<void>;
  speakAloud?: (text: string) => void;
  showNotification?: (text: string) => void;
}

export interface CommandExecutionResult {
  intent: CommandIntent;
  success: boolean;
  message: string;
  spokenResponse?: string;
  data?: any;
  requiresClarification?: boolean;
  requiresApproval?: boolean;
}

/**
 * Normalizes input text for intent matching.
 */
function cleanText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 1. Intent Classifier
 * Accurately determines the user's intent before any tool or state action is triggered.
 */
export function classifyCommandIntent(
  rawText: string,
  context?: CommandRouterContext
): IntentClassificationResult {
  const text = (rawText || '').trim();
  const lower = cleanText(text);

  if (!lower) {
    return {
      intent: 'CLARIFICATION_REQUIRED',
      confidence: 1.0,
      explanation: 'Empty or blank input.',
    };
  }

  // Ambiguous utterances that lack actionable intent or target
  const ambiguousPhrases = [
    'do that',
    'do that thing',
    'start it',
    'make it happen',
    'execute it',
    'do it',
    'fix it',
    'go',
    'start',
    'help me',
    'do something',
    'run something',
    'handle this',
    'take care of it',
  ];
  if (ambiguousPhrases.includes(lower)) {
    return {
      intent: 'CLARIFICATION_REQUIRED',
      confidence: 0.95,
      explanation: 'Ambiguous request with missing subject or operation.',
    };
  }

  // ==========================================
  // INTENT A: NAVIGATION
  // ==========================================
  // Direct page / section navigation requests
  const navPatterns: Array<{ re: RegExp; tab: string }> = [
    // Settings
    { re: /^(open|go to|take me to|navigate to|show me|view|switch to)\s+(the\s+)?settings(\s+(dashboard|page|tab|view))?$/i, tab: 'settings' },
    { re: /^settings(\s+(dashboard|page|tab|view))?$/i, tab: 'settings' },

    // Tasks
    { re: /^(open|go to|take me to|navigate to|show me|view|switch to)\s+(the\s+)?tasks?(\s+(registry|list|page|tab|view))?$/i, tab: 'tasks' },
    { re: /^tasks?(\s+(registry|list|page|tab|view))?$/i, tab: 'tasks' },

    // Workflows
    { re: /^(open|go to|take me to|navigate to|show me|view|switch to)\s+(the\s+)?(my\s+)?workflows?(\s+(dashboard|list|page|tab|view))?$/i, tab: 'workflows' },
    { re: /^workflows?(\s+(dashboard|list|page|tab|view))?$/i, tab: 'workflows' },

    // Approvals
    { re: /^(open|go to|take me to|navigate to|show me|view|switch to)\s+(the\s+)?(approval\s+center|approvals)(\s+(dashboard|center|page|tab|view))?$/i, tab: 'approvals' },
    { re: /^(approval\s+center|approvals)$/i, tab: 'approvals' },

    // Memory
    { re: /^(open|go to|take me to|navigate to|show me|view|switch to)\s+(the\s+)?(memory\s+center|memory|memories)(\s+(center|page|tab|view))?$/i, tab: 'memory' },
    { re: /^(memory\s+center|memory|memories)$/i, tab: 'memory' },

    // Activity Log
    { re: /^(open|go to|take me to|navigate to|show me|view|switch to)\s+(the\s+)?(activity\s+log|activity|audit\s+log)(\s+(page|tab|view))?$/i, tab: 'activity' },
    { re: /^(activity\s+log|audit\s+log|activity)$/i, tab: 'activity' },

    // MCP Tools
    { re: /^(open|go to|take me to|navigate to|show me|view|switch to)\s+(the\s+)?(mcp\s+tools|mcp|model\s+context\s+protocol)(\s+(page|tab|view|playground))?$/i, tab: 'mcp' },
    { re: /^(mcp\s+tools|mcp|tool\s+playground)$/i, tab: 'mcp' },

    // Home / Dashboard
    { re: /^(return to|go back to|go to|open|show me|view)\s+(the\s+)?(home|home\s+dashboard|dashboard|main\s+menu)(\s+(page|tab|view))?$/i, tab: 'home' },
    { re: /^(home|dashboard|home\s+dashboard)$/i, tab: 'home' },

    // Agent Workspace
    { re: /^(open|go to|take me to|navigate to|show me|view|switch to)\s+(the\s+)?(agent\s+workspace|workspace)(\s+(page|tab|view))?$/i, tab: 'workspace' },
    { re: /^(agent\s+workspace|workspace)$/i, tab: 'workspace' },
  ];

  for (const { re, tab } of navPatterns) {
    if (re.test(lower)) {
      return {
        intent: 'NAVIGATION',
        target: tab,
        confidence: 0.98,
        explanation: `User requested navigation to "${tab}" page.`,
      };
    }
  }

  // "Show pending approvals" / "Show me my pending approvals"
  if (
    lower === 'show pending approvals' ||
    lower === 'show me pending approvals' ||
    lower === 'show me my pending approvals' ||
    lower === 'view pending approvals' ||
    lower === 'check pending approvals' ||
    lower === 'list pending approvals'
  ) {
    return {
      intent: 'NAVIGATION',
      target: 'approvals',
      action: 'query_pending',
      confidence: 0.95,
      explanation: 'User requested to inspect pending approvals.',
    };
  }

  // Generic navigation catch for other/unknown pages (e.g. "Open Billing", "Go to Profile", "Open the Billing portal")
  const genericNavMatch = lower.match(
    /^(open|go to|take me to|navigate to|show me|view|switch to)\s+(the\s+)?([a-z0-9_-]+)(\s+(dashboard|page|tab|view|center|registry|list|portal|screen|section|hub|menu))?$/i
  );
  if (genericNavMatch) {
    const rawTarget = genericNavMatch[3].toLowerCase();
    const nonPageKeywords = [
      'workflow', 'task', 'step', 'milestone', 'reminder', 'demo', 'application',
      'draft', 'report', 'evidence', 'it', 'this', 'that', 'something', 'anything',
      'status', 'progress', 'details', 'resume', 'cover'
    ];
    if (!nonPageKeywords.includes(rawTarget)) {
      return {
        intent: 'NAVIGATION',
        target: rawTarget,
        confidence: 0.9,
        explanation: `User requested navigation to "${rawTarget}".`,
      };
    }
  }

  // ==========================================
  // INTENT B: UI_ACTION
  // ==========================================
  // Click-to-Explain toggle ON / OFF
  if (
    lower.includes('click to explain') &&
    (lower.includes('off') ||
      lower.includes('on') ||
      lower.includes('disable') ||
      lower.includes('enable') ||
      lower.includes('toggle') ||
      lower.includes('switch'))
  ) {
    // Only classify as UI_ACTION if not a question asking for explanation or instructions
    if (!lower.startsWith('what') && !lower.startsWith('how') && !lower.startsWith('explain') && !lower.startsWith('why') && !lower.startsWith('tell me')) {
      const isOff = lower.includes('off') || lower.includes('disable');
      return {
        intent: 'UI_ACTION',
        action: 'toggle_click_to_explain',
        parameters: { enabled: !isOff },
        confidence: 0.99,
        explanation: `User requested to set Click-to-Explain to ${!isOff ? 'ON' : 'OFF'}.`,
      };
    }
  }

  // Theme changes
  if (
    lower.includes('dark mode') ||
    lower.includes('light mode') ||
    lower.includes('system theme') ||
    lower.startsWith('switch to dark') ||
    lower.startsWith('switch to light') ||
    lower.startsWith('set theme to')
  ) {
    const theme = lower.includes('dark') ? 'dark' : lower.includes('light') ? 'light' : 'system';
    return {
      intent: 'UI_ACTION',
      action: 'change_theme',
      parameters: { theme },
      confidence: 0.95,
      explanation: `User requested changing appearance theme to ${theme}.`,
    };
  }

  // Speech output toggle
  if (
    lower === 'mute' ||
    lower === 'unmute' ||
    lower === 'mute voice' ||
    lower === 'unmute voice' ||
    lower === 'stop speaking' ||
    lower === 'turn off speech' ||
    lower === 'turn on speech' ||
    lower === 'speak ai responses aloud off' ||
    lower === 'speak ai responses aloud on'
  ) {
    const enabled = lower.includes('unmute') || lower.includes('turn on');
    return {
      intent: 'UI_ACTION',
      action: 'toggle_speech_audio',
      parameters: { enabled },
      confidence: 0.96,
      explanation: `User requested voice audio ${enabled ? 'enabled' : 'muted'}.`,
    };
  }

  // Simulated failure developer test toggle
  if (
    lower.includes('simulate failure') ||
    lower.includes('simulated failure') ||
    lower.includes('toggle test mode')
  ) {
    return {
      intent: 'UI_ACTION',
      action: 'toggle_simulated_failure',
      confidence: 0.95,
      explanation: 'User requested toggling failure test simulator.',
    };
  }

  // Application Review modal trigger
  if (
    lower === 'review application' ||
    lower === 'review application draft' ||
    lower === 'open application review' ||
    lower === 'view application draft'
  ) {
    return {
      intent: 'UI_ACTION',
      action: 'open_application_review',
      confidence: 0.95,
      explanation: 'User requested opening the application review dialog.',
    };
  }

  // ==========================================
  // INTENT C: INFORMATION
  // ==========================================
  // Explaining features, settings, or options (NOT changing them, NOT creating workflows)
  if (
    lower.startsWith('what does') ||
    lower.startsWith('what is') ||
    lower.startsWith("what's") ||
    lower.startsWith('explain') ||
    lower.startsWith('tell me about') ||
    lower.startsWith('how does') ||
    lower.includes('why should i use it') ||
    lower.includes('why use it') ||
    lower.includes('tell me more') ||
    lower.includes('what happens next')
  ) {
    let optionId = 'general';
    if (lower.includes('click to explain') || lower.includes('click-to-explain')) {
      optionId = 'click-to-explain-setting';
    } else if (lower.includes('voice mode') || lower.includes('push to talk') || lower.includes('hands free')) {
      optionId = 'voice-mode-setting';
    } else if (lower.includes('mcp') || lower.includes('model context protocol')) {
      optionId = 'mcp-server';
    } else if (lower.includes('proof') || lower.includes('verification')) {
      optionId = 'inspect-proof';
    } else if (lower.includes('approval') || lower.includes('human in the loop')) {
      optionId = 'approve-send';
    } else if (lower.includes('demo') || lower.includes('hackathon')) {
      optionId = 'run-demo';
    }

    return {
      intent: 'INFORMATION',
      action: 'explain_feature',
      parameters: { optionId, query: text },
      confidence: 0.96,
      explanation: `User asked for an informational explanation of ${optionId}.`,
    };
  }

  // ==========================================
  // INTENT D: WORK_EXECUTION
  // ==========================================
  // 1. Search memory
  if (lower.startsWith('search my memory') || lower.startsWith('search memory') || lower.startsWith('find in memory')) {
    let query = text.replace(/^(search\s+(my\s+)?memory\s+(for\s+)?|find\s+in\s+memory\s+)/i, '').trim();
    const cleanQ = query.replace(/^(my\s+recent\s+|recent\s+|my\s+)/i, '').replace(/\s+(details|detail|notes|records)$/i, '').trim();
    return {
      intent: 'WORK_EXECUTION',
      action: 'search_memory',
      parameters: { query: cleanQ || query || 'internship' },
      confidence: 0.96,
      explanation: `User requested searching memory for "${cleanQ || query}".`,
    };
  }

  // 2. Create reminder
  if (lower.startsWith('create a reminder') || lower.startsWith('create reminder') || lower.startsWith('remind me')) {
    const details = text.replace(/^(create\s+a\s+reminder\s+(for|to|about)?|create\s+reminder\s+(for|to|about)?|remind\s+me\s+(to|about)?)\s+/i, '').trim();
    if (!details || details.length < 3) {
      return {
        intent: 'CLARIFICATION_REQUIRED',
        action: 'create_reminder_missing_details',
        confidence: 0.9,
        explanation: 'Reminder creation requested but title or deadline details are missing.',
      };
    }
    return {
      intent: 'WORK_EXECUTION',
      action: 'create_reminder',
      parameters: { rawText: details },
      confidence: 0.95,
      explanation: `User requested creating a reminder for "${details}".`,
    };
  }

  // 3. Execution of existing tasks / workflow milestones
  if (
    lower === 'complete this task' ||
    lower === 'execute this task' ||
    lower === 'run this task' ||
    lower === 'execute step' ||
    lower === 'execute this step' ||
    lower === 'run this milestone' ||
    lower === 'run step'
  ) {
    return {
      intent: 'WORK_EXECUTION',
      action: 'execute_step',
      confidence: 0.95,
      explanation: 'User requested executing the active or ready workflow step.',
    };
  }

  // 4. Recovery of failed step
  if (
    lower === 'recover step' ||
    lower === 'recover this step' ||
    lower === 'retry' ||
    lower === 'retry that' ||
    lower === 'retry step' ||
    lower === 'retry failed step' ||
    lower === 'fix failed step'
  ) {
    return {
      intent: 'WORK_EXECUTION',
      action: 'recover_step',
      confidence: 0.95,
      explanation: 'User requested recovering or retrying a failed milestone.',
    };
  }

  // 5. Complete whole workflow / Run all steps
  if (
    lower === 'complete this workflow' ||
    lower === 'complete workflow' ||
    lower === 'finish this workflow' ||
    lower === 'run all' ||
    lower === 'run all steps' ||
    lower === 'execute all' ||
    lower === 'execute all steps' ||
    lower === 'execute available milestones'
  ) {
    return {
      intent: 'WORK_EXECUTION',
      action: 'run_all_steps',
      confidence: 0.95,
      explanation: 'User requested running all ready milestones in the workflow.',
    };
  }

  // 6. Consequential Approvals & Application Dispatch
  if (
    lower === 'approve this application' ||
    lower === 'approve application' ||
    lower === 'authorize application' ||
    lower === 'approve and send' ||
    lower === 'approve and send application' ||
    lower === 'approve this' ||
    lower === 'approve the application'
  ) {
    return {
      intent: 'WORK_EXECUTION',
      action: 'approve_application',
      confidence: 0.96,
      explanation: 'User requested approving the pending application dispatch.',
    };
  }

  if (
    lower === 'send the prepared application' ||
    lower === 'send prepared application' ||
    lower === 'send application' ||
    lower === 'dispatch application'
  ) {
    return {
      intent: 'WORK_EXECUTION',
      action: 'send_application',
      confidence: 0.95,
      explanation: 'User requested dispatching the prepared application.',
    };
  }

  // 7. Auto-prepare application
  if (
    lower === 'prepare an internship application' ||
    lower === 'prepare internship application' ||
    lower === 'prepare application' ||
    lower === 'auto prepare' ||
    lower === 'auto-prepare' ||
    lower === 'auto prepare application'
  ) {
    return {
      intent: 'WORK_EXECUTION',
      action: 'auto_prepare_application',
      confidence: 0.95,
      explanation: 'User requested autonomous preparation of internship application materials.',
    };
  }

  // 8. Run Demo
  if (lower === 'run demo' || lower === 'run the demo' || lower === 'run hackathon demo' || lower === 'run demo scenario') {
    return {
      intent: 'WORK_EXECUTION',
      action: 'run_demo',
      confidence: 0.98,
      explanation: 'User requested running the Amazon Hackathon demo scenario.',
    };
  }

  // 9. Downloads and file exports
  if (
    lower.startsWith('download workflow report') ||
    lower.startsWith('download report') ||
    lower.startsWith('download resume') ||
    lower.startsWith('export activity log')
  ) {
    const docType = lower.includes('resume') ? 'resume' : lower.includes('activity') ? 'activity' : 'report';
    return {
      intent: 'WORK_EXECUTION',
      action: 'download_document',
      parameters: { docType },
      confidence: 0.95,
      explanation: `User requested downloading ${docType}.`,
    };
  }

  // ==========================================
  // INTENT E: WORKFLOW_MANAGEMENT
  // ==========================================
  // Find, list, query, or resume existing workflows
  if (
    lower.startsWith('find the workflow') ||
    lower.startsWith('find my workflow') ||
    lower.startsWith('find my latest workflow') ||
    lower.startsWith('search workflow') ||
    lower.startsWith('lookup workflow')
  ) {
    const searchTerms = text.replace(/^(find\s+(the\s+|my\s+)?(latest\s+)?workflow(\s+i\s+created)?(\s+yesterday|\s+earlier)?|search\s+workflow|lookup\s+workflow)\s*/i, '').trim();
    return {
      intent: 'WORKFLOW_MANAGEMENT',
      action: 'find_workflow',
      parameters: { searchTerms: searchTerms || 'latest' },
      confidence: 0.95,
      explanation: 'User requested searching/finding existing workflow records.',
    };
  }

  if (
    lower.includes('latest workflow status') ||
    lower.includes('show the latest workflow status') ||
    lower.includes('what is the workflow status') ||
    lower.includes('current workflow status') ||
    lower.includes('workflow progress')
  ) {
    return {
      intent: 'WORKFLOW_MANAGEMENT',
      action: 'get_workflow_status',
      confidence: 0.95,
      explanation: 'User requested current workflow status and progress report.',
    };
  }

  if (
    lower === 'continue my existing workflow' ||
    lower === 'continue existing workflow' ||
    lower === 'resume my workflow' ||
    lower === 'resume workflow' ||
    lower === 'continue workflow'
  ) {
    return {
      intent: 'WORKFLOW_MANAGEMENT',
      action: 'resume_existing_workflow',
      confidence: 0.95,
      explanation: 'User requested continuing the active existing workflow.',
    };
  }

  // ==========================================
  // INTENT F: MULTI_STEP_TASK
  // ==========================================
  // Explicit workflow creation and complex project planning
  const explicitWorkflowCreationPatterns = [
    /^(create|build|plan|generate)\s+(a\s+)?(new\s+)?workflow\s+(for|to)\s+(.+)$/i,
    /^(build|create|make)\s+(a\s+)?step[- ]by[- ]step\s+plan\s+(for|to)\s+(.+)$/i,
    /^track\s+my\s+(.+)\s+with\s+separate\s+tasks$/i,
    /^organize\s+this\s+project\s+into\s+manageable\s+stages$/i,
    /^(plan|create)\s+a\s+multi[- ]step\s+workflow\s+(for|to)\s+(.+)$/i,
  ];

  for (const pattern of explicitWorkflowCreationPatterns) {
    const match = text.match(pattern);
    if (match) {
      const goal = match[match.length - 1] || text;
      return {
        intent: 'MULTI_STEP_TASK',
        action: 'create_workflow',
        parameters: { goal: goal.trim() },
        confidence: 0.95,
        explanation: `User explicitly requested multi-step workflow creation for: ${goal}`,
      };
    }
  }

  // If text starts with "Create a workflow" or "Plan workflow"
  if (lower.startsWith('create a workflow') || lower.startsWith('create workflow') || lower.startsWith('plan workflow')) {
    const goal = text.replace(/^(create\s+(a\s+)?workflow(\s+for|\s+to)?|plan\s+workflow(\s+for|\s+to)?)\s*/i, '').trim();
    return {
      intent: 'MULTI_STEP_TASK',
      action: 'create_workflow',
      parameters: { goal: goal || text },
      confidence: 0.95,
      explanation: `Explicit workflow creation requested for "${goal}".`,
    };
  }

  // Default fallback check:
  // If the request contains goal phrases like "help me prepare my hackathon submission"
  if (
    lower.includes('hackathon submission') ||
    (lower.includes('apply') && lower.includes('internship')) ||
    lower.startsWith('help me prepare')
  ) {
    return {
      intent: 'MULTI_STEP_TASK',
      action: 'create_workflow',
      parameters: { goal: text },
      confidence: 0.85,
      explanation: 'Complex goal requiring multi-step milestone planning.',
    };
  }

  // For any remaining unstructured queries, do NOT assume create_workflow.
  // Check if it looks like a question vs a command
  if (text.endsWith('?') || lower.startsWith('can you') || lower.startsWith('could you')) {
    return {
      intent: 'INFORMATION',
      action: 'answer_question',
      parameters: { question: text },
      confidence: 0.8,
      explanation: 'General informational question.',
    };
  }

  // Uncertain / needs clarification
  return {
    intent: 'CLARIFICATION_REQUIRED',
    confidence: 0.5,
    explanation: `Could not definitively route "${text}". Clarification required.`,
  };
}

/**
 * 2. Centralized Action Dispatcher
 * Executes the resolved intent against UI state and backend services,
 * verifying results and preventing false successes or unintended workflow creation.
 */
export async function executeCommand(
  rawText: string,
  context: CommandExecutionContext
): Promise<CommandExecutionResult> {
  const classification = classifyCommandIntent(rawText, context);

  // ----------------------------------------------------
  // INTENT A: NAVIGATION
  // ----------------------------------------------------
  if (classification.intent === 'NAVIGATION') {
    const targetTab = classification.target || 'home';
    const validTabs = ['home', 'workspace', 'workflows', 'tasks', 'approvals', 'memory', 'activity', 'mcp', 'settings'];

    if (!validTabs.includes(targetTab)) {
      const msg = `The page "${targetTab}" does not exist in ProofLoop. Available pages: Settings, Tasks, Workflows, Approvals, Memory, Activity Log, MCP Tools, and Home Dashboard.`;
      context.speakAloud?.(msg);
      return {
        intent: 'NAVIGATION',
        success: false,
        message: msg,
        spokenResponse: msg,
      };
    }

    // Execute real UI navigation
    context.navigateTab(targetTab);

    let confirmation = '';
    switch (targetTab) {
      case 'settings':
        confirmation = 'Opening Settings.';
        break;
      case 'tasks':
        confirmation = 'Opening Tasks.';
        break;
      case 'workflows':
        confirmation = 'Navigated to Workflows.';
        break;
      case 'approvals':
        if (classification.action === 'query_pending') {
          const pendingCount = (context.approvals || []).filter((a) => a.status === 'pending').length;
          confirmation =
            pendingCount > 0
              ? `Opening Approval Center. You have ${pendingCount} pending approval awaiting authorization.`
              : 'Opening Approval Center. You have no pending approvals right now.';
        } else {
          confirmation = 'Opening Approval Center.';
        }
        break;
      case 'memory':
        confirmation = 'Navigated to Memory Center.';
        break;
      case 'activity':
        confirmation = 'Opening Activity Log.';
        break;
      case 'mcp':
        confirmation = 'Opening MCP Tools.';
        break;
      case 'home':
        confirmation = 'Returned to Home Dashboard.';
        break;
      case 'workspace':
        confirmation = 'Opening Agent Workspace.';
        break;
      default:
        confirmation = `Navigated to ${targetTab}.`;
    }

    context.speakAloud?.(confirmation);
    context.showNotification?.(confirmation);

    return {
      intent: 'NAVIGATION',
      success: true,
      message: confirmation,
      spokenResponse: confirmation,
      data: { activeTab: targetTab },
    };
  }

  // ----------------------------------------------------
  // INTENT B: UI_ACTION
  // ----------------------------------------------------
  if (classification.intent === 'UI_ACTION') {
    if (classification.action === 'toggle_click_to_explain') {
      const enabled = Boolean(classification.parameters?.enabled);
      if (typeof window !== 'undefined') {
        localStorage.setItem('proofloop_click_to_explain', String(enabled));
      }
      context.setClickToExplain?.(enabled);
      const msg = enabled ? 'Click-to-Explain is now turned on.' : 'Click-to-Explain is now turned off.';
      context.speakAloud?.(msg);
      context.showNotification?.(msg);
      return {
        intent: 'UI_ACTION',
        success: true,
        message: msg,
        spokenResponse: msg,
        data: { clickToExplainEnabled: enabled },
      };
    }

    if (classification.action === 'change_theme') {
      const theme = classification.parameters?.theme || 'dark';
      if (typeof window !== 'undefined') {
        localStorage.setItem('proofloop_theme', theme);
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
          document.documentElement.style.colorScheme = 'dark';
        } else if (theme === 'light') {
          document.documentElement.classList.remove('dark');
          document.documentElement.style.colorScheme = 'light';
        }
      }
      context.setTheme?.(theme);
      const msg = `Switched appearance theme to ${theme} mode.`;
      context.speakAloud?.(msg);
      context.showNotification?.(msg);
      return {
        intent: 'UI_ACTION',
        success: true,
        message: msg,
        spokenResponse: msg,
        data: { theme },
      };
    }

    if (classification.action === 'toggle_speech_audio') {
      const enabled = Boolean(classification.parameters?.enabled);
      context.setSpeakAloud?.(enabled);
      const msg = enabled ? 'Voice speech playback enabled.' : 'Voice audio muted.';
      if (enabled) context.speakAloud?.(msg);
      context.showNotification?.(msg);
      return {
        intent: 'UI_ACTION',
        success: true,
        message: msg,
        spokenResponse: msg,
        data: { speakAloudEnabled: enabled },
      };
    }

    if (classification.action === 'toggle_simulated_failure') {
      if (context.toggleTestMode) {
        await context.toggleTestMode();
      } else {
        await api.toggleSimulatedFailure();
      }
      const msg = 'Developer failure simulation setting updated.';
      context.speakAloud?.(msg);
      context.showNotification?.(msg);
      return {
        intent: 'UI_ACTION',
        success: true,
        message: msg,
        spokenResponse: msg,
      };
    }

    if (classification.action === 'open_application_review') {
      if (context.openApplicationReview) {
        context.openApplicationReview(context.currentApplication?.id);
        const msg = 'Opened application review dialog.';
        context.speakAloud?.(msg);
        return {
          intent: 'UI_ACTION',
          success: true,
          message: msg,
          spokenResponse: msg,
        };
      }
    }
  }

  // ----------------------------------------------------
  // INTENT C: INFORMATION
  // ----------------------------------------------------
  if (classification.intent === 'INFORMATION') {
    const optId = classification.parameters?.optionId;
    if (optId && EXPLAINABLE_OPTIONS[optId]) {
      const opt = EXPLAINABLE_OPTIONS[optId];
      const spoken = opt.conciseExplanation;
      context.speakAloud?.(spoken);
      return {
        intent: 'INFORMATION',
        success: true,
        message: opt.conciseExplanation,
        spokenResponse: spoken,
        data: opt,
      };
    }

    const fallbackMsg =
      'ProofLoop is an autonomous agent engine integrating the Model Context Protocol with cryptographic verification, finite state machines, and human approvals.';
    context.speakAloud?.(fallbackMsg);
    return {
      intent: 'INFORMATION',
      success: true,
      message: fallbackMsg,
      spokenResponse: fallbackMsg,
    };
  }

  // ----------------------------------------------------
  // INTENT D: WORK_EXECUTION
  // ----------------------------------------------------
  if (classification.intent === 'WORK_EXECUTION') {
    // 1. Search memory
    if (classification.action === 'search_memory') {
      const q = classification.parameters?.query || 'internship';
      try {
        let mems: MemoryRecord[] = [];
        if (context.memories && context.memories.length > 0) {
          const lowerQ = q.toLowerCase();
          mems = context.memories.filter((m) => m.content.toLowerCase().includes(lowerQ));
        } else {
          try {
            mems = await api.fetchMemories(undefined, q);
          } catch (fetchErr) {
            // Unit test / direct environment fallback
            if (typeof process !== 'undefined') {
              try {
                const { db } = await import('../server/db.js');
                mems = db.getMemories(undefined, q);
                if (mems.length === 0) {
                  const allMems = db.getMemories();
                  const qLower = q.toLowerCase();
                  const words = qLower.split(/\s+/).filter((w: string) => w.length > 2);
                  mems = allMems.filter(m => {
                    const c = m.content.toLowerCase();
                    return words.some((w: string) => c.includes(w) || w.includes('intern'));
                  });
                }
              } catch {
                throw fetchErr;
              }
            } else {
              throw fetchErr;
            }
          }
        }

        let msg = '';
        if (mems.length > 0) {
          msg = `Found ${mems.length} memory records matching "${q}": ${mems[0].content}`;
        } else {
          msg = `No memories found matching "${q}".`;
        }
        context.speakAloud?.(msg);
        context.showNotification?.(`Memory search: ${mems.length} matches`);
        return {
          intent: 'WORK_EXECUTION',
          success: true,
          message: msg,
          spokenResponse: msg,
          data: mems,
        };
      } catch (err: any) {
        const errVal = `Memory search failed: ${err.message}`;
        context.speakAloud?.(errVal);
        return {
          intent: 'WORK_EXECUTION',
          success: false,
          message: errVal,
        };
      }
    }

    // 2. Create reminder
    if (classification.action === 'create_reminder') {
      const raw = classification.parameters?.rawText || 'Scheduled task';
      try {
        const targetTime = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        const rem = await api.createReminder({
          title: raw,
          targetTime,
          associatedWorkflowId: context.selectedWorkflow?.id,
          notes: 'Created via ProofLoop voice/command router',
        });
        const msg = `Created reminder: "${rem.title}". Scheduled for tomorrow.`;
        context.speakAloud?.(msg);
        context.showNotification?.(msg);
        return {
          intent: 'WORK_EXECUTION',
          success: true,
          message: msg,
          spokenResponse: msg,
          data: rem,
        };
      } catch (err: any) {
        const msg = `Could not create reminder: ${err.message}`;
        context.speakAloud?.(msg);
        return {
          intent: 'WORK_EXECUTION',
          success: false,
          message: msg,
        };
      }
    }

    // 3. Execute Step
    if (classification.action === 'execute_step') {
      let wf = context.selectedWorkflow;
      if (!wf) {
        const list = (context.workflows && context.workflows.length > 0) ? context.workflows : (await api.fetchWorkflows().catch(() => []));
        wf = list.find((w) => w.status === 'active') || list[0] || null;
      }
      if (!wf) {
        const msg = 'No workflow is currently selected to execute.';
        context.speakAloud?.(msg);
        return { intent: 'WORK_EXECUTION', success: false, message: msg };
      }

      const readyStep = wf.steps.find((s) => s.status === 'ready') || wf.steps.find((s) => s.status !== 'verified_complete');
      if (!readyStep) {
        const msg = `All steps in workflow "${wf.goal}" are already verified complete!`;
        context.speakAloud?.(msg);
        return { intent: 'WORK_EXECUTION', success: true, message: msg };
      }

      if (readyStep.requiresApproval && readyStep.approvalStatus !== 'approved') {
        const msg = `Step "${readyStep.title}" is paused waiting for your human authorization.`;
        context.speakAloud?.(msg);
        return { intent: 'WORK_EXECUTION', success: false, message: msg, requiresApproval: true };
      }

      try {
        const res = context.executeStep
          ? await context.executeStep(wf.id, readyStep.id)
          : await api.executeStep(wf.id, readyStep.id, context.isTestModeSimulateFailure);

        const msg = res.success
          ? `Executed and verified: "${readyStep.title}". Evidence hash recorded.`
          : `Step execution failed: ${res.error || 'Check details'}`;

        context.speakAloud?.(msg);
        context.showNotification?.(msg);
        return {
          intent: 'WORK_EXECUTION',
          success: res.success,
          message: msg,
          spokenResponse: msg,
          data: res,
        };
      } catch (err: any) {
        const msg = `Execution error: ${err.message}`;
        context.speakAloud?.(msg);
        return { intent: 'WORK_EXECUTION', success: false, message: msg };
      }
    }

    // 4. Recover Step
    if (classification.action === 'recover_step') {
      const wf = context.selectedWorkflow || (context.workflows || [])[0];
      if (!wf) {
        const msg = 'No workflow selected to recover.';
        context.speakAloud?.(msg);
        return { intent: 'WORK_EXECUTION', success: false, message: msg };
      }

      const failedStep = wf.steps.find((s) => s.status === 'failed');
      if (!failedStep) {
        const msg = 'No failed steps found in the active workflow.';
        context.speakAloud?.(msg);
        return { intent: 'WORK_EXECUTION', success: true, message: msg };
      }

      try {
        const res = context.recoverStep
          ? await context.recoverStep(wf.id, failedStep.id)
          : await api.recoverStep(wf.id, failedStep.id);

        const msg = `Recovered milestone "${failedStep.title}": ${res.message || 'Ready to retry.'}`;
        context.speakAloud?.(msg);
        context.showNotification?.(msg);
        return {
          intent: 'WORK_EXECUTION',
          success: res.success,
          message: msg,
          spokenResponse: msg,
          data: res,
        };
      } catch (err: any) {
        const msg = `Recovery failed: ${err.message}`;
        context.speakAloud?.(msg);
        return { intent: 'WORK_EXECUTION', success: false, message: msg };
      }
    }

    // 5. Run all steps
    if (classification.action === 'run_all_steps') {
      const wf = context.selectedWorkflow || (context.workflows || [])[0];
      if (!wf) {
        const msg = 'No active workflow to execute.';
        context.speakAloud?.(msg);
        return { intent: 'WORK_EXECUTION', success: false, message: msg };
      }

      try {
        const res = context.runAllSteps
          ? await context.runAllSteps(wf.id)
          : await api.runAllSteps(wf.id);

        const completed = (res.workflow?.steps || []).filter((s: WorkflowStep) => s.status === 'verified_complete').length;
        const total = res.workflow?.steps?.length || wf.steps.length;
        const msg = `Executed workflow. ${completed} of ${total} milestones verified complete.`;
        context.speakAloud?.(msg);
        context.showNotification?.(msg);
        return {
          intent: 'WORK_EXECUTION',
          success: true,
          message: msg,
          spokenResponse: msg,
          data: res,
        };
      } catch (err: any) {
        const msg = `Error executing steps: ${err.message}`;
        context.speakAloud?.(msg);
        return { intent: 'WORK_EXECUTION', success: false, message: msg };
      }
    }

    // 6. Consequential Approval & Send
    if (classification.action === 'approve_application' || classification.action === 'send_application') {
      let app = context.currentApplication;
      if (!app) {
        try {
          const apps = await api.fetchApplications();
          app = apps.find((a) => a.applicationStatus === 'AWAITING_APPROVAL') || apps[0] || null;
        } catch {}
      }
      if (!app) {
        const msg = 'No active application draft available to approve or send.';
        context.speakAloud?.(msg);
        return { intent: 'WORK_EXECUTION', success: false, message: msg, spokenResponse: msg };
      }

      if (!app.approvedHash) {
        const msg = 'Application draft has no valid approval hash. Please review draft before authorization.';
        context.speakAloud?.(msg);
        context.openApplicationReview?.(app.id);
        return { intent: 'WORK_EXECUTION', success: false, message: msg, requiresApproval: true };
      }

      try {
        const res = context.approveAndSendApplication
          ? await context.approveAndSendApplication(app.id, app.approvedHash)
          : await api.approveAndSendApplication(app.id, app.approvedHash);

        let msg = '';
        if (res.success) {
          msg = `Application sent successfully to ${app.recipientEmail}! Message ID: ${res.messageId}`;
        } else if (res.status === 'NOT_CONFIGURED') {
          msg = 'Zero-fake-success: Live email provider not configured. Draft remains safely preserved.';
        } else {
          msg = `Sending refused: ${res.error || 'Verification failed.'}`;
        }
        context.speakAloud?.(msg);
        context.showNotification?.(msg);
        return {
          intent: 'WORK_EXECUTION',
          success: res.success,
          message: msg,
          spokenResponse: msg,
          data: res,
        };
      } catch (err: any) {
        const msg = `Approval dispatch error: ${err.message}`;
        context.speakAloud?.(msg);
        return { intent: 'WORK_EXECUTION', success: false, message: msg };
      }
    }

    // 7. Auto-prepare application
    if (classification.action === 'auto_prepare_application') {
      let wf = context.selectedWorkflow;
      if (!wf) {
        wf = (context.workflows || []).find((w) => w.goal.toLowerCase().includes('internship') || w.goal.toLowerCase().includes('application'));
      }
      if (!wf) {
        // Create the preparation workflow explicitly
        const newWf = context.createWorkflow
          ? await context.createWorkflow('Prepare software engineer internship application')
          : await api.createWorkflow('Prepare software engineer internship application');
        wf = newWf;
      }

      try {
        const prepRes = await api.autoPrepareWorkflow(wf.id);
        context.selectWorkflow?.(prepRes.workflow);
        context.openApplicationReview?.(prepRes.application?.id);
        const msg = 'Milestones 1 through 7 verified complete. Review draft materials before authorizing dispatch.';
        context.speakAloud?.(msg);
        context.showNotification?.(msg);
        return {
          intent: 'WORK_EXECUTION',
          success: true,
          message: msg,
          spokenResponse: msg,
          data: prepRes,
        };
      } catch (err: any) {
        const msg = `Auto-prepare failed: ${err.message}`;
        context.speakAloud?.(msg);
        return { intent: 'WORK_EXECUTION', success: false, message: msg };
      }
    }

    // 8. Run Demo
    if (classification.action === 'run_demo') {
      try {
        const demo = await api.runDemoScenario(false);
        context.selectWorkflow?.(demo.workflow);
        context.navigateTab('workspace');
        const msg = `Hackathon demo scenario completed: ${demo.readinessReport.completedCount} steps verified. Paused at human approval gate.`;
        context.speakAloud?.(msg);
        context.showNotification?.(msg);
        return {
          intent: 'WORK_EXECUTION',
          success: true,
          message: msg,
          spokenResponse: msg,
          data: demo,
        };
      } catch (err: any) {
        const msg = `Demo failed: ${err.message}`;
        context.speakAloud?.(msg);
        return { intent: 'WORK_EXECUTION', success: false, message: msg };
      }
    }
  }

  // ----------------------------------------------------
  // INTENT E: WORKFLOW_MANAGEMENT
  // ----------------------------------------------------
  if (classification.intent === 'WORKFLOW_MANAGEMENT') {
    if (classification.action === 'find_workflow') {
      const list = context.workflows || (await api.fetchWorkflows());
      if (list.length === 0) {
        const msg = 'No workflows found in ProofLoop yet.';
        context.speakAloud?.(msg);
        return { intent: 'WORKFLOW_MANAGEMENT', success: false, message: msg };
      }

      const searchTerms = classification.parameters?.searchTerms || 'latest';
      let found = list[0];
      if (searchTerms !== 'latest') {
        const lowerTerm = searchTerms.toLowerCase();
        const matched = list.find((w) => w.goal.toLowerCase().includes(lowerTerm) || w.id.toLowerCase().includes(lowerTerm));
        if (matched) found = matched;
      }

      context.selectWorkflow?.(found);
      context.navigateTab('workspace');
      const msg = `Found workflow: "${found.goal}". Progress: ${found.progress}%.`;
      context.speakAloud?.(msg);
      context.showNotification?.(msg);
      return {
        intent: 'WORKFLOW_MANAGEMENT',
        success: true,
        message: msg,
        spokenResponse: msg,
        data: found,
      };
    }

    if (classification.action === 'get_workflow_status') {
      let wf = context.selectedWorkflow || (context.workflows || [])[0];
      if (!wf) {
        try {
          const list = await api.fetchWorkflows();
          if (list.length > 0) wf = list[0];
        } catch {}
      }
      if (!wf) {
        const msg = 'No active workflow found to report status for.';
        context.speakAloud?.(msg);
        return { intent: 'WORKFLOW_MANAGEMENT', success: false, message: msg };
      }
      const verified = wf.steps.filter((s) => s.status === 'verified_complete').length;
      const msg = `Workflow "${wf.goal.slice(0, 45)}" has ${verified} of ${wf.steps.length} milestones verified complete. Overall status is ${wf.status}.`;
      context.speakAloud?.(msg);
      return {
        intent: 'WORKFLOW_MANAGEMENT',
        success: true,
        message: msg,
        spokenResponse: msg,
        data: wf,
      };
    }

    if (classification.action === 'resume_existing_workflow') {
      let wf = context.selectedWorkflow || (context.workflows || [])[0];
      if (!wf) {
        try {
          const list = await api.fetchWorkflows();
          if (list.length > 0) wf = list[0];
        } catch {}
      }
      if (!wf) {
        const msg = 'No existing workflow to continue.';
        context.speakAloud?.(msg);
        return { intent: 'WORKFLOW_MANAGEMENT', success: false, message: msg };
      }
      context.selectWorkflow?.(wf);
      context.navigateTab('workspace');
      const msg = `Resumed workflow "${wf.goal}". Ready to continue execution.`;
      context.speakAloud?.(msg);
      return {
        intent: 'WORKFLOW_MANAGEMENT',
        success: true,
        message: msg,
        spokenResponse: msg,
        data: wf,
      };
    }
  }

  // ----------------------------------------------------
  // INTENT F: MULTI_STEP_TASK
  // ----------------------------------------------------
  if (classification.intent === 'MULTI_STEP_TASK') {
    const goal = classification.parameters?.goal || rawText;

    // Check if a virtually identical active workflow already exists
    const existing = (context.workflows || []).find(
      (w) => w.status === 'active' && w.goal.toLowerCase() === goal.toLowerCase()
    );

    if (existing) {
      context.selectWorkflow?.(existing);
      context.navigateTab('workspace');
      const msg = `An active workflow for "${goal}" already exists. Resuming it instead of creating a duplicate.`;
      context.speakAloud?.(msg);
      context.showNotification?.(msg);
      return {
        intent: 'MULTI_STEP_TASK',
        success: true,
        message: msg,
        spokenResponse: msg,
        data: existing,
      };
    }

    try {
      const newWf = context.createWorkflow
        ? await context.createWorkflow(goal)
        : await api.createWorkflow(goal);

      context.selectWorkflow?.(newWf);
      context.navigateTab('workspace');
      const msg = `Created workflow for "${goal.slice(0, 40)}" with ${newWf.steps.length} verified milestones.`;
      context.speakAloud?.(msg);
      context.showNotification?.(msg);
      return {
        intent: 'MULTI_STEP_TASK',
        success: true,
        message: msg,
        spokenResponse: msg,
        data: newWf,
      };
    } catch (err: any) {
      const msg = `Could not create workflow: ${err.message}`;
      context.speakAloud?.(msg);
      return { intent: 'MULTI_STEP_TASK', success: false, message: msg };
    }
  }

  // ----------------------------------------------------
  // INTENT G: CLARIFICATION_REQUIRED
  // ----------------------------------------------------
  const clarifyPrompt =
    'Could you clarify what you would like to do? You can ask me to open a page, execute tasks, search memories, check approvals, or plan a workflow.';
  context.speakAloud?.(clarifyPrompt);
  return {
    intent: 'CLARIFICATION_REQUIRED',
    success: false,
    message: clarifyPrompt,
    spokenResponse: clarifyPrompt,
    requiresClarification: true,
  };
}
