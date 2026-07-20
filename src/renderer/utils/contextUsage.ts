import type { Message } from '../../shared/types';

export function calculateContextUsagePercent(messages: Message[], contextLimit?: number | null): number | null {
  if (!contextLimit || contextLimit <= 0) return null;

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const usage = messages[i].usage;
    if (!usage?.prompt_tokens || usage.prompt_tokens <= 0) continue;

    const percent = Math.round((usage.prompt_tokens / contextLimit) * 100);
    return Math.max(0, Math.min(100, percent));
  }

  return null;
}
