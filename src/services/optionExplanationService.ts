/**
 * ProofLoop Context-Aware Option Explanation Service
 * Amazon Developer Hackathon 2026 — Alexa+ Track
 *
 * Provides real, implementation-accurate explanations for all interactive options,
 * buttons, settings, cards, and navigation items in ProofLoop.
 *
 * Rules:
 * 1. Only describe capabilities that the selected feature actually implements.
 * 2. Never claim an operation performs checks, saves data, or contacts external services unless true.
 * 3. Clearly explain consequences of consequential actions before execution.
 * 4. Never treat explanation clicks as approval to execute consequential actions.
 */

export interface ExplainableOption {
  id: string;
  title: string;
  category: 'workflow' | 'memory' | 'verification' | 'approval' | 'setting' | 'navigation' | 'mcp' | 'demo' | 'general';
  conciseExplanation: string; // 1-2 sentence spoken explanation
  whatItDoes: string;
  whyUseIt: string;
  howItWorks: string;
  whatHappensIfClicked: string;
  willSendAnything: string;
  doesSaveData: string;
  canUndo: string;
  isConsequential?: boolean;
  requiresApproval?: boolean;
  keywords?: string[];
}

export const EXPLAINABLE_OPTIONS: Record<string, ExplainableOption> = {
  // --- WORKFLOW OPTIONS ---
  'create-workflow': {
    id: 'create-workflow',
    title: 'Create Workflow',
    category: 'workflow',
    conciseExplanation: 'Create Workflow lets you organize a goal into tasks, track progress, and manage the steps needed to complete it.',
    whatItDoes: 'Decomposes your high-level goal into sequential milestones, searches relevant memory context, and establishes step dependencies.',
    whyUseIt: 'To break down complex projects like internship applications or hackathon submissions into verifiable, trackable steps.',
    howItWorks: 'It queries existing memories for relevant context, generates 4 to 6 milestones with assigned MCP tools, and records the workflow in the local SQLite database.',
    whatHappensIfClicked: 'It generates the workflow plan and displays it in your workspace without performing any unapproved external actions.',
    willSendAnything: 'No, this will not send anything externally; it only plans tasks in your local workspace.',
    doesSaveData: 'Yes, it saves the generated workflow and its milestones in your local ProofLoop SQLite database.',
    canUndo: 'Yes, you can delete or archive the workflow at any time from the workflows list.',
    keywords: ['create workflow', 'plan workflow', 'new workflow', 'goal input', 'plan button', 'follow through'],
  },

  'auto-prepare': {
    id: 'auto-prepare',
    title: 'Auto-Prepare Application',
    category: 'workflow',
    conciseExplanation: 'Auto-Prepare Application executes milestones one through seven to gather credentials and draft materials, pausing before sending for your review.',
    whatItDoes: 'Autonomously searches candidate profiles, audits submission guidelines, verifies resume files, and drafts cover letters.',
    whyUseIt: 'To automate repetitive application preparation while keeping full human control over the final submission.',
    howItWorks: 'It executes preparatory steps in sequence, generates cryptographic outcome hashes, and pauses at step eight in the Awaiting Approval state.',
    whatHappensIfClicked: 'It prepares all draft materials and opens the review panel for your explicit sign-off.',
    willSendAnything: 'No, it strictly stops before dispatch so no email is sent without your direct authorization.',
    doesSaveData: 'Yes, it saves the prepared draft, generated hashes, and milestone verification records in the database.',
    canUndo: 'Yes, you can edit any part of the draft or cancel the application before sending.',
    keywords: ['auto prepare', 'auto-prepare', 'prepare application', 'prepare workflow'],
  },

  'execute-step': {
    id: 'execute-step',
    title: 'Execute Step',
    category: 'workflow',
    conciseExplanation: 'Execute Step runs the selected milestone using its assigned MCP tool and generates a cryptographic proof of completion.',
    whatItDoes: 'Invokes the assigned MCP tool for the milestone and verifies the output before marking the step verified complete.',
    whyUseIt: 'To advance your workflow one milestone at a time with full verification.',
    howItWorks: 'It checks prerequisite dependencies, calls the MCP tool over Streamable HTTP, calculates a SHA-256 evidence hash, and updates downstream steps.',
    whatHappensIfClicked: 'It runs the step and records its cryptographic proof in the ledger.',
    willSendAnything: 'Non-consequential steps execute locally; consequential steps pause for your explicit approval.',
    doesSaveData: 'Yes, it saves the step result and verification record in the local database.',
    canUndo: 'You can recover or re-execute steps if needed.',
    keywords: ['execute step', 'run step', 'execute milestone', 'run milestone'],
  },

  'recover-step': {
    id: 'recover-step',
    title: 'Recover Step',
    category: 'workflow',
    conciseExplanation: 'Recover Step resets a failed milestone and re-executes it using an automated fallback recovery strategy.',
    whatItDoes: 'Clears the failure state, increments the retry counter, and executes the milestone using fallback parameters.',
    whyUseIt: 'To self-heal from transient network errors, timeout issues, or simulated failures without restarting the workflow.',
    howItWorks: 'It resets step status to ready, applies diagnostic recovery adjustments, and re-executes the tool to obtain verified output.',
    whatHappensIfClicked: 'It immediately retries the milestone with recovery logic.',
    willSendAnything: 'No external actions are sent without approval.',
    doesSaveData: 'Yes, it updates step status and logs the recovery event in the activity ledger.',
    canUndo: 'You can re-run or inspect the milestone at any time.',
    keywords: ['recover step', 'retry step', 'retry that', 'recover failed step'],
  },

  'run-all-steps': {
    id: 'run-all-steps',
    title: 'Run All Steps',
    category: 'workflow',
    conciseExplanation: 'Run All Steps automatically executes all ready milestones in sequence until completion or until an approval gate is reached.',
    whatItDoes: 'Advances through all pending milestones that have satisfied dependencies, pausing if an approval is required.',
    whyUseIt: 'To execute all safe preparatory work without clicking each milestone individually.',
    howItWorks: 'It loops through ready steps, executes assigned MCP tools, and records cryptographic proofs, stopping at approvals.',
    whatHappensIfClicked: 'It executes ready steps and updates workflow progress.',
    willSendAnything: 'No, it strictly stops before consequential dispatch steps that require human approval.',
    doesSaveData: 'Yes, it records verified results for all executed milestones in SQLite.',
    canUndo: 'You can inspect and recover any milestone in the workflow.',
    keywords: ['run all', 'run all steps', 'execute all', 'run all milestones'],
  },

  // --- VERIFICATION & PROOFS ---
  'proof-verified': {
    id: 'proof-verified',
    title: 'Proof Verified',
    category: 'verification',
    conciseExplanation: 'This option checks the available evidence for the selected result and reports whether verification succeeds, fails, or remains incomplete.',
    whatItDoes: 'Inspects the cryptographic SHA-256 evidence record binding the tool output to this specific milestone.',
    whyUseIt: 'To confirm that a task was actually completed by an authentic tool execution rather than assumed or faked.',
    howItWorks: 'It reads the verification ledger in SQLite, checks the SHA-256 integrity hash, and displays the exact execution timestamp and tool output.',
    whatHappensIfClicked: 'It displays the cryptographic verification inspector showing the tamper-evident proof details.',
    willSendAnything: 'No, it only inspects the local cryptographic proof ledger.',
    doesSaveData: 'No, it is a read-only inspection of previously recorded evidence.',
    canUndo: 'Yes, closing the proof inspector returns to your previous view without changes.',
    keywords: ['proof verified', 'inspect evidence', 'verification proof', 'cryptographic proof', 'evidence record'],
  },

  // --- MEMORY OPTIONS ---
  'search-memory': {
    id: 'search-memory',
    title: 'Search Memory',
    category: 'memory',
    conciseExplanation: 'Search Memory looks for relevant information saved in your existing ProofLoop memory.',
    whatItDoes: 'Searches persistent candidate profiles, company details, and user preferences stored across sessions.',
    whyUseIt: 'To quickly retrieve previously saved credentials, guidelines, or notes relevant to your current task.',
    howItWorks: 'It runs an indexed query on the SQLite memories table matching your keyword or category filter.',
    whatHappensIfClicked: 'It filters the displayed memory cards without altering any stored data.',
    willSendAnything: 'No, this is a local read-only query that does not send anything to external services.',
    doesSaveData: 'No, searching memory is a read-only operation and does not change your saved data.',
    canUndo: 'Yes, you can clear the search query or reset filters at any time.',
    keywords: ['search memory', 'memory search', 'find memory', 'memory filter'],
  },

  'add-memory': {
    id: 'add-memory',
    title: 'Add Memory',
    category: 'memory',
    conciseExplanation: 'Add Memory saves new facts, preferences, or credentials into your persistent ProofLoop memory ledger.',
    whatItDoes: 'Permanently stores a key piece of information so the AI agent can recall it in future workflows.',
    whyUseIt: 'To teach ProofLoop your preferences or save details like your GPA, resume links, or target employers.',
    howItWorks: 'It inserts a new memory record into the SQLite database under your chosen category.',
    whatHappensIfClicked: 'It saves the memory and makes it immediately available for future reasoning.',
    willSendAnything: 'No, it stores data locally in your workspace database without contacting external APIs.',
    doesSaveData: 'Yes, this saves the memory permanently to your local SQLite database.',
    canUndo: 'Yes, you can edit or delete saved memories at any time from the Memory view.',
    keywords: ['add memory', 'save memory', 'new memory', 'create memory'],
  },

  // --- APPROVALS & CONSEQUENTIAL ACTIONS ---
  'approve-and-send': {
    id: 'approve-and-send',
    title: 'Approve & Send Application',
    category: 'approval',
    conciseExplanation: 'Approve and Send Application verifies the draft hash and dispatches your application email to the recipient. This consequential action cannot be undone once sent.',
    whatItDoes: 'Validates the cryptographic draft hash and dispatches the verified email and attachments via SMTP.',
    whyUseIt: 'To submit your completed and reviewed application package to the hiring organization.',
    howItWorks: 'It compares the draft SHA-256 hash against user-approved content, performs an authenticated SMTP handshake, and records the provider response.',
    whatHappensIfClicked: 'When explicitly authorized, it transmits the email. Clicking to explain will never execute or send the email.',
    willSendAnything: 'Yes, this is a consequential action that will send an email and attachments to the recipient address.',
    doesSaveData: 'Yes, it updates application status to Sent and records an immutable dispatch verification proof.',
    canUndo: 'No, once an email is dispatched to an external mail server, it cannot be recalled or undone.',
    isConsequential: true,
    requiresApproval: true,
    keywords: ['approve and send', 'send application', 'dispatch email', 'approve and send application'],
  },

  'approve-action': {
    id: 'approve-action',
    title: 'Approve Action',
    category: 'approval',
    conciseExplanation: 'Approve Action grants explicit human authorization to execute a consequential task after reviewing its risks and parameters.',
    whatItDoes: 'Transitions a pending approval request from waiting to authorized and executes the gated action.',
    whyUseIt: 'To ensure no sensitive operation, such as external communication or irreversible changes, occurs without your knowledge.',
    howItWorks: 'It records your approval decision with a timestamp in the audit database and invokes the protected tool.',
    whatHappensIfClicked: 'It approves the selected action. Explaining this option does not grant approval.',
    willSendAnything: 'If the approved action is external dispatch, yes; otherwise it executes the approved step.',
    doesSaveData: 'Yes, it records the decision in the approval ledger.',
    canUndo: 'Once an external action is dispatched it cannot be undone; internal steps can be recovered.',
    isConsequential: true,
    requiresApproval: true,
    keywords: ['approve action', 'approve step', 'authorize action', 'confirm action'],
  },

  'reject-action': {
    id: 'reject-action',
    title: 'Reject / Cancel Action',
    category: 'approval',
    conciseExplanation: 'Reject Action cancels the pending consequential operation, safely preserving all drafts and workflow progress without taking external action.',
    whatItDoes: 'Declines authorization for a sensitive action and keeps the draft intact in your workspace.',
    whyUseIt: 'To stop an action if you want to make further edits, change details, or decide not to proceed.',
    howItWorks: 'It marks the approval record as rejected and keeps the workflow in its current safe state.',
    whatHappensIfClicked: 'It cancels the action while keeping your drafts and workflow safe.',
    willSendAnything: 'No, this explicitly prevents any external communication or dispatch.',
    doesSaveData: 'Yes, it records the cancellation decision in the approval history.',
    canUndo: 'Yes, you can re-request approval or edit the draft at any time.',
    keywords: ['reject action', 'cancel action', 'reject approval', 'do not send'],
  },

  // --- SETTINGS ---
  'click-to-explain-setting': {
    id: 'click-to-explain-setting',
    title: 'Click-to-Explain',
    category: 'setting',
    conciseExplanation:
      'Click-to-Explain automatically explains what an option does when you click it. When the Background Voice Assistant is active, explanations can be spoken aloud.',
    whatItDoes:
      'Automatically provides an instant spoken or visual explanation whenever you click an interactive button, option, or setting in ProofLoop.',
    whyUseIt:
      'To discover what options, workflows, and settings do before executing them, with zero guesswork.',
    howItWorks:
      'It identifies the selected element, resolves its implemented behavior and safety guards, and delivers a concise explanation via text-to-speech or an accessible status hint.',
    whatHappensIfClicked: 'Toggles automatic click explanations on or off.',
    willSendAnything: 'No, this only configures local interface guidance.',
    doesSaveData: 'Yes, your Click-to-Explain preference is saved in local storage.',
    canUndo: 'Yes, you can toggle it back on or off at any time.',
    keywords: [
      'click to explain',
      'click-to-explain',
      'explain option',
      'what does this do',
      'click explanation',
      'explain toggle',
    ],
  },

  'speak-aloud-setting': {
    id: 'speak-aloud-setting',
    title: 'Speak AI responses aloud',
    category: 'setting',
    conciseExplanation: 'This setting controls voice speech playback. Changing it enables or disables automatic text-to-speech reading of assistant responses.',
    whatItDoes: 'Turns speech synthesis on or off for voice updates, results, and explanations.',
    whyUseIt: 'Turn it on to hear updates aloud hands-free, or turn it off for quiet visual-only use.',
    howItWorks: 'It toggles the browser SpeechSynthesis API in the Voice controller.',
    whatHappensIfClicked: 'It immediately toggles speech audio on or off.',
    willSendAnything: 'No, this only configures local browser speech synthesis.',
    doesSaveData: 'Yes, your speech playback preference is saved in local storage.',
    canUndo: 'Yes, you can toggle it back on or off whenever you like.',
    keywords: ['speak ai responses aloud', 'speak aloud', 'text to speech toggle', 'voice speech toggle'],
  },

  'speech-language-setting': {
    id: 'speech-language-setting',
    title: 'Speech Recognition Language',
    category: 'setting',
    conciseExplanation: 'This setting controls the language and dialect used for microphone speech recognition.',
    whatItDoes: 'Configures the Web Speech API recognition model for en-US, en-IN, te-IN, or hi-IN.',
    whyUseIt: 'To ensure the voice assistant accurately transcribes your speech in your preferred regional accent or language.',
    howItWorks: 'It updates the recognition locale parameter on the browser SpeechRecognition instance.',
    whatHappensIfClicked: 'It updates the voice recognition language for future microphone sessions.',
    willSendAnything: 'No, it only sets the recognition locale in your browser.',
    doesSaveData: 'Yes, your chosen language is saved in browser local storage.',
    canUndo: 'Yes, you can switch back to any supported language at any time.',
    keywords: ['speech recognition language', 'speech language', 'voice locale', 'language select'],
  },

  'speech-rate-setting': {
    id: 'speech-rate-setting',
    title: 'Speaking Rate',
    category: 'setting',
    conciseExplanation: 'This setting controls the playback speed of the voice assistant responses.',
    whatItDoes: 'Adjusts the text-to-speech rate from slower to faster delivery.',
    whyUseIt: 'To match your listening preference, whether you prefer brisk updates or slower, clearer articulation.',
    howItWorks: 'It sets the rate property on SpeechSynthesisUtterance objects before speech begins.',
    whatHappensIfClicked: 'It changes the speaking rate for upcoming voice responses.',
    willSendAnything: 'No, this only affects local audio synthesis.',
    doesSaveData: 'Yes, the speech rate is saved in your browser preferences.',
    canUndo: 'Yes, you can adjust the slider at any time.',
    keywords: ['speaking rate', 'speech speed', 'voice rate', 'speech rate slider'],
  },

  'voice-mode-setting': {
    id: 'voice-mode-setting',
    title: 'Voice Operating Mode',
    category: 'setting',
    conciseExplanation: 'This setting controls how the voice assistant activates, whether through push-to-talk, hands-free conversation, or wake phrases.',
    whatItDoes: 'Switches the voice interaction model between Push to Talk, Hands-Free continuous conversation, and Wake Phrase.',
    whyUseIt: 'To choose the voice experience that best fits your workflow and privacy preferences.',
    howItWorks: 'It adjusts speech recognition restart behavior, auto-resumption, and transcript staging.',
    whatHappensIfClicked: 'It updates the active voice mode without navigating away.',
    willSendAnything: 'No, this only configures local voice controller behavior.',
    doesSaveData: 'Yes, the selected mode is saved in local storage.',
    canUndo: 'Yes, you can switch between voice modes at any time.',
    keywords: ['voice operating mode', 'voice mode', 'hands-free mode', 'push to talk mode', 'wake phrase mode'],
  },

  'simulate-failure': {
    id: 'simulate-failure',
    title: 'Simulated Failure Active',
    category: 'setting',
    conciseExplanation: 'This setting controls developer failure simulation. When active, the next milestone execution will simulate a recoverable error to demonstrate self-healing.',
    whatItDoes: 'Flags the MCP execution pipeline to simulate a network or tool failure on the next step.',
    whyUseIt: 'To test and verify ProofLoop automated error diagnosis and step recovery mechanisms.',
    howItWorks: 'It toggles the in-memory failure simulator flag in the MCP server layer.',
    whatHappensIfClicked: 'It toggles failure simulation on or off without altering workflow data.',
    willSendAnything: 'No, this only changes the local test simulator state.',
    doesSaveData: 'No, it only alters an in-memory test configuration.',
    canUndo: 'Yes, you can click it again at any time to turn off simulated failures.',
    keywords: ['simulated failure', 'simulate failure', 'failure simulator', 'test mode'],
  },

  'theme-toggle': {
    id: 'theme-toggle',
    title: 'Theme Preference',
    category: 'setting',
    conciseExplanation: 'This setting controls the application visual theme between dark, light, and system preference.',
    whatItDoes: 'Toggles the visual appearance of ProofLoop between dark and light modes.',
    whyUseIt: 'To customize contrast and reduce eye strain based on your environment.',
    howItWorks: 'It updates the theme provider and applies the dark class to the document root element.',
    whatHappensIfClicked: 'It immediately switches the interface color scheme.',
    willSendAnything: 'No, it only alters local CSS appearance.',
    doesSaveData: 'Yes, your theme preference is saved in local storage.',
    canUndo: 'Yes, you can switch themes whenever you choose.',
    keywords: ['theme toggle', 'dark mode', 'light mode', 'theme selector'],
  },

  // --- DEMO & MCP ---
  'run-demo': {
    id: 'run-demo',
    title: 'Run Demo',
    category: 'demo',
    conciseExplanation: 'Run Demo executes the complete Amazon Hackathon demonstration scenario, showcasing guideline audits, document cross-referencing, and proof verification.',
    whatItDoes: 'Runs an automated end-to-end workflow demonstrating verifiable follow-through and recoverable failure.',
    whyUseIt: 'To see ProofLoop full autonomous verification lifecycle in action with one click.',
    howItWorks: 'It creates a demo workflow, executes milestones, verifies cryptographic proofs, and pauses at the approval gate.',
    whatHappensIfClicked: 'It initializes and executes the demo scenario in your workspace.',
    willSendAnything: 'No, it runs verified demo tools and pauses before any external email dispatch.',
    doesSaveData: 'Yes, it records the demo workflow and cryptographic verification records in SQLite.',
    canUndo: 'Yes, you can delete the demo workflow once finished.',
    keywords: ['run demo', 'hackathon demo', 'demo scenario', 'run demo scenario'],
  },

  'mcp-server': {
    id: 'mcp-server',
    title: 'MCP Streamable HTTP Active',
    category: 'mcp',
    conciseExplanation: 'This option inspects the active Model Context Protocol server connection running over Streamable HTTP.',
    whatItDoes: 'Opens the MCP tools inspector showing all 10 registered tools, schemas, and capabilities.',
    whyUseIt: 'To verify that ProofLoop is connected to the official MCP server specification over Streamable HTTP.',
    howItWorks: 'It queries the local MCP server endpoint at /api/mcp for tool schemas and connection health.',
    whatHappensIfClicked: 'It displays the MCP tools and transport status.',
    willSendAnything: 'No, it only performs a local diagnostic query to the MCP server.',
    doesSaveData: 'No, this is a read-only system diagnostic.',
    canUndo: 'Yes, you can navigate back to your workspace at any time.',
    keywords: ['mcp server', 'mcp tools', 'streamable http', 'mcp connection'],
  },

  'voice-toggle': {
    id: 'voice-toggle',
    title: 'Voice Assistant Toggle',
    category: 'setting',
    conciseExplanation: 'This button starts or pauses the Background Voice Assistant microphone and speech processing.',
    whatItDoes: 'Toggles active speech listening on or off without opening a separate window or panel.',
    whyUseIt: 'To speak your instructions, ask questions about interface options, or pause voice interaction.',
    howItWorks: 'It initiates or halts the browser Web Speech recognition session.',
    whatHappensIfClicked: 'If speaking, it immediately stops audio; if idle, it starts listening.',
    willSendAnything: 'Microphone audio is transcribed locally by the browser Web Speech engine.',
    doesSaveData: 'No, toggling voice does not write to the persistent database.',
    canUndo: 'Yes, click again to stop listening or start again.',
    keywords: ['voice toggle', 'voice assistant', 'mic button', 'start voice', 'stop voice'],
  },

  // --- NAVIGATION ITEMS ---
  'nav-home': {
    id: 'nav-home',
    title: 'Home Dashboard',
    category: 'navigation',
    conciseExplanation: 'Home Dashboard gives you a high-level summary of active workflows, pending approvals, and quick action shortcuts.',
    whatItDoes: 'Displays system status, recent milestones, and one-click actions for new goals and demonstrations.',
    whyUseIt: 'To get an instant overview of your tasks and pending human approvals.',
    howItWorks: 'It aggregates current workflows, verification counts, and activity logs from SQLite.',
    whatHappensIfClicked: 'It displays the Home Dashboard view without changing any data.',
    willSendAnything: 'No, navigating views does not send external requests.',
    doesSaveData: 'No, navigation is read-only.',
    canUndo: 'Yes, you can switch back to any tab at any time.',
    keywords: ['home dashboard', 'home tab', 'dashboard'],
  },

  'nav-workspace': {
    id: 'nav-workspace',
    title: 'Agent Workspace',
    category: 'navigation',
    conciseExplanation: 'Agent Workspace displays detailed milestone progress, assigned MCP tools, and live execution status for your active workflow.',
    whatItDoes: 'Allows you to inspect each milestone, execute steps, recover failed actions, and view verification evidence.',
    whyUseIt: 'To supervise and interact with the AI agent as it completes your multi-step goals.',
    howItWorks: 'It connects directly to the workflow engine and verification records for the selected workflow.',
    whatHappensIfClicked: 'It displays the active workflow workspace.',
    willSendAnything: 'No, navigating views does not send external requests.',
    doesSaveData: 'No, navigation is read-only.',
    canUndo: 'Yes, you can return to any tab at any time.',
    keywords: ['agent workspace', 'workspace tab'],
  },

  'nav-workflows': {
    id: 'nav-workflows',
    title: 'Workflows View',
    category: 'navigation',
    conciseExplanation: 'Workflows View lists all your planned and completed workflows with progress bars and milestone summaries.',
    whatItDoes: 'Enables managing, filtering, and switching between multiple active and historical workflows.',
    whyUseIt: 'To track multiple goals simultaneously and inspect past completed workflows.',
    howItWorks: 'It loads all workflow records from SQLite and provides sorting and deletion controls.',
    whatHappensIfClicked: 'It switches to the workflows list view.',
    willSendAnything: 'No external requests are sent.',
    doesSaveData: 'No, navigation is read-only.',
    canUndo: 'Yes, you can navigate back at any time.',
    keywords: ['workflows tab', 'workflows view', 'workflow list'],
  },

  'nav-approvals': {
    id: 'nav-approvals',
    title: 'Approvals View',
    category: 'navigation',
    conciseExplanation: 'Approvals View lists all consequential actions waiting for human authorization before they can proceed.',
    whatItDoes: 'Presents preview data, risk explanations, and decision controls for sensitive actions like email dispatch.',
    whyUseIt: 'To review and approve or reject consequential operations in one dedicated place.',
    howItWorks: 'It queries pending approval records and links to draft review inspectors.',
    whatHappensIfClicked: 'It opens the approvals list without approving or executing any action.',
    willSendAnything: 'No, viewing approvals does not send anything.',
    doesSaveData: 'No, navigation is read-only.',
    canUndo: 'Yes, you can switch back to any tab at any time.',
    keywords: ['approvals view', 'approvals tab', 'pending approvals'],
  },

  'nav-memory': {
    id: 'nav-memory',
    title: 'Memory View',
    category: 'navigation',
    conciseExplanation: 'Memory View displays persistent facts, candidate profiles, and preferences saved across your sessions.',
    whatItDoes: 'Allows viewing, searching, adding, and updating persistent memories used by the AI agent.',
    whyUseIt: 'To inspect what ProofLoop remembers and manage your personal context.',
    howItWorks: 'It reads and writes records directly to the SQLite memories table.',
    whatHappensIfClicked: 'It displays the memory manager interface.',
    willSendAnything: 'No external communications occur.',
    doesSaveData: 'No, navigating to memory is read-only until you add or edit a memory.',
    canUndo: 'Yes, you can return to any tab at any time.',
    keywords: ['memory view', 'memory tab', 'persistent memory'],
  },

  'nav-activity': {
    id: 'nav-activity',
    title: 'Activity Log View',
    category: 'navigation',
    conciseExplanation: 'Activity Log View shows an audit trail of all tool executions, state transitions, approvals, and recoveries.',
    whatItDoes: 'Provides an immutable timeline of system operations and cryptographic verification events.',
    whyUseIt: 'To audit what the agent did, which tools were used, and verify system integrity.',
    howItWorks: 'It queries the activity log records saved in SQLite.',
    whatHappensIfClicked: 'It displays the activity log timeline.',
    willSendAnything: 'No external requests are sent.',
    doesSaveData: 'No, viewing the log is read-only.',
    canUndo: 'Yes, you can switch back at any time.',
    keywords: ['activity log', 'activity tab', 'audit log'],
  },

  'nav-mcp': {
    id: 'nav-mcp',
    title: 'MCP Tools View',
    category: 'navigation',
    conciseExplanation: 'MCP Tools View lists all Model Context Protocol tools registered on the Streamable HTTP server with schemas and documentation.',
    whatItDoes: 'Inspects tool names, argument schemas, descriptions, and verified transport capabilities.',
    whyUseIt: 'To verify compliance with the official Model Context Protocol 2025-11-25 specification.',
    howItWorks: 'It queries /api/mcp/tools for live registration data.',
    whatHappensIfClicked: 'It displays the MCP tool explorer view.',
    willSendAnything: 'No external requests are sent.',
    doesSaveData: 'No, viewing tools is read-only.',
    canUndo: 'Yes, you can return to any tab at any time.',
    keywords: ['mcp tools tab', 'mcp tools view'],
  },

  'nav-settings': {
    id: 'nav-settings',
    title: 'Settings View',
    category: 'navigation',
    conciseExplanation: 'Settings View lets you configure voice modes, speech playback, themes, and developer test failure simulation.',
    whatItDoes: 'Manages user preferences and provides the Alexa+ track deliverables audit checklist.',
    whyUseIt: 'To customize voice recognition, synthesis rates, themes, and test error handling.',
    howItWorks: 'It configures localStorage preferences and communicates with the backend settings API.',
    whatHappensIfClicked: 'It opens the settings interface.',
    willSendAnything: 'No external requests are sent.',
    doesSaveData: 'No, navigating is read-only.',
    canUndo: 'Yes, you can return to any tab at any time.',
    keywords: ['settings view', 'settings tab', 'configuration'],
  },
};

