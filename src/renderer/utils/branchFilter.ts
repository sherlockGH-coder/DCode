import type { Message } from '../../shared/types';

/**
 * 按激活分支过滤消息：每个 turn 只保留 (user 消息 + 该 turn 激活 attempt 的所有 assistant/tool 消息)。
 *
 * 默认激活：activeAttempts 中已记录的值；未记录则 fallback 到该 turn 的 max(attemptNo)。
 *
 * `overrideAttempts` 用于重试场景：传 `{ [turnId]: newAttemptNo }` 让该 turn 临时切到一个尚无消息的新 attempt，
 * 这样过滤结果里该 turn 只剩 user 消息（assistant/tool 都不带回 API）。
 */
export function filterActiveBranch(
  messages: Message[],
  activeAttempts: Record<string, number>,
  overrideAttempts: Record<string, number> = {},
): Message[] {

  const maxByTurn = new Map<string, number>();
  for (const m of messages) {
    if (!m.turnId || m.attemptNo === undefined) continue;
    const prev = maxByTurn.get(m.turnId);
    if (prev === undefined || m.attemptNo > prev) maxByTurn.set(m.turnId, m.attemptNo);
  }

  const resolve = (turnId: string): number => {
    if (overrideAttempts[turnId] !== undefined) return overrideAttempts[turnId];
    if (activeAttempts[turnId] !== undefined) return activeAttempts[turnId];
    return maxByTurn.get(turnId) ?? 0;
  };

  return messages.filter((m) => {
    if (!m.turnId) return true;
    if (m.role === 'user') return true;
    const active = resolve(m.turnId);
    return m.attemptNo === active;
  });
}

/** 计算指定 turn 当前已有的最大 attemptNo（不存在则返回 0） */
export function getMaxAttemptForTurn(messages: Message[], turnId: string): number {
  let max = 0;
  for (const m of messages) {
    if (m.turnId === turnId && m.attemptNo !== undefined && m.attemptNo > max) max = m.attemptNo;
  }
  return max;
}

/** 找到 conversation 中最后一个 user 消息 — 用于判断"是否最后一个 turn"（重试入口可见性） */
export function findLastUserMessage(messages: Message[]): Message | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i];
  }
  return undefined;
}
