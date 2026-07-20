import { describe, expect, it } from 'vitest';
import { parseMcpServerJson } from './mcpJsonConfig';

describe('parseMcpServerJson', () => {
  it('parses Claude-style mcpServers JSON and infers stdio transport', () => {
    const parsed = parseMcpServerJson(JSON.stringify({
      mcpServers: {
        memory: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-memory'],
          env: {
            TOKEN: 'abc',
            RETRIES: 2,
          },
        },
      },
    }));

    expect(parsed).toEqual({
      name: 'memory',
      config: {
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
        env: {
          TOKEN: 'abc',
          RETRIES: '2',
        },
        cwd: undefined,
      },
    });
  });

  it('parses a single remote server JSON with type alias', () => {
    const parsed = parseMcpServerJson(JSON.stringify({
      name: 'search',
      type: 'sse',
      url: 'https://example.com/sse',
      headers: {
        Authorization: 'Bearer token',
      },
    }));

    expect(parsed).toEqual({
      name: 'search',
      config: {
        transport: 'sse',
        url: 'https://example.com/sse',
        headers: {
          Authorization: 'Bearer token',
        },
      },
    });
  });

  it('rejects mcpServers JSON with multiple entries', () => {
    expect(() => parseMcpServerJson(JSON.stringify({
      mcpServers: {
        one: { command: 'npx' },
        two: { command: 'node' },
      },
    }))).toThrow('一次只能导入一个 MCP server JSON');
  });
});
