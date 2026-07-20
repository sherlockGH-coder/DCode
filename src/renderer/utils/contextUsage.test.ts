import { describe, expect, it } from 'vitest';
import type { Message } from '../../shared/types';
import { calculateContextUsagePercent } from './contextUsage';

describe('calculateContextUsagePercent', () => {
  it('uses the latest assistant prompt tokens against the configured context limit', () => {
    const messages: Message[] = [
      {
        id: 'a1',
        role: 'assistant',
        content: 'earlier',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 10,
          total_tokens: 110,
        },
      },
      {
        id: 'a2',
        role: 'assistant',
        content: 'latest',
        usage: {
          prompt_tokens: 67_000,
          completion_tokens: 2_000,
          total_tokens: 69_000,
        },
      },
    ];

    expect(calculateContextUsagePercent(messages, 100_000)).toBe(67);
  });

  it('clamps overflowing usage and returns null when no real usage is available', () => {
    expect(calculateContextUsagePercent([
      {
        id: 'a1',
        role: 'assistant',
        content: 'overflow',
        usage: {
          prompt_tokens: 120_000,
          completion_tokens: 1,
          total_tokens: 120_001,
        },
      },
    ], 100_000)).toBe(100);

    expect(calculateContextUsagePercent([], 100_000)).toBeNull();
    expect(calculateContextUsagePercent([
      { id: 'u1', role: 'user', content: 'hello' },
    ], 100_000)).toBeNull();
    expect(calculateContextUsagePercent([
      {
        id: 'a1',
        role: 'assistant',
        content: 'latest',
        usage: {
          prompt_tokens: 100,
          completion_tokens: 1,
          total_tokens: 101,
        },
      },
    ], 0)).toBeNull();
  });
});
