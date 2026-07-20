import type { VisionProvider } from './media.types';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  strict?: boolean;
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
  | { kind: 'web_fetch'; url: string; title?: string; charCount: number; provider: 'tavily' | 'local' | 'jina' }
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
}

export interface ToolItemBase {
  id: string;
  toolCallId: string;
  name: string;
  /**
   * pending           — 工具刚收到尚未真正运行
   * awaiting_approval — 等待用户确认（目前仅 bash_exec 触发）
   * running           — 已批准并在执行
   * done / error      — 终态
   */
  status: 'pending' | 'awaiting_approval' | 'running' | 'done' | 'error';
  timestamp: number;
  /** 工具提供的操作说明（审批面板展示用） */
  approvalDescription?: string;
  /** 审批面板的 diff 预览（unified-diff 格式，仅 edit/write 工具有值） */
  approvalDiffPreview?: string;
  /** 项目外路径提示（write/edit 工具操作项目外路径时由主进程填充） */
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
  | (ToolItemBase & { kind: 'web_fetch'; url: string; title?: string; charCount?: number; provider?: 'tavily' | 'local' | 'jina'; output?: string })
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
