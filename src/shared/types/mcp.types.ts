import type { BasicScope } from './common.types';

/** 通信传输：stdio = 子进程；sse/http = 远程 HTTP（http 优先 streamableHTTP，失败回退 SSE） */
export type McpTransport = 'stdio' | 'sse' | 'http';

/** 作用域 */
export type McpScope = BasicScope;

/** 运行状态 */
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

/** 单个工具条目（已 namespacing） */
export interface McpToolEntry {
  /** MCP 协议中的原始名 */
  name: string;
  /** 注册到 toolRegistry 的命名空间名：mcp__<server>__<tool> */
  namespacedName: string;
  description?: string;
}

/** 完整状态快照（UI 用） */
export interface McpServerStatus {
  name: string;
  scope: McpScope;
  enabled: boolean;
  config: McpServerConfig;
  status: McpStatus;
  tools: McpToolEntry[];
  lastError?: string;
}
