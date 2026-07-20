import { useCallback, useEffect } from 'react';
import type { Message, Attachment, PlanExecutionRequest } from '../../shared/types';
import { getMaxAttemptForTurn } from '../utils/branchFilter';

interface ChatDeps {
  sendMessage: (opts: {
    userInput: string;
    attachments?: Attachment[];
    conversationId: string | null;
    existingMessages: Message[];
    activeAttempts: Record<string, number>;
    selectedModel: string;
    activeProject: string | null;
    /** 工厂：给定 convId 返回绑定该对话的 setMessages */
    bindSetMessages: (convId: string) => (updater: (prev: Message[]) => Message[]) => void;
    onConversationCreated?: (convId: string) => void;
    onConversationsReload?: () => Promise<void>;
    reasoningEffort?: string;
    retryTurnId?: string;
    retryAttemptNo?: number;
    planExecution?: PlanExecutionRequest;
    messageOrigin?: Message['origin'];
  }) => Promise<void>;
  abortSend: (conversationId?: string | null) => void;
  /** 检查指定对话是否有活跃请求 */
  isConversationActive: (convId: string) => boolean;
  /** HMR / remount 后重新绑定活跃请求的消息写入闭包 */
  rebindActiveRequests: (
    bindSetMessages: (convId: string) => (updater: (prev: Message[]) => Message[]) => void,
  ) => void;
}

interface ConversationDeps {
  conversationId: string | null;
  messages: Message[];
  /** 更新指定对话的消息 — 传入 convId 和 updater */
  setMessages: (convId: string, updater: (prev: Message[]) => Message[]) => void;
  setConversationId: (id: string | null) => void;
  loadConversations: () => Promise<void>;
  activeAttempts: Record<string, number>;
  setActiveAttempts: (
    updater: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>),
  ) => void;
}

interface OrchestratorDeps {
  chat: ChatDeps;
  conv: ConversationDeps;
  selectedModel: string;
  activeProject: string | null;
  reasoningEffort?: string;

  onConversationCreated?: (id: string) => void;
}

export function useChatOrchestrator({ chat, conv, selectedModel, activeProject, reasoningEffort, onConversationCreated }: OrchestratorDeps) {
  const handleConvCreated = useCallback((id: string) => {
    conv.setConversationId(id);
    onConversationCreated?.(id);
  }, [conv, onConversationCreated]);

  const bindSetMessages = useCallback((convId: string) => (updater: (prev: Message[]) => Message[]) => {
    conv.setMessages(convId, updater);
  }, [conv.setMessages]);

  useEffect(() => {
    chat.rebindActiveRequests(bindSetMessages);
  }, [chat.rebindActiveRequests, bindSetMessages]);

  const handleSend = useCallback(async (
    userInput: string,
    attachments: Attachment[] = [],
    existingMessagesOverride?: Message[],
    planExecution?: PlanExecutionRequest,
    conversationIdOverride?: string,
    messageOrigin?: Message['origin'],
  ) => {
    const currentConvId = conversationIdOverride ?? conv.conversationId;
    await chat.sendMessage({
      userInput,
      attachments,
      conversationId: currentConvId,
      existingMessages: existingMessagesOverride ?? conv.messages,
      activeAttempts: conv.activeAttempts,
      selectedModel,
      activeProject,
      bindSetMessages,
      onConversationCreated: handleConvCreated,
      onConversationsReload: conv.loadConversations,
      reasoningEffort,
      planExecution,
      messageOrigin,
    });
  }, [chat, conv, selectedModel, activeProject, reasoningEffort, handleConvCreated, bindSetMessages]);

  /**
   * 重试入口：仅传入 turnId（被重试的 user 消息 id）。
   *
   * 步骤：
   * 1. 算出新的 attemptNo = max(existing) + 1
   * 2. 立刻把 activeAttempts[turnId] 切到 newAttemptNo（内存 + DB），UI 立即看到"新分支"
   * 3. 调 sendMessage 的 retry 分支，跳过 user 消息创建，让流式回包带上新 turnId/attemptNo
   *
   * 注意：activeAttempts 切换发生在 send 之前，所以 send 里读到的 activeAttempts 已是新值，
   * 但 sendMessage 内部又会用 overrideAttempts={[turnId]: newAttemptNo} 显式覆盖，
   * 保证即使外层闭包还没更新也能正确过滤。
   */
  const handleRetry = useCallback(async (turnId: string) => {
    const maxNo = getMaxAttemptForTurn(conv.messages, turnId);
    const newAttemptNo = maxNo + 1;
    const currentConvId = conv.conversationId;
    conv.setActiveAttempts((prev) => ({ ...prev, [turnId]: newAttemptNo }));
    await chat.sendMessage({
      userInput: '',
      conversationId: currentConvId,
      existingMessages: conv.messages,
      activeAttempts: { ...conv.activeAttempts, [turnId]: newAttemptNo },
      selectedModel,
      activeProject,
      bindSetMessages,
      onConversationCreated: handleConvCreated,
      onConversationsReload: conv.loadConversations,
      reasoningEffort,
      retryTurnId: turnId,
      retryAttemptNo: newAttemptNo,
    });
  }, [chat, conv, selectedModel, activeProject, reasoningEffort, handleConvCreated, bindSetMessages]);

  const abortSend = useCallback(() => {
    chat.abortSend(conv.conversationId);
  }, [chat, conv.conversationId]);

  const isLoading = conv.conversationId ? chat.isConversationActive(conv.conversationId) : false;

  return { handleSend, handleRetry, abortSend, isLoading };
}
