import { describe, expect, it } from 'vitest';
import { convertMessagesToChatCompletions, convertMessagesToResponses, convertToolsToResponses } from './openaiFormat';

describe('OpenAI protocol formatters', () => {
  it('converts Chat Completions history and preserves tool-call pairing', () => {
    const messages = convertMessagesToChatCompletions([
      { id: 'system', role: 'system', content: 'Be concise.' },
      { id: 'user', role: 'user', content: 'Read the file.' },
      {
        id: 'assistant',
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'read_file', arguments: '{"path":"a.txt"}' } }],
      },
      { id: 'tool', role: 'tool', content: 'contents', tool_call_id: 'call-1' },
    ]);

    expect(messages).toEqual([
      { role: 'system', content: 'Be concise.' },
      { role: 'user', content: 'Read the file.' },
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'read_file', arguments: '{"path":"a.txt"}' } }],
      },
      { role: 'tool', tool_call_id: 'call-1', content: 'contents' },
    ]);
  });

  it('replays Responses output items losslessly and emits native web search once', () => {
    const providerBlock = {
      type: 'function_call',
      id: 'item-1',
      call_id: 'call-1',
      name: 'read_file',
      arguments: '{}',
    };
    const converted = convertMessagesToResponses([
      { id: 'system', role: 'system', content: 'Be concise.' },
      { id: 'user', role: 'user', content: 'Read the file.' },
      { id: 'assistant', role: 'assistant', content: '', providerContentBlocks: [providerBlock] },
      { id: 'tool', role: 'tool', content: 'contents', tool_call_id: 'call-1' },
    ]);

    expect(converted.instructions).toBe('Be concise.');
    expect(converted.input).toEqual([
      { role: 'user', content: 'Read the file.' },
      providerBlock,
      { type: 'function_call_output', call_id: 'call-1', output: 'contents' },
    ]);

    expect(convertToolsToResponses([
      { name: 'web_search', description: 'Search', input_schema: {}, serverTool: true },
      { name: 'read_file', description: 'Read', input_schema: { type: 'object' } },
      { name: 'web_search', description: 'Search again', input_schema: {}, serverTool: true },
    ])).toEqual([
      { type: 'web_search_preview' },
      { type: 'function', name: 'read_file', description: 'Read', parameters: { type: 'object' } },
    ]);
  });

  it('drops incomplete legacy Responses function calls so a conversation can recover', () => {
    const converted = convertMessagesToResponses([
      { id: 'user-1', role: 'user', content: 'Try the tools.' },
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'I started testing the tools.',
        providerContentBlocks: [
          { type: 'reasoning', id: 'reasoning-1' },
          { type: 'message', id: 'message-1' },
          { type: 'function_call', id: 'item-1', call_id: 'call-missing', name: 'read_file', arguments: '{}' },
        ],
      },
      { id: 'user-2', role: 'user', content: 'Continue.' },
    ]);

    expect(converted.input).toEqual([
      { role: 'user', content: 'Try the tools.' },
      { role: 'assistant', content: 'I started testing the tools.' },
      { role: 'user', content: 'Continue.' },
    ]);
  });
});
