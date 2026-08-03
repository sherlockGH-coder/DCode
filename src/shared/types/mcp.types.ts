import type { BasicScope } from './common.types';

/** Transport: stdio is a child process; sse/http are remote HTTP, with http preferring streamableHTTP and falling back to SSE. */
export type McpTransport = 'stdio' | 'sse' | 'http';

/** Scope. */
export type McpScope = BasicScope;

/** Runtime status. */
export type McpStatus = 'idle' | 'starting' | 'connected' | 'error' | 'stopped';

export interface McpServerConfigStdio {
  transport: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface McpServerConfigHttp {
  transport: 'sse' | 'http';
  url: string;
  headers?: Record<string, string>;
}

export type McpServerConfig = McpServerConfigStdio | McpServerConfigHttp;

/** One namespaced tool entry. */
export interface McpToolEntry {
  /** Original name in the MCP protocol. */
  name: string;
  /** Namespaced name registered in toolRegistry: mcp__<server>__<tool>. */
  namespacedName: string;
  description?: string;
}

/** Complete state snapshot for the UI. */
export interface McpServerStatus {
  name: string;
  scope: McpScope;
  enabled: boolean;
  config: McpServerConfig;
  status: McpStatus;
  tools: McpToolEntry[];
  lastError?: string;
}
