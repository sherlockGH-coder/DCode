import { ipcMain } from 'electron';
import { agentLoop } from '../agentLoop';
import { toolRegistry } from '../tools';
import { skillsManager } from '../skills';
import { settingsManager } from '../settings';
import { getEffectiveSystemPrompt, loadDeepseekMdSources } from '../prompts';
import { approvalService } from '../approvalService';
import { logChatEvent } from '../logger';
import { compactConversation } from '../compact';
import { mcpManager } from '../mcp/manager';
import * as db from '../database';
import { IPC_EVENTS } from '../../shared/types';
import type { Attachment, Message, PlanExecutionRequest } from '../../shared/types';
import {
  beginPlanExecution,
  finishPlanExecution,
  getConversationModeState,
  revokeConversationGrants,
} from '../plan/planService';
import { broadcastConversationModeState } from './planIpc';

const activeChats = new Map<string, AbortController>();
const NO_CONV_KEY = '__no_conv__';

export function registerChatIpc(): void {
  ipcMain.handle(
    IPC_EVENTS.CHAT_STREAM,
    async (
      event,
      messages,
      model,
      conversationId?: string,
      attachments?: Attachment[],
      reasoningEffort?: string,
      turnId?: string,
      attemptNo?: number,
      planExecution?: PlanExecutionRequest,
    ) => {
      const convKey = conversationId ?? NO_CONV_KEY;

      const safeSend = (channel: string, ...args: unknown[]) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(channel, ...args);
        }
      };

      activeChats.get(convKey)?.abort();
      const controller = new AbortController();
      activeChats.set(convKey, controller);

      let projectPath: string | null = null;
      let modeState: ReturnType<typeof getConversationModeState> | null = null;
      if (conversationId) {
        const conv = db.getConversationById(conversationId);
        projectPath = conv?.project_path ?? null;
        modeState = getConversationModeState(conversationId);
      }

      let effectiveMessages = messages as Message[];
      let startedPlanExecution = false;
      if (planExecution) {
        if (!conversationId || !modeState || modeState.mode !== 'execute') {
          throw new Error('Approved plan execution requires an Execute-mode conversation');
        }
        const plan = beginPlanExecution(conversationId, planExecution, turnId);
        startedPlanExecution = true;
        const executionMessage: Message = {
          id: `plan_execution_${plan.id}`,
          role: 'user',
          content: `A user approved Plan v${plan.version}. Implement exactly this plan now.\n\n${plan.markdown}`,
          origin: 'plan_execution',
          planArtifactId: plan.id,
          contextEpoch: modeState.contextEpoch,
        };
        effectiveMessages = planExecution.strategy === 'fresh_context'
          ? [executionMessage]
          : [...effectiveMessages, executionMessage];
      } else if (modeState && modeState.contextEpoch > 0 && conversationId) {
        effectiveMessages = (db.getMessages(conversationId) as Message[]).filter((message) => (
          message.contextEpoch === modeState!.contextEpoch
        ));
      } else if (modeState) {
        effectiveMessages = effectiveMessages.filter((message) => (
          message.contextEpoch === undefined || message.contextEpoch === modeState!.contextEpoch
        ));
      }

      const attachmentWhitelist = attachments ?? [];
      const enabledSkills = skillsManager
        .getEnabled(projectPath)
        .map((s) => ({ name: s.name, description: s.description }));

      const deepseekMdSources = loadDeepseekMdSources(projectPath);

      const mcpInstructions = mcpManager
        .getActiveInstructions()
        .map((m) => ({ serverName: m.name, instructions: m.instructions }));

      let seqCounter = 0;
      let terminalErrorHandled = false;

      const traceId = Math.random().toString(36).slice(2, 8);
      const chatStartedAt = Date.now();
      const handleTerminalError = (error: Error | string) => {
        if (terminalErrorHandled) return;
        terminalErrorHandled = true;

        const message = error instanceof Error ? error.message : String(error);
        if (conversationId) {
          try {
            db.addMessage(
              conversationId,
              'assistant',
              message,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              true,
              undefined,
              Date.now() - chatStartedAt,
              turnId,
              attemptNo,
              seqCounter++,
            );
          } catch (err) {
            console.warn('[chat] 错误消息落库失败:', err);
          }
        }

        safeSend(IPC_EVENTS.CHAT_ERROR, conversationId, message);
      };

      logChatEvent('chat_request', {
        traceId,
        conversationId: conversationId ?? null,
        projectPath,
        model: model || settingsManager.getPublic().api.defaultModel,
        messagesCount: messages.length,
        attachmentsCount: attachmentWhitelist.length,
        attachmentKinds: attachmentWhitelist.map((a) => a.kind),
        enabledSkills: enabledSkills.map((s) => s.name),
      });

      try {
        settingsManager.assertActiveApiProfileSupported();
        await agentLoop(
          effectiveMessages,
          toolRegistry,
          {
            onChunk: (text) => {
              safeSend(IPC_EVENTS.CHAT_CHUNK, conversationId, text);
            },
            onReasoningChunk: (text) => {
              safeSend(IPC_EVENTS.CHAT_REASONING_CHUNK, conversationId, text);
            },
            onToolCallStart: (toolCall) => {
              safeSend(IPC_EVENTS.CHAT_TOOL_CALL_START, conversationId, {
                id: toolCall.id,
                name: toolCall.function.name,
                arguments: toolCall.function.arguments,
              });
            },
            onToolCallEnd: (result) => {
              safeSend(IPC_EVENTS.CHAT_TOOL_CALL_END, conversationId, {
                tool_call_id: result.tool_call_id,
                name: result.name,
                content: result.content,
                contentBlocks: result.contentBlocks,
                error: result.error,
                metadata: result.metadata,
              });
              if (conversationId && result.metadata?.kind === 'plan_artifact') {
                safeSend(IPC_EVENTS.PLAN_ARTIFACT_CREATED, conversationId, result.metadata.plan);
                safeSend(IPC_EVENTS.CHAT_MODE_STATE_CHANGED, getConversationModeState(conversationId));
              }
            },
            onAssistantMessage: (msg) => {
              const ourSeq = seqCounter++;
              const payload: Record<string, unknown> = {
                id: msg.id,
                usage: msg.usage,
                duration: msg.duration,
                completed_at: msg.completed_at,
                content: msg.content,
              };

              if (conversationId) {
                try {
                  db.addMessage(
                    conversationId, 'assistant', msg.content,
                    msg.tool_calls, undefined, undefined,
                    msg.reasoning_content, undefined, undefined,
                    undefined, msg.usage, msg.duration,
                    turnId, attemptNo, ourSeq,
                    msg.id,
                  );
                } catch (err) {
                  console.warn('[chat] assistant 消息落库失败:', err);
                }
              }
              safeSend(IPC_EVENTS.CHAT_ASSISTANT_MESSAGE, conversationId, payload);
            },
            onToolMessage: (msg) => {
              const ourSeq = seqCounter++;
              safeSend(IPC_EVENTS.CHAT_TOOL_MESSAGE_PERSISTED, conversationId, {
                tool_call_id: msg.tool_call_id,
                id: msg.id,
              });

              if (!conversationId) return;
              try {
                db.addMessage(
                  conversationId, 'tool', msg.content,
                  undefined, msg.tool_call_id, msg.metadata,
                  undefined, undefined, msg.name, msg.error,
                  undefined, undefined,
                  turnId, attemptNo, ourSeq,
                  msg.id,
                  msg.contentBlocks,
                );
              } catch (err) {
                console.warn('[chat] tool 消息落库失败:', err);
              }
            },
            onDone: () => {
              if (startedPlanExecution && conversationId) {
                finishPlanExecution(conversationId, planExecution!.executionTurnId);
                startedPlanExecution = false;
              }
              safeSend(IPC_EVENTS.CHAT_DONE, conversationId);
            },
            onError: (error) => {
              handleTerminalError(error);
            },
            onStreamRetry: (info) => {
              safeSend(IPC_EVENTS.CHAT_STREAM_RETRY, conversationId, info);
            },
            onCacheMetrics: (metrics) => {
              safeSend('chat:cache-metrics', conversationId, metrics);
            },
            onAutoCompact: async () => {
              if (!conversationId) return null;
              try {
                const result = await compactConversation(conversationId);
                if (result.compactedCount === 0) return null;
                return db.getMessages(conversationId) as Message[];
              } catch (err) {
                console.warn('[chat] auto-compact failed:', err);
                return null;
              }
            },
          },
          {
            apiKey: settingsManager.getApiKey(),
            model: model || settingsManager.getPublic().api.defaultModel,
            baseUrl: settingsManager.getBaseUrl(),
            projectPath,
            attachmentWhitelist,
            enabledSkills,
            systemPrompt: getEffectiveSystemPrompt(),
            deepseekMdSources,
            mcpInstructions,
            signal: controller.signal,
            approvalWebContentsId: event.sender.id,
            turnId,
            attemptNo,
            reasoningEffort: (reasoningEffort === 'high' || reasoningEffort === 'max') ? reasoningEffort : undefined,
            conversationId,
            collaborationMode: modeState?.mode === 'plan' ? 'plan' : 'execute',
            modeRevision: modeState?.modeRevision,
          },
        );
      } catch (error) {
        if (startedPlanExecution && conversationId && planExecution) {
          finishPlanExecution(
            conversationId,
            planExecution.executionTurnId,
            error instanceof Error ? error.message : String(error),
          );
          startedPlanExecution = false;
        }
        console.error('[chat] Agent Loop 错误:', error instanceof Error ? error.message : error);
        handleTerminalError(error instanceof Error ? error : String(error));
      } finally {
        if (activeChats.get(convKey) === controller) {
          activeChats.delete(convKey);
        }
      }
    },
  );

  ipcMain.handle(IPC_EVENTS.CHAT_ABORT, (_event, conversationId?: string) => {
    const key = conversationId ?? NO_CONV_KEY;
    activeChats.get(key)?.abort();
    if (conversationId) {
      approvalService.rejectForConversation(conversationId, 'Cancelled by user');
    } else {
      approvalService.rejectAll('Cancelled by user');
    }
  });

  ipcMain.handle('chat:truncate', (_event, conversationId: string, messageId: string) => {
    db.deleteMessagesFromId(conversationId, messageId);
    revokeConversationGrants(conversationId);
    broadcastConversationModeState(conversationId);
  });
}
