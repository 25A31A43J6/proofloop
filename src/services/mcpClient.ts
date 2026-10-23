/**
 * ProofLoop Native MCP Client
 * Connects to ProofLoop MCP Streamable HTTP server, discovers tools, and invokes actions.
 * Amazon Developer Hackathon 2026 — Alexa+ track
 */

import type { MCPToolInfo } from '../types/index.js';

export interface MCPToolExecutionRecord {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: any;
  error?: string;
  durationMs: number;
  timestamp: string;
  status: 'success' | 'error';
}

export interface MCPServerConnectionState {
  connected: boolean;
  endpoint: string;
  specVersion: string;
  serverName: string;
  toolsCount: number;
  tools: MCPToolInfo[];
  lastChecked: string;
  error?: string;
}

class ProofLoopMCPClient {
  private endpoint = '/mcp';
  private toolsCache: MCPToolInfo[] = [];
  private executionHistory: MCPToolExecutionRecord[] = [];
  private listeners: (() => void)[] = [];

  constructor() {
    this.loadHistory();
  }

  private loadHistory() {
    try {
      const stored = localStorage.getItem('proofloop_mcp_history');
      if (stored) {
        this.executionHistory = JSON.parse(stored);
      }
    } catch {
      // ignore
    }
  }

  private saveHistory() {
    try {
      localStorage.setItem(
        'proofloop_mcp_history',
        JSON.stringify(this.executionHistory.slice(0, 50))
      );
    } catch {
      // ignore
    }
    this.notify();
  }

  public subscribe(fn: () => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  public getHistory(): MCPToolExecutionRecord[] {
    return this.executionHistory;
  }

  public clearHistory() {
    this.executionHistory = [];
    this.saveHistory();
  }

  /**
   * Initializes MCP connection and discovers all available tools.
   */
  public async discoverTools(): Promise<MCPServerConnectionState> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch('/api/mcp/tools', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`MCP Server returned HTTP ${res.status}`);
      }

      const data = await res.json();
      this.toolsCache = data.tools || [];

      return {
        connected: true,
        endpoint: data.serverInfo?.endpoint || this.endpoint,
        specVersion: data.protocolVersion || '2025-11-25',
        serverName: data.serverInfo?.name || 'proofloop-agent-server',
        toolsCount: this.toolsCache.length,
        tools: this.toolsCache,
        lastChecked: new Date().toISOString(),
      };
    } catch (err: any) {
      console.warn('[MCP Client] Connection error:', err);
      return {
        connected: false,
        endpoint: this.endpoint,
        specVersion: '2025-11-25',
        serverName: 'proofloop-agent-server',
        toolsCount: 0,
        tools: [],
        lastChecked: new Date().toISOString(),
        error: err.name === 'AbortError' ? 'Connection timed out' : err.message,
      };
    }
  }

  /**
   * Invokes an MCP tool with arguments and records the execution result.
   */
  public async invokeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<MCPToolExecutionRecord> {
    const startTime = Date.now();
    const id = `exec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    try {
      const res = await fetch('/api/mcp/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolName, args }),
      });

      const durationMs = Date.now() - startTime;
      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorRecord: MCPToolExecutionRecord = {
          id,
          toolName,
          args,
          error: data.error || `HTTP ${res.status} execution failure`,
          durationMs,
          timestamp: new Date().toISOString(),
          status: 'error',
        };
        this.executionHistory.unshift(errorRecord);
        this.saveHistory();
        return errorRecord;
      }

      const successRecord: MCPToolExecutionRecord = {
        id,
        toolName,
        args,
        result: data.result,
        durationMs,
        timestamp: new Date().toISOString(),
        status: 'success',
      };
      this.executionHistory.unshift(successRecord);
      this.saveHistory();
      return successRecord;
    } catch (err: any) {
      const durationMs = Date.now() - startTime;
      const errorRecord: MCPToolExecutionRecord = {
        id,
        toolName,
        args,
        error: err.message || 'Network error invoking tool',
        durationMs,
        timestamp: new Date().toISOString(),
        status: 'error',
      };
      this.executionHistory.unshift(errorRecord);
      this.saveHistory();
      return errorRecord;
    }
  }
}

export const mcpClient = new ProofLoopMCPClient();
