import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { webFetchTool } from './webFetch';
import type { ToolExecutionContext } from './types';

const fetchMock = vi.fn();

function context(): ToolExecutionContext {
  return {
    projectPath: null,
    toolCallId: 'call_web_fetch',
  };
}

function htmlResponse(html: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null),
    },
    text: vi.fn(async () => html),
    json: vi.fn(async () => ({})),
  } as unknown as Response;
}

function markdownResponse(markdown: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: vi.fn(async () => markdown),
    json: vi.fn(async () => ({})),
  } as unknown as Response;
}

describe('web_fetch tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses a prompt schema without external extraction providers', () => {
    expect(webFetchTool.definition.description).toContain('Fetch a fully formed URL');
    expect(webFetchTool.definition.description).toContain('Backend priority: local Readability -> Jina Reader');
    expect(webFetchTool.definition.description).not.toContain('Tavily');

    const schema = webFetchTool.definition.input_schema as {
      properties: Record<string, Record<string, unknown>>;
      required: string[];
      additionalProperties?: boolean;
    };
    expect(schema.required).toEqual(['url', 'prompt']);
    expect(schema.properties.extract_depth).toBeUndefined();
    expect(schema.additionalProperties).toBe(false);
  });

  it('extracts content locally with Readability and wraps it with the prompt', async () => {
    const paragraph = 'Install and configure the package before running the test suite. '.repeat(8);
    fetchMock.mockResolvedValue(htmlResponse(
      `<html><head><title>Example Docs</title></head><body><article><h1>Example Docs</h1><p>${paragraph}</p></article></body></html>`,
    ));

    const result = await webFetchTool.execute({
      url: 'http://example.com/docs',
      prompt: 'Summarize the setup steps.',
    }, context());

    const [endpoint] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(endpoint).toBe('https://example.com/docs');
    expect(result.content).toContain('Web page: https://example.com/docs');
    expect(result.content).toContain('Prompt: Summarize the setup steps.');
    expect(result.content).toContain('Example Docs');
    expect(result.metadata).toMatchObject({
      kind: 'web_fetch',
      url: 'https://example.com/docs',
      title: 'Example Docs',
      provider: 'local',
    });
  });

  it('falls back to Jina Reader when local extraction fails', async () => {
    fetchMock
      .mockResolvedValueOnce(htmlResponse('', 403))
      .mockResolvedValueOnce(markdownResponse('# Jina Docs\n\nDetailed markdown content from Jina Reader. '.repeat(5)));

    const result = await webFetchTool.execute({
      url: 'https://example.com/docs',
      prompt: 'Summarize the docs.',
    }, context());

    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(init?.method ?? 'GET').toBe('GET');
    expect(result.content).toContain('Web page: https://example.com/docs');
    expect(result.content).toContain('Jina Docs');
    expect(result.metadata).toMatchObject({
      kind: 'web_fetch',
      url: 'https://example.com/docs',
      provider: 'jina',
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

  it('propagates user cancellation to the active fetch request', async () => {
    fetchMock.mockResolvedValue(htmlResponse(
      `<html><head><title>Docs</title></head><body><article><p>${'Enough content for extraction. '.repeat(10)}</p></article></body></html>`,
    ));
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
