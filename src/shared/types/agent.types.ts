export type PlanStepStatus = 'pending' | 'in_progress' | 'completed';

export interface PlanUpdateItem {
  step: string;
  status: PlanStepStatus;
}

export type AgentRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'errored'
  | 'cancelled'
  | 'closed'
  | 'not_found';

export interface AgentRunSummary {
  id: string;
  conversationId: string;
  parentConversationId: string | null;
  rootConversationId: string | null;
  taskName: string;
  role: string;
  prompt: string;
  status: AgentRunStatus;
  result?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AgentToolMetadata {
  kind: 'agent';
  action: 'spawn' | 'wait' | 'send_input' | 'list' | 'close';
  agentId?: string;
  agentIds?: string[];
  taskName?: string;
  role?: string;
  status?: AgentRunStatus;
  agents?: AgentRunSummary[];
  timedOut?: boolean;
  prompt?: string;
  result?: string;
}

export interface AgentLoopCallbacks {
  onChunk: (text: string) => void;
  onReasoningChunk: (text: string) => void;
  onToolCallStart: (toolCall: import('./tool.types').ToolCall) => void;
  onToolCallEnd: (result: import('./tool.types').ToolResult) => void;
  onDone: (finalContent: string) => void;
  onError: (error: Error) => void;
  /**
   * 每完成一轮 assistant 消息时触发（含 tool_calls 中间轮、stop 终轮，以及 abort/error 时已积累的部分轮）。
   * 调用方应据此持久化到 DB；这是唯一的"已落定"边界。
   */
  onAssistantMessage?: (msg: import('./conversation.types').Message) => void;
  /** 每条 tool 结果消息追加进历史时触发，便于持久化。 */
  onToolMessage?: (msg: import('./conversation.types').Message) => void;
  /** 自动压缩回调：token 超阈值时调用，返回压缩后的消息数组；失败返回 null */
  onAutoCompact?: () => Promise<import('./conversation.types').Message[] | null>;
  /**
   * 网络层重试退避时触发：让前端把"正在重试…"反馈给用户。
   * - attempt 从 1 起步（已失败次数）；maxAttempts = MAX_RETRIES + 1
   * - reason 是触发重试的简短原因（status / errno / message）
   */
  onStreamRetry?: (info: { attempt: number; maxAttempts: number; delayMs: number; reason: string }) => void;
  /**
   * 每轮结束后触发缓存命中指标，便于前端实时展示缓存命中率。
   * hitTokens / missTokens 为当轮增量，cumulativeHit/Miss 为会话累计。
   */
  onCacheMetrics?: (metrics: { hitTokens: number; missTokens: number; cumulativeHit: number; cumulativeMiss: number }) => void;
}

export interface AgentLoopConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  /** 当前对话所属项目根；null = 未归类对话（文件访问需单独确认） */
  projectPath?: string | null;
  /** 本回合用户附件清单 — read_file 命中其路径则跳过项目沙箱并按 mimeType 路由解析器 */
  attachmentWhitelist?: import('./attachment.types').Attachment[];
  /** 当前启用的 skill 概要（仅 name + description），注入 system prompt 让 AI 决策 load_skill */
  enabledSkills?: Array<{ name: string; description: string }>;
  /** 注入到首条 system 消息的正文 — 由调用方（主进程）从 prompts.ts 计算后传入 */
  systemPrompt: string;
  /** DEEPSEEK.md 层级来源（由调用方传入结构化 sources，避免 agentLoop 直接读文件） */
  deepseekMdSources?: Array<{ filePath: string; contents: string; scope: 'user' | 'project' | 'local' }>;
  /** 跨对话记忆上下文（由调用方从 DB 加载后传入） */
  memoryContext?: string;
  /** 已连接 MCP server 的使用说明（由调用方从 mcpManager 收集后传入） */
  mcpInstructions?: Array<{ serverName: string; instructions: string }>;
  /** 中断信号 — 触发后 fetch 立即报错、循环跳出；不调 onError 而是走 onDone */
  signal?: AbortSignal;
  /** 调试日志关联的对话 ID（可选；用于 logs/chat-*.jsonl 上下文） */
  conversationId?: string | null;
  /** 当前用户回合 ID；用于 renderer 重挂载后恢复挂起审批 UI。 */
  turnId?: string;
  /** 当前回合的 attempt 序号；用于 renderer 重挂载后恢复挂起审批 UI。 */
  attemptNo?: number;
  /** 调试日志的追踪 ID — 由调用方生成并与 chat_request 事件对齐 */
  traceId?: string;
  /** 发起本轮对话的窗口 webContents id；用于把审批请求路由回对应窗口 */
  approvalWebContentsId?: number;
  /** 思考深度：high = 高，max = 极限；不传 = 关闭思考模式 */
  reasoningEffort?: 'high' | 'max';
  /** 工具访问策略。子 Agent 使用 subagent_readonly。 */
  toolAccessMode?: 'default' | 'subagent_readonly';
  /** 当前 loop 是否为只读子 Agent。 */
  subAgent?: boolean;
  /** 单次请求允许的最大模型轮数，防止重复工具调用形成无限循环。 */
  maxToolRounds?: number;
  /**
   * 工具审批策略（定时任务用）：
   * - 'auto-deny'：自动拒绝需要审批的工具调用（默认，安全）
   * - 'auto-approve'：自动批准所有工具调用（危险，仅用于可信任务）
   * - undefined：正常弹出审批窗口等待用户决策
   */
  approvalPolicy?: 'auto-deny' | 'auto-approve';
  collaborationMode?: 'execute' | 'plan';
  modeRevision?: number;
}
