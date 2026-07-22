import { useState, useCallback, useEffect, useRef } from 'react';
import type { Conversation, Message } from '../../shared/types';
import { reconstructToolItems } from '../utils/toolItemHelpers';
import { applyApprovalToMessages, type ActiveRequest } from './useMessages';

const MAX_CACHED_CONVERSATIONS = 5;

/**
 * 对话列表 + 当前选中对话的状态管理。
 * activeProject 改变时按项目过滤；同时清空当前选中对话，让用户回到「新对话」起点。
 *
 * messages 按 conversationId 缓存，切换对话不丢失后台流式更新的消息。
 * 使用 LRU 策略限制缓存数量，避免内存无限增长。
 */
export function useConversations(activeProject: string | null) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messagesByConv, setMessagesByConv] = useState<Record<string, Message[]>>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const [activeAttempts, setActiveAttemptsState] = useState<Record<string, number>>({});

  const conversationAccessOrderRef = useRef<string[]>([]);

  const messages = conversationId ? (messagesByConv[conversationId] ?? []) : [];

  /**
   * 拉取当前项目下的对话。
   *  - activeProject 为字符串：该项目下的对话
   *  - activeProject 为 null：未归类的对话
   */
  const loadConversations = useCallback(async () => {
    try {
      const projConvs = await window.deepseekApi.getConversations();
      setConversations(projConvs as Conversation[]);
    } catch (err) {
      console.error('加载对话列表失败:', err);
    }
  }, []);

  const latestLoadRef = useRef<string | null>(null);

  const messagesByConvRef = useRef(messagesByConv);
  messagesByConvRef.current = messagesByConv;

  const touchConversationCache = useCallback((convId: string) => {
    const accessOrder = conversationAccessOrderRef.current.filter((id) => id !== convId);
    accessOrder.push(convId);
    conversationAccessOrderRef.current = accessOrder;
  }, []);

  const pruneConversationCache = useCallback((cache: Record<string, Message[]>): Record<string, Message[]> => {
    const keys = Object.keys(cache);
    if (keys.length <= MAX_CACHED_CONVERSATIONS) return cache;

    const keySet = new Set(keys);
    const ordered = conversationAccessOrderRef.current.filter((id) => keySet.has(id));
    const orderedSet = new Set(ordered);
    const untracked = keys.filter((id) => !orderedSet.has(id));
    const normalizedOrder = [...untracked, ...ordered];
    const toKeep = new Set(normalizedOrder.slice(-MAX_CACHED_CONVERSATIONS));
    const filtered: Record<string, Message[]> = {};

    for (const key of keys) {
      if (toKeep.has(key)) filtered[key] = cache[key];
    }
    conversationAccessOrderRef.current = normalizedOrder.filter((id) => toKeep.has(id));
    return filtered;
  }, []);

  const loadMessages = useCallback(async (convId: string) => {
    latestLoadRef.current = convId;
    try {
      const [msgs, attempts, pendingApprovals] = await Promise.all([
        window.deepseekApi.getMessages(convId),
        window.deepseekApi.getActiveAttempts(convId),
        window.deepseekApi.approvalListPending(convId),
      ]);
      if (latestLoadRef.current !== convId) return;

      const raw = msgs as Message[];
      const toolMsgsByCallId = new Map<string, Message>();
      for (const m of raw) {
        if (m.role === 'tool' && m.tool_call_id) {
          toolMsgsByCallId.set(m.tool_call_id, m);
        }
      }
      const restored = raw.map((m): Message => {
        if (m.role === 'assistant' && m.tool_calls?.length) {
          return {
            ...m,
            toolItems: reconstructToolItems(m.tool_calls, m.tool_calls.map((tc) => toolMsgsByCallId.get(tc.id)).filter(Boolean) as Message[]),
          };
        }
        return m;
      });
      const restoredWithApprovals = pendingApprovals.reduce<Message[]>((current, approvalReq) => {
        if (!approvalReq.turnId) return current;
        const activeReq: ActiveRequest = {
          conversationId: convId,
          fullContent: '',
          fullReasoning: '',
          setMessages: () => undefined,
          turnId: approvalReq.turnId,
          attemptNo: approvalReq.attemptNo ?? 1,
          placeholderId: `approval_holder_${approvalReq.toolCallId}`,
        };
        return applyApprovalToMessages(current, approvalReq, activeReq);
      }, restored);
      setMessagesByConv((prev) => {
        touchConversationCache(convId);
        return pruneConversationCache({
          ...prev,
          [convId]: restoredWithApprovals,
        });
      });
      setActiveAttemptsState(attempts ?? {});
      setConversationId(convId);
    } catch (err) {
      console.error('加载消息失败:', err);
    }
  }, [pruneConversationCache, touchConversationCache]);

  /**
   * 更新指定对话的消息（供流式事件回调使用）。
   * 调用方负责指定 convId 以确保后台对话的消息写入正确缓存。
   */
  const setMessages = useCallback((convId: string, updater: (prev: Message[]) => Message[]) => {
    setMessagesByConv((prev) => {
      touchConversationCache(convId);
      const next = {
        ...prev,
        [convId]: updater(prev[convId] ?? []),
      };
      return pruneConversationCache(next);
    });
  }, [pruneConversationCache, touchConversationCache]);

  /** 写 activeAttempts：内存 + DB 一起更新（DB 失败仅 console，UI 不阻塞） */
  const setActiveAttempts = useCallback(
    (updater: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => {
      setActiveAttemptsState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (conversationId) {
          window.deepseekApi.setActiveAttempts(conversationId, next).catch((err) => {
            console.error('[useConversations] 持久化 activeAttempts 失败:', err);
          });
        }
        return next;
      });
    },
    [conversationId],
  );

  useEffect(() => {
    loadConversations();
  }, [loadConversations, activeProject]);

  useEffect(() => {
    const unsub = window.conversationsApi.onChanged(() => {
      loadConversations();
    });
    return unsub;
  }, [loadConversations]);

  const handleNewConversation = useCallback(async (projectPath?: string | null): Promise<string | null> => {
    setConversationId(null);
    setActiveAttemptsState({});
    if (projectPath === undefined) return null;

    try {
      const convId = await window.deepseekApi.createConversation('新对话', projectPath);
      setMessagesByConv((prev) => {
        touchConversationCache(convId);
        return pruneConversationCache({
          ...prev,
          [convId]: [],
        });
      });
      setConversationId(convId);
      await loadConversations();
      return convId;
    } catch (err) {
      console.error('创建新对话失败:', err);
      return null;
    }
  }, [loadConversations, pruneConversationCache, touchConversationCache]);

  const handleSelectConversation = useCallback((convId: string) => {
    if (convId === conversationId) return;

    if (messagesByConvRef.current[convId]?.length) {
      touchConversationCache(convId);
      setConversationId(convId);

      window.deepseekApi.getActiveAttempts(convId).then((attempts) => {
        setActiveAttemptsState(attempts ?? {});
      }).catch(() => {});
      return;
    }
    loadMessages(convId);
  }, [conversationId, loadMessages, touchConversationCache]);

  const handleDeleteConversation = useCallback(async (convId: string) => {
    try {
      await window.deepseekApi.deleteConversation(convId);
      if (convId === conversationId) {
        setConversationId(null);
        setActiveAttemptsState({});
      }

      setMessagesByConv((prev) => {
        const next = { ...prev };
        delete next[convId];
        conversationAccessOrderRef.current = conversationAccessOrderRef.current.filter((id) => id !== convId);
        return next;
      });
      await loadConversations();
    } catch (err) {
      console.error('删除对话失败:', err);
    }
  }, [conversationId, loadConversations]);

  const deleteMessagesFromTurn = useCallback(async (convId: string, turnId: string) => {
    await window.deepseekApi.deleteMessagesFromTurn(convId, turnId);
    setMessagesByConv((prev) => {
      const current = prev[convId] ?? [];
      const startIndex = current.findIndex((message) => message.turnId === turnId);
      if (startIndex === -1) return prev;
      return {
        ...prev,
        [convId]: current.slice(0, startIndex),
      };
    });
    setActiveAttemptsState((prev) => {
      const current = messagesByConvRef.current[convId] ?? [];
      const startIndex = current.findIndex((message) => message.turnId === turnId);
      if (startIndex === -1) return prev;
      const deletedTurnIds = new Set(
        current.slice(startIndex)
          .map((message) => message.turnId)
          .filter((id): id is string => !!id),
      );
      if (deletedTurnIds.size === 0) return prev;
      const next = { ...prev };
      for (const deletedTurnId of deletedTurnIds) {
        delete next[deletedTurnId];
      }
      return next;
    });
    await loadConversations();
  }, [loadConversations]);

  return {
    conversationId,
    setConversationId,
    messages,
    setMessages,
    conversations,
    activeAttempts,
    setActiveAttempts,
    loadConversations,
    loadMessages,
    handleNewConversation,
    handleSelectConversation,
    handleDeleteConversation,
    deleteMessagesFromTurn,
  };
}
