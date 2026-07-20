import { describe, expect, it } from 'vitest';
import {
  buildAnthropicMessagesUrl,
  drainSseEvents,
  parseSseEvent,
} from './anthropicStreamClient';

describe('anthropic SSE parser', () => {
  it('builds the messages endpoint without duplicating /v1', () => {
    expect(buildAnthropicMessagesUrl('https://api.deepseek.com/anthropic')).toBe(
      'https://api.deepseek.com/anthropic/v1/messages',
    );
    expect(buildAnthropicMessagesUrl('https://api.example.com/v1')).toBe(
      'https://api.example.com/v1/messages',
    );
    expect(buildAnthropicMessagesUrl('https://api.example.com/v1/messages')).toBe(
      'https://api.example.com/v1/messages',
    );
  });

  it('joins multiple data lines as one SSE event payload', () => {
    const raw = [
      'event: content_block_delta',
      'data: {"type":"content_block_delta",',
      'data: "delta":{"type":"text_delta","text":"hello"}}',
    ].join('\n');

    expect(parseSseEvent(raw)).toEqual({
      event: 'content_block_delta',
      data: '{"type":"content_block_delta",\n"delta":{"type":"text_delta","text":"hello"}}',
    });
  });

  it('drains complete events and keeps an incomplete trailing event', () => {
    const first = 'event: ping\r\ndata: {"type":"ping"}\r\n\r\n';
    const secondStart = 'event: content_block_delta\r\ndata: {"type":"content_block_delta"';

    const result = drainSseEvents(first + secondStart);

    expect(result.events).toEqual([{ event: 'ping', data: '{"type":"ping"}' }]);
    expect(result.rest).toBe('event: content_block_delta\ndata: {"type":"content_block_delta"');
  });

  it('ignores comments and preserves meaningful spaces after data colon', () => {
    const raw = [
      ': keep-alive',
      'event: message_start',
      'data: {"type":"message_start","message":{"content":[]}}',
    ].join('\n');

    expect(parseSseEvent(raw)).toEqual({
      event: 'message_start',
      data: '{"type":"message_start","message":{"content":[]}}',
    });
  });
});
