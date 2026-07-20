import type { ToolCall, ToolResultContentBlock, ToolResultMetadata, ToolItem } from './tool.types';
import type { Attachment } from './attachment.types';
import type { AgentRunStatus } from './agent.types';

export interface Message {
  id: string;
  /** 渲染稳定键：流式创建时生成，持久化后 id 更换但 clientId 保留，避免 React 整树 remount。不入库。 */
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

  /** 该消息所属轮次。user 消息：=自己的 id；assistant/tool 消息：=触发它的 user 消息 id */
  turnId?: string;
  /** 该消息所在的 attempt 序号；user 消息恒为 0；assistant/tool 从 1 开始 */
  attemptNo?: number;
  /** 同一 (turnId, attemptNo) 内的顺序号；从 0 起递增 */
  seq?: number;
  contextEpoch?: number;
  origin?: 'chat' | 'plan_rejection' | 'plan_execution';
  planArtifactId?: string;
}

export interface Conversation {
  id: string;
  title: string;
  /** 所属项目路径；null = legacy 未归类对话 */
  project_path: string | null;
  created_at: string;
  updated_at: string;
  /** 每个 turn 当前激活的 attempt 序号；缺省时 UI fallback 到 max(attemptNo) */
  activeAttempts?: Record<string, number>;
  /** 对话来源：manual=手动创建, cron=定时任务 */
  source?: string;
  /** 来源关联的任务 ID（仅 cron 来源） */
  source_job_id?: string | null;
  /** 子 Agent 父会话 ID（source=agent 时使用） */
  parent_conversation_id?: string | null;
  /** 子 Agent 所属根会话 ID（source=agent 时使用） */
  root_conversation_id?: string | null;
  /** 子 Agent 角色 */
  agent_role?: string | null;
  /** 子 Agent 状态 */
  agent_status?: AgentRunStatus | null;
  /** 子 Agent 任务名 */
  agent_task_name?: string | null;
  /** 对话摘要（用于上下文压缩） */
  summary?: string | null;
  /** 压缩截止消息 ID */
  compacted_to_message_id?: string | null;
  collaboration_mode?: import('./plan.types').ConversationMode;
  mode_revision?: number;
  content_revision?: number;
  current_context_epoch?: number;
  active_plan_artifact_id?: string | null;
}
