/**
 * ProofLoop MCP Tools Center
 * Interactive Model Context Protocol playground and diagnostics.
 * Amazon Developer Hackathon 2026 — Alexa+ track
 */

import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Server,
  Code2,
  RefreshCw,
  Copy,
  Check,
  Download,
  Loader2,
  FileText,
  FileDown,
} from 'lucide-react';
import { mcpClient, type MCPToolExecutionRecord, type MCPServerConnectionState } from '../services/mcpClient.js';
import type { MCPToolInfo } from '../types/index.js';
import {
  downloadDocument,
  fetchDocuments,
  type DownloadableDocumentMeta,
} from '../services/api.js';

export const MCPToolsView: React.FC = () => {
  const [connectionState, setConnectionState] = useState<MCPServerConnectionState | null>(null);
  const [selectedTool, setSelectedTool] = useState<MCPToolInfo | null>(null);
  const [inputArgsJson, setInputArgsJson] = useState('{}');
  const [isCalling, setIsCalling] = useState(false);
  const [lastExecution, setLastExecution] = useState<MCPToolExecutionRecord | null>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<MCPToolExecutionRecord[]>([]);
  const [documents, setDocuments] = useState<DownloadableDocumentMeta[]>([]);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const [docDownloadMsg, setDocDownloadMsg] = useState<string | null>(null);

  const refreshTools = async () => {
    const state = await mcpClient.discoverTools();
    setConnectionState(state);
    if (state.tools.length > 0 && !selectedTool) {
      handleSelectTool(state.tools[0]);
    }
  };

  const loadDocuments = async () => {
    try {
      const docs = await fetchDocuments();
      setDocuments(docs);
    } catch (err) {
      console.warn('Could not load documents library:', err);
    }
  };

  const handleDownloadDoc = async (id: string, format?: 'original' | 'pdf') => {
    if (downloadingDocId) return;
    setDownloadingDocId(id);
    setDocDownloadMsg(null);
    try {
      const filename = await downloadDocument(id, format);
      setDocDownloadMsg(`Downloaded ${filename}`);
      setTimeout(() => setDocDownloadMsg(null), 3000);
    } catch (err: any) {
      setDocDownloadMsg(`Error: ${err.message || 'Download failed'}`);
      setTimeout(() => setDocDownloadMsg(null), 4000);
    } finally {
      setDownloadingDocId(null);
    }
  };

  useEffect(() => {
    refreshTools();
    loadDocuments();
    setHistory(mcpClient.getHistory());
    const unsub = mcpClient.subscribe(() => {
      setHistory(mcpClient.getHistory());
    });
    return unsub;
  }, []);

  const handleSelectTool = (tool: MCPToolInfo) => {
    setSelectedTool(tool);
    setJsonError(null);

    // Generate sample arguments from tool schema
    const sample: Record<string, any> = {};
    const props = tool.inputSchema.properties || {};
    for (const [key, val] of Object.entries(props)) {
      if (val.type === 'string') {
        if (key === 'goal') sample[key] = 'Prepare hackathon presentation checklist';
        else if (key === 'query') sample[key] = 'hackathon guidelines';
        else if (key === 'workflowId') sample[key] = 'wf-demo-1';
        else if (key === 'stepId') sample[key] = 'step-wf-demo-1-1';
        else if (key === 'recipient') sample[key] = 'judge@amazon.com';
        else if (key === 'subject') sample[key] = 'Submission Draft';
        else if (key === 'body') sample[key] = 'Hello from ProofLoop agent';
        else if (key === 'category') sample[key] = 'user_preferences';
        else if (key === 'content') sample[key] = 'Prefers concise verification summaries';
        else if (key === 'title') sample[key] = 'Review Hackathon Checklist';
        else if (key === 'targetTime') sample[key] = '2026-10-24T23:59:00Z';
        else sample[key] = 'sample_value';
      } else if (val.type === 'number') {
        sample[key] = 10;
      } else if (val.type === 'boolean') {
        sample[key] = true;
      } else if (val.type === 'object') {
        sample[key] = { status: 'verified_complete' };
      }
    }
    setInputArgsJson(JSON.stringify(sample, null, 2));
  };

  const handleInvoke = async () => {
    if (!selectedTool) return;
    setJsonError(null);

    let parsedArgs: Record<string, any> = {};
    try {
      parsedArgs = JSON.parse(inputArgsJson);
    } catch (err: any) {
      setJsonError(`Invalid JSON arguments: ${err.message}`);
      return;
    }

    setIsCalling(true);
    try {
      const execResult = await mcpClient.invokeTool(selectedTool.name, parsedArgs);
      setLastExecution(execResult);
    } finally {
      setIsCalling(false);
    }
  };

  const handleCopyEndpoint = () => {
    navigator.clipboard.writeText(connectionState?.endpoint || 'http://localhost:3000/mcp');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-white">
            Model Context Protocol (MCP) Center
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Production MCP server running over Streamable HTTP (spec version {connectionState?.specVersion || '2025-11-25'})
          </p>
        </div>

        <button
          onClick={refreshTools}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 rounded-md transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Discover Tools</span>
        </button>
      </div>

      {/* Connection & Endpoint Status Banner */}
      <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="space-y-1">
          <div className="text-neutral-500 dark:text-neutral-400">Connection Status</div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {connectionState?.connected ? 'Streamable HTTP Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="text-neutral-400 text-[11px]">
            Spec: {connectionState?.specVersion || '2025-11-25'} · Local Node.js MCP Server
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-neutral-500 dark:text-neutral-400">Active MCP Endpoint</div>
          <div className="flex items-center gap-1.5 font-mono text-neutral-900 dark:text-neutral-100 truncate">
            <span className="truncate">{connectionState?.endpoint || '/mcp'}</span>
            <button
              onClick={handleCopyEndpoint}
              className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              title="Copy Endpoint URL"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
          <div className="text-neutral-400 text-[11px]">
            POST /mcp (Streamable HTTP) & SSE /mcp/sse
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-neutral-500 dark:text-neutral-400">Registered MCP Tools</div>
          <div className="font-mono text-base font-bold text-neutral-900 dark:text-white tabular-nums">
            {connectionState?.toolsCount || 0} Tools
          </div>
          <div className="text-neutral-400 text-[11px]">
            SQLite persistence & proof verification
          </div>
        </div>
      </div>

      {/* AI Studio Environment Variable Guidance Box */}
      <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/20 space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <div className="font-bold text-neutral-900 dark:text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-600" />
            <span>Configuring MCP_ENDPOINT_URL for Google AI Studio</span>
          </div>
          <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
            Local MCP Server Active
          </span>
        </div>

        <p className="text-neutral-600 dark:text-neutral-400 leading-relaxed">
          ProofLoop includes a fully functioning, built-in MCP server running directly on this Node.js instance. You do <strong>not</strong> need to provision an external server. If Google AI Studio prompts you for <code className="px-1 py-0.5 bg-neutral-200 dark:bg-neutral-800 rounded font-mono">MCP_ENDPOINT_URL</code>, enter this applet's public URL:
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg font-mono text-[11px]">
          <span className="text-emerald-700 dark:text-emerald-400 font-medium truncate select-all">
            {connectionState?.endpoint && connectionState.endpoint.startsWith('http')
              ? connectionState.endpoint
              : typeof window !== 'undefined'
              ? `${window.location.origin}/mcp`
              : 'http://localhost:3000/mcp'}
          </span>
          <button
            onClick={() => {
              const url =
                connectionState?.endpoint && connectionState.endpoint.startsWith('http')
                  ? connectionState.endpoint
                  : `${window.location.origin}/mcp`;
              navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-sans text-xs font-semibold shrink-0 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Value for AI Studio'}</span>
          </button>
        </div>

        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 space-y-1">
          <div>· <strong>For AI Studio Cloud Run:</strong> <span className="font-mono text-neutral-700 dark:text-neutral-300">https://ais-dev-ibh6tckaqzxweoi6iojdp7-582607226427.asia-east1.run.app/mcp</span></div>
          <div>· <strong>For Local Development:</strong> <span className="font-mono text-neutral-700 dark:text-neutral-300">http://localhost:3000/mcp</span></div>
        </div>
      </div>

      {/* Tools Playground Split: Left = Tools List, Right = Tool Tester */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: 10 Registered Tools List */}
        <div className="lg:col-span-5 space-y-2">
          <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
            Registered MCP Tools
          </div>

          <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-800">
            {(connectionState?.tools || []).map((tool) => {
              const isSelected = selectedTool?.name === tool.name;

              return (
                <button
                  key={tool.name}
                  onClick={() => handleSelectTool(tool)}
                  className={`w-full text-left p-3 text-xs transition-colors block ${
                    isSelected
                      ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40 text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-semibold text-neutral-900 dark:text-white">
                      {tool.name}
                    </span>
                    {tool.requiresApproval && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        Approval Required
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-neutral-500 line-clamp-1">
                    {tool.description}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Downloadable Repository Documents Panel */}
          <div className="pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                Repository Documents
              </span>
              <span className="text-[11px] text-neutral-400">
                {documents.length} files available
              </span>
            </div>

            {docDownloadMsg && (
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                <span>{docDownloadMsg}</span>
                <button
                  onClick={() => setDocDownloadMsg(null)}
                  className="font-bold text-neutral-400 hover:text-neutral-700"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-800">
              {documents.map((doc) => {
                const isDownloadingThis = downloadingDocId === doc.id;

                return (
                  <div key={doc.id} className="p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="space-y-0.5">
                      <div className="font-medium text-neutral-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                        <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="font-mono text-[11px]">{doc.filename}</span>
                      </div>
                      <p className="text-[11px] text-neutral-500 line-clamp-1">
                        {doc.title}
                      </p>
                      <div className="text-[10px] text-neutral-400 font-mono">
                        {(doc.sizeBytes / 1024).toFixed(1)} KB · {doc.mimeType}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => handleDownloadDoc(doc.id, 'original')}
                        disabled={Boolean(downloadingDocId)}
                        data-explain="download-document-file"
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors disabled:opacity-50"
                        title={`Download ${doc.filename}`}
                      >
                        {isDownloadingThis ? (
                          <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                        ) : (
                          <Download className="w-3 h-3 text-emerald-600" />
                        )}
                        <span>Download</span>
                      </button>

                      <button
                        onClick={() => handleDownloadDoc(doc.id, 'pdf')}
                        disabled={Boolean(downloadingDocId)}
                        data-explain="download-document-pdf"
                        className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-neutral-700 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded transition-colors disabled:opacity-50"
                        title={`Download ${doc.filename} as PDF`}
                      >
                        <FileDown className="w-3 h-3 text-neutral-500" />
                        <span>PDF</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Interactive Invocation & Schema Playground */}
        <div className="lg:col-span-7 space-y-4">
          {selectedTool ? (
            <div className="p-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase text-emerald-600 dark:text-emerald-400 font-semibold">
                    Tool Inspector
                  </span>
                </div>
                <h2 className="text-base font-mono font-bold text-neutral-900 dark:text-white">
                  {selectedTool.name}
                </h2>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  {selectedTool.description}
                </p>
              </div>

              {/* Input Schema Preview */}
              <div className="space-y-1">
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Input Schema (Zod / JSON Schema)
                </span>
                <pre className="p-2.5 bg-neutral-50 dark:bg-neutral-850 rounded text-[11px] font-mono text-neutral-700 dark:text-neutral-300 max-h-32 overflow-y-auto border border-neutral-200 dark:border-neutral-800">
                  {JSON.stringify(selectedTool.inputSchema, null, 2)}
                </pre>
              </div>

              {/* Argument Editor */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Execution Arguments (JSON)
                  </label>
                  <span className="text-[11px] text-neutral-400">Editable test parameters</span>
                </div>
                <textarea
                  value={inputArgsJson}
                  onChange={(e) => setInputArgsJson(e.target.value)}
                  rows={5}
                  className="w-full p-2.5 font-mono text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
                {jsonError && (
                  <div className="text-rose-600 text-xs font-medium">{jsonError}</div>
                )}
              </div>

              {/* Invoke Button */}
              <button
                onClick={handleInvoke}
                disabled={isCalling}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md transition-colors shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isCalling ? 'Invoking MCP Tool...' : 'Invoke Tool via MCP'}</span>
              </button>

              {/* Live Result View */}
              {lastExecution && (
                <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-900 dark:text-white">
                      Execution Result
                    </span>
                    <span className="font-mono text-neutral-400 tabular-nums text-[11px]">
                      {lastExecution.durationMs}ms · {lastExecution.status}
                    </span>
                  </div>

                  {lastExecution.error ? (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-md text-xs text-rose-800 dark:text-rose-300">
                      <div className="font-semibold">Tool Execution Error:</div>
                      <div>{lastExecution.error}</div>
                    </div>
                  ) : (
                    <pre className="p-3 bg-neutral-900 text-neutral-100 rounded text-[11px] font-mono overflow-x-auto max-h-56 border border-neutral-800">
                      {JSON.stringify(lastExecution.result, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center text-xs text-neutral-400 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900">
              Select a tool on the left to inspect its schema and test calls.
            </div>
          )}

          {/* Past Tool Call History */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                MCP Execution History
              </span>
              {history.length > 0 && (
                <button
                  onClick={() => mcpClient.clearHistory()}
                  className="text-[11px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  Clear history
                </button>
              )}
            </div>

            <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-800 text-xs">
              {history.length === 0 ? (
                <div className="p-4 text-center text-neutral-400 text-xs">
                  No MCP tool calls recorded yet in this session.
                </div>
              ) : (
                history.slice(0, 5).map((rec) => (
                  <div key={rec.id} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-neutral-900 dark:text-white">
                        {rec.toolName}
                      </span>
                      <span className="font-mono text-[11px] text-neutral-400 tabular-nums">
                        {rec.durationMs}ms
                      </span>
                    </div>

                    <span
                      className={`font-semibold text-[11px] ${
                        rec.status === 'success'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {rec.status === 'success' ? 'OK' : 'Error'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
