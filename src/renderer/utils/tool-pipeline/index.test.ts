import { describe, expect, it } from 'vitest';
import type { Message, ToolItem } from '../../../shared/types';
import { pipeline } from './index';

describe('tool pipeline', () => {
  it('filters tool kinds that are not rendered in assistant messages', () => {
    const hiddenItems: ToolItem[] = [
      {
        id: 'vision_1',
        toolCallId: 'call_vision',
        name: 'analyze_image',
        kind: 'vision',
        status: 'done',
        timestamp: 0,
        path: '/tmp/screenshot.png',
        question: 'What is shown?',
      },
      {
        id: 'task_1',
        toolCallId: 'call_task',
        name: 'task',
        kind: 'task',
        status: 'done',
        timestamp: 1,
        action: 'list',
      },
      {
        id: 'plan_1',
        toolCallId: 'call_plan',
        name: 'update_plan',
        kind: 'plan_update',
        status: 'done',
        timestamp: 2,
        plan: [{ step: 'Hidden from message tools', status: 'completed' }],
      },
    ];
    const messages: Message[] = [
      {
        id: 'assistant_1',
        role: 'assistant',
        content: '',
        toolItems: hiddenItems,
      },
    ];

    expect(pipeline(messages).units).toEqual([]);
  });
});
