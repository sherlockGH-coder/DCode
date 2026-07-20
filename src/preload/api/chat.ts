import { ipcRenderer } from 'electron';
import type { ToolResultMetadata, Attachment, AgentRunSummary, PlanExecutionRequest } from '../../shared/types';
import { subscribe } from '../bridge';

export const chatApi = {
  sendMessage: (
    messages: Array<{ role: string; content: string }>,
    model?: string,
    conversationId?: string,
    attachments?: Attachment[],
    reasoningEffort?: string,
    turnId?: string,
    attemptNo?: number,
    planExecution?: PlanExecutionRequest,
  ) => {
    return ipcRenderer.invoke('chat:stream', messages, model, conversationId, attachments, reasoningEffort, turnId, attemptNo, planExecution);
  },

  /** 中断指定会话正在进行的对话请求；不传 conversationId 则中断未关联会话的请求 */
  abortChat: (conversationId?: string) => {
    return ipcRenderer.invoke('chat:abort', conversationId);
  },

  /** 删除指定消息及之后所有消息（编辑重试时截断用） */
  truncateMessages: (conversationId: string, messageId: string) => {
    return ipcRenderer.invoke('chat:truncate', conversationId, messageId);
  },

  /** 压缩对话上下文：用 AI 摘要替换旧消息 */
  compactConversation: (conversationId: string) => {
    return ipcRenderer.invoke('compact:run', conversationId) as Promise<{
      summary: string;
      boundaryMessageId: string | null;
      compactedCount: number;
    }>;
  },

  onChunk: (callback: (conversationId: string, content: string) => void) => {
    return subscribe('chat:chunk', callback);
  },

  onReasoningChunk: (callback: (conversationId: string, content: string) => void) => {
    return subscribe('chat:reasoning_chunk', callback);
  },

  onDone: (callback: (conversationId: string) => void) => {
    return subscribe('chat:done', callback);
  },

  onError: (callback: (conversationId: string, errorMessage: string) => void) => {
    return subscribe('chat:error', callback);
  },

  onToolCallStart: (callback: (conversationId: string, toolCall: { id: string; name: string; arguments: string }) => void) => {
    return subscribe('chat:tool_call_start', callback);
  },

  onToolCallEnd: (callback: (conversationId: string, result: { tool_call_id: string; name: string; content: string; error?: boolean; metadata?: ToolResultMetadata }) => void) => {
    return subscribe('chat:tool_call_end', callback);
  },

  onAssistantMessage: (callback: (conversationId: string, msg: any) => void) => {
    return subscribe('chat:assistant-message', callback);
  },

  onToolMessagePersisted: (callback: (conversationId: string, msg: { tool_call_id: string; id: string }) => void) => {
    return subscribe('chat:tool-message-persisted', callback);
  },

  /** 主进程在 429 / 5xx / 网络错误时指数退避，期间通过此事件让前端显示"正在重试…" */
  onStreamRetry: (
    callback: (conversationId: string, info: { attempt: number; maxAttempts: number; delayMs: number; reason: string }) => void,
  ) => {
    return subscribe('chat:stream-retry', callback);
  },

  agentsList: (): Promise<AgentRunSummary[]> => {
    return ipcRenderer.invoke('agents:list');
  },

  onAgentsChanged: (callback: (agents: AgentRunSummary[]) => void) => {
    return subscribe('agents:changed', callback);
  },
};
