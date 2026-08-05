import type { VisionProvider } from './media.types';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  strict?: boolean;
  /**
   * Server-side tool executed by the model provider API (for example web search).
   * These are declared to the API as built-in server tools instead of local function tools,
   * and their results arrive as `server_tool_use` blocks in the assistant stream.
   */
  serverTool?: boolean;
}

/** A `server_tool_use` block returned by the API for server-side tools such as web search. */
export interface ServerToolUse {
  id: string;
  name: string;
  /** Parsed tool input; for web search this contains the query and optional filters. */
  input: Record<string, unknown>;
}

/**
 * An assistant content block returned by the Anthropic-compatible API.
 *
 * Server tools can be interleaved with client tool calls, and the provider requires
 * the complete ordered block array to be sent back unchanged on the next request.
 * Keep this deliberately forward-compatible so new provider block types survive a
 * round trip even before the UI understands them.
 */
export interface ProviderContentBlock {
  type: string;
  [key: string]: unknown;
}

export type ToolResultContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'; data: string } }
  | { type: 'document'; source: { type: 'base64'; media_type: 'application/pdf'; data: string } };

export interface ToolCallDelta {
  index: number;
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
}

export interface ToolCall {
  id: string;
  type: "function";
  /** UI lifecycle marker only; server tools are never serialized as client tool_use calls. */
  serverTool?: boolean;
  function: {
    name: string;
    arguments: string;
  };
}

export type ToolResultMetadata =
  | { kind: 'read'; path: string; lineCount: number; truncated: boolean }
  | { kind: 'write'; path: string; isNew: boolean; diff?: string }
  | { kind: 'edit'; path: string; linesAdded: number; linesDeleted: number; diff?: string }
  | { kind: 'exec'; command: string; exitCode: number; duration: number; outputLines: number }
  | { kind: 'grep'; pattern: string; matchCount: number; fileCount: number }
  | { kind: 'glob'; pattern: string; matchCount: number }
  | { kind: 'web_search'; query: string; resultCount: number }
  | { kind: 'web_fetch'; url: string; title?: string; charCount: number; provider: 'local' | 'jina' }
  | { kind: 'vision'; path: string; question: string; provider: VisionProvider; model: string }
  | { kind: 'list_directory'; path: string; totalCount: number; offset?: number; limit?: number }
  | { kind: 'task'; action: string; taskId?: string; title?: string }
  | { kind: 'plan_update'; explanation?: string; plan: PlanUpdateItem[] }
  | { kind: 'plan_artifact'; plan: import('./plan.types').PlanArtifact }
  | { kind: 'ask_user_question'; questions: Array<{ question: string; header: string; options: Array<{ label: string; description: string }>; multiSelect: boolean }>; answers?: Record<string, string> }
  | AgentToolMetadata;

import type { PlanUpdateItem } from './agent.types';
import type { AgentToolMetadata } from './agent.types';

export interface ToolResult {
  tool_call_id: string;
  name: string;
  content: string;
  contentBlocks?: ToolResultContentBlock[];
  error?: boolean;
  metadata?: ToolResultMetadata;
  terminal?: boolean;
  /** UI lifecycle marker only; server-tool results must not become user tool_result messages. */
  serverTool?: boolean;
}

export interface ToolItemBase {
  id: string;
  toolCallId: string;
  name: string;
  /**
   * pending           - tool just received and has not actually run.
   * awaiting_approval - waiting for user confirmation; currently triggered only by bash_exec.
   * running           - approved and executing.
   * done / error      - terminal state.
   */
  status: 'pending' | 'awaiting_approval' | 'running' | 'done' | 'error';
  timestamp: number;
  /** Operation description supplied by the tool, shown in the approval panel. */
  approvalDescription?: string;
  /** Approval-panel diff preview in unified-diff format, populated only for edit/write tools. */
  approvalDiffPreview?: string;
  /** Out-of-project path notice, populated by the main process for write/edit operations outside the project. */
  approvalOutOfScope?: {
    absolutePath: string;
    projectRoot: string | null;
  };
}

export type ToolItem =
  | (ToolItemBase & { kind: 'read'; path: string; lineCount?: number; truncated?: boolean; output?: string })
  | (ToolItemBase & { kind: 'write'; path: string; isNew?: boolean; diff?: string })
  | (ToolItemBase & { kind: 'edit'; path: string; linesAdded?: number; linesDeleted?: number; diff?: string })
  | (ToolItemBase & { kind: 'exec'; command: string; exitCode?: number; duration?: number; outputLines?: number; output?: string })
  | (ToolItemBase & { kind: 'grep'; pattern: string; path?: string; matchCount?: number; fileCount?: number; output?: string })
  | (ToolItemBase & { kind: 'glob'; pattern: string; matchCount?: number; output?: string })
  | (ToolItemBase & { kind: 'web_search'; query: string; resultCount?: number; output?: string })
  | (ToolItemBase & { kind: 'web_fetch'; url: string; title?: string; charCount?: number; provider?: 'local' | 'jina'; output?: string })
  | (ToolItemBase & { kind: 'vision'; path: string; question: string; provider?: VisionProvider; model?: string; output?: string })
  | (ToolItemBase & { kind: 'list_directory'; path: string; totalCount?: number; output?: string })
  | (ToolItemBase & { kind: 'task'; action: string; taskId?: string; title?: string; output?: string })
  | (ToolItemBase & { kind: 'plan_update'; explanation?: string; plan: PlanUpdateItem[]; output?: string })
  | (ToolItemBase & { kind: 'plan_artifact'; title?: string; plan?: import('./plan.types').PlanArtifact; output?: string })
  | (ToolItemBase & { kind: 'agent'; action: import('./agent.types').AgentToolMetadata['action']; agentId?: string; agentIds?: string[]; taskName?: string; role?: string; agentStatus?: import('./agent.types').AgentRunStatus; agents?: import('./agent.types').AgentRunSummary[]; timedOut?: boolean; output?: string })
  | (ToolItemBase & { kind: 'tool'; toolName: string; input: string; output?: string })
  | (ToolItemBase & { kind: 'ask_user_question'; questions?: Array<{ question: string; header: string; options: Array<{ label: string; description: string }>; multiSelect: boolean }>; answers?: Record<string, string>; output?: string });

export interface ChangeUndoEntry {
  path: string;
  diff: string;
  isNew?: boolean;
}

export interface ChangeUndoResult {
  success: boolean;
  reverted: string[];
  error?: string;
}
