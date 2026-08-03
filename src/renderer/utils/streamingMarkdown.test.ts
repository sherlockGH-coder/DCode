import { describe, expect, it } from 'vitest';
import { closeMarkdown } from './streamingMarkdown';

describe('closeMarkdown', () => {
  it('does not append underscores for snake_case tool names', () => {
    const text = 'Testing web_search, web_fetch, edit_file, write_file, and load_skill:';

    expect(closeMarkdown(text)).toBe(text);
  });

  it('does not treat odd snake_case identifiers as unclosed emphasis', () => {
    const text = 'Testing edit_file, wait_agent, and list_agents:';

    expect(closeMarkdown(text)).toBe(text);
  });

  it('still closes real underscore emphasis', () => {
    expect(closeMarkdown('Start _emphasis')).toBe('Start _emphasis_');
  });

  it('ignores underscores inside inline code', () => {
    const text = 'Read read_file after calling `web_search`:';

    expect(closeMarkdown(text)).toBe(text);
  });

  it('does not treat a leading list marker as unclosed italic', () => {
    const text = 'The results are:\n* First item\n* Second item';

    expect(closeMarkdown(text)).toBe(text);
  });

  it('still closes real single-star italic mid-line', () => {
    expect(closeMarkdown('This is *emphasis')).toBe('This is *emphasis*');
  });
});
