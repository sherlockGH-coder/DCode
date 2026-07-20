import { describe, expect, it } from 'vitest';
import { convertMessagesToAnthropic } from './agentLoop';
import { applyCacheBreakpoints } from './agent-loop/anthropicRound';
import type { Message } from '../shared/types';

describe('tool result content blocks', () => {
  it('serializes tail context reminders and applies a bounded cache marker centrally', () => {
    const messages: Message[] = [
      {
        id: 'tail_context_reminder',
        role: 'user',
        content: '<system-reminder>\n# 当前日期\n今天的日期: 2026/06/19\n</system-reminder>',
      },
    ];

    const { anthropicMessages } = convertMessagesToAnthropic(messages);
    applyCacheBreakpoints([], anthropicMessages, []);

    expect(anthropicMessages[0]).toEqual({
      role: 'user',
      content: [
        {
          type: 'text',
          text: '<system-reminder>\n# 当前日期\n今天的日期: 2026/06/19\n</system-reminder>',
          cache_control: { type: 'ephemeral' },
        },
      ],
    });
  });

  it('serializes image blocks for Anthropic tool results', () => {
    const messages: Message[] = [
      {
        id: 'tool_1',
        role: 'tool',
        tool_call_id: 'call_1',
        name: 'read_file',
        content: '[Image file]',
        contentBlocks: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: 'abc',
            },
          },
        ],
      } as any,
    ];

    const { anthropicMessages } = convertMessagesToAnthropic(messages);

    expect((anthropicMessages[0].content as any[])[0]).toEqual({
      type: 'tool_result',
      tool_use_id: 'call_1',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: 'abc',
          },
        },
      ],
    });
  });
});
