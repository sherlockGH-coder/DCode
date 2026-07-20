import { describe, expect, it } from 'vitest';
import { splitBlocks } from './streamingBlocks';

describe('splitBlocks', () => {
  it('returns empty for empty input', () => {
    expect(splitBlocks('')).toEqual([]);
  });

  it('splits top-level paragraphs on blank lines', () => {
    expect(splitBlocks('para one\n\npara two')).toEqual(['para one', 'para two']);
  });

  it('does not split blank lines inside a fenced code block', () => {
    const text = '```python\ndef f():\n\n    return 1\n```';
    expect(splitBlocks(text)).toEqual([text]);
  });

  it('keeps an unclosed fence as a single trailing block', () => {
    const text = 'intro\n\n```js\nconst a = 1;\n\nconst b = 2;';
    expect(splitBlocks(text)).toEqual(['intro', '```js\nconst a = 1;\n\nconst b = 2;']);
  });

  it('merges a loose list separated by blank lines into one block', () => {
    const text = '- item one\n\n- item two\n\n- item three';
    expect(splitBlocks(text)).toEqual(['- item one\n\n- item two\n\n- item three']);
  });

  it('separates a heading from a following paragraph', () => {
    expect(splitBlocks('# Title\n\nbody text')).toEqual(['# Title', 'body text']);
  });

  it('treats consecutive non-blank lines as one block', () => {
    expect(splitBlocks('line a\nline b\nline c')).toEqual(['line a\nline b\nline c']);
  });

  it('merges indented continuation into the previous block', () => {
    const text = '1. first\n\n    continued detail\n\n2. second';
    const blocks = splitBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toContain('continued detail');
  });
});
