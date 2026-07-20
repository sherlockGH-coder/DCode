import { useEffect, useMemo, useRef, useState } from 'react';
import type { Message } from '../../shared/types';
import type { RetryInfo } from './useMessages';

export type ActivityPhase =
  | 'idle'
  | 'awaiting_approval'
  | 'thinking'
  | 'tool_running'
  | 'between_rounds'
  | 'slow'
  | 'retrying'
  | 'offline'
  | 'timeout';

export interface ActivityState {
  phase: ActivityPhase;
  visible: boolean;
  label: string;
  detail?: string;
  toolName?: string;
  staleSecs: number;
  retryAttempt?: number;
  retryMaxAttempts?: number;
  retryReason?: string;
}

interface Options {
  isLoading: boolean;
  messages: Message[];
  lastTurnId: string | undefined;
  retryInfo: RetryInfo | null;
}

const STALE_THRESHOLD = 15;
const TIMEOUT_THRESHOLD = 45;

const RETRY_WINDOW_MS = 12_000;

export function useChatActivityPhase({
  isLoading,
  messages,
  lastTurnId,
  retryInfo,
}: Options): ActivityState {
  const [staleSecs, setStaleSecs] = useState(0);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const lastAssistant = useMemo(() => {
    if (!lastTurnId) return undefined;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === 'assistant' && m.turnId === lastTurnId) return m;
    }
    return undefined;
  }, [messages, lastTurnId]);

  const signatureRef = useRef<{ c: string; r: string; toolSig: string } | null>(null);
  useEffect(() => {
    if (!isLoading) {
      setStaleSecs(0);
      signatureRef.current = null;
      return;
    }
    const c = lastAssistant?.content ?? '';
    const r = lastAssistant?.reasoning_content ?? '';
    const toolSig = (lastAssistant?.toolItems ?? [])
      .map((ti) => `${ti.toolCallId}:${ti.status}`)
      .join('|');
    const prev = signatureRef.current;
    if (!prev || prev.c !== c || prev.r !== r || prev.toolSig !== toolSig) {
      signatureRef.current = { c, r, toolSig };
      setStaleSecs(0);
    }
  }, [isLoading, lastAssistant?.content, lastAssistant?.reasoning_content, lastAssistant?.toolItems]);

  useEffect(() => {
    if (!isLoading) return;
    const id = setInterval(() => setStaleSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isLoading]);

  return useMemo<ActivityState>(() => {
    if (!isLoading) {
      return { phase: 'idle', visible: false, label: '', staleSecs: 0 };
    }

    const toolItems = lastAssistant?.toolItems ?? [];
    const hasAwaitingApproval = toolItems.some((ti) => ti.status === 'awaiting_approval');
    if (hasAwaitingApproval) {
      return { phase: 'awaiting_approval', visible: false, label: '', staleSecs };
    }

    if (!isOnline) {
      return {
        phase: 'offline',
        visible: true,
        label: '网络已断开',
        detail: '连接恢复后将自动继续',
        staleSecs,
      };
    }

    if (retryInfo && Date.now() - retryInfo.startedAt < RETRY_WINDOW_MS) {
      return {
        phase: 'retrying',
        visible: true,
        label: `网络异常，正在尝试重新连接 (${retryInfo.attempt}/${retryInfo.maxAttempts})…`,
        detail: retryInfo.reason,
        staleSecs,
        retryAttempt: retryInfo.attempt,
        retryMaxAttempts: retryInfo.maxAttempts,
        retryReason: retryInfo.reason,
      };
    }

    if (staleSecs > TIMEOUT_THRESHOLD) {
      return {
        phase: 'timeout',
        visible: true,
        label: `响应似乎较慢，已等待 ${staleSecs} 秒`,
        staleSecs,
      };
    }

    const runningTool = toolItems.find((ti) => ti.status === 'running' || ti.status === 'pending');
    if (runningTool) {
      return {
        phase: 'tool_running',
        visible: true,
        label: `正在执行 ${runningTool.name}…`,
        toolName: runningTool.name,
        staleSecs,
      };
    }

    const hasToolCalls = !!lastAssistant?.tool_calls?.length;
    const allToolsDone =
      hasToolCalls && toolItems.length > 0 &&
      toolItems.every((ti) => ti.status === 'done' || ti.status === 'error');
    if (allToolsDone) {
      return {
        phase: 'between_rounds',
        visible: true,
        label: '继续生成中…',
        staleSecs,
      };
    }

    if (staleSecs > STALE_THRESHOLD) {
      return {
        phase: 'slow',
        visible: true,
        label: `响应较慢，已等待 ${staleSecs} 秒`,
        staleSecs,
      };
    }

    const hasNothing = !lastAssistant?.content && !lastAssistant?.reasoning_content;
    if (hasNothing) {
      return {
        phase: 'thinking',
        visible: true,
        label: '正在思考…',
        staleSecs,
      };
    }

    return { phase: 'thinking', visible: false, label: '', staleSecs };
  }, [isLoading, isOnline, retryInfo, staleSecs, lastAssistant]);
}
