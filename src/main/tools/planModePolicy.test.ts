import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getConversationModeState } = vi.hoisted(() => ({ getConversationModeState: vi.fn() }));
vi.mock('../plan/planService', () => ({ getConversationModeState }));

import { ToolRegistry } from './types';

function executor(name: string) {
  return {
    definition: { name, description: name, input_schema: { type: 'object' } },
    execute: vi.fn(async () => ({ content: 'executed' })),
  };
}

describe('Plan mode tool policy', () => {
  beforeEach(() => {
    getConversationModeState.mockReset();
    getConversationModeState.mockReturnValue({
      conversationId: 'conv', mode: 'plan', phase: 'idle', modeRevision: 3,
      contentRevision: 1, contextEpoch: 0, activePlan: null,
    });
  });

  it('only exposes the explicit Plan allowlist', () => {
    const registry = new ToolRegistry();
    for (const name of ['read_file', 'grep', 'submit_plan', 'write_file', 'bash_exec', 'update_plan']) {
      registry.register(executor(name));
    }
    expect(registry.getDefinitionsForMode('plan').map((tool) => tool.name)).toEqual([
      'read_file', 'grep', 'submit_plan',
    ]);
  });

  it('rejects a forged mutation at execution time', async () => {
    const registry = new ToolRegistry();
    const edit = executor('edit_file');
    registry.register(edit);
    const result = await registry.execute({
      id: 'call', type: 'function', function: { name: 'edit_file', arguments: '{}' },
    }, {
      projectPath: '/tmp/project', conversationId: 'conv', collaborationMode: 'plan', modeRevision: 3,
    });
    expect(result.error).toBe(true);
    expect(result.content).toContain('not allowed in Plan mode');
    expect(edit.execute).not.toHaveBeenCalled();
  });

  it('rejects calls from a stale mode revision', async () => {
    const registry = new ToolRegistry();
    const read = executor('read_file');
    registry.register(read);
    const result = await registry.execute({
      id: 'call', type: 'function', function: { name: 'read_file', arguments: '{}' },
    }, {
      projectPath: '/tmp/project', conversationId: 'conv', collaborationMode: 'plan', modeRevision: 2,
    });
    expect(result.error).toBe(true);
    expect(result.content).toContain('mode changed');
    expect(read.execute).not.toHaveBeenCalled();
  });
});
