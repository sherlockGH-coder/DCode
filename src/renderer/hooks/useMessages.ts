import { useState, useCallback, useRef } from 'react';
import type { Message, ToolCall, Attachment, PendingApprovalRequest, PlanExecutionRequest } from '../../shared/types';
import { filterActiveBranch } from '../utils/branchFilter';
import { formatSlashCommandsForTitle } from '../utils/slashCommands';
import {
  applyApprovalToMessages,
  shouldAutoApproveApproval,
} from './use-messages/approval';
import { activeRequestRegistry } from './use-messages/hotRegistry';
import { useMessageStreamEvents } from './use-messages/useMessageStreamEvents';
import type { ActiveRequest, RetryInfo } from './use-messages/types';

interface ApiMessage {
  role: string;
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  reasoning_content?: string;
  contextEpoch?: number;
  origin?: Message['origin'];
  planArtifactId?: string;
}

interface SendMessageOptions {
  userInput: string;
  attachments?: Attachment[];
  conversationId: string | null;
  existingMessages: Message[];
  /** Active attempt for each turn in the current conversation, used to filter context. */
  activeAttempts: Record<string, number>;
  selectedModel: string;
  /** Current active project path; new conversations are bound to it. */
  activeProject: string | null;
  /** Factory: return the setMessages function bound to a conversation ID. */
  bindSetMessages: (convId: string) => (updater: (prev: Message[]) => Message[]) => void;
  onConversationCreated?: (convId: string) => void;
  onConversationsReload?: () => Promise<void>;
  /** Reasoning effort: high or max; omit to disable reasoning. */
  reasoningEffort?: string;
  /**
   * Retry mode:
   *   - retryTurnId: user message ID to regenerate, which is also the turnId.
   *   - retryAttemptNo: sequence number for this new attempt (= max(existing attemptNo for turn) + 1).
   * When both are set, enter the retry branch: skip creating a user message, switch to the new active attempt, and filter out the old assistant/tool messages for that turn.
  */
  retryTurnId?: string;
  retryAttemptNo?: number;
  planExecution?: PlanExecutionRequest;
  messageOrigin?: Message['origin'];
}

export type { ActiveRequest } from './use-messages/types';
export { applyApprovalToMessages, createFallbackToolItemFromApproval } from './use-messages/approval';

