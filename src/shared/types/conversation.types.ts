import type { ToolCall, ToolResultContentBlock, ToolResultMetadata, ToolItem } from './tool.types';
import type { Attachment } from './attachment.types';
import type { AgentRunStatus } from './agent.types';

export interface Message {
  id: string;
  /** Stable renderer key: generated during streaming creation; clientId remains when the persisted ID changes to avoid a full React-tree remount. Not stored in the DB. */
  clientId?: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  contentBlocks?: ToolResultContentBlock[];
  reasoning_content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
  metadata?: ToolResultMetadata;
  error?: boolean;
  toolItems?: ToolItem[];
  attachments?: Attachment[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_cache_hit_tokens?: number;
    prompt_cache_miss_tokens?: number;
  };
  duration?: number;
  completed_at?: number;
  created_at?: string;

  /** Turn owning the message. For user messages, this is their own ID; for assistant/tool messages, it is the triggering user message ID. */
  turnId?: string;
  /** Attempt number for the message; user messages are always 0, while assistant/tool messages start at 1. */
  attemptNo?: number;
  /** Sequence number within the same (turnId, attemptNo), starting at 0. */
  seq?: number;
  contextEpoch?: number;
  origin?: 'chat' | 'plan_rejection' | 'plan_execution';
  planArtifactId?: string;
}

export interface Conversation {
  id: string;
  title: string;
  /** Project path; null means a legacy unassigned conversation. */
  project_path: string | null;
  created_at: string;
  updated_at: string;
  /** Active attempt number for each turn; the UI falls back to max(attemptNo) when absent. */
  activeAttempts?: Record<string, number>;
  /** Conversation source: manual or cron. */
  source?: string;
  /** Task ID associated with the source, only for cron sources. */
  source_job_id?: string | null;
  /** Parent conversation ID for a child agent, used when source=agent. */
  parent_conversation_id?: string | null;
  /** Root conversation ID for a child agent, used when source=agent. */
  root_conversation_id?: string | null;
  /** Child-agent role. */
  agent_role?: string | null;
  /** Child-agent status. */
  agent_status?: AgentRunStatus | null;
  /** Child-agent task name. */
  agent_task_name?: string | null;
  /** Conversation summary used for context compaction. */
  summary?: string | null;
  /** Compaction boundary message ID. */
  compacted_to_message_id?: string | null;
  collaboration_mode?: import('./plan.types').ConversationMode;
  mode_revision?: number;
  content_revision?: number;
  current_context_epoch?: number;
  active_plan_artifact_id?: string | null;
}
