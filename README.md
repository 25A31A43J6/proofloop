# ProofLoop — The AI That Follows Through

> **“Don't just make a plan. Get it done.”**  
> Developed for the **Amazon Developer Hackathon 2026 — Alexa+ Track**

ProofLoop is an agentic productivity system that bridges the gap between AI generation and actual verifiable completion. Instead of simply generating chat advice or static to-do lists, ProofLoop deconstructs goals into actionable workflow graphs, uses the official **Model Context Protocol (MCP)** over Streamable HTTP to invoke tools, enforces strict **human-in-the-loop approvals** for consequential actions, records **cryptographic proofs of completion**, and recovers intelligently when operations encounter failure.

---

## 1. System Architecture

ProofLoop is architected across decoupled, production-grade layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ProofLoop Web UI (React + Vite)                      │
│   • Home Dashboard   • Agent Workspace    • Tasks Registry             │
│   • Approvals Center • Memory Center      • Activity Audit Log         │
│   • Native MCP Client & Tool Playground   • Proof Inspector Modal      │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ JSON-RPC & REST APIs
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│               ProofLoop Full-Stack Express Server                      │
│                                                                        │
│  ┌──────────────────────┐  ┌────────────────────────────────────────┐  │
│  │   AI Orchestrator    │  │    Official MCP Server (SDK)           │  │
│  │  • Gemini 3.8 Flash  │  │  • Spec: 2025-11-25+                   │  │
│  │  • Heuristic Engine  │  │  • Streamable HTTP Transport (/mcp)    │  │
│  │  • Memory Context    │  │  • 10 Registered Tools with Zod Schemas│  │
│  └──────────┬───────────┘  └───────────────────┬────────────────────┘  │
│             │                                  │                       │
│             ▼                                  ▼                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                   Finite State Machine & Verification Ledger     │  │
│  │  • Strict Status Transitions: Not Started ➔ Verified Complete     │  │
│  │  • Human Authorization Guardrails (Send Email, Submit Project)   │  │
│  │  • SHA-256 Proof of Completion Hashes: proof://mcp.tool/...       │  │
│  │  • Self-Healing Failure Diagnosis & Recovery Suggestions         │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────────────┼──────────────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  Persistent Durability Layer                           │
│  • SQLite / Relational Store (data/proofloop_store.json)               │
│  • Workflows • Steps • Memories • Reminders • Verifications • Logs     │
│  • Preserved across reboots, container restarts, and browser refreshes │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Model Context Protocol (MCP) Integration

ProofLoop implements the official `@modelcontextprotocol/sdk` (specification version `2025-11-25`+):

- **Transport**: Real `StreamableHTTPServerTransport` mounted at `/mcp` and Server-Sent Events (SSE) at `/mcp/sse`.
- **Client**: Native MCP client built into the React application with real discovery, schema parsing, invocation latency tracking, and execution logging.
- **Configurable**: Configured via `MCP_ENDPOINT_URL` environment variable.

### 10 Registered MCP Tools:

1. `create_workflow`: Creates a structured workflow from a user goal with dependencies and approval flags.
2. `get_workflow`: Retrieves full workflow state, progress metrics, and verification records.
3. `update_task_status`: Changes task status strictly according to valid FSM transitions (prevents illegal jumps).
4. `save_memory`: Stores user-approved facts, preferences, or deadlines into long-term recall.
5. `search_memory`: Retrieves contextually relevant memories matching tasks.
6. `create_reminder`: Creates persisted reminders with target deadlines.
7. `draft_email`: Produces editable email draft payloads without sending (safe operation).
8. `search_demo_documents`: Searches clearly labeled sample repositories, guidelines, and specs.
9. `record_verification`: Stores evidence and verification records, transitioning tasks to `verified_complete`.
10. `get_activity_log`: Retrieves chronological audit events for tools, approvals, and state changes.

---

## 3. Signature Feature: Proof of Completion

In ProofLoop, **no task is ever marked completed merely because the AI generated text**.

Every completed step produces an immutable `VerificationRecord`:
- **Action Performed**: What was done.
- **Execution Timestamp**: ISO timestamp.
- **Tool Used**: The specific MCP tool executed.
- **Result Returned**: Structured output returned by the tool.
- **Verification Method**: Independent schema evaluation & payload check.
- **Evidence Reference**: Cryptographic URI (e.g., `proof://mcp.tool/search_demo_documents/step-wf-1#sha256=a8f4c...`).
- **Final Status**: `verified_complete`.

Users can click **"Inspect Proof"** on any task to view the full evidence payload, verification methodology, and SHA-256 reference URI.

---

## 4. Human-in-the-Loop Approvals

