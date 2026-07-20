import { describe, expect, it, vi } from 'vitest';
import { bridgeMcpTool } from './toolBridge';

describe('MCP tool bridge', () => {
  it('passes the conversation abort signal to the MCP request', async () => {
    const callTool = vi.fn(async () => ({ text: 'ok', isError: false }));
    const client = {
      serverName: 'test-server',
      callTool,
    } as any;
    const executor = bridgeMcpTool(client, {
      name: 'read_data',
      namespacedName: 'mcp__test-server__read_data',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true },
    });
    const controller = new AbortController();

    await executor.execute({}, {
      projectPath: null,
      toolCallId: 'tool-1',
      signal: controller.signal,
    });

    expect(callTool).toHaveBeenCalledWith('read_data', {}, controller.signal);
  });
});
