export interface AnthropicStreamParams {
  apiKey: string;
  baseUrl: string;
  body: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface SseEvent {
  event?: string;
  data: string;
}

export class AnthropicStreamParseError extends Error {
  readonly eventName?: string;
  readonly payloadLength: number;

  constructor(message: string, eventName: string | undefined, payload: string) {
    super(message);
    this.name = 'AnthropicStreamParseError';
    this.eventName = eventName;
    this.payloadLength = payload.length;
  }
}

export class AnthropicRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AnthropicRequestError';
    this.status = status;
  }
}

export function buildAnthropicMessagesUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  if (trimmed.endsWith('/v1/messages')) return trimmed;
  if (trimmed.endsWith('/v1')) return `${trimmed}/messages`;
  return `${trimmed}/v1/messages`;
}

export function parseSseEvent(rawEvent: string): SseEvent | null {
  const dataLines: string[] = [];
  let eventName: string | undefined;

  for (const line of rawEvent.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue;

    if (line.startsWith('event:')) {
      eventName = removeOptionalLeadingSpace(line.slice(6));
      continue;
    }

    if (line.startsWith('data:')) {
      dataLines.push(removeOptionalLeadingSpace(line.slice(5)));
    }
  }

  if (dataLines.length === 0) return null;
  return { event: eventName, data: dataLines.join('\n') };
}

export function drainSseEvents(buffer: string): { events: SseEvent[]; rest: string } {
  let rest = buffer.replace(/\r\n/g, '\n');
  const events: SseEvent[] = [];
  let eventEnd = rest.indexOf('\n\n');

  while (eventEnd !== -1) {
    const parsed = parseSseEvent(rest.slice(0, eventEnd));
    if (parsed) events.push(parsed);
    rest = rest.slice(eventEnd + 2);
    eventEnd = rest.indexOf('\n\n');
  }

  return { events, rest };
}

export async function streamAnthropicMessages(params: AnthropicStreamParams): Promise<AsyncGenerator<any>> {
  const response = await requestAnthropicMessages(params);
  return readAnthropicEvents(response);
}

async function* readAnthropicEvents(response: Response): AsyncGenerator<any> {
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of response.body as any) {
    buffer += decoder.decode(chunk, { stream: true });
    const drained = drainSseEvents(buffer);
    buffer = drained.rest;
    for (const event of drained.events) yield parseAnthropicPayload(event);
  }

  buffer += decoder.decode();
  const trailing = parseSseEvent(buffer.trim());
  if (trailing) yield parseAnthropicPayload(trailing);
}

async function requestAnthropicMessages(params: AnthropicStreamParams): Promise<Response> {
  const response = await fetch(buildAnthropicMessagesUrl(params.baseUrl), {
    method: 'POST',
    headers: {
      'x-api-key': params.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ ...params.body, stream: true }),
    signal: params.signal,
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => '');
    throw new AnthropicRequestError(
      `Anthropic messages request failed: HTTP ${response.status} ${errorText}`.trim(),
      response.status,
    );
  }

  return response;
}

function parseAnthropicPayload(event: SseEvent): any {
  try {
    return JSON.parse(event.data);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new AnthropicStreamParseError(
      `Invalid Anthropic SSE JSON (${event.event ?? 'message'}): ${reason}`,
      event.event,
      event.data,
    );
  }
}

function removeOptionalLeadingSpace(value: string): string {
  return value.startsWith(' ') ? value.slice(1) : value;
}
