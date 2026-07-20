import type { Message } from '../../../shared/types';

export interface ActiveRequest {
  conversationId: string;
  fullContent: string;
  fullReasoning: string;
  setMessages: (updater: (prev: Message[]) => Message[]) => void;
  turnId: string;
  attemptNo: number;
  /** 旧字段：当前 assistant 锚点。保留用于热更新恢复兼容。 */
  placeholderId: string;
  /** 当前 assistant 消息锚点，用于合并 chunk、tool_calls 和最终 assistant metadata。 */
  assistantAnchorId?: string;
  /** 新消息插入游标，用于把 tool result 和下一轮 assistant 插到正确位置。 */
  insertAfterId?: string;
}

export interface RetryInfo {
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  reason: string;
  startedAt: number;
}
