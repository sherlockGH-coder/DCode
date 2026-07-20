import { describe, expect, it } from 'vitest';
import { closeMarkdown } from './streamingMarkdown';

describe('closeMarkdown', () => {
  it('does not append underscores for snake_case tool names', () => {
    const text = '现在测试 web_search、 web_fetch、 edit_file、 write_file 和 load_skill:';

    expect(closeMarkdown(text)).toBe(text);
  });

  it('does not treat odd snake_case identifiers as unclosed emphasis', () => {
    const text = '现在测试 edit_file、 wait_agent 和 list_agents:';

    expect(closeMarkdown(text)).toBe(text);
  });

  it('still closes real underscore emphasis', () => {
    expect(closeMarkdown('开始 _强调')).toBe('开始 _强调_');
  });

  it('ignores underscores inside inline code', () => {
    const text = '调用 `web_search` 后读取 read_file:';

    expect(closeMarkdown(text)).toBe(text);
  });

  it('does not treat a leading list marker as unclosed italic', () => {
    const text = '结果如下：\n* 第一项\n* 第二项';

    expect(closeMarkdown(text)).toBe(text);
  });

  it('still closes real single-star italic mid-line', () => {
    expect(closeMarkdown('这是 *强调')).toBe('这是 *强调*');
  });
});
