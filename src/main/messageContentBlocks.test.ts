import { describe, expect, it } from 'vitest';
import { convertMessagesToAnthropic } from './agentLoop';
import { applyCacheBreakpoints } from './agent-loop/anthropicRound';
import { convertToolsToAnthropic } from './agent-loop/anthropicFormat';
import type { Message } from '../shared/types';

describe('tool result content blocks', () => {
  it('serializes tail context reminders and applies a bounded cache marker centrally', () => {
    const messages: Message[] = [
      {
        id: 'tail_context_reminder',
        role: 'user',
        content: '<system-reminder>\n# Current date\nToday\'s date: 2026/06/19\n</system-reminder>',
      },
    ];

    const { anthropicMessages } = convertMessagesToAnthropic(messages);
    applyCacheBreakpoints([], anthropicMessages, []);

    expect(anthropicMessages[0]).toEqual({
      role: 'user',
      content: [
        {
          type: 'text',
          text: '<system-reminder>\n# Current date\nToday\'s date: 2026/06/19\n</system-reminder>',
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

  it('maps server tools to the API built-in web search tool', () => {
    const tools = convertToolsToAnthropic([
      {
        name: 'web_search',
        description: 'Search the web',
        input_schema: { type: 'object', properties: {} },
        serverTool: true,
      },
      {
        name: 'read_file',
        description: 'Read a file',
        input_schema: { type: 'object', properties: {} },
      },
    ]);

    expect(tools[0]).toEqual({
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: 5,
    });
    expect(tools[1]).toEqual({
      name: 'read_file',
      description: 'Read a file',
      input_schema: { type: 'object', properties: {} },
    });
  });

  it('does not replay incomplete legacy server calls without raw result blocks', () => {
    const messages: Message[] = [
      {
        id: 'assistant_1',
        role: 'assistant',
        content: 'The search returned these results.',
        serverToolUses: [
          {
            id: 'web-1',
            name: 'web_search',
            input: { query: 'DeepSeek Anthropic API web search' },
          },
        ],
      },
    ];

    const { anthropicMessages } = convertMessagesToAnthropic(messages);
    const blocks = anthropicMessages[0].content as any[];
    expect(blocks[0]).toEqual({
      type: 'text',
      text: 'The search returned these results.',
    });
    expect(blocks).toHaveLength(1);
  });

  it('strips server-side tool blocks when replaying provider content, keeping text and local tool_use', () => {
    const providerContentBlocks = [
      {
        type: 'server_tool_use',
        id: 'call_00_search',
        name: 'web_search',
        input: { query: 'DeepSeek Anthropic API web search' },
      },
      {
        type: 'web_search_tool_result',
        tool_use_id: 'call_00_search',
        content: [
          {
            type: 'web_search_result',
            title: 'DeepSeek Docs',
            url: 'https://api-docs.deepseek.com',
            encrypted_content: 'opaque-result',
          },
        ],
      },
      { type: 'text', text: 'Here are the results.' },
      {
        type: 'tool_use',
        id: 'call_01_fetch',
        name: 'web_fetch',
        input: { url: 'https://api-docs.deepseek.com' },
      },
    ];
    const messages: Message[] = [{
      id: 'assistant_1',
      role: 'assistant',
      content: 'This flattened text must not replace the provider blocks.',
      providerContentBlocks,
    }];

    const { anthropicMessages } = convertMessagesToAnthropic(messages);

    // server_tool_use / web_search_tool_result are response-only blocks: replaying them
    // makes the provider reject the request with "tool_use ids were found without
    // tool_result blocks immediately after". Text and local tool_use survive.
    expect((anthropicMessages[0].content as any[]).map((block) => block.type)).toEqual([
      'text',
      'tool_use',
    ]);
    expect((anthropicMessages[0].content as any[])[1]).toEqual({
      type: 'tool_use',
      id: 'call_01_fetch',
      name: 'web_fetch',
      input: { url: 'https://api-docs.deepseek.com' },
    });
  });

  it('repairs a legacy mixed turn by dropping the incomplete server call', () => {
    const messages: Message[] = [
      {
        id: 'assistant_1',
        role: 'assistant',
        content: 'I will search and fetch the documentation.',
        serverToolUses: [
          {
            id: 'call_00_search',
            name: 'web_search',
            input: { query: 'DeepSeek Anthropic API web search' },
          },
        ],
        tool_calls: [
          {
            id: 'call_01_fetch',
            type: 'function',
            function: {
              name: 'web_fetch',
              arguments: '{"url":"https://api-docs.deepseek.com/guides/anthropic_api"}',
            },
          },
        ],
      },
      {
        id: 'tool_1',
        role: 'tool',
        content: 'Fetched documentation',
        tool_call_id: 'call_01_fetch',
        name: 'web_fetch',
      },
    ];

    const { anthropicMessages } = convertMessagesToAnthropic(messages);

    expect(anthropicMessages).toHaveLength(2);
    expect((anthropicMessages[0].content as any[]).map((block) => block.type)).toEqual([
      'text',
      'tool_use',
    ]);
    expect(anthropicMessages[1]).toEqual({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'call_01_fetch',
          content: 'Fetched documentation',
        },
      ],
    });
  });
});
