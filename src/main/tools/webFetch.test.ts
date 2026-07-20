import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../settings', () => ({
  settingsManager: {
    getTavilyApiKey: vi.fn(),
  },
}));

import { settingsManager } from '../settings';
import { webFetchTool } from './webFetch';
import type { ToolExecutionContext } from './types';

const fetchMock = vi.fn();

function context(): ToolExecutionContext {
  return {
    projectPath: null,
    toolCallId: 'call_web_fetch',
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn(async () => body),
    text: vi.fn(async () => JSON.stringify(body)),
  } as unknown as Response;
}

describe('web_fetch tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(settingsManager.getTavilyApiKey).mockReturnValue('tvly-test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses concise Claude-style prompt schema with Tavily extraction', () => {
    expect(webFetchTool.definition.description).toContain('Fetch a fully formed URL');
    expect(webFetchTool.definition.description).toContain('Backend priority: Tavily Extract');

    const schema = webFetchTool.definition.input_schema as {
      properties: Record<string, Record<string, unknown>>;
      required: string[];
      additionalProperties?: boolean;
    };
    expect(schema.required).toEqual(['url', 'prompt']);
    expect(schema.properties.extract_depth.enum).toEqual(['basic', 'advanced']);
    expect(schema.additionalProperties).toBe(false);
  });

  it('uses Tavily Extract first and wraps content with the prompt', async () => {
    const rawContent = `# Setup\n\n${'Install and configure the package. '.repeat(8)}`;
    fetchMock.mockResolvedValue(jsonResponse({
      results: [{
        url: 'https://example.com/docs',
        title: 'Example Docs',
        raw_content: rawContent,
      }],
    }));

    const result = await webFetchTool.execute({
      url: 'http://example.com/docs',
      prompt: 'Summarize the setup steps.',
      extract_depth: 'advanced',
    }, context());

    const [endpoint, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(endpoint).toBe('https://api.tavily.com/extract');
    expect(body).toMatchObject({
      api_key: 'tvly-test-key',
      urls: ['https://example.com/docs'],
      extract_depth: 'advanced',
    });
    expect(result.content).toContain('Web page: https://example.com/docs');
    expect(result.content).toContain('Prompt: Summarize the setup steps.');
    expect(result.content).toContain(rawContent);
    expect(result.metadata).toMatchObject({
      kind: 'web_fetch',
      url: 'https://example.com/docs',
      title: 'Example Docs',
      charCount: rawContent.length,
      provider: 'tavily',
    });
  });

  it('requires a prompt before fetching', async () => {
    const result = await webFetchTool.execute({
      url: 'https://example.com/docs',
    }, context());

    expect(result.error).toBe(true);
    expect(result.content).toContain('web_fetch requires a prompt');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('propagates user cancellation to the active extraction request', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      results: [{
        url: 'https://example.com/docs',
        raw_content: 'Enough content for extraction. '.repeat(10),
      }],
    }));
    const controller = new AbortController();

    await webFetchTool.execute({
      url: 'https://example.com/docs',
      prompt: 'Extract the setup steps.',
    }, {
      ...context(),
      signal: controller.signal,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    controller.abort();
    expect(init.signal?.aborted).toBe(true);
  });
});
