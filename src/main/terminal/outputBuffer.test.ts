import { describe, expect, it } from 'vitest';
import { TerminalOutputBuffer } from './outputBuffer';

describe('TerminalOutputBuffer', () => {
  it('returns appended data in order', () => {
    const buffer = new TerminalOutputBuffer(1024);
    buffer.append('a');
    buffer.append('b');
    buffer.append('c');
    expect(buffer.read()).toBe('abc');
    expect(buffer.size).toBe(3);
  });

  it('ignores empty appends', () => {
    const buffer = new TerminalOutputBuffer(1024);
    buffer.append('');
    expect(buffer.read()).toBe('');
    expect(buffer.size).toBe(0);
  });

  it('drops the oldest chunks once the cap is exceeded', () => {
    const buffer = new TerminalOutputBuffer(5);
    buffer.append('abc');
    buffer.append('de');
    buffer.append('fg');
    // 'abc' is evicted as a whole, leaving 'de' + 'fg'.
    expect(buffer.read()).toBe('defg');
    expect(buffer.size).toBe(4);
  });

  it('truncates a single oversized chunk to the tail', () => {
    const buffer = new TerminalOutputBuffer(4);
    buffer.append('abcdefghij');
    expect(buffer.read()).toBe('ghij');
    expect(buffer.size).toBe(4);
  });

  it('never exceeds the cap across many appends', () => {
    const max = 64;
    const buffer = new TerminalOutputBuffer(max);
    for (let i = 0; i < 5000; i++) {
      buffer.append(`chunk-${i}-`);
      expect(buffer.size).toBeLessThanOrEqual(max);
    }
    expect(buffer.read().length).toBeLessThanOrEqual(max);
    // The retained output must always be the newest output.
    expect(buffer.read().endsWith('chunk-4999-')).toBe(true);
  });

  it('stays correct when read is called repeatedly between appends', () => {
    const buffer = new TerminalOutputBuffer(10);
    buffer.append('abc');
    expect(buffer.read()).toBe('abc');
    buffer.append('def');
    expect(buffer.read()).toBe('abcdef');
    expect(buffer.read()).toBe('abcdef');
    buffer.append('ghijkl');
    expect(buffer.read()).toBe('ghijkl');
  });

  it('clears back to empty', () => {
    const buffer = new TerminalOutputBuffer(10);
    buffer.append('abc');
    buffer.clear();
    expect(buffer.read()).toBe('');
    expect(buffer.size).toBe(0);
  });

  it('handles high-volume appends without quadratic slowdown', () => {
    const buffer = new TerminalOutputBuffer(256 * 1024);
    const chunk = 'x'.repeat(512);
    const started = performance.now();
    for (let i = 0; i < 50_000; i++) buffer.append(chunk);
    const elapsed = performance.now() - started;

    expect(buffer.size).toBe(256 * 1024);
    // The old implementation copied 256 KB for every chunk after the buffer filled,
    // making this loop several orders of magnitude slower.
    expect(elapsed).toBeLessThan(2000);
  });
});
