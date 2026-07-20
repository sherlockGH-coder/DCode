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
            question: '你想选择哪个方案？',
            header: '方案',
            options: [
              { label: 'A', description: '第一个方案' },
              { label: 'B', description: '第二个方案' },
            ],
            multiSelect: false,
          },
        ],
      }),
    ], []);

    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('ask_user_question');
    expect(items[0].status).toBe('error');
    expect('output' in items[0] ? items[0].output : '').toContain('问题已失效');
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
        question: '继续吗？',
        header: '确认',
        options: [{ label: '继续', description: '继续任务' }],
        multiSelect: false,
      },
    ];
    const call = toolCall('ask_user_question', {
      questions,
    });
    const toolMessage: Message = {
      id: 'tool_result',
      role: 'tool',
      content: '用户已作答："继续吗？"="继续"。',
      tool_call_id: call.id,
      name: 'ask_user_question',
      metadata: {
        kind: 'ask_user_question',
        questions,
        answers: { '继续吗？': '继续' },
      },
    };

    const items = reconstructToolItems([call], [toolMessage]);

    expect(items[0].status).toBe('done');
    expect(items[0].kind === 'ask_user_question' ? items[0].questions : undefined).toEqual(questions);
    expect(items[0].kind === 'ask_user_question' ? items[0].answers : undefined).toEqual({ '继续吗？': '继续' });
  });

  it('recovers answers from legacy ask-user result text without metadata', () => {
    const call = toolCall('ask_user_question', {
      questions: [{
        question: '继续吗？',
        header: '确认',
        options: [{ label: '继续', description: '继续任务' }],
        multiSelect: false,
      }],
    });
    const toolMessage: Message = {
      id: 'legacy_tool_result',
      role: 'tool',
      content: '用户已作答："继续吗？"="继续"。请根据这些选择继续执行。',
      tool_call_id: call.id,
      name: 'ask_user_question',
    };

    const items = reconstructToolItems([call], [toolMessage]);

    expect(items[0].kind === 'ask_user_question' ? items[0].answers : undefined).toEqual({ '继续吗？': '继续' });
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
