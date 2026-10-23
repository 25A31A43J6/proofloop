/**
 * ProofLoop Main Application Container
 * Tagline: "Don't just make a plan. Get it done."
 * Amazon Developer Hackathon 2026 — Alexa+ track
 */

import React, { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from 'react';
import { TopNav } from './components/TopNav.js';
import { Sidebar } from './components/Sidebar.js';
import { HomeDashboard } from './views/HomeDashboard.js';
import { AgentWorkspace } from './views/AgentWorkspace.js';

// Code-split secondary views & modals to minimize initial bundle size and speed up page load
const WorkflowsView = lazy(() => import('./views/WorkflowsView.js').then((m) => ({ default: m.WorkflowsView })));
const TasksView = lazy(() => import('./views/TasksView.js').then((m) => ({ default: m.TasksView })));
const ApprovalsView = lazy(() => import('./views/ApprovalsView.js').then((m) => ({ default: m.ApprovalsView })));
const MemoryView = lazy(() => import('./views/MemoryView.js').then((m) => ({ default: m.MemoryView })));
const ActivityLogView = lazy(() => import('./views/ActivityLogView.js').then((m) => ({ default: m.ActivityLogView })));
const MCPToolsView = lazy(() => import('./views/MCPToolsView.js').then((m) => ({ default: m.MCPToolsView })));
const SettingsView = lazy(() => import('./views/SettingsView.js').then((m) => ({ default: m.SettingsView })));

const WorkflowDetailPanel = lazy(() =>
  import('./components/WorkflowDetailPanel.js').then((m) => ({ default: m.WorkflowDetailPanel }))
);
const VerificationProofModal = lazy(() =>
  import('./components/VerificationProofModal.js').then((m) => ({ default: m.VerificationProofModal }))
);
const ApprovalActionModal = lazy(() =>
  import('./components/ApprovalActionModal.js').then((m) => ({ default: m.ApprovalActionModal }))
);
const ApplicationReviewModal = lazy(() =>
  import('./components/ApplicationReviewModal.js').then((m) => ({ default: m.ApplicationReviewModal }))
);

import { useVoice } from './context/VoiceContext.js';
import { useTheme } from './context/ThemeContext.js';
import {
  executeCommand,
  type CommandExecutionContext,
  type CommandExecutionResult,
} from './services/commandRouter.js';
import * as api from './services/api.js';
import type {
  Workflow,
  WorkflowStep,
  ApprovalRecord,
  MemoryRecord,
  VerificationRecord,
  ActivityLogEntry,
  MemoryCategory,
  InternshipApplicationData,
} from './types/index.js';

export default function App() {
  // Navigation & Panel state
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState<boolean>(false);

  // Background Voice Controller & Theme context
  const {
    registerWorkflowSync,
    registerNavigationHandler,
    registerCommandExecutor,
    setActiveWorkflowContext,
    toggleVoice,
    clickToExplainEnabled,
    setClickToExplainEnabled,
    speakAloudEnabled,
    setSpeakAloudEnabled,
    speak,
  } = useVoice();
  const { setTheme } = useTheme();


  // App domain state
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [memories, setMemories] = useState<MemoryRecord[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);

  // System & Connection state
  const [isMcpConnected, setIsMcpConnected] = useState<boolean>(true);
  const [isTestModeSimulateFailure, setIsTestModeSimulateFailure] = useState<boolean>(false);
  const [isDemoRunning, setIsDemoRunning] = useState<boolean>(false);
  const [isPlanning, setIsPlanning] = useState<boolean>(false);
  const [isRunAllLoading, setIsRunAllLoading] = useState<boolean>(false);
  const [executingStepId, setExecutingStepId] = useState<string | null>(null);
  const [isDecidingApproval, setIsDecidingApproval] = useState<boolean>(false);

  // Modals & Application Review state
  const [activeVerification, setActiveVerification] = useState<VerificationRecord | null>(null);
  const [activeApproval, setActiveApproval] = useState<ApprovalRecord | null>(null);
  const [currentApplication, setCurrentApplication] = useState<InternshipApplicationData | null>(null);
  const [isApplicationReviewOpen, setIsApplicationReviewOpen] = useState<boolean>(false);
  const [isAutoPreparingApp, setIsAutoPreparingApp] = useState<boolean>(false);

  // Notification message
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const selectedWorkflowRef = useRef<Workflow | null>(null);
  useEffect(() => {
    selectedWorkflowRef.current = selectedWorkflow;
  }, [selectedWorkflow]);

  // Load all initial data (stable dependency)
  const loadData = useCallback(async () => {
    try {
      const [wfs, apps, mems, logs, testState] = await Promise.all([
        api.fetchWorkflows(),
        api.fetchApprovals(),
        api.fetchMemories(),
        api.fetchActivityLogs(),
        api.fetchSimulatedFailureState(),
      ]);

      setWorkflows(wfs);
      setApprovals(apps);
      setMemories(mems);
      setActivityLogs(logs);
      setIsTestModeSimulateFailure(testState);

      const current = selectedWorkflowRef.current;
      const targetWf = current || (wfs.length > 0 ? wfs[0] : null);
      if (wfs.length > 0 && !current) {
        setSelectedWorkflow(wfs[0]);
      }

      if (targetWf) {
        const app = await api.fetchApplicationByWorkflow(targetWf.id).catch(() => null);
        setCurrentApplication(app);
      }
    } catch (err) {
      console.error('[ProofLoop] Error loading data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Check health once
    api.fetchHealth().then((h) => setIsMcpConnected(h.mcpConnected)).catch(() => {});
  }, [loadData]);

  // Sync background Voice Controller with active workflow and data reloads
  useEffect(() => {
    setActiveWorkflowContext(selectedWorkflow, currentApplication);
  }, [selectedWorkflow, currentApplication, setActiveWorkflowContext]);

  useEffect(() => {
    const unregister = registerWorkflowSync(loadData);
    return unregister;
  }, [registerWorkflowSync, loadData]);



  // Goal submission & Workflow Planning
  const handlePlanGoal = async (goal: string): Promise<Workflow> => {
    setIsPlanning(true);
    try {
      const newWf = await api.createWorkflow(goal);
      await loadData();
      setSelectedWorkflow(newWf);
      setIsDetailPanelOpen(true);
      setCurrentTab('workspace');
      showNotification(`Workflow created: ${goal.slice(0, 35)}...`);

      // If goal relates to an internship application, automatically prepare draft materials
      if (
        goal.toLowerCase().includes('internship') ||
        goal.toLowerCase().includes('apply') ||
        goal.toLowerCase().includes('application')
      ) {
        setIsAutoPreparingApp(true);
        try {
          const prepRes = await api.autoPrepareWorkflow(newWf.id);
          setSelectedWorkflow(prepRes.workflow);
          setCurrentApplication(prepRes.application || null);
          setWorkflows((prev) =>
            prev.map((w) => (w.id === newWf.id ? prepRes.workflow : w))
          );
          const freshApprovals = await api.fetchApprovals();
          setApprovals(freshApprovals);
          setIsApplicationReviewOpen(true);
          showNotification(
            'Internship materials prepared! Please review application draft and authorize sending.'
          );
          return prepRes.workflow;
        } catch (prepErr: any) {
          console.warn('[ProofLoop] Auto-prepare warning:', prepErr);
        } finally {
          setIsAutoPreparingApp(false);
        }
      }
      return newWf;
    } catch (err: any) {
      alert(`Error planning workflow: ${err.message}`);
      throw err;
    } finally {
      setIsPlanning(false);
    }
  };

  // Step Execution
  const handleExecuteStep = async (stepId: string) => {
    if (!selectedWorkflow) return;
    setExecutingStepId(stepId);
    try {
      const res = await api.executeStep(selectedWorkflow.id, stepId, isTestModeSimulateFailure);
      if (res.success) {
        showNotification(`Step verified complete! Evidence recorded.`);
      } else if (res.step.status === 'failed') {
        showNotification(`Step failed: ${res.error || 'Check recovery options'}`);
      }
      await refreshCurrentWorkflow(selectedWorkflow.id);
    } catch (err: any) {
      alert(`Execution error: ${err.message}`);
    } finally {
      setExecutingStepId(null);
    }
  };

  // Step Recovery
  const handleRecoverStep = async (stepId: string) => {
    if (!selectedWorkflow) return;
    setExecutingStepId(stepId);
    try {
      const res = await api.recoverStep(selectedWorkflow.id, stepId);
      showNotification(res.message);
      await refreshCurrentWorkflow(selectedWorkflow.id);
    } catch (err: any) {
      alert(`Recovery error: ${err.message}`);
    } finally {
      setExecutingStepId(null);
    }
  };

  // Run all steps
  const handleRunAll = async () => {
    if (!selectedWorkflow) return;
    setIsRunAllLoading(true);
    try {
      await api.runAllSteps(selectedWorkflow.id);
      await refreshCurrentWorkflow(selectedWorkflow.id);
      showNotification(`Executed available workflow milestones.`);
    } catch (err: any) {
      alert(`Error running steps: ${err.message}`);
    } finally {
      setIsRunAllLoading(false);
    }
  };

  // Refresh single workflow and globals
  const refreshCurrentWorkflow = async (workflowId: string) => {
    const [wfData, apps, logs, app] = await Promise.all([
      api.fetchWorkflow(workflowId),
      api.fetchApprovals(),
      api.fetchActivityLogs(),
      api.fetchApplicationByWorkflow(workflowId).catch(() => null),
    ]);
    setSelectedWorkflow(wfData.workflow);
    setApprovals(apps);
    setActivityLogs(logs);
    setCurrentApplication(app);

    setWorkflows((prev) =>
      prev.map((w) => (w.id === workflowId ? wfData.workflow : w))
    );
  };

  // Application Review & Dispatch Handlers
  const handleOpenApplicationReview = async (applicationId?: string) => {
    try {
      if (applicationId) {
        const app = await api.fetchApplication(applicationId);
        setCurrentApplication(app);
      } else if (selectedWorkflow) {
        const app = await api.fetchApplicationByWorkflow(selectedWorkflow.id);
        setCurrentApplication(app);
      }
    } catch (err: any) {
      console.warn('Error fetching application for review:', err);
    } finally {
      setIsApplicationReviewOpen(true);
    }
  };

  const handleUpdateApplicationDraft = async (
    updates: Partial<InternshipApplicationData>
  ): Promise<InternshipApplicationData> => {
    if (!currentApplication) throw new Error('No active application to update');
    const updated = await api.updateApplication(currentApplication.id, updates);
    setCurrentApplication(updated);
    if (selectedWorkflow) {
      await refreshCurrentWorkflow(selectedWorkflow.id);
    }
    showNotification('Draft updated. Previous human approval reset for security.');
    return updated;
  };

  const handleApproveAndSendApplication = async (
    id: string,
    approvedHash: string,
    idempotencyKey?: string
  ) => {
    const res = await api.approveAndSendApplication(id, approvedHash, idempotencyKey);
    if (res.application) {
      setCurrentApplication(res.application);
    }
    if (res.workflow) {
      setSelectedWorkflow(res.workflow);
      setWorkflows((prev) =>
        prev.map((w) => (w.id === res.workflow!.id ? res.workflow! : w))
      );
    }
    const [apps, logs] = await Promise.all([
      api.fetchApprovals(),
      api.fetchActivityLogs(),
    ]);
    setApprovals(apps);
    setActivityLogs(logs);

    if (res.success) {
      showNotification(
        `Application successfully sent! Provider Message ID: ${res.messageId}`
      );
    } else if (res.status === 'NOT_CONFIGURED') {
      showNotification(
        'Zero-fake-success: Live email provider not configured. Draft remains safely preserved.'
      );
    } else {
      showNotification(`Sending failed: ${res.error || 'Check details'}`);
    }

    return res;
  };

  const handleAutoPrepareApplication = async () => {
    if (!selectedWorkflow) return;
    setIsAutoPreparingApp(true);
    try {
      const prepRes = await api.autoPrepareWorkflow(selectedWorkflow.id);
      setSelectedWorkflow(prepRes.workflow);
      setCurrentApplication(prepRes.application || null);
      setWorkflows((prev) =>
        prev.map((w) => (w.id === prepRes.workflow.id ? prepRes.workflow : w))
      );
      const [apps, logs] = await Promise.all([
        api.fetchApprovals(),
        api.fetchActivityLogs(),
      ]);
      setApprovals(apps);
      setActivityLogs(logs);
      setIsApplicationReviewOpen(true);
      showNotification('Milestones 1-7 verified! Review application draft before sending.');
    } catch (err: any) {
      alert(`Auto-prepare failed: ${err.message}`);
    } finally {
      setIsAutoPreparingApp(false);
    }
  };

  // Run Hackathon Demo Scenario
  const handleRunDemo = async () => {
    setIsDemoRunning(true);
    try {
      const demoResult = await api.runDemoScenario(false);
      await loadData();
      setSelectedWorkflow(demoResult.workflow);
      setIsDetailPanelOpen(true);
      setCurrentTab('workspace');
      showNotification(
        `Hackathon demo completed: ${demoResult.readinessReport.completedCount} steps verified!`
      );
    } catch (err: any) {
      alert(`Error running demo scenario: ${err.message}`);
    } finally {
      setIsDemoRunning(false);
    }
  };

  // Toggle failure test mode
  const handleToggleTestMode = async () => {
    const newState = await api.toggleSimulatedFailure();
    setIsTestModeSimulateFailure(newState);
    showNotification(
      newState
        ? 'Developer Test Mode Activated: Tool calls will simulate recoverable timeouts.'
        : 'Developer Test Mode Disabled: Live execution restored.'
    );
  };

  // Decide Approval
  const handleDecideApproval = async (id: string, status: 'approved' | 'rejected') => {
    setIsDecidingApproval(true);
    try {
      await api.decideApproval(id, status);
      await loadData();
      if (selectedWorkflow) {
        await refreshCurrentWorkflow(selectedWorkflow.id);
      }
      setActiveApproval(null);
      showNotification(`Action ${status} by human reviewer.`);
    } catch (err: any) {
      alert(`Approval decision error: ${err.message}`);
    } finally {
      setIsDecidingApproval(false);
    }
  };

  const handleExecuteCommand = useCallback(
    async (rawText: string): Promise<CommandExecutionResult> => {
      const context: CommandExecutionContext = {
        currentTab,
        workflows,
        selectedWorkflow,
        currentApplication,
        approvals,
        memories,
        clickToExplainEnabled,
        speakAloudEnabled,
        isTestModeSimulateFailure,
        navigateTab: (tab: string) => setCurrentTab(tab),
        setClickToExplain: setClickToExplainEnabled,
        setSpeakAloud: setSpeakAloudEnabled,
        setTheme,
        toggleTestMode: handleToggleTestMode,
        selectWorkflow: (wf: Workflow) => {
          setSelectedWorkflow(wf);
          setIsDetailPanelOpen(true);
        },
        openApplicationReview: handleOpenApplicationReview,
        openApprovalModal: (appr: ApprovalRecord) => setActiveApproval(appr),
        executeStep: async (wfId: string, stepId: string) => {
          return await api.executeStep(wfId, stepId, isTestModeSimulateFailure);
        },
        recoverStep: async (wfId: string, stepId: string) => {
          return await api.recoverStep(wfId, stepId);
        },
        runAllSteps: async (wfId: string) => {
          return await api.runAllSteps(wfId);
        },
        createWorkflow: handlePlanGoal,
        approveAndSendApplication: handleApproveAndSendApplication,
        reloadAll: loadData,
        speakAloud: (text: string) => speak(text),
        showNotification,
      };

      return await executeCommand(rawText, context);
    },
    [
      currentTab,
      workflows,
      selectedWorkflow,
      currentApplication,
      approvals,
      memories,
      clickToExplainEnabled,
      speakAloudEnabled,
      isTestModeSimulateFailure,
      setClickToExplainEnabled,
      setSpeakAloudEnabled,
      setTheme,
      handleToggleTestMode,
      handleOpenApplicationReview,
      handleApproveAndSendApplication,
      loadData,
      speak,
    ]
  );

  // Register navigation handler and command executor with background Voice Controller
  useEffect(() => {
    const unregisterNav = registerNavigationHandler((tab) => setCurrentTab(tab));
    return unregisterNav;
  }, [registerNavigationHandler]);

  useEffect(() => {
    const unregisterExec = registerCommandExecutor(handleExecuteCommand);
    return unregisterExec;
  }, [registerCommandExecutor, handleExecuteCommand]);

  const pendingApprovalsCount = useMemo(
    () => approvals.filter((a) => a.status === 'pending').length,
    [approvals]
  );
  const activeWorkflowsCount = useMemo(
    () => workflows.filter((w) => w.status === 'active').length,
    [workflows]
  );

  return (
    <div className="flex flex-col h-screen w-full bg-neutral-100/50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans antialiased overflow-hidden">
      {/* Top Navigation */}
      <TopNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isMcpConnected={isMcpConnected}
        isTestModeSimulateFailure={isTestModeSimulateFailure}
        onToggleTestMode={handleToggleTestMode}
        onRunDemo={handleRunDemo}
        isDemoRunning={isDemoRunning}
        pendingApprovalsCount={pendingApprovalsCount}
      />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          pendingApprovalsCount={pendingApprovalsCount}
          activeWorkflowsCount={activeWorkflowsCount}
        />

        {/* Central Viewport */}
        <main className="flex-1 flex overflow-hidden relative">
          <Suspense
            fallback={
              <div className="flex-1 flex items-center justify-center p-12 text-neutral-400 text-sm">
                <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-2.5"></div>
                Loading view...
              </div>
            }
          >
          {currentTab === 'home' && (
            <HomeDashboard
              workflows={workflows}
              approvals={approvals}
              activityLogs={activityLogs}
              onSubmitGoal={async (goal) => {
                await handleExecuteCommand(goal);
              }}
              onOpenWorkflow={async (wf) => {
                setSelectedWorkflow(wf);
                setIsDetailPanelOpen(true);
                setCurrentTab('workspace');
                const app = await api.fetchApplicationByWorkflow(wf.id).catch(() => null);
                setCurrentApplication(app);
              }}
              onRunDemo={handleRunDemo}
              isDemoRunning={isDemoRunning}
              onSelectTab={setCurrentTab}
            />
          )}

          {currentTab === 'workspace' && (
            <AgentWorkspace
              currentWorkflow={selectedWorkflow}
              currentApplication={currentApplication}
              onPlanGoal={async (goal) => {
                await handleExecuteCommand(goal);
              }}
              onExecuteStep={handleExecuteStep}
              onRecoverStep={handleRecoverStep}
              onRunAll={handleRunAll}
              onInspectVerification={setActiveVerification}
              onRequestApproval={(step) => {
                if (
                  currentApplication &&
                  (step.actionType === 'dispatch' ||
                    step.title.toLowerCase().includes('application') ||
                    step.title.toLowerCase().includes('approve') ||
                    step.title.toLowerCase().includes('send'))
                ) {
                  handleOpenApplicationReview();
                } else {
                  const appr = approvals.find((a) => a.stepId === step.id);
                  if (appr) setActiveApproval(appr);
                }
              }}
              onOpenApplicationReview={() => handleOpenApplicationReview()}
              onAutoPrepareApplication={handleAutoPrepareApplication}
              onOpenVoiceMode={() => toggleVoice()}

              executingStepId={executingStepId}
              isPlanning={isPlanning}
              isAutoPreparing={isAutoPreparingApp}
            />
          )}

          {currentTab === 'workflows' && (
            <WorkflowsView
              workflows={workflows}
              onOpenWorkflow={async (wf) => {
                setSelectedWorkflow(wf);
                setIsDetailPanelOpen(true);
                setCurrentTab('workspace');
                const app = await api.fetchApplicationByWorkflow(wf.id).catch(() => null);
                setCurrentApplication(app);
              }}
              onDeleteWorkflow={async (id) => {
                await api.deleteWorkflow(id);
                await loadData();
                if (selectedWorkflow?.id === id) {
                  setSelectedWorkflow(null);
                  setIsDetailPanelOpen(false);
                }
              }}
              onCreateWorkflow={async (goal) => {
                await handlePlanGoal(goal);
              }}
            />
          )}

          {currentTab === 'tasks' && (
            <TasksView
              workflows={workflows}
              onExecuteStep={async (wfId, stepId) => {
                const wf = workflows.find((w) => w.id === wfId);
                if (wf) {
                  setSelectedWorkflow(wf);
                  const app = await api.fetchApplicationByWorkflow(wf.id).catch(() => null);
                  setCurrentApplication(app);
                }
                await handleExecuteStep(stepId);
              }}
              onRecoverStep={async (wfId, stepId) => {
                const wf = workflows.find((w) => w.id === wfId);
                if (wf) {
                  setSelectedWorkflow(wf);
                  const app = await api.fetchApplicationByWorkflow(wf.id).catch(() => null);
                  setCurrentApplication(app);
                }
                await handleRecoverStep(stepId);
              }}
              onInspectVerification={setActiveVerification}
              onRequestApproval={(step) => {
                if (
                  currentApplication &&
                  (step.actionType === 'dispatch' ||
                    step.title.toLowerCase().includes('application') ||
                    step.title.toLowerCase().includes('approve') ||
                    step.title.toLowerCase().includes('send'))
                ) {
                  handleOpenApplicationReview();
                } else {
                  const appr = approvals.find((a) => a.stepId === step.id);
                  if (appr) setActiveApproval(appr);
                }
              }}
              executingStepId={executingStepId}
            />
          )}

          {currentTab === 'approvals' && (
            <ApprovalsView
              approvals={approvals}
              onDecide={handleDecideApproval}
              onOpenApplicationReview={(appId) => handleOpenApplicationReview(appId)}
              isDeciding={isDecidingApproval}
            />
          )}

          {currentTab === 'memory' && (
            <MemoryView
              memories={memories}
              onAddMemory={async (payload) => {
                await api.createMemory(payload);
                const mems = await api.fetchMemories();
                setMemories(mems);
                showNotification('Memory persisted successfully.');
              }}
              onDeleteMemory={async (id) => {
                await api.deleteMemory(id);
                const mems = await api.fetchMemories();
                setMemories(mems);
              }}
              onUpdateMemory={async (id, content) => {
                await api.updateMemory(id, { content });
                const mems = await api.fetchMemories();
                setMemories(mems);
                showNotification('Memory updated.');
              }}
            />
          )}

          {currentTab === 'activity' && <ActivityLogView logs={activityLogs} />}

          {currentTab === 'mcp' && <MCPToolsView />}

          {currentTab === 'settings' && (
            <SettingsView
              isTestModeSimulateFailure={isTestModeSimulateFailure}
              onToggleTestMode={handleToggleTestMode}
              workflowsCount={workflows.length}
              memoriesCount={memories.length}
            />
          )}
          </Suspense>
        </main>

        {/* Collapsible Right-Side Workflow Details Panel */}
        <Suspense fallback={null}>
          {isDetailPanelOpen && selectedWorkflow && (
            <WorkflowDetailPanel
              workflow={selectedWorkflow}
              onClose={() => setIsDetailPanelOpen(false)}
              onExecuteStep={handleExecuteStep}
              onRecoverStep={handleRecoverStep}
              onRunAll={handleRunAll}
              onInspectVerification={setActiveVerification}
              onRequestApproval={(step) => {
                if (
                  currentApplication &&
                  (step.actionType === 'dispatch' ||
                    step.title.toLowerCase().includes('application') ||
                    step.title.toLowerCase().includes('approve') ||
                    step.title.toLowerCase().includes('send'))
                ) {
                  handleOpenApplicationReview();
                } else {
                  const appr = approvals.find((a) => a.stepId === step.id);
                  if (appr) setActiveApproval(appr);
                }
              }}
              onOpenApplicationReview={(appId) => handleOpenApplicationReview(appId)}
              executingStepId={executingStepId}
              isRunAllLoading={isRunAllLoading}
            />
          )}

          {/* Verification Proof Inspector Modal */}
          {activeVerification && (
            <VerificationProofModal
              record={activeVerification}
              onClose={() => setActiveVerification(null)}
            />
          )}

          {/* Approval Consequential Action Modal */}
          {activeApproval && (
            <ApprovalActionModal
              approval={activeApproval}
              onDecide={handleDecideApproval}
              onClose={() => setActiveApproval(null)}
              isDeciding={isDecidingApproval}
            />
          )}

          {/* Human-in-the-Loop Application Review Modal */}
          {isApplicationReviewOpen && (
            <ApplicationReviewModal
              application={currentApplication}
              isOpen={isApplicationReviewOpen}
              onClose={() => setIsApplicationReviewOpen(false)}
              onUpdateDraft={handleUpdateApplicationDraft}
              onApproveAndSend={handleApproveAndSendApplication}
            />
          )}
        </Suspense>
      </div>

      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs px-4 py-2.5 rounded-lg shadow-lg border border-neutral-700 dark:border-neutral-200 transition-all">
          {notification}
        </div>
      )}
    </div>
  );
}
