/**
 * Clearly labeled sample documents for search_demo_documents MCP tool
 * Amazon Developer Hackathon 2026 — Alexa+ track
 */

export interface SampleDocument {
  id: string;
  title: string;
  category: 'hackathon_rules' | 'project_spec' | 'submission_materials' | 'checklists';
  content: string;
  source: string;
  lastUpdated: string;
}

export const SAMPLE_DOCUMENTS: SampleDocument[] = [
  {
    id: 'doc-hackathon-guidelines-2026',
    title: 'Amazon Developer Hackathon 2026 — Alexa+ Track Official Guidelines',
    category: 'hackathon_rules',
    source: 'sample_repository/docs/hackathon_guidelines.md',
    lastUpdated: '2026-10-15T08:00:00Z',
    content: `
# Amazon Developer Hackathon 2026 — Alexa+ Track Official Guidelines
Deadline: Friday, October 24, 2026, 11:59 PM PDT.

## Track Objective:
Build high-agency AI experiences that don't just chat, but execute workflows, maintain verified follow-through, and interact with external systems using standard agent protocols.

## Mandatory Deliverables Checklist:
1. Complete working source code repository.
2. Production-grade responsive web interface (Zero-pill discipline, WCAG AA, clean hierarchy).
3. Real Model Context Protocol (MCP) server running over Streamable HTTP (spec version 2025-11-25+).
4. Native MCP client built into the application demonstrating tool discovery and invocation.
5. Persistent memory and state layer (preserving state across browser refreshes and server restarts).
6. Human-in-the-loop approval mechanism for consequential operations.
7. Signature Feature: "Proof of Completion" verification records for every action.
8. Working end-to-end demonstration scenario (Hackathon submission readiness).
9. Automated test suite (unit and integration tests for state transitions, validation, approvals, verification).
10. Comprehensive README with architecture diagrams and setup instructions.
11. Demo script for a sub-3-minute walkthrough video.
12. Honest external integrations audit: clearly classifying real vs simulated components.

## Evaluation Criteria:
- Technical Execution & Architecture: 30%
- Protocol & MCP Integration: 25%
- Outcome Verification & Follow-Through: 25%
- Design Quality & User Experience: 20%
`.trim(),
  },
  {
    id: 'doc-proofloop-architecture',
    title: 'ProofLoop System Architecture Specification',
    category: 'project_spec',
    source: 'sample_repository/docs/architecture_spec.md',
    lastUpdated: '2026-10-18T14:30:00Z',
    content: `
# ProofLoop Architecture Specification
Tagline: "Don't just make a plan. Get it done."

## Core Philosophy:
Unlike typical LLM chat wrappers that hallucinate completion, ProofLoop treats every goal as a directed workflow graph. No step is marked complete without cryptographic or tool-validated proof.

## Subsystem Layers:
1. Orchestration Engine: Uses Gemini (gemini-3.8-flash) or heuristic planner to decompose natural language goals into ordered tasks with dependency graphs and required approvals.
2. MCP Streamable HTTP Layer: Exposes 10 core tools over standardized Streamable HTTP endpoints.
3. Verification Ledger: Produces immutable verification records capturing tool execution outputs, hashes, timestamps, and verification methods.
4. Approval Guardrails: Consequential actions (email dispatch, external publishing, sensitive deletions) pause for explicit human review.
5. Persistent SQLite / JSON Store: Multi-entity relational schema storing workflows, tasks, memories, reminders, approvals, and activity logs.
`.trim(),
  },
  {
    id: 'doc-submission-draft',
    title: 'ProofLoop Hackathon Submission Draft & Checklist',
    category: 'submission_materials',
    source: 'sample_repository/docs/submission_draft.json',
    lastUpdated: '2026-10-19T11:20:00Z',
    content: `
{
  "project_name": "ProofLoop",
  "track": "Alexa+ Track",
  "tagline": "Don't just make a plan. Get it done.",
  "status": "In Preparation",
  "prepared_materials": {
    "source_code": "Ready in repository",
    "mcp_server": "Implemented over Streamable HTTP with 10 tools",
    "mcp_client": "Built into frontend with tool playground and live execution",
    "persistence": "SQLite with automatic state durability",
    "verification_engine": "Implemented with cryptographic proof records",
    "approval_guardrails": "Implemented with preview and risk ratings",
    "automated_tests": "Implemented (unit + integration)",
    "documentation": "README and Demo Script completed"
  },
  "pending_submission_steps": [
    "Verify all 12 hackathon requirement checkpoints",
    "Draft formal submission notification to judges",
    "User approval to finalize submission package"
  ]
}
`.trim(),
  },
  {
    id: 'doc-internship-sample',
    title: 'Sample Career Application Materials & Checklist',
    category: 'checklists',
    source: 'sample_repository/templates/career_application.md',
    lastUpdated: '2026-10-10T12:00:00Z',
    content: `
# Software Engineering Internship Application Checklist
- Resume (PDF format, tailored to backend/AI agent role)
- Cover Letter / Intent statement
- GitHub repository links with active projects
- Project demo video or live URL
- Transcripts and proof of enrollment
- Application deadline: 11:59 PM Friday
`.trim(),
  },
  {
    id: 'doc-candidate-profile',
    title: 'Verified Candidate Profile & Credentials (Karthikeya Ventrapragada)',
    category: 'checklists',
    source: 'user_profile/candidate_credentials.json',
    lastUpdated: '2026-10-20T09:00:00Z',
    content: `
{
  "applicant_name": "Karthikeya Ventrapragada",
  "applicant_email": "karthikeyaventrapragada99@gmail.com",
  "applicant_phone": "+1 (555) 382-9104",
  "portfolio_url": "https://github.com/karthikeyaventrapragada",
  "headline": "Software Development Engineer (Backend, Distributed Systems & Agentic AI)",
  "skills": ["TypeScript", "Node.js", "Python", "Model Context Protocol (MCP)", "SQLite", "Express", "Distributed Systems"],
  "verified_resume_file": "Karthikeya_Ventrapragada_Resume.pdf",
  "verified_resume_size": "248 KB",
  "projects": [
    "ProofLoop: Verifiable AI Agent Engine using Model Context Protocol and finite state machine verification",
    "High-throughput Streamable HTTP agent framework"
  ]
}
`.trim(),
  },
  {
    id: 'doc-job-desc-amazon-intern',
    title: 'Job Description — Amazon SDE Intern (Alexa+ Agent Frameworks)',
    category: 'hackathon_rules',
    source: 'careers_repository/amazon_sde_intern_alexa_plus.md',
    lastUpdated: '2026-10-18T10:00:00Z',
    content: `
# Amazon SDE Internship: Alexa+ Agent Architecture (Summer 2027)
- Company: Amazon.com Services LLC
- Division: Alexa+ Artificial General Agency
- Position: Software Development Engineer Intern
- Location: Seattle, WA / Remote
- Official Recipient: alexa-agent-internships@amazon.com
- Subject Template: Software Development Engineer Intern Application — Karthikeya Ventrapragada
- Required Materials: Resume (PDF), GitHub / Code Sample, Verification Evidence
- Application Deadline: Friday, October 24, 2026 at 11:59 PM PDT
`.trim(),
  },
];

export function searchDemoDocuments(query: string, category?: string): SampleDocument[] {
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/).filter(Boolean);

  return SAMPLE_DOCUMENTS.filter((doc) => {
    if (category && doc.category !== category) return false;
    if (words.length === 0) return true;

    const fullText = `${doc.title} ${doc.content} ${doc.category}`.toLowerCase();
    // Matches if the exact phrase matches or if all keywords are present
    if (fullText.includes(q)) return true;
    return words.every((word) => fullText.includes(word));
  });
}

export function getDocumentById(id: string): SampleDocument | undefined {
  return SAMPLE_DOCUMENTS.find((d) => d.id === id);
}

export function getDocumentFilename(doc: SampleDocument): string {
  const parts = doc.source.split('/');
  return parts[parts.length - 1] || `${doc.id}.txt`;
}

export function getDocumentMimeType(doc: SampleDocument): string {
  const filename = getDocumentFilename(doc);
  if (filename.endsWith('.md')) return 'text/markdown; charset=utf-8';
  if (filename.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filename.endsWith('.pdf')) return 'application/pdf';
  return 'text/plain; charset=utf-8';
}
