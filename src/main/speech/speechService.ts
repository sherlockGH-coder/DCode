import { settingsManager } from '../settings';
import { OpenAITranscriptionProvider } from './openaiTranscriptionProvider';
import type { SpeechToTextProvider, SpeechTranscribeOutput } from './types';

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
]);

export async function transcribeSpeech(
  audioBuffer: ArrayBuffer | Uint8Array,
  mimeType: string,
): Promise<SpeechTranscribeOutput> {
  const audio = normalizeAudioBuffer(audioBuffer);
  const normalizedMimeType = normalizeMimeType(mimeType);

  if (audio.byteLength === 0) {
    throw new Error('The recording is empty');
  }
  if (audio.byteLength > MAX_AUDIO_BYTES) {
    throw new Error('The recording file is too large. Shorten the recording and try again.');
  }
  if (!SUPPORTED_MIME_TYPES.has(normalizedMimeType)) {
    throw new Error(`Unsupported recording format: ${mimeType || 'unknown'}`);
  }
  const provider = createProvider();

  return provider.transcribe({
    audio,
    mimeType: normalizedMimeType,
    language: settingsManager.getSpeechLanguage() || undefined,
  });
}

function createProvider(): SpeechToTextProvider {
  const baseUrl = settingsManager.getSpeechBaseUrl();
  const apiKey = settingsManager.getSpeechApiKey();
  if (!apiKey && !isLoopbackBaseUrl(baseUrl)) {
    throw new Error('Voice input requires a separate Speech API key to be configured first');
  }

  return new OpenAITranscriptionProvider({
    apiKey,
    baseUrl,
    model: settingsManager.getSpeechModel(),
  });
}

function normalizeAudioBuffer(audioBuffer: ArrayBuffer | Uint8Array): Uint8Array {
  if (audioBuffer instanceof Uint8Array) {
    return new Uint8Array(audioBuffer);
  }
  return new Uint8Array(audioBuffer);
}

function normalizeMimeType(mimeType: string): string {
  const trimmed = mimeType.trim().toLowerCase();
  if (trimmed.startsWith('audio/webm')) return trimmed.includes('opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
  if (trimmed.startsWith('audio/mp4')) return 'audio/mp4';
  if (trimmed.startsWith('audio/mpeg')) return 'audio/mpeg';
  if (trimmed.startsWith('audio/wav')) return 'audio/wav';
  if (trimmed.startsWith('audio/ogg')) return 'audio/ogg';
  return trimmed;
}

function isLoopbackBaseUrl(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);
    return url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
  } catch {
    return false;
  }
}
