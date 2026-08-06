import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildChatCompletionsUrl,
  buildResponsesUrl,
  drainOpenAISseEvents,
  streamOpenAI,
} from './openaiStreamClient';

describe('OpenAI-compatible transport', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes service-root, /v1, and complete endpoint base URLs', () => {
    expect(buildChatCompletionsUrl('https://example.test')).toBe('https://example.test/v1/chat/completions');
    expect(buildChatCompletionsUrl('https://example.test/v1/')).toBe('https://example.test/v1/chat/completions');
    expect(buildChatCompletionsUrl('https://example.test/v1/chat/completions')).toBe('https://example.test/v1/chat/completions');
    expect(buildResponsesUrl('https://example.test/proxy')).toBe('https://example.test/proxy/v1/responses');
    expect(buildResponsesUrl('https://example.test/v1/responses')).toBe('https://example.test/v1/responses');
  });

  it('drains multiline SSE data while retaining incomplete events', () => {
    const drained = drainOpenAISseEvents('event: message\ndata: {"a":\ndata: 1}\n\ndata: [DONE]\n\npartial');

    expect(drained.events).toEqual([
      { event: 'message', data: '{"a":\n1}' },
      { event: undefined, data: '[DONE]' },
    ]);
    expect(drained.rest).toBe('partial');
  });

  it('sends bearer authentication and skips the terminal [DONE] marker', async () => {
    const encoder = new TextEncoder();
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"type":"response.created"}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      }),
      { status: 200, headers: { 'content-type': 'text/event-stream' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    const stream = await streamOpenAI({
      apiKey: 'secret',
      baseUrl: 'https://example.test/v1',
      protocol: 'responses',
      body: { model: 'test-model' },
    });
    const events: any[] = [];
    for await (const event of stream) events.push(event);

    expect(events).toEqual([{ type: 'response.created' }]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/v1/responses',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer secret' }),
        body: JSON.stringify({ model: 'test-model', stream: true }),
      }),
    );
  });
});
