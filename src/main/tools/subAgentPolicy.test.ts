import { describe, expect, it } from 'vitest';
import { ToolRegistry, type ToolExecutor } from './types';
import type { ToolCall } from '../../shared/types';

function executor(name: string, isReadonly: boolean): ToolExecutor {
  return {
    definition: {
      name,
      description: `${name} test tool`,
      input_schema: { type: 'object', properties: {} },
    },
    isReadonly,
    async execute() {
      return { content: `${name} executed` };
    },
  };
}

function toolCall(name: string, args: Record<string, unknown> = {}): ToolCall {
  return {
    id: `call_${name}`,
    type: 'function',
    function: {
      name,
      arguments: JSON.stringify(args),
    },
  };
}

function registry(): ToolRegistry {
  const toolRegistry = new ToolRegistry();
  toolRegistry.register(executor('read_file', true));
  toolRegistry.register(executor('web_search', true));
  toolRegistry.register(executor('ask_user_question', true));
  toolRegistry.register(executor('spawn_agent', true));
  toolRegistry.register(executor('wait_agent', true));
  toolRegistry.register(executor('write_file', false));
  toolRegistry.register(executor('edit_file', false));
  toolRegistry.register(executor('bash_exec', false));
  toolRegistry.register(executor('update_plan', false));
  return toolRegistry;
}

describe('ToolRegistry sub-agent policy', () => {
  it('removes user-question and agent-spawn tools from sub-agent definitions', () => {
    const names = registry().getSubAgentReadonlyDefinitions().map((tool) => tool.name);

    expect(names).toContain('read_file');
    expect(names).not.toContain('ask_user_question');
    expect(names).not.toContain('spawn_agent');
    expect(names).not.toContain('wait_agent');
    expect(names).not.toContain('write_file');
    expect(names).not.toContain('edit_file');
    expect(names).not.toContain('bash_exec');
    expect(names).not.toContain('update_plan');
  });

  it('rejects user interaction, mutation, shell, and agent tools at execution time', async () => {
    const toolRegistry = registry();
    const ctx = {
      projectPath: null,
      subAgent: true,
    };

    for (const name of ['ask_user_question', 'spawn_agent', 'write_file', 'edit_file', 'bash_exec', 'update_plan']) {
      const result = await toolRegistry.execute(toolCall(name), ctx);
      expect(result.error).toBe(true);
      expect(result.content).toContain('Sub-agents are read-only');
    }
  });

  it('allows readonly tools in sub-agents', async () => {
    const result = await registry().execute(toolCall('read_file'), {
      projectPath: null,
      subAgent: true,
    });

    expect(result.error).toBeUndefined();
    expect(result.content).toBe('read_file executed');
  });

  it('allows readonly non-file tools in sub-agents even when approval policy is auto-deny', async () => {
    const result = await registry().execute(toolCall('web_search'), {
      projectPath: null,
      subAgent: true,
      approvalPolicy: 'auto-deny',
    });

    expect(result.error).toBeUndefined();
    expect(result.content).toBe('web_search executed');
  });

  it('denies readonly file access outside the project in sub-agents', async () => {
    const result = await registry().execute(
      toolCall('read_file', { file_path: '/tmp/outside-project.txt' }),
      {
        projectPath: '/project',
        subAgent: true,
        approvalPolicy: 'auto-deny',
      },
    );

    expect(result.error).toBe(true);
    expect(result.content).toContain('[Auto-denied]');
  });
});
