import { ipcRenderer } from 'electron';
import type { ToolResultMetadata, Attachment } from '../../shared/types';

export const dbApi = {
  /** Create a conversation bound to a project path; null means unassigned. Return the conversation ID. */
  createConversation: (title: string, projectPath: string | null) => {
    return ipcRenderer.invoke('db:createConversation', title, projectPath);
  },

  /**
   * Get the conversation list.
   *  - omitted = all;
   *  - null = unassigned;
   *  - project path = conversations in that project.
   */
  getConversations: (projectPath?: string | null) => {
    return ipcRenderer.invoke('db:getConversations', projectPath);
  },

  /** Update a conversation title. */
  updateConversationTitle: (id: string, title: string) => {
    return ipcRenderer.invoke('db:updateConversationTitle', id, title);
  },

  /** Delete a conversation. */
  deleteConversation: (id: string) => {
    return ipcRenderer.invoke('db:deleteConversation', id);
  },

  /** Add a message to the database. */
  addMessage: (conversationId: string, role: string, content: string | null, toolCalls?: any[], toolCallId?: string, metadata?: ToolResultMetadata, reasoningContent?: string, attachments?: Attachment[], name?: string, error?: boolean, usage?: any, duration?: number, turnId?: string, attemptNo?: number, seq?: number, id?: string, contentBlocks?: any[], contextEpoch?: number, origin?: string, planArtifactId?: string) => {
    return ipcRenderer.invoke('db:addMessage', conversationId, role, content, toolCalls, toolCallId, metadata, reasoningContent, attachments, name, error, usage, duration, turnId, attemptNo, seq, id, contentBlocks, contextEpoch, origin, planArtifactId);
  },

  /** Get all messages for a conversation. */
  getMessages: (conversationId: string) => {
    return ipcRenderer.invoke('db:getMessages', conversationId);
  },

  /** Delete a turn and all following messages. */
  deleteMessagesFromTurn: (conversationId: string, turnId: string): Promise<void> => {
    return ipcRenderer.invoke('db:deleteMessagesFromTurn', conversationId, turnId);
  },

  /** Read the conversation's active-attempt mapping. */
  getActiveAttempts: (conversationId: string): Promise<Record<string, number>> => {
    return ipcRenderer.invoke('db:getActiveAttempts', conversationId);
  },

  /** Replace the conversation's active-attempt mapping. */
  setActiveAttempts: (conversationId: string, map: Record<string, number>): Promise<void> => {
    return ipcRenderer.invoke('db:setActiveAttempts', conversationId, map);
  },
};