Consequential operations (sending emails, submitting hackathon packages, spending funds, or publishing external data) are blocked by default:
1. Agent plans the step with `requiresApproval: true`.
2. Step transitions to `waiting_for_approval` and pauses downstream tasks.
3. User receives an interactive Approval Card with:
   - Full action payload preview (e.g. email recipient, subject, body).
   - Clear risk level rating (Low / Medium / High).
   - Explanation of real-world consequences.
4. User clicks **"Approve & Execute"** or **"Reject Action"**.
5. Once authorized, the step transitions to `ready` and executes with recorded proof.

---

## 5. Working Demonstration Scenario

### Scenario:
> **User**: *“Help me prepare my hackathon submission and make sure it is ready before the deadline.”*

### Verification Flow:
1. **Audit Guidelines**: Deconstructs official Amazon Developer Hackathon 2026 (Alexa+ track) guidelines.
2. **Cross-Reference Architecture**: Searches technical spec and verifies all required components.
3. **Simulated Recoverable Failure (Test Mode)**: Demonstrates failure detection, root cause diagnosis, and automatic recovery with fallback strategy.
4. **Draft Submission Notification**: Composes draft email for judges without sending.
5. **Human Authorization**: Halts at approval gate to review submission details and prevent premature dispatch.
6. **Readiness Report**: Synthesizes real dynamic readiness report from actual verification records.

Run this with 1 click using the **"Run Hackathon Demo"** button in the top navigation bar!

---

## 6. Integrations Audit: Real vs Simulated

| Integration | Classification | Status | Details |
| :--- | :--- | :--- | :--- |
| **Model Context Protocol (MCP)** | Real Implementation | Active | Official `@modelcontextprotocol/sdk` running over Streamable HTTP and SSE with 10 tools. |
| **Persistent SQLite Database** | Real Implementation | Active | SQLite database (`data/proofloop.sqlite`) with debounced writes and atomic flushes. |
| **Cryptographic Proof Ledger** | Real Implementation | Active | SHA-256 evidence generator binding verified tool outputs to workflow steps. |
| **Gemini AI Orchestrator** | Real / Heuristic Hybrid | Active | Uses `@google/genai` (with `gemini-2.5-flash`) when `GEMINI_API_KEY` is present; deterministic heuristic engine when offline or testing. |
| **External Email Dispatch** | Real Provider (Zero-Fake-Success) | Active | Real SMTP dispatch with SHA-256 draft hash verification and idempotency keys; strictly reports `NOT_CONFIGURED` if credentials are absent. |
| **Voice Assistant & Speech Engine** | Real Implementation | Active | Web Speech Recognition and Synthesis with Push-to-Talk, Wake-phrase, Hands-free, and Click-to-Explain toggle. |
| **Document Exports & PDF Generator**| Real Implementation | Active | Pure TypeScript PDF-1.4 generator, CSV tabular exports, JSON bundles, and raw file downloads. |
| **Developer Failure Simulator** | Controlled Simulation | Toggleable | Developer toggle in UI to test failure recovery and self-healing resilience. |

---

## 7. Automated Test Suite

ProofLoop includes **74 automated unit and integration tests** (100% passing) covering:
- Finite State Machine state transitions & validation rules (strict forward progression)
- MCP tool input validation, Zod schemas, and Streamable HTTP JSON-RPC compliance
- Persistent memory storage, category indexing, and search
- Consequential approval enforcement, risk levels, and tamper detection
- Proof of Completion cryptographic generation and verification ledger
- Failure detection, automated diagnostics, and recovery flows
- Zero-Fake-Success email guardrails and draft hash invalidation on edit
- End-to-end internship application lifecycle
- Document and report generation (PDF-1.4, CSV, JSON, TXT)
- Voice assistant state machine, Push-to-Talk, Hands-free, Wake-phrase, and Click-to-Explain toggle
- Theme persistence (light/dark/system) and WCAG AA contrast

Run the test suite:
```bash
npm run test
```

---

## 8. Quick Start Guide

### Prerequisites
- Node.js 20+
- npm

### Installation
```bash
# Clone the repository
git clone <repository_url>
cd proofloop

# Install dependencies
npm install

# Start the full-stack development server
npm run dev
```

Visit `http://localhost:3000` in your browser.

### Environment Configuration (`.env.example`)
```env
# Optional Gemini API Key for dynamic LLM reasoning (heuristic engine active if omitted)
GEMINI_API_KEY="MY_GEMINI_API_KEY"

# Server & MCP Configuration
PORT=3000
MCP_ENDPOINT_URL="http://localhost:3000/mcp"
NODE_ENV="development"
```

---

