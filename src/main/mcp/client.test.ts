import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpServerConfig } from '../../shared/types';

const mocks = vi.hoisted(() => ({
  stdioParams: [] as Array<Record<string, unknown>>,
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: class {
    constructor(params: Record<string, unknown>) {
      mocks.stdioParams.push(params);
    }

    close = vi.fn();
  },
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: class {},
}));

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: class {},
}));

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class {
    connect = vi.fn(async () => undefined);

    getInstructions = vi.fn(() => undefined);

    listTools = vi.fn(async () => ({ tools: [] }));

    close = vi.fn(async () => undefined);
  },
}));

import { McpClient } from './client';

describe('McpClient stdio proxy environment', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    mocks.stdioParams = [];
    process.env = { ...originalEnv };
    process.env.HTTP_PROXY = 'http://127.0.0.1:7890';
    process.env.HTTPS_PROXY = 'http://127.0.0.1:7890';
    process.env.NO_PROXY = 'localhost,127.0.0.1';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('passes inherited proxy variables to stdio MCP servers', async () => {
    const config: McpServerConfig = {
      transport: 'stdio',
      command: 'ai-vision-mcp',
    };

    await new McpClient('ai-vision', config).connect();

    expect(mocks.stdioParams[0]).toMatchObject({
      command: 'ai-vision-mcp',
      env: {
        HTTP_PROXY: 'http://127.0.0.1:7890',
        HTTPS_PROXY: 'http://127.0.0.1:7890',
        NO_PROXY: 'localhost,127.0.0.1',
      },
    });
  });

  it('keeps explicit MCP env values authoritative', async () => {
    const config: McpServerConfig = {
      transport: 'stdio',
      command: 'ai-vision-mcp',
      env: {
        HTTPS_PROXY: 'http://custom.proxy:8080',
        VISION_API_KEY: 'secret',
      },
    };

    await new McpClient('ai-vision', config).connect();

    expect(mocks.stdioParams[0]?.env).toMatchObject({
      HTTP_PROXY: 'http://127.0.0.1:7890',
      HTTPS_PROXY: 'http://custom.proxy:8080',
      NO_PROXY: 'localhost,127.0.0.1',
      VISION_API_KEY: 'secret',
    });
  });
});
