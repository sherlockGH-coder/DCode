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
   * Fired after each assistant message round completes, including tool-call intermediate rounds, the stop round,
   * and partial rounds accumulated before abort or error.
   * Callers should persist at this point; this is the only "settled" boundary.
   */
  onAssistantMessage?: (msg: import('./conversation.types').Message) => void;
  /** Fired when each tool result message is appended to history, for persistence. */
  onToolMessage?: (msg: import('./conversation.types').Message) => void;
  /** Automatic compaction callback, called when tokens exceed the threshold; returns compacted messages or null on failure. */
  onAutoCompact?: () => Promise<import('./conversation.types').Message[] | null>;
  /**
   * Fired during network retry backoff so the frontend can show "Retrying...".
   * - attempt starts at 1, representing the number of failures; maxAttempts = MAX_RETRIES + 1.
   * - reason is a short retry reason, such as status, errno, or message.
   */
  onStreamRetry?: (info: { attempt: number; maxAttempts: number; delayMs: number; reason: string }) => void;
  /**
   * Fired after each round with cache-hit metrics for live display.
   * hitTokens and missTokens are per-round deltas; cumulativeHit and cumulativeMiss are session totals.
   */
  onCacheMetrics?: (metrics: { hitTokens: number; missTokens: number; cumulativeHit: number; cumulativeMiss: number }) => void;
}

export interface AgentLoopConfig {
  apiKey: string;
  /** Provider request protocol selected by the active API profile. */
  protocol?: import('./settings.types').ApiProtocol;
  model?: string;
  baseUrl?: string;
  /** Project root for the current conversation; null means unassigned and file access requires separate confirmation. */
  projectPath?: string | null;
  /** Override the runtime environment description injected into the model, used when tools connect to a remote or container environment. */
  environmentInfoOverride?: string;
  /** User attachments for this turn; read_file skips the project sandbox for matching paths and routes by mimeType. */
  attachmentWhitelist?: import('./attachment.types').Attachment[];
  /** Summaries of enabled skills, name and description only, injected into the system prompt so AI can choose load_skill. */
  enabledSkills?: Array<{ name: string; description: string }>;
  /** Body injected into the first system message, computed by the main process from prompts.ts. */
  systemPrompt: string;
  /** DEEPSEEK.md sources by level, passed in as structured sources so agentLoop does not read files directly. */
  deepseekMdSources?: Array<{ filePath: string; contents: string; scope: 'user' | 'project' | 'local' }>;
  /** Cross-conversation memory context loaded from the DB by the caller. */
  memoryContext?: string;
  /** Usage instructions for connected MCP servers, collected from mcpManager by the caller. */
  mcpInstructions?: Array<{ serverName: string; instructions: string }>;
  /** Abort signal; fetch fails immediately and the loop exits through onDone rather than onError. */
  signal?: AbortSignal;
  /** Conversation ID associated with the current run, used for context, approvals, and tool routing. */
  conversationId?: string | null;
  /** Current user-turn ID, used to restore pending approval UI after renderer remount. */
  turnId?: string;
  /** Attempt number for the current turn, used to restore pending approval UI after renderer remount. */
  attemptNo?: number;
  /** Trace ID for the current run, used to associate console debug output with approval requests. */
  traceId?: string;
  /** webContents ID of the window that started this turn, used to route approval requests back to it. */
  approvalWebContentsId?: number;
  /** Reasoning effort: high is strong, max is maximum; omit to disable reasoning mode. */
  reasoningEffort?: 'high' | 'max';
  /** Tool access policy; child agents use subagent_readonly. */
  toolAccessMode?: 'default' | 'subagent_readonly';
  /** Whether the current loop is a read-only child agent. */
  subAgent?: boolean;
  /** Maximum model rounds allowed for one request, preventing infinite loops from repeated tool calls. */
  maxToolRounds?: number;
  /**
   * Tool approval policy, used by scheduled tasks:
   * - 'auto-deny': automatically deny tool calls that require approval (safe default).
   * - 'auto-approve': automatically approve all tool calls (dangerous; trusted tasks only).
   * - undefined: show the normal approval prompt and wait for the user.
   */
  approvalPolicy?: 'auto-deny' | 'auto-approve';
  collaborationMode?: 'execute' | 'plan';
  modeRevision?: number;
}