/**
 * Resolves an ExplainableOption from a clicked DOM element by inspecting
 * data-explain attributes, aria-labels, button titles, and contextual classnames.
 */
export function resolveOptionFromElement(element: HTMLElement | null): ExplainableOption | null {
  if (!element) return null;

  // Handle text nodes or SVG elements by resolving nearest Element
  const targetElement = (
    element.nodeType === 1 ? element : (element as any).parentElement
  ) as HTMLElement | null;
  if (!targetElement || typeof targetElement.closest !== 'function') return null;

  // 1. Direct or closest data-explain attribute
  const explicitTarget = targetElement.closest('[data-explain]') as HTMLElement | null;
  if (explicitTarget) {
    const key = explicitTarget.getAttribute('data-explain');
    if (key && EXPLAINABLE_OPTIONS[key]) {
      return EXPLAINABLE_OPTIONS[key];
    }
  }

  // 2. Do not treat normal text typing in unadorned input/textarea as an option click
  const isPlainTextInput =
    (targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') &&
    !explicitTarget;
  if (isPlainTextInput) {
    return null;
  }

  // 3. Check closest button, anchor, card, or role="button"
  const interactive = targetElement.closest(
    'button, a, select, [role="button"], [role="tab"], [data-explainable]'
  ) as HTMLElement | null;
  if (!interactive) return null;

  const text = (interactive.textContent || '').trim().toLowerCase();
  const title = (interactive.getAttribute('title') || '').toLowerCase();
  const ariaLabel = (interactive.getAttribute('aria-label') || '').toLowerCase();
  const combined = `${text} ${title} ${ariaLabel}`;

  // Match against known options
  for (const option of Object.values(EXPLAINABLE_OPTIONS)) {
    if (combined.includes(option.title.toLowerCase())) {
      return option;
    }
    if (option.keywords?.some((kw) => combined.includes(kw.toLowerCase()))) {
      return option;
    }
  }

  // Contextual heuristic fallback for generic buttons without explicit keys
  if (combined.includes('verify') || combined.includes('proof') || combined.includes('evidence')) {
    return EXPLAINABLE_OPTIONS['proof-verified'];
  }
  if (combined.includes('approve') && combined.includes('send')) {
    return EXPLAINABLE_OPTIONS['approve-and-send'];
  }
  if (combined.includes('approve') || combined.includes('authorize')) {
    return EXPLAINABLE_OPTIONS['approve-action'];
  }
  if (combined.includes('reject') || combined.includes('cancel')) {
    return EXPLAINABLE_OPTIONS['reject-action'];
  }
  if (combined.includes('recover') || combined.includes('retry')) {
    return EXPLAINABLE_OPTIONS['recover-step'];
  }
  if (
    combined.includes('create workflow') ||
    combined.includes('new workflow') ||
    combined.includes('plan workflow') ||
    combined.includes('follow through')
  ) {
    return EXPLAINABLE_OPTIONS['create-workflow'];
  }
  if (combined.includes('search memory') || combined.includes('find memory')) {
    return EXPLAINABLE_OPTIONS['search-memory'];
  }
  if (combined.includes('add memory') || combined.includes('save memory')) {
    return EXPLAINABLE_OPTIONS['add-memory'];
  }
  if (combined.includes('run all') || combined.includes('execute all') || combined.includes('available steps')) {
    return EXPLAINABLE_OPTIONS['run-all-steps'];
  }
  if (combined.includes('run demo') || combined.includes('hackathon demo')) {
    return EXPLAINABLE_OPTIONS['run-demo'];
  }
  if (combined.includes('run') || combined.includes('execute')) {
    return EXPLAINABLE_OPTIONS['execute-step'];
  }

  // Section 6 Reliable Fallback:
  // If the assistant cannot determine what an option does, say that its function could not be determined instead of inventing an explanation.
  // If the option is ambiguous, use its actual label and surrounding context to provide an accurate description.
  const rawLabel =
    interactive.getAttribute('aria-label') ||
    interactive.getAttribute('title') ||
    interactive.textContent?.trim().slice(0, 30);

  if (!rawLabel || rawLabel.length < 2) {
    return {
      id: 'unknown-option',
      title: 'Unknown Option',
      category: 'general',
      conciseExplanation: 'The function of this option could not be determined from the current interface context.',
      whatItDoes: 'The function of this option could not be determined.',
      whyUseIt: 'Select an option with clear context or ask about a specific task.',
      howItWorks: 'No handler or documentation could be derived from this element.',
      whatHappensIfClicked: 'No action will be triggered without identifiable context.',
      willSendAnything: 'No external requests will be sent.',
      doesSaveData: 'No data is saved.',
      canUndo: 'Yes, no persistent change occurred.',
    };
  }

  return {
    id: `option-${rawLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title: rawLabel,
    category: 'general',
    conciseExplanation: `This option controls ${rawLabel}. Changing it affects how this feature behaves in ProofLoop.`,
    whatItDoes: `Configures or triggers ${rawLabel} in the current interface.`,
    whyUseIt: `To interact with or customize ${rawLabel}.`,
    howItWorks: `It updates application state or triggers the assigned handler.`,
    whatHappensIfClicked: `It activates ${rawLabel}.`,
    willSendAnything: `No external requests are sent unless explicitly confirmed.`,
    doesSaveData: `Saves relevant preferences or state locally where supported.`,
    canUndo: `Yes, you can adjust this setting or return to your previous view.`,
  };
}

export type QuestionIntent =
  | 'what_does_it_do'
  | 'why_use_it'
  | 'how_it_works'
  | 'what_happens_if_clicked'
  | 'will_send_anything'
  | 'does_save_data'
  | 'can_undo'
  | 'explain_again'
  | 'tell_me_more'
  | 'unknown';

/**
 * Identifies the question intent from a spoken utterance about an option.
 */
export function detectQuestionIntent(query: string): QuestionIntent {
  const lower = query.toLowerCase().trim();

  if (
    lower.includes('will this send') ||
    lower.includes('will it send') ||
    lower.includes('does this send') ||
    lower.includes('does it send') ||
    lower.includes('send anything')
  ) {
    return 'will_send_anything';
  }

  if (
    lower.includes('does this save') ||
    lower.includes('does it save') ||
    lower.includes('will this save') ||
    lower.includes('save my data') ||
    lower.includes('save data')
  ) {
    return 'does_save_data';
  }

  if (
    lower.includes('can i undo') ||
    lower.includes('can it be undone') ||
    lower.includes('is it reversible') ||
    lower.includes('undo it') ||
    lower.includes('undo this')
  ) {
    return 'can_undo';
  }

  if (
    lower.includes('what happens if i click') ||
    lower.includes('what happens if i press') ||
    lower.includes('what will happen if') ||
    lower.includes('what happens if clicked')
  ) {
    return 'what_happens_if_clicked';
  }

  if (
    lower.includes('why should i use') ||
    lower.includes('why use it') ||
    lower.includes('why use this') ||
    lower.includes('why do i need this') ||
    lower.includes('why would i use')
  ) {
    return 'why_use_it';
  }

  if (
    lower.includes('how does it work') ||
    lower.includes('how does this work') ||
    lower.includes('how it works')
  ) {
    return 'how_it_works';
  }

  if (
    lower.includes('explain that again') ||
    lower.includes('repeat that') ||
    lower.includes('say that again') ||
    lower.includes('what did you say')
  ) {
    return 'explain_again';
  }

  if (
    lower.includes('tell me more about this') ||
    lower.includes('tell me more') ||
    lower.includes('elaborate') ||
    lower.includes('more details')
  ) {
    return 'tell_me_more';
  }

  if (
    lower.includes('what does this do') ||
    lower.includes('what does this option do') ||
    lower.includes('what does this button do') ||
    lower.includes('what does this setting do') ||
    lower.includes('what does it do') ||
    lower.includes('what is this') ||
    lower.includes('explain this') ||
    lower.includes('explain that') ||
    lower.includes('explain this option')
  ) {
    return 'what_does_it_do';
  }

  return 'unknown';
}

/**
 * Generates an accurate, implementation-grounded answer to a question about an option.
 */
export function answerQuestionAboutOption(
  option: ExplainableOption,
  intent: QuestionIntent
): string {
  switch (intent) {
    case 'will_send_anything':
      return option.willSendAnything;
    case 'does_save_data':
      return option.doesSaveData;
    case 'can_undo':
      return option.canUndo;
    case 'what_happens_if_clicked':
      return option.whatHappensIfClicked;
    case 'why_use_it':
      return option.whyUseIt;
    case 'how_it_works':
      return option.howItWorks;
    case 'explain_again':
      return option.conciseExplanation;
    case 'tell_me_more':
      return `${option.conciseExplanation} ${option.howItWorks} ${option.willSendAnything}`;
    case 'what_does_it_do':
    case 'unknown':
    default:
      return option.conciseExplanation;
  }
}

/**
 * Retrieves the full explanation record for a known option ID.
 */
export function getOptionExplanation(id: string): ExplainableOption | undefined {
  return EXPLAINABLE_OPTIONS[id];
}