export function useMessages() {
  const [isLoading, setIsLoading] = useState(activeRequestRegistry.size > 0);
  const [retryInfo, setRetryInfo] = useState<RetryInfo | null>(null);

  const [turnTimers, setTurnTimers] = useState<Record<string, { startedAt: number; endedAt?: number }>>({});

  const activeRequestsRef = useRef<Map<string, ActiveRequest>>(activeRequestRegistry);
  const bindSetMessagesRef = useRef<((convId: string) => (updater: (prev: Message[]) => Message[]) => void) | null>(null);

  const abortSend = useCallback((conversationId?: string | null) => {
    void window.deepseekApi.abortChat(conversationId ?? undefined);
  }, []);

  /** Check whether the specified conversation has an active request. */
  const isConversationActive = useCallback((convId: string) => {
    return activeRequestsRef.current.has(convId);
  }, []);

  const getOrCreateActiveRequestForApproval = useCallback((approvalReq: PendingApprovalRequest): ActiveRequest | undefined => {
    if (!approvalReq.conversationId) return undefined;
    const existing = activeRequestsRef.current.get(approvalReq.conversationId);
    if (existing) return existing;
    if (!approvalReq.turnId || !bindSetMessagesRef.current) return undefined;

    const req: ActiveRequest = {
      conversationId: approvalReq.conversationId,
      fullContent: '',
      fullReasoning: '',
      setMessages: bindSetMessagesRef.current(approvalReq.conversationId),
      turnId: approvalReq.turnId,
      attemptNo: approvalReq.attemptNo ?? 1,
      placeholderId: `approval_holder_${approvalReq.toolCallId}`,
      assistantAnchorId: `approval_holder_${approvalReq.toolCallId}`,
      insertAfterId: `approval_holder_${approvalReq.toolCallId}`,
    };
    activeRequestsRef.current.set(approvalReq.conversationId, req);
    setIsLoading(true);
    return req;
  }, []);

  const restorePendingApprovals = useCallback(async () => {
    try {
      const pendingApprovals = await window.deepseekApi.approvalListPending();
      for (const approvalReq of pendingApprovals) {
        const req = getOrCreateActiveRequestForApproval(approvalReq);
        if (!req) continue;
        if (shouldAutoApproveApproval(approvalReq)) {
          window.deepseekApi.approvalRespond(approvalReq.toolCallId, true).catch((err) => {
            console.error('[useMessages] Restored session auto-approval failed:', err);
          });
          continue;
        }
        req.setMessages((prev) => applyApprovalToMessages(prev, approvalReq, req));
      }
    } catch (err) {
          console.warn('[useMessages] Failed to restore pending approval:', err);
    }
  }, [getOrCreateActiveRequestForApproval]);

  const rebindActiveRequests = useCallback((
    bindSetMessages: (convId: string) => (updater: (prev: Message[]) => Message[]) => void,
  ) => {
    bindSetMessagesRef.current = bindSetMessages;
    for (const req of activeRequestsRef.current.values()) {
      req.setMessages = bindSetMessages(req.conversationId);
    }
    setIsLoading(activeRequestsRef.current.size > 0);
    void restorePendingApprovals();
  }, [restorePendingApprovals]);

  useMessageStreamEvents({
    activeRequestsRef,
    getOrCreateActiveRequestForApproval,
    restorePendingApprovals,
    setIsLoading,
    setRetryInfo,
    setTurnTimers,
  });

  const sendMessage = useCallback(async (opts: SendMessageOptions) => {
    const {
      userInput, attachments, conversationId, existingMessages, activeAttempts,
      selectedModel, activeProject, bindSetMessages,
      onConversationCreated, onConversationsReload, reasoningEffort,
      retryTurnId, retryAttemptNo,
      planExecution,
      messageOrigin,
    } = opts;
    const isRetry = !!retryTurnId && retryAttemptNo !== undefined;
    const hasAttachments = !!attachments && attachments.length > 0;
    if (!isRetry && !userInput.trim() && !hasAttachments) return;

    if (conversationId && activeRequestsRef.current.has(conversationId)) return;

    if (!isRetry && userInput.trim() === '/compact') {
      if (!conversationId) return;
      const setMessages = bindSetMessages(conversationId);
      setIsLoading(true);
      setRetryInfo(null);
      try {
        const result = await window.deepseekApi.compactConversation(conversationId);
        if (result.compactedCount > 0) {

          const msgs = await window.deepseekApi.getMessages(conversationId);
          setMessages(() => msgs as Message[]);
          await onConversationsReload?.();
        } else {

          alert('This conversation is not long enough to have history that needs compacting.');
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: `Compact failed: ${errMsg}` };
          }
          return updated;
        });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    let currentConvId = conversationId;
    let pendingTurnId: string | undefined;
    let pendingAttemptNo: number | undefined;

    let setMessages: ((updater: (prev: Message[]) => Message[]) => void) | undefined;

    try {
      const isFirstMessageInConversation = !isRetry && existingMessages.length === 0;
          const rawTitle = userInput.trim() || attachments?.[0]?.name || 'Attachment';
      const title = formatSlashCommandsForTitle(rawTitle).slice(0, 20);

      if (!currentConvId) {
        currentConvId = await window.deepseekApi.createConversation(title, activeProject);
        onConversationCreated?.(currentConvId);
        await onConversationsReload?.();
      } else if (isFirstMessageInConversation) {
        try {
          await window.deepseekApi.updateConversationTitle(currentConvId, title);
          await onConversationsReload?.();
        } catch (err) {
          console.warn('[useMessages] Failed to update the pre-created conversation title:', err);
        }
      }

      setMessages = bindSetMessages(currentConvId);

      const modeState = typeof window.deepseekApi.getConversationModeState === 'function'
        ? await window.deepseekApi.getConversationModeState(currentConvId)
        : { contextEpoch: 0 };
      const userMessage: Message | null = isRetry ? null : (() => {
          const uid = planExecution?.executionTurnId ?? crypto.randomUUID();
        return {
          id: uid,
          role: 'user',
          content: userInput,
          created_at: new Date().toISOString(),
          turnId: uid,
          attemptNo: 0,
          seq: 0,
          contextEpoch: modeState.contextEpoch,
          origin: messageOrigin ?? (planExecution ? 'plan_execution' : 'chat'),
          ...(planExecution ? { planArtifactId: planExecution.planId } : {}),
          ...(hasAttachments ? { attachments } : {}),
        };
      })();

      const turnId = isRetry ? retryTurnId : userMessage!.id;
      const attemptNo = isRetry ? retryAttemptNo : 1;
      pendingTurnId = turnId;
      pendingAttemptNo = attemptNo;

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        toolItems: [],
        turnId,
        attemptNo,
      };

      if (isRetry) {

        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        setMessages((prev) => [...prev, userMessage!, assistantMessage]);
      }

      setIsLoading(true);
      setRetryInfo(null);

      activeRequestsRef.current.set(currentConvId, {
        conversationId: currentConvId,
        fullContent: '',
        fullReasoning: '',
        setMessages,
        turnId,
        attemptNo,
        placeholderId: assistantMessage.id,
        assistantAnchorId: assistantMessage.id,
        insertAfterId: assistantMessage.id,
      });

      if (!isRetry && userMessage) {
        await window.deepseekApi.addMessage(
          currentConvId, 'user', userInput,
          undefined, undefined, undefined, undefined, attachments,
          undefined, undefined, undefined, undefined,
          turnId, 0, 0, userMessage.id,
          undefined,
          modeState.contextEpoch,
          messageOrigin ?? (planExecution ? 'plan_execution' : 'chat'),
          planExecution?.planId,
        );
      }

      const overrideAttempts = isRetry ? { [turnId]: attemptNo } : {};

      const filtered = filterActiveBranch(existingMessages, activeAttempts, overrideAttempts);

      const contextMessages: Message[] = isRetry ? filtered : [...filtered, userMessage!];

      const apiMessages: ApiMessage[] = contextMessages.map((msg) => {
        const apiMsg: ApiMessage = { role: msg.role, content: msg.content };
        if (msg.role === 'assistant') {
          if (msg.tool_calls) apiMsg.tool_calls = msg.tool_calls;
          if (msg.reasoning_content) apiMsg.reasoning_content = msg.reasoning_content;
        }
        if (msg.role === 'tool' && msg.tool_call_id) apiMsg.tool_call_id = msg.tool_call_id;
        if (msg.contextEpoch !== undefined && msg.contextEpoch !== 0) apiMsg.contextEpoch = msg.contextEpoch;
        if (msg.origin && msg.origin !== 'chat') apiMsg.origin = msg.origin;
        if (msg.planArtifactId) apiMsg.planArtifactId = msg.planArtifactId;
        return apiMsg;
      });

      await window.deepseekApi.sendMessage(
        apiMessages,
        selectedModel,
        currentConvId,
        attachments,
        reasoningEffort,
        turnId,
        attemptNo,
        planExecution,
      );
    } catch (error) {
      setIsLoading(false);
      if (currentConvId) {
        activeRequestsRef.current.delete(currentConvId);
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorContent = errorMessage;
      if (setMessages) {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant' && !last.content && !last.reasoning_content && !last.toolItems?.length && !last.tool_calls?.length) {
            updated[updated.length - 1] = { ...last, content: errorContent, error: true };
          } else if (currentConvId) {
            updated.push({
              id: `err_${Date.now()}`,
              role: 'assistant',
              content: errorContent,
              error: true,
              turnId: pendingTurnId,
              attemptNo: pendingAttemptNo,
            });
          }
          return updated;
        });
      }
      if (currentConvId) {
        try {
          await window.deepseekApi.addMessage(
            currentConvId, 'assistant', errorContent,
            undefined, undefined, undefined, undefined, undefined,
            undefined, true, undefined, undefined,
            pendingTurnId,
            pendingAttemptNo,
          );
        } catch (persistError) {
          console.error('[useMessages] Failed to persist send error:', persistError);
        }
      }
    }
  }, []);

  /**
   * Approval confirmation: respond immediately and change the ToolItem state from awaiting_approval back to running.
   * This removes ApprovalPanel immediately so the user can approve the next item while the tool runs in the background.
   *
   * @param answers - Answer mapping for AskUserQuestion.
   */
  const handleApprovalConfirm = useCallback((
    toolCallId: string,
    allowed: boolean,
    feedback?: string,
    rememberForSession?: boolean,
    scope?: { kind: 'outOfScopeDir'; dir: string },
    answers?: Record<string, string>,
  ) => {
    window.deepseekApi
      .approvalRespond(toolCallId, allowed, feedback, rememberForSession, scope, answers)
      .catch((err) => {
        console.error('[useMessages] approvalRespond failed:', err);
      });
    if (allowed) {

      for (const req of activeRequestsRef.current.values()) {
        req.setMessages((prev) => {
          const updated = [...prev];
          let found = false;
          for (let i = updated.length - 1; i >= 0; i--) {
            const msg = updated[i];
            if (msg.role === 'assistant' && msg.toolItems?.length) {
              const itemIdx = msg.toolItems.findIndex((ti) => ti.toolCallId === toolCallId);
              if (itemIdx !== -1) {
                const newItems = [...msg.toolItems];
                newItems[itemIdx] = { ...newItems[itemIdx], status: 'running' as const };
                updated[i] = { ...msg, toolItems: newItems };
                found = true;
                break;
              }
            }
          }
          return found ? updated : prev;
        });
        break;
      }
    }
  }, []);

  return { isLoading, retryInfo, turnTimers, isConversationActive, rebindActiveRequests, sendMessage, abortSend, handleApprovalConfirm };
}
