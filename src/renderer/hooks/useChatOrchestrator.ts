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
    /** Factory: return the setMessages function bound to a conversation ID. */
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
  /** Check whether the specified conversation has an active request. */
  isConversationActive: (convId: string) => boolean;
  /** Rebind the active request's message-writing closure after HMR or remount. */
  rebindActiveRequests: (
    bindSetMessages: (convId: string) => (updater: (prev: Message[]) => Message[]) => void,
  ) => void;
}

interface ConversationDeps {
  conversationId: string | null;
  messages: Message[];
  /** Update a conversation's messages by passing its ID and an updater. */
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
  const setConversationId = conv.setConversationId;
  const setMessages = conv.setMessages;
  const rebindActiveRequests = chat.rebindActiveRequests;
  const handleConvCreated = useCallback((id: string) => {
    setConversationId(id);
    onConversationCreated?.(id);
  }, [setConversationId, onConversationCreated]);

  const bindSetMessages = useCallback((convId: string) => (updater: (prev: Message[]) => Message[]) => {
    setMessages(convId, updater);
  }, [setMessages]);

  useEffect(() => {
    rebindActiveRequests(bindSetMessages);
  }, [rebindActiveRequests, bindSetMessages]);

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
   * Retry entry point: pass only the turn ID, which is the user message ID being retried.
   *
   * Steps:
   * 1. Calculate the new attemptNo = max(existing) + 1.
   * 2. Immediately switch activeAttempts[turnId] to newAttemptNo in memory and the DB so the UI shows the new branch.
   * 3. Call the retry branch of sendMessage, skip creating a user message, and let the streamed response carry the new turnId/attemptNo.
   *
   * Note: the activeAttempts switch happens before send, so send reads the new value.
   * sendMessage also explicitly overrides it with overrideAttempts={[turnId]: newAttemptNo},
   * which keeps filtering correct even if the outer closure has not updated.
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
