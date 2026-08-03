import { describe, expect, it } from 'vitest';
import type { Message, ToolCall } from '../../shared/types';
import { createToolItemFromStart, reconstructToolItems } from './toolItemHelpers';

function toolCall(name: string, args: Record<string, unknown>): ToolCall {
  return {
    id: `call_${name}`,
    type: 'function',
    function: {
      name,
      arguments: JSON.stringify(args),
    },
  };
}

describe('reconstructToolItems', () => {
  it('marks interrupted ask-user questions as failed instead of running forever', () => {
    const items = reconstructToolItems([
      toolCall('ask_user_question', {
        questions: [
          {
            question: 'Which approach do you want to choose?',
            header: 'Approach',
            options: [
              { label: 'A', description: 'The first approach' },
              { label: 'B', description: 'The second approach' },
            ],
            multiSelect: false,
          },
        ],
      }),
    ], []);

    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('ask_user_question');
    expect(items[0].status).toBe('error');
    expect('output' in items[0] ? items[0].output : '').toContain('This question expired');
  });

  it('keeps other unfinished tools running while loading history', () => {
    const items = reconstructToolItems([
      toolCall('read_file', { path: '/tmp/example.txt' }),
    ], []);

    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('read');
    expect(items[0].status).toBe('running');
  });

  it('uses persisted tool results when they exist', () => {
    const questions = [
      {
        question: 'Continue?',
        header: 'Confirmation',
        options: [{ label: 'Continue', description: 'Continue the task' }],
        multiSelect: false,
      },
    ];
    const call = toolCall('ask_user_question', {
      questions,
    });
    const toolMessage: Message = {
      id: 'tool_result',
      role: 'tool',
      content: 'User answer: "Continue?"="Continue".',
      tool_call_id: call.id,
      name: 'ask_user_question',
      metadata: {
        kind: 'ask_user_question',
        questions,
        answers: { 'Continue?': 'Continue' },
      },
    };

    const items = reconstructToolItems([call], [toolMessage]);

    expect(items[0].status).toBe('done');
    expect(items[0].kind === 'ask_user_question' ? items[0].questions : undefined).toEqual(questions);
    expect(items[0].kind === 'ask_user_question' ? items[0].answers : undefined).toEqual({ 'Continue?': 'Continue' });
  });

  it('recovers answers from legacy ask-user result text without metadata', () => {
    const call = toolCall('ask_user_question', {
      questions: [{
        question: 'Continue?',
        header: 'Confirmation',
        options: [{ label: 'Continue', description: 'Continue the task' }],
        multiSelect: false,
      }],
    });
    const toolMessage: Message = {
      id: 'legacy_tool_result',
      role: 'tool',
      content: 'User answer: "Continue?"="Continue". Continue based on these choices.',
      tool_call_id: call.id,
      name: 'ask_user_question',
    };

    const items = reconstructToolItems([call], [toolMessage]);

    expect(items[0].kind === 'ask_user_question' ? items[0].answers : undefined).toEqual({ 'Continue?': 'Continue' });
  });

  it('reconstructs agent tool cards from persisted metadata', () => {
    const call = toolCall('wait_agent', { agent_id: 'agent-1' });
    const toolMessage: Message = {
      id: 'tool_result',
      role: 'tool',
      content: 'agent completed',
      tool_call_id: call.id,
      name: 'wait_agent',
      metadata: {
        kind: 'agent',
        action: 'wait',
        agentId: 'agent-1',
        taskName: 'Inspect renderer',
        role: 'explorer',
        status: 'completed',
        result: 'Done',
      },
    };

    const items = reconstructToolItems([call], [toolMessage]);

    expect(items[0].kind).toBe('agent');
    expect(items[0].status).toBe('done');
    expect(items[0].kind === 'agent' ? items[0].agentStatus : undefined).toBe('completed');
  });

  it('creates agent tool cards from the redesigned spawn_agent schema', () => {
    const item = createToolItemFromStart({
      id: 'call_spawn',
      name: 'spawn_agent',
      arguments: JSON.stringify({
        description: 'Inspect agent tools',
        subagent_type: 'test-scout',
      }),
    });

    expect(item.kind).toBe('agent');
    expect(item.kind === 'agent' ? item.taskName : undefined).toBe('Inspect agent tools');
    expect(item.kind === 'agent' ? item.role : undefined).toBe('test-scout');
  });
});
