import type { Message } from '../../shared/types';

/**
 * Filter messages by the active branch: keep only the user message and all assistant/tool messages from the active attempt for each turn.
 *
 * Default activation: use the value recorded in activeAttempts; otherwise fall back to the turn's max(attemptNo).
 *
 * `overrideAttempts` is used for retries: pass `{ [turnId]: newAttemptNo }` to temporarily switch the turn to a new attempt with no messages,
 * so the filtered result contains only the user message for that turn and sends no assistant/tool messages back to the API.
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

/** Calculate the current maximum attemptNo for a turn, returning 0 when none exists. */
export function getMaxAttemptForTurn(messages: Message[], turnId: string): number {
  let max = 0;
  for (const m of messages) {
    if (m.turnId === turnId && m.attemptNo !== undefined && m.attemptNo > max) max = m.attemptNo;
  }
  return max;
}

/** Find the last user message in a conversation to determine whether it is the last turn and whether the retry entry is visible. */
export function findLastUserMessage(messages: Message[]): Message | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i];
  }
  return undefined;
}
