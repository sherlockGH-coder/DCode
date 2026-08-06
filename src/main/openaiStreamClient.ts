export type OpenAIProtocol = 'chat-completions' | 'responses';

interface OpenAIStreamParams {
  apiKey: string;
  baseUrl: string;
  protocol: OpenAIProtocol;
  body: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface OpenAISseEvent {
  event?: string;
  data: string;
}

export class OpenAIStreamParseError extends Error {
  readonly eventName?: string;
  readonly payloadLength: number;

  constructor(message: string, eventName: string | undefined, payload: string) {
    super(message);
    this.name = 'OpenAIStreamParseError';
    this.eventName = eventName;
    this.payloadLength = payload.length;
  }
}

export class OpenAIRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'OpenAIRequestError';
    this.status = status;
  }
}

function buildEndpointUrl(baseUrl: string, endpoint: 'chat/completions' | 'responses'): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  if (trimmed.endsWith(`/${endpoint}`)) return trimmed;
  if (trimmed.endsWith('/v1')) return `${trimmed}/${endpoint}`;
  return `${trimmed}/v1/${endpoint}`;
}

export function buildChatCompletionsUrl(baseUrl: string): string {
  return buildEndpointUrl(baseUrl, 'chat/completions');
}

export function buildResponsesUrl(baseUrl: string): string {
  return buildEndpointUrl(baseUrl, 'responses');
}

export function parseOpenAISseEvent(rawEvent: string): OpenAISseEvent | null {
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

export function drainOpenAISseEvents(buffer: string): { events: OpenAISseEvent[]; rest: string } {
  let rest = buffer.replace(/\r\n/g, '\n');
  const events: OpenAISseEvent[] = [];
  let eventEnd = rest.indexOf('\n\n');

  while (eventEnd !== -1) {
    const parsed = parseOpenAISseEvent(rest.slice(0, eventEnd));
    if (parsed) events.push(parsed);
    rest = rest.slice(eventEnd + 2);
    eventEnd = rest.indexOf('\n\n');
  }

  return { events, rest };
}

export async function streamOpenAI(params: OpenAIStreamParams): Promise<AsyncGenerator<any>> {
  const response = await requestOpenAI(params, true);
  return readOpenAIEvents(response);
}

export async function requestOpenAIJson(params: OpenAIStreamParams): Promise<Record<string, any>> {
  const response = await requestOpenAI(params, false);
  const data = await response.json();
  if (!data || typeof data !== 'object') {
    throw new OpenAIRequestError('OpenAI-compatible API returned a non-object JSON response', response.status);
  }
  return data as Record<string, any>;
}

async function requestOpenAI(params: OpenAIStreamParams, stream: boolean): Promise<Response> {
  const endpoint = params.protocol === 'responses'
    ? buildResponsesUrl(params.baseUrl)
    : buildChatCompletionsUrl(params.baseUrl);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: stream ? 'text/event-stream' : 'application/json',
  };
  if (params.apiKey) headers.Authorization = `Bearer ${params.apiKey}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...params.body, ...(stream ? { stream: true } : {}) }),
    signal: params.signal,
  });

  if (!response.ok || (stream && !response.body)) {
    const errorText = await response.text().catch(() => '');
    throw new OpenAIRequestError(
      `OpenAI ${params.protocol} request failed: HTTP ${response.status} ${errorText}`.trim(),
      response.status,
    );
  }

  return response;
}

async function* readOpenAIEvents(response: Response): AsyncGenerator<any> {
  const decoder = new TextDecoder();
  let buffer = '';

  for await (const chunk of response.body as any) {
    buffer += decoder.decode(chunk, { stream: true });
    const drained = drainOpenAISseEvents(buffer);
    buffer = drained.rest;
    for (const event of drained.events) {
      const parsed = parseOpenAIPayload(event);
      if (parsed !== undefined) yield parsed;
    }
  }

  buffer += decoder.decode();
  const trailing = parseOpenAISseEvent(buffer.trim());
  if (trailing) {
    const parsed = parseOpenAIPayload(trailing);
    if (parsed !== undefined) yield parsed;
  }
}

function parseOpenAIPayload(event: OpenAISseEvent): any | undefined {
  if (event.data.trim() === '[DONE]') return undefined;

  try {
    return JSON.parse(event.data);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new OpenAIStreamParseError(
      `Invalid OpenAI SSE JSON (${event.event ?? 'message'}): ${reason}`,
      event.event,
      event.data,
    );
  }
}

function removeOptionalLeadingSpace(value: string): string {
  return value.startsWith(' ') ? value.slice(1) : value;
}
