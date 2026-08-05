import { describe, expect, it } from 'vitest';
import type { Message, ToolCall } from '../../shared/types';
import { ensureToolResultPairing } from './messagePairing';

function toolCall(id: string, name = 'read_file'): ToolCall {
  return {
    id,
    type: 'function',
    function: { name, arguments: '{}' },
  };
}

describe('ensureToolResultPairing', () => {
  it('matches distinct tool results even when transport messages omit database IDs', () => {
    const messages = [
      { id: 'assistant_1', role: 'assistant', content: '', tool_calls: [toolCall('call_1')] },
      { role: 'tool', content: 'first result', tool_call_id: 'call_1', name: 'read_file' },
      { id: 'assistant_2', role: 'assistant', content: '', tool_calls: [toolCall('call_2')] },
      { role: 'tool', content: 'second result', tool_call_id: 'call_2', name: 'read_file' },
    ] as Message[];

    const paired = ensureToolResultPairing(messages);

    expect(paired.filter((message) => message.role === 'tool').map((message) => message.content)).toEqual([
      'first result',
      'second result',
    ]);
  });

  it('collapses duplicate tool calls and keeps one matching result', () => {
    const duplicate = toolCall('call_1');
    const messages = [
      {
        id: 'assistant_1',
        role: 'assistant',
        content: '',
        tool_calls: [duplicate, { ...duplicate }],
      },
      { role: 'tool', content: 'file contents', tool_call_id: 'call_1', name: 'read_file' },
    ] as Message[];

    const paired = ensureToolResultPairing(messages);

    expect(paired[0].tool_calls?.map((call) => call.id)).toEqual(['call_1']);
    expect(paired.filter((message) => message.role === 'tool')).toHaveLength(1);
    expect(paired[1].content).toBe('file contents');
  });
});
