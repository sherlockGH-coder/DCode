import { describe, expect, it } from 'vitest';
import { applyCacheBreakpoints } from './anthropicRound';

describe('Anthropic cache breakpoints', () => {
  it('uses no more than four stable cache-control markers', () => {
    const system = Array.from({ length: 3 }, (_, index) => ({ type: 'text', text: `system-${index}` }));
    const messages = Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: [{ type: 'text', text: `message-${index}` }],
    }));
    const tools = Array.from({ length: 6 }, (_, index) => ({ name: `tool_${index}` }));

    applyCacheBreakpoints(system, messages, tools);

    const marked = [
      ...system,
      ...tools,
      ...messages.flatMap((message) => message.content),
    ].filter((item) => 'cache_control' in item);

    expect(marked).toHaveLength(4);
    expect(tools.at(-1)).toHaveProperty('cache_control');
    expect(system.at(-1)).toHaveProperty('cache_control');
    expect(messages[0].content[0]).toHaveProperty('cache_control');
    expect(messages.at(-1)?.content[0]).toHaveProperty('cache_control');
  });
});
