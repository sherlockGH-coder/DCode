import type { Message } from '../../../shared/types';

export interface ActiveRequest {
  conversationId: string;
  fullContent: string;
  fullReasoning: string;
  setMessages: (updater: (prev: Message[]) => Message[]) => void;
  turnId: string;
  attemptNo: number;
  /** Legacy field: current assistant anchor, retained for hot-reload recovery compatibility. */
  placeholderId: string;
  /** Current assistant message anchor, used to merge chunks, tool_calls, and final assistant metadata. */
  assistantAnchorId?: string;
  /** New-message insertion cursor, used to place tool results and the next assistant message correctly. */
  insertAfterId?: string;
}

export interface RetryInfo {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  reason: string;
  startedAt: number;
}
