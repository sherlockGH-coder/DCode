import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Message, PendingApprovalRequest, ToolCall } from '../../../shared/types';
import { applyMetadata, createToolItemFromStart } from '../../utils/toolItemHelpers';
import { applyApprovalToMessages, shouldAutoApproveApproval } from './approval';
import {
  assistantAnchorId,
  findMessageIndex,
  insertIndexAfter,
  insertionAnchorId,
  setCurrentAssistant,
  updateAssistantId,
} from './anchors';
import type { ActiveRequest, RetryInfo } from './types';

interface ChunkBuffer {
  content: string;
  reasoning: string;
  rafId: number | null;
  timeoutId: number | null;
}

export interface AssistantMessagePayload {
  id?: string;
  content?: unknown;
  usage?: Message['usage'];
  duration?: number;
  completed_at?: number;
}

/**
 * 把一轮结束时主进程发来的 assistant-message 合并进消息数组。
 * 纯工具轮的 content 为空串，空串不得覆盖已流式输出的正文。
 */
export function applyAssistantMessageToMessages(
  prev: Message[],
  req: ActiveRequest,
  data: AssistantMessagePayload,
): Message[] {
  const dbId = data.id;
  const hasIncomingContent = typeof data.content === 'string' && data.content.length > 0;
  const anchorIdx = findMessageIndex(prev, assistantAnchorId(req));
  const updated = [...prev];
  if (hasIncomingContent && anchorIdx !== -1 && updated[anchorIdx]?.role !== 'assistant') {
    const insertAt = insertIndexAfter(updated, insertionAnchorId(req));
    const newAssistant: Message = {
      id: dbId ?? crypto.randomUUID(),
      clientId: crypto.randomUUID(),
      role: 'assistant',
      content: data.content as string,
      usage: data.usage,
      duration: data.duration,
      completed_at: data.completed_at,
      turnId: req.turnId,
      attemptNo: req.attemptNo,
    };
    updated.splice(insertAt, 0, newAssistant);
    setCurrentAssistant(req, newAssistant.id);
    return updated;
  }
  const startIdx = anchorIdx === -1 ? updated.length - 1 : anchorIdx;
  for (let i = startIdx; i >= 0; i--) {
    if (updated[i].role === 'assistant') {
      const oldId = updated[i].id;
      updated[i] = {
        ...updated[i],
        ...(dbId ? { id: dbId } : {}),
        ...(hasIncomingContent ? { content: data.content as string } : {}),
        usage: data.usage,
        duration: data.duration,
        completed_at: data.completed_at,
      };
      if (dbId) updateAssistantId(req, oldId, dbId);
      break;
    }
  }
  return updated;
}

