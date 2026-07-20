import { ipcMain } from 'electron';
import * as db from '../database';
import { clearSessionAllowList } from '../pathAllowList';
import { resolveKnownProjectPath } from '../projectScope';
import { registerLocalFilePreviewPaths } from '../localFileProtocol';
import type { Attachment } from '../../shared/types';
import { revokeConversationGrants } from '../plan/planService';
import { broadcastConversationModeState } from './planIpc';

export function registerDbIpc(): void {
  ipcMain.handle('db:createConversation', (_event, title: string, projectPath: string | null) => {
    return db.createConversation(title, resolveKnownProjectPath(projectPath));
  });

  ipcMain.handle('db:getConversations', (_event, projectPath?: string | null) => {
    if (projectPath === undefined || projectPath === null) return db.getConversations(projectPath);
    const knownProjectPath = resolveKnownProjectPath(projectPath);
    return knownProjectPath ? db.getConversations(knownProjectPath) : [];
  });

  ipcMain.handle('db:updateConversationTitle', (_event, id: string, title: string) => {
    db.updateConversationTitle(id, title);
  });

  ipcMain.handle('db:deleteConversation', (_event, id: string) => {
    db.deleteConversation(id);
    clearSessionAllowList(id);
  });

  ipcMain.handle(
    'db:addMessage',
    (
      _event,
      conversationId: string,
      role: string,
      content: string | null,
      toolCalls?: any[],
      toolCallId?: string,
      metadata?: any,
      reasoningContent?: string,
      attachments?: Attachment[],
      name?: string,
      error?: boolean,
      usage?: any,
      duration?: number,
      turnId?: string,
      attemptNo?: number,
      seq?: number,
      id?: string,
      contentBlocks?: any[],
      contextEpoch?: number,
      origin?: string,
      planArtifactId?: string,
    ) => {
      if (attachments && attachments.length > 0) {
        registerLocalFilePreviewPaths(attachments.map((attachment) => attachment.path));
      }
      const messageId = db.addMessage(
        conversationId,
        role as any,
        content,
        toolCalls,
        toolCallId,
        metadata,
        reasoningContent,
        attachments,
        name,
        error,
        usage,
        duration,
        turnId,
        attemptNo,
        seq,
        id,
        contentBlocks,
        contextEpoch,
        origin,
        planArtifactId,
      );
      if (role === 'user' && origin !== 'plan_execution') {
        revokeConversationGrants(conversationId);
        broadcastConversationModeState(conversationId);
      }
      return messageId;
    },
  );

  ipcMain.handle('db:getMessages', (_event, conversationId: string) => {
    const messages = db.getMessages(conversationId);
    for (const message of messages) {
      if (message.attachments && message.attachments.length > 0) {
        registerLocalFilePreviewPaths(message.attachments.map((attachment: Attachment) => attachment.path));
      }
    }
    return messages;
  });

  ipcMain.handle('db:deleteMessagesFromTurn', (_event, conversationId: string, turnId: string) => {
    db.deleteMessagesFromTurn(conversationId, turnId);
    revokeConversationGrants(conversationId);
    broadcastConversationModeState(conversationId);
  });

  ipcMain.handle('db:getActiveAttempts', (_event, conversationId: string) => {
    return db.getActiveAttempts(conversationId);
  });

  ipcMain.handle('db:setActiveAttempts', (_event, conversationId: string, map: Record<string, number>) => {
    db.setActiveAttempts(conversationId, map);
    revokeConversationGrants(conversationId);
    broadcastConversationModeState(conversationId);
  });
}
