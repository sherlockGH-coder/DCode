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

  /** Interrupt an in-progress request for a conversation; omit conversationId to interrupt an unassociated request. */
  abortChat: (conversationId?: string) => {
    return ipcRenderer.invoke('chat:abort', conversationId);
  },

  /** Delete a message and all following messages, used to truncate edit-and-retry history. */
  truncateMessages: (conversationId: string, messageId: string) => {
    return ipcRenderer.invoke('chat:truncate', conversationId, messageId);
  },

  /** Compact conversation context by replacing old messages with an AI summary. */
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

  onToolCallStart: (callback: (conversationId: string, toolCall: { id: string; name: string; arguments: string; serverTool?: boolean }) => void) => {
    return subscribe('chat:tool_call_start', callback);
  },

  onToolCallEnd: (callback: (conversationId: string, result: { tool_call_id: string; name: string; content: string; error?: boolean; metadata?: ToolResultMetadata; serverTool?: boolean }) => void) => {
    return subscribe('chat:tool_call_end', callback);
  },

  onAssistantMessage: (callback: (conversationId: string, msg: any) => void) => {
    return subscribe('chat:assistant-message', callback);
  },

  onToolMessagePersisted: (callback: (conversationId: string, msg: { tool_call_id: string; id: string }) => void) => {
    return subscribe('chat:tool-message-persisted', callback);
  },

  /** The main process uses exponential backoff for 429, 5xx, and network errors; this event lets the frontend show "Retrying...". */
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
