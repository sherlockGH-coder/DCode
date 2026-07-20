import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../settings', () => ({
  settingsManager: {
    getTavilyApiKey: vi.fn(),
  },
}));

import { settingsManager } from '../settings';
import { webSearchTool } from './webSearch';
import type { ToolExecutionContext } from './types';

const fetchMock = vi.fn();

function context(): ToolExecutionContext {
  return {
    projectPath: null,
    toolCallId: 'call_web_search',
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

describe('web_search tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(settingsManager.getTavilyApiKey).mockReturnValue('tvly-test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses concise Claude-style Tavily guidance and domain filter schema', () => {
    expect(webSearchTool.definition.description).toContain('Search the web for current information via Tavily');
    expect(webSearchTool.definition.description).toContain('Include relevant Sources');

    const schema = webSearchTool.definition.input_schema as {
      properties: Record<string, Record<string, unknown>>;
      additionalProperties?: boolean;
    };
    expect(schema.properties.allowed_domains.items).toEqual({ type: 'string' });
    expect(schema.properties.blocked_domains.items).toEqual({ type: 'string' });
    expect(schema.properties.max_results.default).toBe(5);
    expect(schema.properties.max_results.maximum).toBe(10);
    expect(schema.additionalProperties).toBe(false);
  });

  it('maps allowed domains and search depth into the Tavily request', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      results: [{
        title: 'Claude Code docs',
        url: 'https://docs.anthropic.com/claude-code',
        content: 'Claude Code documentation snippet.',
        score: 0.91,
      }],
    }));

    const result = await webSearchTool.execute({
      query: 'Claude Code web search 2026',
      allowed_domains: ['docs.anthropic.com'],
      search_depth: 'advanced',
      max_results: 2,
    }, context());

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      api_key: 'tvly-test-key',
      query: 'Claude Code web search 2026',
      search_depth: 'advanced',
      max_results: 2,
      include_domains: ['docs.anthropic.com'],
    });
    expect(result.content).toContain('[Claude Code docs](https://docs.anthropic.com/claude-code)');
    expect(result.content).toContain('REMINDER: Include relevant sources');
    expect(result.metadata).toMatchObject({
      kind: 'web_search',
      query: 'Claude Code web search 2026',
      resultCount: 1,
    });
  });

  it('rejects simultaneous allowed and blocked domains before calling Tavily', async () => {
    const result = await webSearchTool.execute({
      query: 'Claude Code',
      allowed_domains: ['docs.anthropic.com'],
      blocked_domains: ['example.com'],
    }, context());

    expect(result.error).toBe(true);
    expect(result.content).toContain('cannot use allowed_domains and blocked_domains');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('propagates user cancellation to the Tavily request signal', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ results: [] }));
    const controller = new AbortController();

    await webSearchTool.execute({ query: 'cancel this search' }, {
      ...context(),
      signal: controller.signal,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    controller.abort();
    expect(init.signal?.aborted).toBe(true);
  });
});
