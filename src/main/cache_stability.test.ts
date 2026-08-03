/**
 * cache_stability.test.ts - byte-stability tests
 *
 * Covered scenarios:
 * 1. Recovery after compaction: pruneWithSummary produces consistent output.
 * 2. Message selection: selectMessagesToCompact routes messages correctly.
 */
import { describe, it, expect } from 'vitest';
import { pruneWithSummary, selectMessagesToCompact } from '../main/compact';
import type { Message } from '../shared/types';

function stableJson(obj: unknown): string {
  return JSON.stringify(obj, null, 0);
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: overrides.id ?? 'msg_1',
    role: overrides.role ?? 'user',
    content: overrides.content ?? 'Hello',
    ...overrides,
  };
}

describe('Compression recovery', () => {
  it('pruneWithSummary returns an unchanged copy without a summary (not the same reference)', () => {
    const messages: Message[] = [
      makeMessage({ id: 'sys', role: 'system', content: 'System' }),
      makeMessage({ id: 'u1', role: 'user', content: 'Hello' }),
    ];

    const result = pruneWithSummary(messages, null, null);
    expect(result).toEqual(messages);
    expect(result).not.toBe(messages);
  });

  it('pruneWithSummary prunes and injects a summary message when a summary exists', () => {
    const messages: Message[] = [
      makeMessage({ id: 'm1', role: 'user', content: 'First' }),
      makeMessage({ id: 'm2', role: 'assistant', content: 'Response 1' }),
      makeMessage({ id: 'm3', role: 'user', content: 'Second' }),
      makeMessage({ id: 'm4', role: 'assistant', content: 'Response 2' }),
      makeMessage({ id: 'm5', role: 'user', content: 'Third' }),
    ];

    const result = pruneWithSummary(messages, 'Previous summary text', 'm2');

    expect(result).toHaveLength(4);
    expect(result[0].id).toBe('context_summary');
    expect(result[0].role).toBe('system');
    expect(result[0].content).toContain('Previous summary text');
    expect(result[1].id).toBe('m3');
    expect(result[2].id).toBe('m4');
    expect(result[3].id).toBe('m5');
  });

  it('pruneWithSummary keeps all messages when the boundary ID is missing', () => {
    const messages: Message[] = [
      makeMessage({ id: 'm1', role: 'user', content: 'First' }),
    ];

    const result = pruneWithSummary(messages, 'Summary', 'nonexistent');
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual(messages[0]);
  });

  it('pruneWithSummary is idempotent and repeated calls match', () => {
    const messages: Message[] = [
      makeMessage({ id: 'm1', role: 'user', content: 'First' }),
      makeMessage({ id: 'm2', role: 'assistant', content: 'Response' }),
      makeMessage({ id: 'm3', role: 'user', content: 'Second' }),
    ];

    const result1 = pruneWithSummary(messages, 'Summary', 'm1');
    const result2 = pruneWithSummary(messages, 'Summary', 'm1');

    expect(stableJson(result1)).toBe(stableJson(result2));
  });

  it('selectMessagesToCompact routes messages correctly', () => {
    const messages: Message[] = [
      makeMessage({ id: 'sys', role: 'system', content: 'System' }),
      makeMessage({ id: 'u1', role: 'user', content: 'First', turnId: 't1' }),
      makeMessage({ id: 'a1', role: 'assistant', content: 'R1', turnId: 't1' }),
      makeMessage({ id: 'u2', role: 'user', content: 'Second', turnId: 't2' }),
      makeMessage({ id: 'a2', role: 'assistant', content: 'R2', turnId: 't2' }),
      makeMessage({ id: 'u3', role: 'user', content: 'Third', turnId: 't3' }),
      makeMessage({ id: 'a3', role: 'assistant', content: 'R3', turnId: 't3' }),
    ];

    const { toCompact, toKeep } = selectMessagesToCompact(messages, 1);

    expect(toKeep.some((m) => m.id === 'sys')).toBe(true);

    expect(toKeep.some((m) => m.id === 'u3')).toBe(true);
    expect(toKeep.some((m) => m.id === 'a3')).toBe(true);

    expect(toCompact.some((m) => m.id === 'u1')).toBe(true);
    expect(toCompact.some((m) => m.id === 'u2')).toBe(true);

    expect(toCompact.some((m) => m.role === 'system')).toBe(false);
  });
});
