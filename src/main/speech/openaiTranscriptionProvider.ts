import type { SpeechToTextProvider, SpeechTranscribeInput, SpeechTranscribeOutput } from './types';

const DEFAULT_TRANSCRIPTION_MODEL = 'whisper-1';

interface OpenAITranscriptionProviderOptions {
  apiKey?: string;
  baseUrl: string;
  model?: string;
}

export class OpenAITranscriptionProvider implements SpeechToTextProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(options: OpenAITranscriptionProviderOptions) {
    this.apiKey = options.apiKey ?? '';
    this.baseUrl = options.baseUrl;
    this.model = options.model?.trim() || DEFAULT_TRANSCRIPTION_MODEL;
  }

  async transcribe(input: SpeechTranscribeInput): Promise<SpeechTranscribeOutput> {
    const startedAt = Date.now();
    const form = new FormData();
    const file = new Blob([toArrayBuffer(input.audio)], { type: input.mimeType });

    form.append('file', file, fileNameForMimeType(input.mimeType));
    form.append('model', this.model);
    form.append('response_format', 'json');
    if (input.language) form.append('language', input.language);

    const response = await fetch(buildAudioTranscriptionsUrl(this.baseUrl), {
      method: 'POST',
      headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : undefined,
      body: form,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`语音转写请求失败: HTTP ${response.status} ${errorText}`.trim());
    }

    const payload = await response.json() as { text?: unknown };
    const text = typeof payload.text === 'string' ? payload.text.trim() : '';
    if (!text) {
      throw new Error('语音转写没有返回文本');
    }

    return {
      text,
      durationMs: Date.now() - startedAt,
    };
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function buildAudioTranscriptionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  if (trimmed.endsWith('/audio/transcriptions')) return trimmed;
  if (trimmed.endsWith('/v1')) return `${trimmed}/audio/transcriptions`;
  return `${trimmed}/v1/audio/transcriptions`;
}

function fileNameForMimeType(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'recording.m4a';
  if (mimeType.includes('mpeg')) return 'recording.mp3';
  if (mimeType.includes('wav')) return 'recording.wav';
  if (mimeType.includes('ogg')) return 'recording.ogg';
  return 'recording.webm';
}