export function useMessageStreamEvents({
  activeRequestsRef,
  getOrCreateActiveRequestForApproval,
  restorePendingApprovals,
  setIsLoading,
  setRetryInfo,
  setTurnTimers,
}: {
  activeRequestsRef: MutableRefObject<Map<string, ActiveRequest>>;
  getOrCreateActiveRequestForApproval: (approvalReq: PendingApprovalRequest) => ActiveRequest | undefined;
  restorePendingApprovals: () => Promise<void>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setRetryInfo: Dispatch<SetStateAction<RetryInfo | null>>;
  setTurnTimers: Dispatch<SetStateAction<Record<string, { startedAt: number; endedAt?: number }>>>;
}): void {
  useEffect(() => {
    const unsubs: Array<() => void> = [];
    const chunkBuffers = new Map<string, ChunkBuffer>();

    const getChunkBuffer = (conversationId: string): ChunkBuffer => {
      let buffer = chunkBuffers.get(conversationId);
      if (!buffer) {
        buffer = { content: '', reasoning: '', rafId: null, timeoutId: null };
        chunkBuffers.set(conversationId, buffer);
      }
      return buffer;
    };

    const cancelScheduledFlush = (buffer: ChunkBuffer) => {
      if (buffer.rafId !== null) {
        window.cancelAnimationFrame(buffer.rafId);
        buffer.rafId = null;
      }
      if (buffer.timeoutId !== null) {
        window.clearTimeout(buffer.timeoutId);
        buffer.timeoutId = null;
      }
    };

    const flushChunks = (conversationId: string) => {
      const buffer = chunkBuffers.get(conversationId);
      if (!buffer || (!buffer.content && !buffer.reasoning)) return;
      cancelScheduledFlush(buffer);

      const content = buffer.content;
      const reasoning = buffer.reasoning;
      buffer.content = '';
      buffer.reasoning = '';

      const req = activeRequestsRef.current.get(conversationId);
      if (!req) return;
      const candidateId = crypto.randomUUID();
      req.setMessages((prev) => {
        const idx = findMessageIndex(prev, assistantAnchorId(req));
        const anchor = idx === -1 ? undefined : prev[idx];
        if (anchor && anchor.role === 'assistant' && !anchor.toolItems?.length) {
          const updated = [...prev];
          updated[idx] = {
            ...anchor,
            content: anchor.content + content,
            reasoning_content: (anchor.reasoning_content ?? '') + reasoning,
          };
          return updated;
        }

        const insertAt = insertIndexAfter(prev, insertionAnchorId(req));
        const newAssistant: Message = {
          id: candidateId,
          clientId: candidateId,
          role: 'assistant',
          content,
          ...(reasoning ? { reasoning_content: reasoning } : {}),
          turnId: req.turnId,
          attemptNo: req.attemptNo,
        };
        setCurrentAssistant(req, candidateId);
        return [...prev.slice(0, insertAt), newAssistant, ...prev.slice(insertAt)];
      });
    };

    const scheduleChunkFlush = (conversationId: string) => {
      const buffer = getChunkBuffer(conversationId);
      if (buffer.rafId !== null || buffer.timeoutId !== null) return;
      if (typeof window.requestAnimationFrame === 'function') {
        buffer.rafId = window.requestAnimationFrame(() => {
          buffer.rafId = null;
          flushChunks(conversationId);
        });
        return;
      }
      buffer.timeoutId = window.setTimeout(() => {
        buffer.timeoutId = null;
        flushChunks(conversationId);
      }, 33);
    };

    const stampTurnStart = (turnId: string) => {
      setTurnTimers((prev) => (prev[turnId] ? prev : { ...prev, [turnId]: { startedAt: Date.now() } }));
    };

    unsubs.push(window.dcodeApi.onReasoningChunk((conversationId: string, chunk: string) => {
      const req = activeRequestsRef.current.get(conversationId);
      if (!req) return;
      stampTurnStart(req.turnId);
      req.fullReasoning += chunk;
      getChunkBuffer(conversationId).reasoning += chunk;
      scheduleChunkFlush(conversationId);
    }));

    unsubs.push(window.dcodeApi.onChunk((conversationId: string, chunk: string) => {
      const req = activeRequestsRef.current.get(conversationId);
      if (!req) return;
      stampTurnStart(req.turnId);
      req.fullContent += chunk;
      getChunkBuffer(conversationId).content += chunk;
      scheduleChunkFlush(conversationId);
    }));

    unsubs.push(window.dcodeApi.onToolCallStart((conversationId: string, toolCall) => {
      const req = activeRequestsRef.current.get(conversationId);
      if (!req) return;
      stampTurnStart(req.turnId);
      flushChunks(conversationId);
      const newItem = createToolItemFromStart(toolCall);
      const toolCallObj: ToolCall = {
        id: toolCall.id,
        type: 'function',
        function: { name: toolCall.name, arguments: toolCall.arguments },
      };
      req.setMessages((prev) => {
        const idx = findMessageIndex(prev, assistantAnchorId(req));
        if (idx === -1) return prev;
        const anchor = prev[idx];
        if (anchor.role === 'assistant') {
          const updated = [...prev];
          updated[idx] = {
            ...anchor,
            tool_calls: [...(anchor.tool_calls ?? []), toolCallObj],
            toolItems: [...(anchor.toolItems ?? []), newItem],
          };
          return updated;
        }
        const newAssistant: Message = {
          id: `tool_holder_${toolCall.id}`,
          clientId: `tool_holder_${toolCall.id}`,
          role: 'assistant',
          content: '',
          tool_calls: [toolCallObj],
          toolItems: [newItem],
          turnId: req.turnId,
          attemptNo: req.attemptNo,
        };
        const insertAt = insertIndexAfter(prev, insertionAnchorId(req));
        setCurrentAssistant(req, newAssistant.id);
        return [...prev.slice(0, insertAt), newAssistant, ...prev.slice(insertAt)];
      });
    }));

    unsubs.push(window.dcodeApi.onToolCallEnd((conversationId: string, result) => {
      const req = activeRequestsRef.current.get(conversationId);
      if (!req) return;
      flushChunks(conversationId);
      const status = result.error ? 'error' as const : 'done' as const;
      req.setMessages((prev) => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          const msg = updated[i];
          if (msg.role === 'assistant' && msg.toolItems?.length) {
            const itemIdx = msg.toolItems.findIndex((ti) => ti.toolCallId === result.tool_call_id);
            if (itemIdx !== -1) {
              const oldItem = msg.toolItems[itemIdx];
              const newItems = [...msg.toolItems];
              newItems[itemIdx] = applyMetadata(oldItem, result.metadata, status, result.content);
              updated[i] = { ...msg, toolItems: newItems };
              break;
            }
          }
        }
        const toolMsg: Message = {
          id: `tool_result_${result.tool_call_id}`,
          clientId: `tool_result_${result.tool_call_id}`,
          role: 'tool' as const,
          content: result.content,
          tool_call_id: result.tool_call_id,
          name: result.name,
          error: result.error,
          turnId: req.turnId,
          attemptNo: req.attemptNo,
        };
        const anchorIdx = findMessageIndex(updated, insertionAnchorId(req));
        if (anchorIdx === -1) {
          updated.push(toolMsg);
        } else {
          updated.splice(anchorIdx + 1, 0, toolMsg);
        }
        req.insertAfterId = toolMsg.id;
        return updated;
      });
    }));

    unsubs.push(window.dcodeApi.onAssistantMessage((conversationId: string, data: any) => {
      const req = activeRequestsRef.current.get(conversationId);
      if (!req) return;
      flushChunks(conversationId);

      if (typeof data.content === 'string' && data.content.length > 0) {
        req.fullContent = data.content;
      }
      req.setMessages((prev) => applyAssistantMessageToMessages(prev, req, data));
    }));

    unsubs.push(window.dcodeApi.onToolMessagePersisted((conversationId: string, data) => {
      const req = activeRequestsRef.current.get(conversationId);
      if (!req) return;
      req.setMessages((prev) => {
        const idx = prev.findIndex(m => m.role === 'tool' && m.tool_call_id === data.tool_call_id);
        if (idx === -1) return prev;
        const oldId = prev[idx].id;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], id: data.id };
        if (req.insertAfterId === oldId) req.insertAfterId = data.id;
        return updated;
      });
    }));

    unsubs.push(window.dcodeApi.onApprovalRequest((approvalReq) => {
      const req = getOrCreateActiveRequestForApproval(approvalReq);
      if (!req) {
        console.warn('[useMessages] approval request has no matching active conversation:', approvalReq);
        return;
      }
      if (shouldAutoApproveApproval(approvalReq)) {
        window.dcodeApi.approvalRespond(approvalReq.toolCallId, true).catch((err) => {
          console.error('[useMessages] session auto-approve 失败:', err);
        });
        return;
      }
      req.setMessages((prev) => applyApprovalToMessages(prev, approvalReq, req));
    }));

    unsubs.push(window.dcodeApi.onDone(async (conversationId: string) => {
      const req = activeRequestsRef.current.get(conversationId);
      if (!req) return;
      flushChunks(conversationId);
      const finishedTurnId = req.turnId;
      activeRequestsRef.current.delete(conversationId);
      if (activeRequestsRef.current.size === 0) {
        setIsLoading(false);
        setRetryInfo(null);
      }
      setTurnTimers((prev) => {
        const t = prev[finishedTurnId];
        if (!t || t.endedAt) return prev;
        return { ...prev, [finishedTurnId]: { ...t, endedAt: Date.now() } };
      });
    }));

    unsubs.push(window.dcodeApi.onError((conversationId: string, errorMessage: string) => {
      const req = activeRequestsRef.current.get(conversationId);
      if (!req) return;
      flushChunks(conversationId);
      const finishedTurnId = req.turnId;
      const errorContent = errorMessage;
      req.setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        const canReuseAssistantPlaceholder =
          last?.role === 'assistant' &&
          !last.content &&
          !last.reasoning_content &&
          !last.toolItems?.length &&
          !last.tool_calls?.length;

        if (canReuseAssistantPlaceholder) {
          updated[updated.length - 1] = { ...last, content: errorContent, error: true };
        } else {
          updated.push({
            id: `err_${Date.now()}`,
            role: 'assistant',
            content: errorContent,
            error: true,
            turnId: req.turnId,
            attemptNo: req.attemptNo,
          });
        }
        return updated;
      });
      activeRequestsRef.current.delete(conversationId);
      if (activeRequestsRef.current.size === 0) {
        setIsLoading(false);
        setRetryInfo(null);
      }
      setTurnTimers((prev) => {
        const t = prev[finishedTurnId];
        if (!t || t.endedAt) return prev;
        return { ...prev, [finishedTurnId]: { ...t, endedAt: Date.now() } };
      });
    }));

    unsubs.push(window.dcodeApi.onStreamRetry((conversationId: string, info) => {
      if (!activeRequestsRef.current.has(conversationId)) return;
      setRetryInfo({ ...info, startedAt: Date.now() });
    }));

    void restorePendingApprovals();

    return () => {
      for (const buffer of chunkBuffers.values()) {
        cancelScheduledFlush(buffer);
      }
      unsubs.forEach((unsub) => unsub());
    };
  }, [
    activeRequestsRef,
    getOrCreateActiveRequestForApproval,
    restorePendingApprovals,
    setIsLoading,
    setRetryInfo,
    setTurnTimers,
  ]);
}
