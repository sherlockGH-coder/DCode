import { ipcRenderer } from 'electron';
import type { ToolResultMetadata, Attachment } from '../../shared/types';

export const dbApi = {
  /** 创建新对话，绑定项目路径（null 表示未归类），返回对话 ID */
  createConversation: (title: string, projectPath: string | null) => {
    return ipcRenderer.invoke('db:createConversation', title, projectPath);
  },

  /**
   * 获取对话列表
   *  - 不传 = 全部
   *  - 传 null = 未归类
   *  - 传项目路径 = 该项目下
   */
  getConversations: (projectPath?: string | null) => {
    return ipcRenderer.invoke('db:getConversations', projectPath);
  },

  /** 更新对话标题 */
  updateConversationTitle: (id: string, title: string) => {
    return ipcRenderer.invoke('db:updateConversationTitle', id, title);
  },

  /** 删除对话 */
  deleteConversation: (id: string) => {
    return ipcRenderer.invoke('db:deleteConversation', id);
  },

  /** 添加消息到数据库 */
  addMessage: (conversationId: string, role: string, content: string | null, toolCalls?: any[], toolCallId?: string, metadata?: ToolResultMetadata, reasoningContent?: string, attachments?: Attachment[], name?: string, error?: boolean, usage?: any, duration?: number, turnId?: string, attemptNo?: number, seq?: number, id?: string, contentBlocks?: any[], contextEpoch?: number, origin?: string, planArtifactId?: string) => {
    return ipcRenderer.invoke('db:addMessage', conversationId, role, content, toolCalls, toolCallId, metadata, reasoningContent, attachments, name, error, usage, duration, turnId, attemptNo, seq, id, contentBlocks, contextEpoch, origin, planArtifactId);
  },

  /** 获取某对话的所有消息 */
  getMessages: (conversationId: string) => {
    return ipcRenderer.invoke('db:getMessages', conversationId);
  },

  /** 删除指定 turn 及之后的所有消息 */
  deleteMessagesFromTurn: (conversationId: string, turnId: string): Promise<void> => {
    return ipcRenderer.invoke('db:deleteMessagesFromTurn', conversationId, turnId);
  },

  /** 读取对话的激活 attempt 映射 */
  getActiveAttempts: (conversationId: string): Promise<Record<string, number>> => {
    return ipcRenderer.invoke('db:getActiveAttempts', conversationId);
  },

  /** 整体覆盖对话的激活 attempt 映射 */
  setActiveAttempts: (conversationId: string, map: Record<string, number>): Promise<void> => {
    return ipcRenderer.invoke('db:setActiveAttempts', conversationId, map);
  },
};
